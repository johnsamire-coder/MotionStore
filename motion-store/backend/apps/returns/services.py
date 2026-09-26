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

@transaction.atomic
def process_sales_return_v2(invoice_id, shift_id, cashier, items: list, refund_method_id=None, refund_to_credit: bool = False, reason: str = None) -> SalesReturn:
    """ Return from a specific invoice: blocks over-returns, refunds what was actually paid (after discounts/offers), sends goods back to this shop, refunds by the chosen method or to the customer account """
    from django.db.models import Sum
    from apps.inventory.models import StockItem
    from apps.payments.models import PaymentMethod
    from apps.customers.models import Customer
    invoice = SaleInvoice.objects.select_for_update().get(pk=invoice_id)
    shift = Shift.objects.select_for_update().get(pk=shift_id)
    if shift.status != ShiftStatus.OPEN:
        raise ValidationError('الوردية مقفولة، افتح وردية الأول')
    tenant = invoice.tenant
    terminal = shift.terminal
    now = timezone.now()
    seq = SalesReturn.objects.filter(tenant=tenant, return_date_time__date=now.date()).count() + 1
    return_number = f"RET-{terminal.code}-{now.strftime('%Y%m%d')}-{seq:04d}"
    sub = invoice.subtotal or Decimal('0')
    ratio = ((sub - (invoice.discount_amount or Decimal('0'))) / sub) if sub > 0 else Decimal('1')
    ratio = max(Decimal('0'), min(Decimal('1'), ratio))
    total_refund = Decimal('0.00')
    total_cogs = Decimal('0.00')
    lines = []
    for it in items:
        sl = invoice.lines.select_related('stock_item', 'product').get(pk=it['sale_line_id'])
        name = sl.display_name or sl.product.name
        prev = SalesReturnLineItem.objects.filter(original_sale_line=sl, sales_return__status=ReturnStatus.COMPLETED).aggregate(w=Sum('weight_kg'), p=Sum('quantity_pieces'))
        prev_w = prev['w'] or Decimal('0')
        prev_p = prev['p'] or 0
        piece_mode = bool(sl.quantity_pieces) and sl.quantity_pieces > 0 and abs(sl.subtotal - Decimal(sl.quantity_pieces) * sl.unit_price) < Decimal('0.02')
        if piece_mode:
            rp = int(it.get('quantity_pieces') or 0)
            if rp <= 0:
                continue
            left = sl.quantity_pieces - prev_p
            if rp > left:
                raise ValidationError(f'{name}: الكمية المرتجعة أكبر من الباقي ({left} قطعة)')
            frac = Decimal(rp) / Decimal(sl.quantity_pieces)
            rw = (sl.weight_kg * frac).quantize(Decimal('0.001'))
        else:
            rw = Decimal(str(it.get('weight_kg') or '0'))
            if rw <= 0:
                continue
            left_w = sl.weight_kg - prev_w
            if rw > left_w + Decimal('0.0005'):
                raise ValidationError(f'{name}: الوزن المرتجع أكبر من الباقي ({left_w} كجم)')
            frac = (rw / sl.weight_kg) if sl.weight_kg > 0 else Decimal('0')
            rp = int(it.get('quantity_pieces') or 0)
            if rp <= 0 and sl.quantity_pieces:
                rp = int(round(float(sl.quantity_pieces) * float(frac)))
            rp = max(0, min(rp, (sl.quantity_pieces or 0) - prev_p))
        refund = (sl.total_price * frac * ratio).quantize(Decimal('0.01'))
        cogs = (rw * sl.unit_cost).quantize(Decimal('0.01'))
        target = sl.stock_item
        shop = terminal.default_warehouse
        if shop and target.warehouse_id != shop.id:
            target, _ = StockItem.objects.get_or_create(tenant=tenant, product=sl.product, grade=sl.grade, warehouse=shop, source_lot=sl.stock_item.source_lot,
                defaults={'avg_cost_per_kg': sl.unit_cost, 'total_weight_kg': Decimal('0.000'), 'total_quantity_pieces': 0, 'current_total_value': Decimal('0.00')})
        record_inventory_transaction(stock_item=target, transaction_type=TransactionType.RETURN_IN, weight_change_kg=rw, quantity_change_pieces=rp, unit_cost=sl.unit_cost,
                                     source_document_type='SalesReturn', source_document_id=return_number, notes=f"Return #{return_number} from Inv #{invoice.invoice_number}")
        lines.append({'original_sale_line': sl, 'stock_item': target, 'product': sl.product, 'grade': sl.grade, 'weight_kg': rw, 'quantity_pieces': rp,
                      'refund_unit_price': sl.unit_price, 'refund_total_price': refund, 'unit_cost': sl.unit_cost, 'total_cogs_reversed': cogs})
        total_refund += refund
        total_cogs += cogs
    if not lines:
        raise ValidationError('اختار صنف واحد على الأقل وكمية ترجّعها')
    customer = invoice.customer
    pm = None
    if refund_to_credit:
        if not customer:
            raise ValidationError('الفاتورة دي مالهاش عميل عشان نخصم من حسابه')
        cu = Customer.objects.select_for_update().get(pk=customer.pk)
        cu.credit_balance -= total_refund
        cu.save(update_fields=['credit_balance'])
    else:
        if refund_method_id:
            pm = PaymentMethod.objects.filter(tenant=tenant, pk=refund_method_id).first()
        else:
            pm = PaymentMethod.objects.filter(tenant=tenant, method_type='CASH').first()
        if not pm or pm.method_type == 'CREDIT':
            raise ValidationError('اختار طريقة رد الفلوس')
        target_t = pm.treasury or terminal.cash_drawer
        record_treasury_transaction(treasury_id=target_t.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=total_refund, payment_method=pm,
                                    source_document_type='SalesReturn', source_document_id=return_number, description=f"رد فلوس مرتجع {return_number}")
    sr = SalesReturn.objects.create(tenant=tenant, return_number=return_number, original_sale_invoice=invoice, shift=shift, cashier=cashier, return_date_time=now,
                                    total_refund_amount=total_refund, total_cogs_reversed=total_cogs, status=ReturnStatus.COMPLETED, reason=reason,
                                    refund_method=pm, refund_to_credit=refund_to_credit, customer=customer)
    for l in lines:
        SalesReturnLineItem.objects.create(tenant=tenant, sales_return=sr, **l)
    jv = [
        {'account_code': '4010', 'debit': total_refund, 'credit': Decimal('0.00'), 'desc': f'Sales Revenue Reversal Ret #{return_number}'},
        {'account_code': '1050' if refund_to_credit else '1030', 'debit': Decimal('0.00'), 'credit': total_refund, 'desc': f'Refund Ret #{return_number}'},
    ]
    if total_cogs > 0:
        jv.append({'account_code': '1020', 'debit': total_cogs, 'credit': Decimal('0.00'), 'desc': f'Inventory Restored Ret #{return_number}'})
        jv.append({'account_code': '5010', 'debit': Decimal('0.00'), 'credit': total_cogs, 'desc': f'COGS Reversal Ret #{return_number}'})
    if total_refund > 0:
        create_balanced_journal_entry(tenant=tenant, entry_number=f"JV-RET-{return_number}", entry_date=now.date(), source_document_type='SalesReturn',
                                      source_document_id=str(sr.id), notes=f"Sales Return #{return_number}", lines_data=jv)
    return sr
