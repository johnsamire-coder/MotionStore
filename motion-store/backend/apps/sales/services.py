from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.sales.models import SaleInvoice, SaleLineItem, SalePayment, SaleStatus
from apps.shifts.models import Shift, ShiftStatus
from apps.inventory.models import StockItem, TransactionType
from apps.inventory.services import record_inventory_transaction
from apps.treasury.models import TreasuryTransactionType
from apps.treasury.services import record_treasury_transaction
from apps.accounting.services import create_balanced_journal_entry

def _find_stock_for_piece(piece, terminal, qty):
    """ Picks the shop stock matching the piece (source kind, category, grade, brand) with the most pieces """
    qs = StockItem.objects.select_related('source_lot__purchase_line_item', 'product').filter(
        tenant=piece.tenant, total_quantity_pieces__gte=qty, total_weight_kg__gt=0)
    if terminal.default_warehouse_id:
        qs = qs.filter(warehouse_id=terminal.default_warehouse_id)
    best = None
    for si in qs:
        li = getattr(si.source_lot, 'purchase_line_item', None) if si.source_lot_id else None
        if not li or li.purchase_kind != piece.source_kind:
            continue
        if piece.segment and li.segment and li.segment != piece.segment:
            continue
        if piece.source_kind == 'BALE' and piece.purchase_grade and li.grade != piece.purchase_grade:
            continue
        if piece.source_kind == 'STOCK' and piece.brand and li.brand != piece.brand:
            continue
        if best is None or si.total_quantity_pieces > best.total_quantity_pieces:
            best = si
    if not best:
        raise ValidationError(f"مفيش رصيد في المحل للقطعة {piece.code} - {piece.name} {piece.segment or ''}".strip())
    return StockItem.objects.select_for_update().get(pk=best.pk)


@transaction.atomic
def process_pos_sale(
    shift_id,
    cashier,
    items_data: list,
    payments_data: list,
    discount_amount: Decimal = Decimal('0.00'),
    delivery_fee: Decimal = Decimal('0.00'),
    previous_balance: Decimal = Decimal('0.00'),
    customer = None,
    notes: str = None,
    coupon_code: str = None,
    applied_offers: list = None,
    allowed_warehouse_id=None
) -> SaleInvoice:
    """
    Central POS Sale Engine:
    Decrements stock, calculates COGS & Margins, collects cash into Treasury drawer, updates Shift, and posts Double-Entry Journal Entry.
    """
    shift = Shift.objects.select_for_update().get(pk=shift_id)
    if shift.status != ShiftStatus.OPEN:
        raise ValidationError(f"Cannot sell on shift #{shift.shift_code}. Shift is {shift.get_status_display()}.")

    tenant = shift.tenant
    terminal = shift.terminal
    now = timezone.now()

    # 1. Generate Invoice #
    date_str = now.strftime('%Y%m%d')
    seq = SaleInvoice.objects.filter(tenant=tenant, invoice_date_time__date=now.date()).count() + 1
    invoice_number = f"INV-{terminal.code}-{date_str}-{seq:04d}"

    # 2. Compute Lines, Stock Decrements & COGS
    subtotal = Decimal('0.00')
    total_cogs = Decimal('0.00')
    line_objects = []

    for item_data in items_data:
        piece = None
        price_mode = item_data.get('price_mode') or 'KG'
        qty_pieces = int(item_data.get('quantity_pieces', 0) or 0)
        unit_price = Decimal(str(item_data['unit_price']))
        if item_data.get('piece_item_id'):
            from apps.pricing.models import PieceItem
            piece = PieceItem.objects.get(pk=item_data['piece_item_id'], tenant=tenant)
            if qty_pieces < 1:
                qty_pieces = 1
            stock_item = _find_stock_for_piece(piece, terminal, qty_pieces)
            given_w = Decimal(str(item_data.get('weight_kg') or '0'))
            if given_w > 0:
                weight_kg = given_w
            else:
                per = (stock_item.total_weight_kg / stock_item.total_quantity_pieces) if stock_item.total_quantity_pieces else Decimal('0')
                weight_kg = (per * qty_pieces).quantize(Decimal('0.001'))
        else:
            stock_item = StockItem.objects.select_for_update().get(pk=item_data['stock_item_id'])
            weight_kg = Decimal(str(item_data['weight_kg']))
        if terminal.default_warehouse_id and stock_item.warehouse_id not in (terminal.default_warehouse_id, allowed_warehouse_id):
            raise ValidationError(f"الصنف {stock_item.product.name} مش موجود في رصيد المحل ده")

        # Stock availability check
        if stock_item.total_weight_kg < weight_kg:
            raise ValidationError(
                f"Insufficient stock for {stock_item.product.name} [{stock_item.get_grade_display()}]. Available: {stock_item.total_weight_kg} KG, Requested: {weight_kg} KG."
            )

        line_subtotal = ((Decimal(qty_pieces) * unit_price) if price_mode == 'PIECE' else (weight_kg * unit_price)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        line_discount = Decimal(str(item_data.get('discount_amount', '0.00')))
        line_total_revenue = line_subtotal - line_discount
        
        # Unit Cost & COGS
        line_unit_cost = stock_item.avg_cost_per_kg
        line_total_cost = (weight_kg * line_unit_cost).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        line_gross_profit = line_total_revenue - line_total_cost

        subtotal += line_subtotal
        total_cogs += line_total_cost

        # Record Inventory Ledger Decrement (SALE)
        record_inventory_transaction(
            stock_item=stock_item,
            transaction_type=TransactionType.SALE,
            weight_change_kg=-weight_kg,
            quantity_change_pieces=-qty_pieces,
            unit_cost=line_unit_cost,
            source_document_type='SaleInvoice',
            source_document_id=invoice_number,
            notes=f"Sale #{invoice_number}"
        )

        line_objects.append({
            'stock_item': stock_item,
            'product': stock_item.product,
            'grade': stock_item.grade,
            'weight_kg': weight_kg,
            'quantity_pieces': qty_pieces,
            'unit_price': unit_price,
            'subtotal': line_subtotal,
            'discount_amount': line_discount,
            'total_price': line_total_revenue,
            'unit_cost': line_unit_cost,
            'total_cost': line_total_cost,
            'gross_profit': line_gross_profit,
            'display_name': item_data.get('display_name') or None,
            'piece_item': piece,
            'bundle_label': item_data.get('bundle_label') or None,
            'offer_label': item_data.get('offer_label') or None
        })

    total_amount = subtotal - discount_amount + delivery_fee
    gross_profit = total_amount - total_cogs

    # 3. Create Sale Invoice Record
    invoice = SaleInvoice.objects.create(
        tenant=tenant,
        invoice_number=invoice_number,
        branch=terminal.branch,
        pos_terminal=terminal,
        shift=shift,
        cashier=cashier,
        customer=customer,
        invoice_date_time=now,
        status=SaleStatus.COMPLETED,
        subtotal=subtotal,
        discount_amount=discount_amount,
        delivery_fee=delivery_fee,
        previous_balance=previous_balance,
        total_amount=total_amount,
        total_cogs=total_cogs,
        gross_profit=gross_profit,
        notes=notes,
        coupon_code=coupon_code or None,
        applied_offers=applied_offers or []
    )

    # 4. Save Line Items
    for l_data in line_objects:
        SaleLineItem.objects.create(
            tenant=tenant,
            sale_invoice=invoice,
            **l_data
        )

    # 5. Process Payments & Treasury Receipts
    cash_collected = Decimal('0.00')
    credit_total = Decimal('0.00')
    for p_data in payments_data:
        from apps.payments.models import PaymentMethod
        pm = p_data.get('payment_method')
        if not isinstance(pm, PaymentMethod):
            pm_id = p_data.get('payment_method_id') or pm
            pm = PaymentMethod.objects.get(pk=pm_id, tenant=tenant)
        p_amount = Decimal(str(p_data['amount']))
        if pm.method_type == 'CREDIT':
            if not customer:
                raise ValidationError('البيع على الحساب محتاج اسم العميل وتليفونه')
            from apps.customers.models import Customer as _Cu
            cu = _Cu.objects.select_for_update().get(pk=customer.pk)
            if cu.credit_limit and cu.credit_limit > 0 and (cu.credit_balance + p_amount) > cu.credit_limit:
                raise ValidationError(f'العميل {cu.name} هيعدّي حد الدين المسموح ({cu.credit_limit} ج.م)')
            cu.credit_balance += p_amount
            cu.save(update_fields=['credit_balance'])
            credit_total += p_amount
            SalePayment.objects.create(tenant=tenant, sale_invoice=invoice, payment_method=pm, amount=p_amount, reference_number=p_data.get('reference_number'))
            continue

        SalePayment.objects.create(
            tenant=tenant,
            sale_invoice=invoice,
            payment_method=pm,
            amount=p_amount,
            reference_number=p_data.get('reference_number')
        )

        # Deposit to target treasury (drawer or bank)
        target_treasury = pm.treasury or terminal.cash_drawer
        record_treasury_transaction(
            treasury_id=target_treasury.id,
            transaction_type=TreasuryTransactionType.DEPOSIT,
            amount=p_amount,
            payment_method=pm,
            source_document_type='SaleInvoice',
            source_document_id=invoice_number,
            description=f"Sales receipt from Invoice #{invoice_number}"
        )

        if pm.method_type == 'CASH':
            cash_collected += p_amount

    # 6. Update Shift Cash Accumulator
    if cash_collected > 0:
        shift.cash_sales_total += cash_collected
        shift.save()

    # 7. Post Double-Entry Accounting Journal Entry
    # Dr. 1030 (Cash on Hand) 6,250 | Cr. 4010 (Sales Revenue) 6,250
    # Dr. 5010 (COGS) 3,676.47      | Cr. 1020 (Finished Goods) 3,676.47
    jv_lines = [
        {'account_code': '1030', 'debit': total_amount, 'credit': Decimal('0.00'), 'desc': f'Cash Collection Inv #{invoice_number}'},
        {'account_code': '4010', 'debit': Decimal('0.00'), 'credit': total_amount, 'desc': f'Sales Revenue Inv #{invoice_number}'},
        {'account_code': '5010', 'debit': total_cogs, 'credit': Decimal('0.00'), 'desc': f'COGS Inv #{invoice_number}'},
        {'account_code': '1020', 'debit': Decimal('0.00'), 'credit': total_cogs, 'desc': f'Inventory Relief Inv #{invoice_number}'},
    ]

    if credit_total > 0:
        jv_lines[0]['debit'] = total_amount - credit_total
        jv_lines.insert(1, {'account_code': '1050', 'debit': credit_total, 'credit': Decimal('0.00'), 'desc': f'Customer Credit Inv #{invoice_number}'})
        if jv_lines[0]['debit'] <= 0:
            jv_lines.pop(0)
    create_balanced_journal_entry(
        tenant=tenant,
        entry_number=f"JV-SALE-{invoice_number}",
        entry_date=now.date(),
        source_document_type='SaleInvoice',
        source_document_id=str(invoice.id),
        notes=f"POS Sale Invoice #{invoice_number}",
        lines_data=jv_lines
    )

    # 8. Offers usage counters & coupon redemption
    if applied_offers:
        from apps.discounts.models import Offer
        for ao in applied_offers:
            o = Offer.objects.filter(tenant=tenant, pk=ao.get('id')).first()
            if o:
                o.usage_count += 1
                o.total_sales += total_amount
                o.total_discount += Decimal(str(ao.get('discount') or '0'))
                o.save(update_fields=['usage_count', 'total_sales', 'total_discount'])
    if coupon_code:
        from apps.api.views import redeem_coupon
        coupon_disc = sum((Decimal(str(a.get('discount') or '0')) for a in (applied_offers or []) if a.get('coupon')), Decimal('0.00'))
        redeem_coupon(tenant, coupon_code, invoice_number, cashier, coupon_disc)

    return invoice
