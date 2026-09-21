from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.returns.models import SalesReturn, SalesReturnLineItem, ReturnStatus
from apps.sales.models import SaleInvoice
from apps.shifts.models import Shift, ShiftStatus
from apps.inventory.models import TransactionType
from apps.inventory.services import record_inventory_transaction
from apps.treasury.models import TreasuryTransactionType
from apps.treasury.services import record_treasury_transaction
from apps.accounting.services import create_balanced_journal_entry

@transaction.atomic
def process_sales_return(
    original_invoice_id,
    shift_id,
    cashier,
    return_items_data: list,
    reason: str = None
) -> SalesReturn:
    """
    Sales Return Engine:
    Restores stock at original cost (RETURN_IN), refunds customer from drawer, and posts reversal Journal Entry.
    """
    invoice = SaleInvoice.objects.get(pk=original_invoice_id)
    shift = Shift.objects.select_for_update().get(pk=shift_id)

    if shift.status != ShiftStatus.OPEN:
        raise ValidationError(f"Cannot process return on closed shift #{shift.shift_code}.")

    tenant = invoice.tenant
    terminal = shift.terminal
    now = timezone.now()

    date_str = now.strftime('%Y%m%d')
    seq = SalesReturn.objects.filter(tenant=tenant, return_date_time__date=now.date()).count() + 1
    return_number = f"RET-{terminal.code}-{date_str}-{seq:04d}"

    total_refund = Decimal('0.00')
    total_cogs_reversed = Decimal('0.00')
    line_objects = []

    for ret_data in return_items_data:
        sale_line = invoice.lines.get(pk=ret_data['sale_line_id'])
        ret_weight = Decimal(str(ret_data['weight_kg']))
        ret_pieces = int(ret_data.get('quantity_pieces', 0))

        if ret_weight > sale_line.weight_kg:
            raise ValidationError(f"Returned weight ({ret_weight} KG) exceeds original sold weight ({sale_line.weight_kg} KG).")

        refund_total = (ret_weight * sale_line.unit_price)
        cogs_reversed = (ret_weight * sale_line.unit_cost)

        total_refund += refund_total
        total_cogs_reversed += cogs_reversed

        # 1. Restore Inventory (RETURN_IN)
        record_inventory_transaction(
            stock_item=sale_line.stock_item,
            transaction_type=TransactionType.RETURN_IN,
            weight_change_kg=ret_weight,
            quantity_change_pieces=ret_pieces,
            unit_cost=sale_line.unit_cost,
            source_document_type='SalesReturn',
            source_document_id=return_number,
            notes=f"Return #{return_number} from Inv #{invoice.invoice_number}"
        )

        line_objects.append({
            'original_sale_line': sale_line,
            'stock_item': sale_line.stock_item,
            'product': sale_line.product,
            'grade': sale_line.grade,
            'weight_kg': ret_weight,
            'quantity_pieces': ret_pieces,
            'refund_unit_price': sale_line.unit_price,
            'refund_total_price': refund_total,
            'unit_cost': sale_line.unit_cost,
            'total_cogs_reversed': cogs_reversed
        })

    # 2. Create Master Return
    sales_return = SalesReturn.objects.create(
        tenant=tenant,
        return_number=return_number,
        original_sale_invoice=invoice,
        shift=shift,
        cashier=cashier,
        return_date_time=now,
        total_refund_amount=total_refund,
        total_cogs_reversed=total_cogs_reversed,
        status=ReturnStatus.COMPLETED,
        reason=reason
    )

    # 3. Create Return Lines
    for l_data in line_objects:
        SalesReturnLineItem.objects.create(
            tenant=tenant,
            sales_return=sales_return,
            **l_data
        )

    # 4. Cash Drawer Refund
    record_treasury_transaction(
        treasury_id=terminal.cash_drawer_id,
        transaction_type=TreasuryTransactionType.WITHDRAWAL,
        amount=total_refund,
        source_document_type='SalesReturn',
        source_document_id=return_number,
        description=f"Cash refund for Return #{return_number}"
    )

    # 5. Reverse Double-Entry Journal Entry
    # Dr. 4010 (Sales Revenue) Total Refund | Cr. 1030 (Cash on Hand) Total Refund
    # Dr. 1020 (Finished Goods) Reversal COGS | Cr. 5010 (COGS) Reversal COGS
    jv_lines = [
        {'account_code': '4010', 'debit': total_refund, 'credit': Decimal('0.00'), 'desc': f'Sales Revenue Reversal Ret #{return_number}'},
        {'account_code': '1030', 'debit': Decimal('0.00'), 'credit': total_refund, 'desc': f'Cash Refund Ret #{return_number}'},
        {'account_code': '1020', 'debit': total_cogs_reversed, 'credit': Decimal('0.00'), 'desc': f'Inventory Restored Ret #{return_number}'},
        {'account_code': '5010', 'debit': Decimal('0.00'), 'credit': total_cogs_reversed, 'desc': f'COGS Reversal Ret #{return_number}'},
    ]

    create_balanced_journal_entry(
        tenant=tenant,
        entry_number=f"JV-RET-{return_number}",
        entry_date=now.date(),
        source_document_type='SalesReturn',
        source_document_id=str(sales_return.id),
        notes=f"Sales Return #{return_number}",
        lines_data=jv_lines
    )

    return sales_return
