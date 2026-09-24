from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.transfers.models import TransferOrder, TransferLineItem, TransferStatus
from apps.inventory.models import StockItem, TransactionType
from apps.inventory.services import record_inventory_transaction

@transaction.atomic
def create_transfer_order(tenant, source_warehouse, destination_warehouse, requested_by, items_data: list, notes: str = None) -> TransferOrder:
    """ Creates a new transfer order draft """
    if source_warehouse.id == destination_warehouse.id:
        raise ValidationError("Source and destination warehouses cannot be the same.")

    now = timezone.now()
    date_str = now.strftime('%Y%m%d')
    seq = TransferOrder.objects.filter(tenant=tenant, transfer_date=now.date()).count() + 1
    transfer_code = f"TRF-{date_str}-{seq:03d}"

    transfer = TransferOrder.objects.create(
        tenant=tenant,
        transfer_code=transfer_code,
        source_warehouse=source_warehouse,
        destination_warehouse=destination_warehouse,
        requested_by=requested_by,
        transfer_date=now.date(),
        status=TransferStatus.DRAFT,
        notes=notes
    )

    total_weight = Decimal('0.000')
    total_cost = Decimal('0.00')

    for item in items_data:
        stock_item = StockItem.objects.get(pk=item['stock_item_id'])
        weight = Decimal(str(item['weight_kg']))
        qty = int(item.get('quantity_pieces', 0))
        cost = stock_item.avg_cost_per_kg
        line_total_cost = weight * cost

        total_weight += weight
        total_cost += line_total_cost

        TransferLineItem.objects.create(
            tenant=tenant,
            transfer_order=transfer,
            stock_item=stock_item,
            product=stock_item.product,
            grade=stock_item.grade,
            weight_kg=weight,
            quantity_pieces=qty,
            unit_cost=cost,
            total_cost=line_total_cost
        )

    transfer.total_weight_kg = total_weight
    transfer.total_cost_value = total_cost
    transfer.save()
    return transfer


@transaction.atomic
def ship_transfer_order(transfer_order_id) -> TransferOrder:
    """ Ships transfer order: decrements source warehouse stock with TRANSFER_OUT """
    transfer = TransferOrder.objects.select_for_update().get(pk=transfer_order_id)
    if transfer.status != TransferStatus.DRAFT:
        raise ValidationError(f"Transfer #{transfer.transfer_code} is not in Draft state.")

    for line in transfer.lines.all():
        stock_item = StockItem.objects.select_for_update().get(pk=line.stock_item_id)
        if stock_item.total_weight_kg < line.weight_kg:
            raise ValidationError(f"Insufficient stock in {transfer.source_warehouse.name} for {stock_item.product.name}.")

        record_inventory_transaction(
            stock_item=stock_item,
            transaction_type=TransactionType.TRANSFER_OUT,
            weight_change_kg=-line.weight_kg,
            quantity_change_pieces=-line.quantity_pieces,
            unit_cost=line.unit_cost,
            source_document_type='TransferOrder',
            source_document_id=transfer.transfer_code,
            notes=f"Shipped to {transfer.destination_warehouse.name}"
        )

    transfer.status = TransferStatus.SHIPPED
    transfer.shipped_at = timezone.now()
    transfer.save()
    return transfer


@transaction.atomic
def receive_transfer_order(transfer_order_id) -> TransferOrder:
    """ Receives transfer order: increments destination warehouse stock with TRANSFER_IN """
    transfer = TransferOrder.objects.select_for_update().get(pk=transfer_order_id)
    if transfer.status != TransferStatus.SHIPPED:
        raise ValidationError(f"Transfer #{transfer.transfer_code} must be SHIPPED before receiving.")

    for line in transfer.lines.all():
        dest_stock_item, _ = StockItem.objects.get_or_create(
            tenant=transfer.tenant,
            product=line.product,
            grade=line.grade,
            warehouse=transfer.destination_warehouse,
            source_lot=line.stock_item.source_lot,
            defaults={
                'avg_cost_per_kg': line.unit_cost,
                'total_weight_kg': Decimal('0.000'),
                'total_quantity_pieces': 0,
                'current_total_value': Decimal('0.00')
            }
        )

        record_inventory_transaction(
            stock_item=dest_stock_item,
            transaction_type=TransactionType.TRANSFER_IN,
            weight_change_kg=line.weight_kg,
            quantity_change_pieces=line.quantity_pieces,
            unit_cost=line.unit_cost,
            source_document_type='TransferOrder',
            source_document_id=transfer.transfer_code,
            notes=f"Received from {transfer.source_warehouse.name}"
        )

    transfer.status = TransferStatus.RECEIVED
    transfer.received_at = timezone.now()
    transfer.save()
    return transfer
