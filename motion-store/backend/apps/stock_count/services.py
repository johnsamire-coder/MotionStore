from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.stock_count.models import StockCountSession, StockCountLineItem, StockCountStatus
from apps.inventory.models import StockItem, TransactionType
from apps.inventory.services import record_inventory_transaction
from apps.accounting.services import create_balanced_journal_entry

@transaction.atomic
def create_stock_count_session(tenant, warehouse, counted_by, count_items: list, notes: str = None) -> StockCountSession:
    """
    Creates and audits a physical stock count session, calculating weight & cost differences.
    """
    now = timezone.now()
    date_str = now.strftime('%Y%m%d')
    seq = StockCountSession.objects.filter(tenant=tenant, count_date=now.date()).count() + 1
    session_code = f"CNT-{warehouse.name[:3].upper()}-{date_str}-{seq:03d}"

    session = StockCountSession.objects.create(
        tenant=tenant,
        session_code=session_code,
        warehouse=warehouse,
        counted_by=counted_by,
        count_date=now.date(),
        status=StockCountStatus.COMPLETED,
        notes=notes
    )

    total_weight_diff = Decimal('0.000')
    total_cost_adj = Decimal('0.00')

    for item in count_items:
        stock_item = StockItem.objects.get(pk=item['stock_item_id'])
        counted_wt = Decimal(str(item['counted_weight_kg']))
        counted_qty = int(item.get('counted_quantity_pieces', stock_item.total_quantity_pieces))

        weight_diff = counted_wt - stock_item.total_weight_kg
        qty_diff = counted_qty - stock_item.total_quantity_pieces
        cost_adj = weight_diff * stock_item.avg_cost_per_kg

        total_weight_diff += weight_diff
        total_cost_adj += cost_adj

        StockCountLineItem.objects.create(
            tenant=tenant,
            session=session,
            stock_item=stock_item,
            product=stock_item.product,
            grade=stock_item.grade,
            system_weight_kg=stock_item.total_weight_kg,
            counted_weight_kg=counted_wt,
            weight_difference_kg=weight_diff,
            system_quantity_pieces=stock_item.total_quantity_pieces,
            counted_quantity_pieces=counted_qty,
            quantity_difference_pieces=qty_diff,
            unit_cost=stock_item.avg_cost_per_kg,
            total_adjustment_cost=cost_adj
        )

    session.total_weight_difference = total_weight_diff
    session.total_cost_adjustment = total_cost_adj
    session.save()
    return session


@transaction.atomic
def apply_approved_stock_adjustment(session_id) -> StockCountSession:
    """
    Applies approved stock count adjustments to Inventory Ledger and posts Double-Entry Journal Entry.
    """
    session = StockCountSession.objects.select_for_update().get(pk=session_id)
    if session.status != StockCountStatus.COMPLETED:
        raise ValidationError(f"Session #{session.session_code} is already applied or invalid.")

    tenant = session.tenant
    now = timezone.now()

    for line in session.lines.all():
        if line.weight_difference_kg == Decimal('0.000'):
            continue

        txn_type = TransactionType.ADJUSTMENT_PLUS if line.weight_difference_kg > 0 else TransactionType.ADJUSTMENT_MINUS
        stock_item = StockItem.objects.select_for_update().get(pk=line.stock_item_id)

        record_inventory_transaction(
            stock_item=stock_item,
            transaction_type=txn_type,
            weight_change_kg=line.weight_difference_kg,
            quantity_change_pieces=line.quantity_difference_pieces,
            unit_cost=line.unit_cost,
            source_document_type='StockCountSession',
            source_document_id=session.session_code,
            notes=f"Physical Count Adjustment #{session.session_code}"
        )

    # Post Accounting Journal Entry for the total financial discrepancy
    # If Deficit (Cost adj < 0): Dr. 5030 (Inventory Adjustment Loss) | Cr. 1020 (Finished Goods)
    # If Surplus (Cost adj > 0): Dr. 1020 (Finished Goods) | Cr. 3010 (Retained Earnings / Gain)
    if session.total_cost_adjustment != Decimal('0.00'):
        adj_val = abs(session.total_cost_adjustment)
        if session.total_cost_adjustment < 0:
            jv_lines = [
                {'account_code': '5030', 'debit': adj_val, 'credit': Decimal('0.00'), 'desc': f'Inventory Shortage Count #{session.session_code}'},
                {'account_code': '1020', 'debit': Decimal('0.00'), 'credit': adj_val, 'desc': f'Inventory Relief Count #{session.session_code}'},
            ]
        else:
            jv_lines = [
                {'account_code': '1020', 'debit': adj_val, 'credit': Decimal('0.00'), 'desc': f'Inventory Surplus Count #{session.session_code}'},
                {'account_code': '3010', 'debit': Decimal('0.00'), 'credit': adj_val, 'desc': f'Inventory Gain Count #{session.session_code}'},
            ]

        create_balanced_journal_entry(
            tenant=tenant,
            entry_number=f"JV-CNT-{session.session_code}",
            entry_date=now.date(),
            source_document_type='StockCountSession',
            source_document_id=str(session.id),
            notes=f"Stock Audit Adjustment #{session.session_code}",
            lines_data=jv_lines
        )

    session.status = StockCountStatus.APPLIED
    session.save()
    return session
