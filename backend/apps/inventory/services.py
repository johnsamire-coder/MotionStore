from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.sorting.models import SortingOrder, SortingStatus
from apps.inventory.models import StockItem, InventoryTransaction, TransactionType
from apps.waste.models import WasteRecord, WasteDisposalStatus

@transaction.atomic
def record_inventory_transaction(
    stock_item: StockItem,
    transaction_type: str,
    weight_change_kg: Decimal,
    quantity_change_pieces: int,
    unit_cost: Decimal,
    source_document_type: str,
    source_document_id: str,
    notes: str = None
) -> InventoryTransaction:
    """
    Central Ledger Writer:
    Creates an immutable transaction and safely updates cumulative StockItem balance.
    """
    total_cost_change = weight_change_kg * unit_cost

    # Update StockItem Balance
    stock_item.total_weight_kg += weight_change_kg
    stock_item.total_quantity_pieces += quantity_change_pieces
    
    if stock_item.total_weight_kg > 0:
        stock_item.current_total_value += total_cost_change
        stock_item.avg_cost_per_kg = stock_item.current_total_value / stock_item.total_weight_kg
    else:
        stock_item.current_total_value = Decimal('0.00')
        stock_item.avg_cost_per_kg = unit_cost

    stock_item.save()

    # Create Ledger Entry
    ledger_entry = InventoryTransaction.objects.create(
        tenant=stock_item.tenant,
        transaction_type=transaction_type,
        stock_item=stock_item,
        product=stock_item.product,
        grade=stock_item.grade,
        warehouse=stock_item.warehouse,
        weight_change_kg=weight_change_kg,
        quantity_change_pieces=quantity_change_pieces,
        unit_cost=unit_cost,
        total_cost_change=total_cost_change,
        source_document_type=source_document_type,
        source_document_id=str(source_document_id),
        running_weight_balance=stock_item.total_weight_kg,
        notes=notes
    )

    return ledger_entry


@transaction.atomic
def post_sorting_to_inventory(sorting_order_id) -> list:
    """
    Automated Bridge between Sorting & Finished Inventory / Waste:
    Posts calculated good outputs into Stock Items & Ledger (SORT_IN), and records Waste.
    """
    order = SortingOrder.objects.select_related('raw_lot').get(pk=sorting_order_id)

    # 1. Validation check
    existing_entries = InventoryTransaction.objects.filter(
        source_document_type='SortingOrder',
        source_document_id=str(order.id)
    )
    if existing_entries.exists():
        raise ValidationError(f"Sorting Order {order.order_code} has already been posted to inventory.")

    posted_transactions = []

    # 2. Post Good Outputs to Finished Inventory
    for line in order.output_lines.all():
        if not line.cost_per_kg or line.allocated_cost is None:
            raise ValidationError(f"Output line {line.get_grade_display()} has no cost calculated. Run Costing Engine first.")

        # Get or create StockItem for this specific batch / product / grade
        stock_item, _ = StockItem.objects.get_or_create(
            tenant=order.tenant,
            product=line.product,
            grade=line.grade,
            warehouse=line.warehouse,
            source_lot=order.raw_lot,
            defaults={
                'avg_cost_per_kg': line.cost_per_kg,
                'total_weight_kg': Decimal('0.000'),
                'total_quantity_pieces': 0,
                'current_total_value': Decimal('0.00')
            }
        )

        txn = record_inventory_transaction(
            stock_item=stock_item,
            transaction_type=TransactionType.SORT_IN,
            weight_change_kg=line.weight_kg,
            quantity_change_pieces=line.quantity_pieces or 0,
            unit_cost=line.cost_per_kg,
            source_document_type='SortingOrder',
            source_document_id=str(order.id),
            notes=f"Sorting Output #{order.order_code} - Lot {order.raw_lot.lot_code}"
        )
        posted_transactions.append(txn)

    # 3. Post Waste Records to Waste Domain
    for w_line in order.waste_lines.all():
        WasteRecord.objects.create(
            tenant=order.tenant,
            sorting_order=order,
            raw_lot=order.raw_lot,
            warehouse=order.raw_lot.warehouse,
            weight_kg=w_line.weight_kg,
            quantity_pieces=w_line.quantity_pieces,
            classification=w_line.classification,
            reason=w_line.reason,
            allocated_cost=w_line.allocated_cost or Decimal('0.00'),
            disposal_status=WasteDisposalStatus.PENDING
        )

    # 4. Mark Sorting Order as Completed
    order.status = SortingStatus.COMPLETED
    order.save()

    return posted_transactions
