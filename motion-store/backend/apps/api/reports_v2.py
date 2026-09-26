# ================= Reports engine v2 =================
from datetime import date, timedelta, datetime
from collections import defaultdict
from decimal import Decimal
from django.apps import apps as A
from django.db.models import Sum, Count, Max, Min, Q
from django.utils import timezone

M = lambda app, name: A.get_model(app, name)
f = lambda v: float(v or 0)
GR = {'NEW_COLLECTION': 'عالي', 'MIDDLE': 'وسط', 'CLEARANCE': 'تصفيات', 'WASTE': 'هالك'}
KIND = {'BALE': 'بالة', 'STOCK': 'استوك', 'DIRECT': 'شراء مباشر'}
DAYS = ['الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت', 'الحد']


def gv(o, names, default=None):
    for n in names:
        try:
            v = o
            for part in n.split('.'):
                v = getattr(v, part)
                if v is None:
                    break
            if v is not None:
                return v
        except Exception:
            continue
    return default


def rep(title, cols, rows, totals=None, cards=None, note=None):
    return {'title': title, 'columns': [{'key': c[0], 'label': c[1], 'type': c[2] if len(c) > 2 else 'text'} for c in cols], 'rows': rows, 'totals': totals or {}, 'cards': cards or [], 'note': note}


def period(p):
    t = timezone.localdate()
    d1 = p.get('date_from') or str(t.replace(day=1))
    d2 = p.get('date_to') or str(t)
    return d1, d2


def rng(qs, field, p):
    d1, d2 = period(p)
    return qs.filter(**{f'{field}__date__gte': d1, f'{field}__date__lte': d2})


def rngd(qs, field, p):
    d1, d2 = period(p)
    return qs.filter(**{f'{field}__gte': d1, f'{field}__lte': d2})


def invoices(t, p):
    qs = M('sales', 'SaleInvoice').objects.filter(tenant=t)
    qs = rng(qs, 'invoice_date_time', p)
    if p.get('cashier'):
        qs = qs.filter(cashier_id=p['cashier'])
    if p.get('terminal'):
        qs = qs.filter(pos_terminal_id=p['terminal'])
    if p.get('warehouse'):
        qs = qs.filter(pos_terminal__default_warehouse_id=p['warehouse'])
    return qs


def lines(t, p):
    return M('sales', 'SaleLineItem').objects.filter(sale_invoice__in=invoices(t, p)).select_related('stock_item__source_lot__purchase_line_item', 'product', 'sale_invoice')


def linfo(sl):
    li = gv(sl, ['stock_item.source_lot.purchase_line_item'])
    return li


def group_lines(t, p, keyfn, title, klabel):
    agg = defaultdict(lambda: {'pcs': 0, 'kg': 0.0, 'sales': 0.0, 'cost': 0.0, 'n': 0})
    for sl in lines(t, p):
        k = keyfn(sl) or '—'
        a = agg[k]; a['pcs'] += int(sl.quantity_pieces or 0); a['kg'] += f(sl.weight_kg); a['sales'] += f(sl.total_price); a['cost'] += f(sl.total_cost); a['n'] += 1
    rows = [{'k': k, 'n': v['n'], 'pcs': v['pcs'], 'kg': round(v['kg'], 3), 'sales': round(v['sales'], 2), 'cost': round(v['cost'], 2), 'profit': round(v['sales'] - v['cost'], 2),
             'margin': round((v['sales'] - v['cost']) / v['sales'] * 100, 1) if v['sales'] else 0} for k, v in agg.items()]
    rows.sort(key=lambda r: -r['sales'])
    cols = [('k', klabel), ('n', 'سطور', 'number'), ('pcs', 'قطع', 'number'), ('kg', 'كجم', 'kg'), ('sales', 'المبيعات', 'money'), ('cost', 'التكلفة', 'money'), ('profit', 'الربح', 'money'), ('margin', 'هامش %', 'pct')]
    tot = {c: round(sum(r[c] for r in rows), 2) for c in ('n', 'pcs', 'kg', 'sales', 'cost', 'profit')}
    return rep(title, cols, rows, tot)


def group_invoices(t, p, keyfn, title, klabel):
    agg = defaultdict(lambda: {'n': 0, 'total': 0.0, 'disc': 0.0})
    for inv in invoices(t, p).select_related('cashier', 'pos_terminal'):
        a = agg[keyfn(inv) or '—']; a['n'] += 1; a['total'] += f(inv.total_amount); a['disc'] += f(inv.discount_amount)
    rows = [{'k': k, 'n': v['n'], 'total': round(v['total'], 2), 'avg': round(v['total'] / v['n'], 2) if v['n'] else 0, 'disc': round(v['disc'], 2)} for k, v in agg.items()]
    rows.sort(key=lambda r: -r['total'])
    return rep(title, [('k', klabel), ('n', 'فواتير', 'number'), ('total', 'المبيعات', 'money'), ('avg', 'متوسط الفاتورة', 'money'), ('disc', 'الخصومات', 'money')], rows,
               {'n': sum(r['n'] for r in rows), 'total': round(sum(r['total'] for r in rows), 2), 'disc': round(sum(r['disc'] for r in rows), 2)})


# ---------------- SALES ----------------
def sales_daily(t, p):
    r = group_invoices(t, p, lambda i: str(timezone.localtime(i.invoice_date_time).date()), 'المبيعات يوم بيوم', 'اليوم')
    r['rows'].sort(key=lambda x: x['k'])
    inv = invoices(t, p); tot = f(inv.aggregate(s=Sum('total_amount'))['s'])
    r['cards'] = [{'label': 'إجمالي المبيعات', 'value': tot, 'type': 'money'}, {'label': 'عدد الفواتير', 'value': inv.count(), 'type': 'number'}, {'label': 'متوسط الفاتورة', 'value': round(tot / inv.count(), 2) if inv.count() else 0, 'type': 'money'}]
    return r

def sales_by_cashier(t, p): return group_invoices(t, p, lambda i: i.cashier.username if i.cashier_id else None, 'المبيعات حسب الكاشير', 'الكاشير')
def sales_by_terminal(t, p): return group_invoices(t, p, lambda i: f"{i.pos_terminal.name} ({i.pos_terminal.code})" if i.pos_terminal_id else None, 'المبيعات حسب نقطة البيع', 'نقطة البيع')
def sales_by_hour(t, p):
    r = group_invoices(t, p, lambda i: f"{timezone.localtime(i.invoice_date_time).hour:02d}:00", 'المبيعات حسب الساعة (ساعات الزحمة)', 'الساعة'); r['rows'].sort(key=lambda x: x['k']); return r
def sales_by_weekday(t, p): return group_invoices(t, p, lambda i: DAYS[timezone.localtime(i.invoice_date_time).weekday()], 'المبيعات حسب أيام الأسبوع', 'اليوم')

def sales_by_method(t, p):
    agg = defaultdict(lambda: [0, 0.0])
    for sp in M('sales', 'SalePayment').objects.filter(sale_invoice__in=invoices(t, p)).select_related('payment_method'):
        a = agg[sp.payment_method.name]; a[0] += 1; a[1] += f(sp.amount)
    rows = sorted([{'k': k, 'n': v[0], 'total': round(v[1], 2)} for k, v in agg.items()], key=lambda r: -r['total'])
    tot = sum(r['total'] for r in rows)
    for r in rows: r['pct'] = round(r['total'] / tot * 100, 1) if tot else 0
    return rep('المبيعات حسب طريقة الدفع', [('k', 'طريقة الدفع'), ('n', 'مرات', 'number'), ('total', 'المبلغ', 'money'), ('pct', 'النسبة %', 'pct')], rows, {'total': round(tot, 2)})

def sales_by_item(t, p): return group_lines(t, p, lambda sl: sl.display_name or sl.product.name, 'المبيعات حسب الصنف', 'الصنف')
def sales_by_grade(t, p): return group_lines(t, p, lambda sl: GR.get(sl.grade, sl.grade), 'المبيعات حسب الدرجة', 'الدرجة')
def sales_by_kind(t, p): return group_lines(t, p, lambda sl: KIND.get(gv(linfo(sl), ['purchase_kind']), 'بدون تصنيف'), 'المبيعات حسب التصنيف (بالة / استوك / خاص)', 'التصنيف')
def sales_by_segment(t, p): return group_lines(t, p, lambda sl: gv(linfo(sl), ['segment']) or gv(sl, ['piece_item.segment']), 'المبيعات حسب النوع (حريمي / رجالي / ...)', 'النوع')
def sales_by_brand(t, p): return group_lines(t, p, lambda sl: gv(linfo(sl), ['brand']) or gv(sl, ['piece_item.brand']), 'المبيعات حسب البراند', 'البراند')
def sales_by_mode(t, p): return group_lines(t, p, lambda sl: 'بالقطعة' if (sl.quantity_pieces and abs(f(sl.subtotal) - sl.quantity_pieces * f(sl.unit_price)) < 0.02) else 'بالكيلو', 'البيع بالقطعة مقابل بالكيلو', 'الطريقة')

def top_items(t, p):
    r = sales_by_item(t, p); r['title'] = 'الأكثر مبيعاً (أول 30)'; r['rows'] = r['rows'][:30]; return r

def discounts_approvals(t, p):
    rows = []
    for inv in invoices(t, p).filter(Q(discount_amount__gt=0) | Q(notes__icontains='موافقة')).select_related('cashier'):
        rows.append({'no': inv.invoice_number, 'date': str(timezone.localtime(inv.invoice_date_time))[:16], 'cashier': inv.cashier.username if inv.cashier_id else '', 'disc': f(inv.discount_amount),
                     'offers': ', '.join(o.get('name', '') for o in (inv.applied_offers or [])), 'coupon': inv.coupon_code or '', 'notes': inv.notes or ''})
    return rep('الخصومات وموافقات المدير على الفواتير', [('no', 'الفاتورة'), ('date', 'التاريخ'), ('cashier', 'الكاشير'), ('disc', 'الخصم', 'money'), ('offers', 'العروض'), ('coupon', 'الكوبون'), ('notes', 'الملاحظات / الموافقة')], rows, {'disc': round(sum(r['disc'] for r in rows), 2)})

def deferred_report(t, p):
    today = timezone.localdate(); rows = []
    for d in rng(M('sales', 'DeferredSale').objects.filter(tenant=t), 'created_at', p).select_related('customer', 'cashier', 'sale_invoice'):
        st = {'OPEN': 'مفتوحة', 'SOLD': 'اتباعت', 'CANCELLED': 'اتلغت'}.get(d.status, d.status)
        if d.status == 'OPEN' and d.due_date < today: st = 'متأخرة ⚠️'
        rows.append({'no': d.number, 'date': str(timezone.localtime(d.created_at))[:16], 'cust': f"{d.customer.name} {d.customer.phone}", 'total': f(d.total_amount), 'dep': f(d.deposit_amount), 'due': str(d.due_date), 'st': st, 'inv': d.sale_invoice.invoice_number if d.sale_invoice_id else ''})
    return rep('الفواتير المؤجلة (الأمانات)', [('no', 'الرقم'), ('date', 'التاريخ'), ('cust', 'العميل'), ('total', 'الإجمالي', 'money'), ('dep', 'العربون', 'money'), ('due', 'آخر ميعاد'), ('st', 'الحالة'), ('inv', 'فاتورة البيع')], rows, {'total': sum(r['total'] for r in rows)})

# ---------------- PROFIT ----------------
def _returns(t, p):
    return rng(M('returns', 'SalesReturn').objects.filter(tenant=t, status='COMPLETED'), 'return_date_time', p)

def _expenses(t, p):
    return rngd(M('treasury', 'Expense').objects.filter(tenant=t, status='ACTIVE'), 'expense_date', p)

def income_statement(t, p):
    inv = invoices(t, p)
    sales = f(inv.aggregate(s=Sum('subtotal'))['s']); disc = f(inv.aggregate(s=Sum('discount_amount'))['s']); cogs = f(inv.aggregate(s=Sum('total_cogs'))['s'])
    ret = _returns(t, p); ret_amt = f(ret.aggregate(s=Sum('total_refund_amount'))['s']); ret_cogs = f(ret.aggregate(s=Sum('total_cogs_reversed'))['s'])
    exp = _expenses(t, p); exp_amt = f(exp.aggregate(s=Sum('amount'))['s'])
    net_sales = sales - disc - ret_amt; net_cogs = cogs - ret_cogs; gross = net_sales - net_cogs; net = gross - exp_amt
    rows = [{'k': 'إجمالي المبيعات (قبل الخصم)', 'v': sales}, {'k': '(-) الخصومات والعروض', 'v': -disc}, {'k': '(-) المرتجعات', 'v': -ret_amt}, {'k': '= صافي المبيعات', 'v': net_sales},
            {'k': '(-) تكلفة البضاعة المباعة', 'v': -net_cogs}, {'k': '= مجمل الربح', 'v': gross}]
    for c in exp.values('category__name').annotate(s=Sum('amount')).order_by('-s'):
        rows.append({'k': f"(-) مصروف: {c['category__name']}", 'v': -f(c['s'])})
    rows.append({'k': '= صافي الربح', 'v': net})
    return rep('قايمة الدخل (صافي الربح الحقيقي)', [('k', 'البند'), ('v', 'المبلغ', 'money')], [{'k': r['k'], 'v': round(r['v'], 2)} for r in rows], {},
               [{'label': 'صافي المبيعات', 'value': round(net_sales, 2), 'type': 'money'}, {'label': 'مجمل الربح', 'value': round(gross, 2), 'type': 'money'}, {'label': 'المصروفات', 'value': round(exp_amt, 2), 'type': 'money'},
                {'label': 'صافي الربح', 'value': round(net, 2), 'type': 'money'}, {'label': 'هامش صافي %', 'value': round(net / net_sales * 100, 1) if net_sales else 0, 'type': 'pct'}])

def profit_by_item(t, p): r = sales_by_item(t, p); r['title'] = 'الربح حسب الصنف'; r['rows'].sort(key=lambda x: -x['profit']); return r
def profit_by_grade(t, p): r = sales_by_grade(t, p); r['title'] = 'الربح حسب الدرجة'; return r
def profit_by_cashier(t, p): return group_lines(t, p, lambda sl: sl.sale_invoice.cashier.username if sl.sale_invoice.cashier_id else None, 'الربح حسب الكاشير', 'الكاشير')
def profit_by_shop(t, p): return group_lines(t, p, lambda sl: gv(sl, ['sale_invoice.pos_terminal.default_warehouse.name']), 'الربح حسب المحل', 'المحل')

def lot_label(lot):
    li = gv(lot, ['purchase_line_item'])
    parts = [KIND.get(gv(li, ['purchase_kind']), ''), gv(li, ['bale_type']), gv(li, ['segment']), gv(li, ['grade']), gv(li, ['brand']), gv(li, ['item_name'])]
    return ' - '.join([x for x in parts if x]) or str(gv(lot, ['lot_code', 'code', 'lot_number'], str(lot.pk)[:8]))

def bale_profit(t, p):
    Lot = M('raw_lots', 'RawLot'); SL = M('sales', 'SaleLineItem'); SI = M('inventory', 'StockItem')
    rows = []
    for lot in Lot.objects.filter(tenant=t).select_related('purchase_line_item', 'purchase_invoice__supplier'):
        cost = f(gv(lot, ['purchase_cost', 'total_cost']))
        kg0 = f(gv(lot, ['initial_weight_kg', 'weight_kg', 'total_weight_kg', 'gross_weight_kg']))
        sold = SL.objects.filter(stock_item__source_lot=lot).aggregate(s=Sum('total_price'), c=Sum('total_cost'), k=Sum('weight_kg'))
        left = SI.objects.filter(source_lot=lot).aggregate(v=Sum('current_total_value'), k=Sum('total_weight_kg'))
        rev = f(sold['s']); cogs = f(sold['c'])
        rows.append({'lot': lot_label(lot), 'sup': gv(lot, ['purchase_invoice.supplier.name'], ''), 'kg': kg0, 'cost': round(cost, 2), 'soldkg': round(f(sold['k']), 3), 'rev': round(rev, 2), 'cogs': round(cogs, 2),
                     'profit': round(rev - cogs, 2), 'leftkg': round(f(left['k']), 3), 'leftv': round(f(left['v']), 2), 'net': round(rev + f(left['v']) - cost, 2)})
    rows.sort(key=lambda r: -r['profit'])
    return rep('ربح كل بالة / لوط (من الشراء للبيع)', [('lot', 'البالة'), ('sup', 'المورد'), ('kg', 'وزن الشراء', 'kg'), ('cost', 'تكلفتها', 'money'), ('soldkg', 'اتباع كجم', 'kg'), ('rev', 'مبيعاتها', 'money'),
               ('cogs', 'تكلفة المباع', 'money'), ('profit', 'ربح المباع', 'money'), ('leftkg', 'فاضل كجم', 'kg'), ('leftv', 'قيمة الفاضل', 'money'), ('net', 'النتيجة لحد دلوقتي', 'money')], rows,
               {k: round(sum(r[k] for r in rows), 2) for k in ('cost', 'rev', 'cogs', 'profit', 'leftv', 'net')}, note='النتيجة = المبيعات + قيمة الفاضل − تكلفة البالة. الفترة مش بتأثر على التقرير ده.')

def monthly_compare(t, p):
    Inv = M('sales', 'SaleInvoice'); rows = []; d = timezone.localdate().replace(day=1)
    for i in range(11, -1, -1):
        y, m = d.year, d.month - i
        while m <= 0: m += 12; y -= 1
        s = Inv.objects.filter(tenant=t, invoice_date_time__year=y, invoice_date_time__month=m).aggregate(s=Sum('total_amount'), c=Sum('total_cogs'), n=Count('id'))
        e = M('treasury', 'Expense').objects.filter(tenant=t, status='ACTIVE', expense_date__year=y, expense_date__month=m).aggregate(s=Sum('amount'))
        sales = f(s['s']); cogs = f(s['c']); exp = f(e['s'])
        rows.append({'k': f"{y}-{m:02d}", 'n': s['n'] or 0, 'sales': round(sales, 2), 'gross': round(sales - cogs, 2), 'exp': round(exp, 2), 'net': round(sales - cogs - exp, 2)})
    return rep('مقارنة شهرية (آخر 12 شهر)', [('k', 'الشهر'), ('n', 'فواتير', 'number'), ('sales', 'المبيعات', 'money'), ('gross', 'مجمل الربح', 'money'), ('exp', 'المصروفات', 'money'), ('net', 'صافي الربح', 'money')], rows)

# ---------------- SORTING ----------------
def _sort_orders(t, p):
    return M('sorting', 'SortingOrder').objects.filter(tenant=t)

def sorting_results(t, p):
    Out = M('sorting', 'SortingOutputLine'); W = M('sorting', 'SortingWasteLine'); rows = []
    for o in _sort_orders(t, p).select_related('raw_lot__purchase_line_item', 'raw_lot__purchase_invoice__supplier'):
        g = {x['grade']: f(x['s']) for x in Out.objects.filter(sorting_order=o).values('grade').annotate(s=Sum('weight_kg'))}
        w = f(W.objects.filter(sorting_order=o).aggregate(s=Sum('weight_kg'))['s'])
        tot = sum(g.values()) + w
        if tot <= 0: continue
        pc = lambda v: round(v / tot * 100, 1)
        rows.append({'code': gv(o, ['order_code'], ''), 'lot': lot_label(o.raw_lot) if o.raw_lot_id else '', 'sup': gv(o, ['raw_lot.purchase_invoice.supplier.name'], ''), 'tot': round(tot, 3),
                     'h': pc(g.get('NEW_COLLECTION', 0)), 'm': pc(g.get('MIDDLE', 0)), 'l': pc(g.get('CLEARANCE', 0)), 'w': pc(w)})
    return rep('نتيجة الفرز لكل بالة (نسب الدرجات)', [('code', 'أمر الفرز'), ('lot', 'البالة'), ('sup', 'المورد'), ('tot', 'الوزن', 'kg'), ('h', 'عالي %', 'pct'), ('m', 'وسط %', 'pct'), ('l', 'تصفيات %', 'pct'), ('w', 'هالك %', 'pct')], rows)

def supplier_quality(t, p):
    r = sorting_results(t, p); agg = defaultdict(lambda: {'n': 0, 'kg': 0.0, 'h': 0.0, 'w': 0.0})
    for x in r['rows']:
        a = agg[x['sup'] or '—']; a['n'] += 1; a['kg'] += x['tot']; a['h'] += x['h'] * x['tot']; a['w'] += x['w'] * x['tot']
    rows = [{'sup': k, 'n': v['n'], 'kg': round(v['kg'], 3), 'h': round(v['h'] / v['kg'], 1) if v['kg'] else 0, 'w': round(v['w'] / v['kg'], 1) if v['kg'] else 0} for k, v in agg.items()]
    rows.sort(key=lambda x: -x['h'])
    return rep('تقييم الموردين من نتايج الفرز', [('sup', 'المورد'), ('n', 'بالات', 'number'), ('kg', 'كجم', 'kg'), ('h', 'متوسط العالي %', 'pct'), ('w', 'متوسط الهالك %', 'pct')], rows)

def pending_lots(t, p):
    Lot = M('raw_lots', 'RawLot'); done = set(_sort_orders(t, p).filter(status__in=['RECONCILED', 'COSTED', 'POSTED', 'COMPLETED', 'DONE']).values_list('raw_lot_id', flat=True))
    rows = [{'lot': lot_label(l), 'sup': gv(l, ['purchase_invoice.supplier.name'], ''), 'date': str(gv(l, ['purchase_invoice.invoice_date'], '')), 'kg': f(gv(l, ['initial_weight_kg', 'weight_kg', 'total_weight_kg'])), 'cost': f(gv(l, ['purchase_cost']))}
            for l in Lot.objects.filter(tenant=t).exclude(pk__in=done).select_related('purchase_line_item', 'purchase_invoice__supplier')]
    return rep('بالات لسه ماتفرزتش (أو فرزها ماتقفلش)', [('lot', 'البالة'), ('sup', 'المورد'), ('date', 'تاريخ الشراء'), ('kg', 'الوزن', 'kg'), ('cost', 'التكلفة', 'money')], rows, {'kg': sum(r['kg'] for r in rows), 'cost': sum(r['cost'] for r in rows)})

# ---------------- PURCHASES & SUPPLIERS ----------------
def purchases_list(t, p):
    rows = [{'no': x.invoice_number, 'date': str(x.invoice_date), 'sup': x.supplier.name if x.supplier_id else '', 'total': f(x.total_cost), 'paid': f(x.paid_amount), 'rest': f(x.total_cost) - f(x.paid_amount)}
            for x in rngd(M('purchasing', 'PurchaseInvoice').objects.filter(tenant=t), 'invoice_date', p).select_related('supplier').order_by('-invoice_date')]
    return rep('فواتير الشراء', [('no', 'الفاتورة'), ('date', 'التاريخ'), ('sup', 'المورد'), ('total', 'الإجمالي', 'money'), ('paid', 'مدفوع عليها', 'money'), ('rest', 'الباقي', 'money')], rows, {k: round(sum(r[k] for r in rows), 2) for k in ('total', 'paid', 'rest')})

def purchases_by_supplier(t, p):
    rows = [{'sup': x['supplier__name'] or '—', 'n': x['n'], 'total': f(x['s'])} for x in rngd(M('purchasing', 'PurchaseInvoice').objects.filter(tenant=t), 'invoice_date', p).values('supplier__name').annotate(n=Count('id'), s=Sum('total_cost')).order_by('-s')]
    return rep('المشتريات حسب المورد', [('sup', 'المورد'), ('n', 'فواتير', 'number'), ('total', 'الإجمالي', 'money')], rows, {'total': sum(r['total'] for r in rows)})

def supplier_balances(t, p):
    PI = M('purchasing', 'PurchaseInvoice'); SP = M('suppliers', 'SupplierPayment'); rows = []
    for s in M('suppliers', 'Supplier').objects.filter(tenant=t):
        tot = f(PI.objects.filter(tenant=t, supplier=s).aggregate(x=Sum('total_cost'))['x']); paid = f(SP.objects.filter(tenant=t, supplier=s).aggregate(x=Sum('amount'))['x'])
        rows.append({'code': s.code, 'sup': s.name, 'total': round(tot, 2), 'paid': round(paid, 2), 'bal': round(tot - paid, 2)})
    rows.sort(key=lambda r: -r['bal'])
    return rep('أرصدة الموردين (عليكم كام)', [('code', 'الكود'), ('sup', 'المورد'), ('total', 'المشتريات', 'money'), ('paid', 'المدفوع', 'money'), ('bal', 'الرصيد', 'money')], rows, {k: round(sum(r[k] for r in rows), 2) for k in ('total', 'paid', 'bal')})

def supplier_aging(t, p):
    PI = M('purchasing', 'PurchaseInvoice'); today = timezone.localdate(); rows = []
    for s in M('suppliers', 'Supplier').objects.filter(tenant=t):
        paid = f(M('suppliers', 'SupplierPayment').objects.filter(tenant=t, supplier=s).aggregate(x=Sum('amount'))['x'])
        b = {'a': 0.0, 'b': 0.0, 'c': 0.0, 'd': 0.0}
        for inv in PI.objects.filter(tenant=t, supplier=s).order_by('invoice_date'):
            amt = f(inv.total_cost); use = min(paid, amt); paid -= use; left = amt - use
            if left <= 0: continue
            days = (today - inv.invoice_date).days
            b['a' if days <= 30 else 'b' if days <= 60 else 'c' if days <= 90 else 'd'] += left
        if sum(b.values()) > 0:
            rows.append({'sup': s.name, **{k: round(v, 2) for k, v in b.items()}, 'tot': round(sum(b.values()), 2)})
    return rep('أعمار ديون الموردين', [('sup', 'المورد'), ('a', 'لحد 30 يوم', 'money'), ('b', '31-60', 'money'), ('c', '61-90', 'money'), ('d', 'أكتر من 90', 'money'), ('tot', 'الإجمالي', 'money')], rows, {k: round(sum(r[k] for r in rows), 2) for k in ('a', 'b', 'c', 'd', 'tot')})

# ---------------- INVENTORY ----------------
def _stock(t, p):
    qs = M('inventory', 'StockItem').objects.filter(tenant=t, total_weight_kg__gt=0).select_related('product', 'warehouse', 'source_lot__purchase_line_item')
    if p.get('warehouse'): qs = qs.filter(warehouse_id=p['warehouse'])
    return qs

def _sale_price(si):
    WP = M('pricing', 'WeightPrice'); li = gv(si, ['source_lot.purchase_line_item']); kind = gv(li, ['purchase_kind'])
    key = '' if kind == 'BALE' else ((gv(li, ['brand']) if gv(li, ['stock_type']) == 'ONE_BRAND' else 'MIX') if kind == 'STOCK' else (gv(li, ['item_name']) or ''))
    w = WP.objects.filter(tenant=si.tenant, kind=kind or 'BALE', key=key or '', grade=si.grade).first()
    return f(w.price_per_kg) if w else f(gv(si, ['product.retail_price']))

def stock_value(t, p):
    rows = []
    for si in _stock(t, p):
        sp = _sale_price(si)
        rows.append({'item': si.product.name, 'grade': GR.get(si.grade, si.grade), 'loc': si.warehouse.name, 'kg': f(si.total_weight_kg), 'pcs': si.total_quantity_pieces, 'cost': round(f(si.current_total_value), 2), 'sale': round(f(si.total_weight_kg) * sp, 2)})
    tot = {k: round(sum(r[k] for r in rows), 2) for k in ('kg', 'pcs', 'cost', 'sale')}
    return rep('المخزون الحالي بالقيمة', [('item', 'الصنف'), ('grade', 'الدرجة'), ('loc', 'المكان'), ('kg', 'كجم', 'kg'), ('pcs', 'قطع', 'number'), ('cost', 'القيمة بالتكلفة', 'money'), ('sale', 'القيمة بسعر البيع', 'money')], rows, tot,
               [{'label': 'إجمالي الوزن', 'value': tot['kg'], 'type': 'kg'}, {'label': 'بالتكلفة', 'value': tot['cost'], 'type': 'money'}, {'label': 'بسعر البيع', 'value': tot['sale'], 'type': 'money'}, {'label': 'الربح المتوقع', 'value': round(tot['sale'] - tot['cost'], 2), 'type': 'money'}])

def stock_by_location(t, p):
    agg = defaultdict(lambda: [0.0, 0, 0.0])
    for si in _stock(t, p):
        a = agg[si.warehouse.name]; a[0] += f(si.total_weight_kg); a[1] += si.total_quantity_pieces; a[2] += f(si.current_total_value)
    rows = [{'loc': k, 'kg': round(v[0], 3), 'pcs': v[1], 'cost': round(v[2], 2)} for k, v in agg.items()]
    return rep('المخزون حسب المكان', [('loc', 'المكان'), ('kg', 'كجم', 'kg'), ('pcs', 'قطع', 'number'), ('cost', 'القيمة بالتكلفة', 'money')], rows, {k: round(sum(r[k] for r in rows), 2) for k in ('kg', 'pcs', 'cost')})

def slow_moving(t, p):
    IT = M('inventory', 'InventoryTransaction'); now = timezone.now(); rows = []
    for si in _stock(t, p):
        last = IT.objects.filter(stock_item=si).aggregate(m=Max('created_at'))['m'] or si.created_at
        days = (now - last).days
        rows.append({'item': si.product.name, 'grade': GR.get(si.grade, si.grade), 'loc': si.warehouse.name, 'kg': f(si.total_weight_kg), 'cost': round(f(si.current_total_value), 2), 'days': days})
    rows.sort(key=lambda r: -r['days'])
    return rep('البضاعة الراكدة (أيام من غير حركة)', [('item', 'الصنف'), ('grade', 'الدرجة'), ('loc', 'المكان'), ('kg', 'كجم', 'kg'), ('cost', 'القيمة', 'money'), ('days', 'أيام من آخر حركة', 'number')], rows)

def low_stock(t, p):
    rows = [{'item': si.product.name, 'grade': GR.get(si.grade, si.grade), 'loc': si.warehouse.name, 'kg': f(si.total_weight_kg), 'pcs': si.total_quantity_pieces} for si in _stock(t, p) if f(si.total_weight_kg) < float(p.get('limit') or 10)]
    rows.sort(key=lambda r: r['kg'])
    return rep('أصناف قربت تخلص (أقل من 10 كجم)', [('item', 'الصنف'), ('grade', 'الدرجة'), ('loc', 'المكان'), ('kg', 'كجم', 'kg'), ('pcs', 'قطع', 'number')], rows)

def transfers_list(t, p):
    rows = [{'code': x.transfer_code, 'date': str(x.transfer_date), 'from': x.source_warehouse.name, 'to': x.destination_warehouse.name, 'kg': f(x.total_weight_kg), 'cost': f(x.total_cost_value), 'notes': x.notes or ''}
            for x in rngd(M('transfers', 'TransferOrder').objects.filter(tenant=t), 'transfer_date', p).select_related('source_warehouse', 'destination_warehouse').order_by('-transfer_date')]
    return rep('أذون النقل', [('code', 'الإذن'), ('date', 'التاريخ'), ('from', 'من'), ('to', 'إلى'), ('kg', 'كجم', 'kg'), ('cost', 'القيمة', 'money'), ('notes', 'ملاحظات')], rows, {'kg': sum(r['kg'] for r in rows), 'cost': sum(r['cost'] for r in rows)})

def holding_goods(t, p):
    rows = [{'no': d.number, 'cust': f"{d.customer.name} {d.customer.phone}", 'items': ' · '.join(l.get('display_name', '') for l in d.lines), 'total': f(d.total_amount), 'due': str(d.due_date), 'late': 'متأخرة ⚠️' if d.due_date < timezone.localdate() else ''}
            for d in M('sales', 'DeferredSale').objects.filter(tenant=t, status='OPEN').select_related('customer')]
    return rep('البضاعة عند العملاء (أمانات مفتوحة)', [('no', 'الرقم'), ('cust', 'العميل'), ('items', 'الأصناف'), ('total', 'القيمة', 'money'), ('due', 'آخر ميعاد'), ('late', 'حالة')], rows, {'total': sum(r['total'] for r in rows)})

# ---------------- CUSTOMERS ----------------
def top_customers(t, p):
    rows = [{'code': x['customer__code'] or '', 'name': x['customer__name'], 'phone': x['customer__phone'], 'n': x['n'], 'total': f(x['s'])} for x in invoices(t, p).filter(customer__isnull=False).values('customer__code', 'customer__name', 'customer__phone').annotate(n=Count('id'), s=Sum('total_amount')).order_by('-s')]
    return rep('أكتر العملاء شراءً', [('code', 'الكود'), ('name', 'العميل'), ('phone', 'التليفون'), ('n', 'فواتير', 'number'), ('total', 'المشتريات', 'money')], rows, {'total': sum(r['total'] for r in rows)})

def new_customers(t, p):
    rows = [{'code': c.code, 'name': c.name, 'phone': c.phone, 'date': str(timezone.localtime(c.created_at))[:16]} for c in rng(M('customers', 'Customer').objects.filter(tenant=t), 'created_at', p).order_by('-created_at')]
    return rep('العملاء الجداد', [('code', 'الكود'), ('name', 'العميل'), ('phone', 'التليفون'), ('date', 'اتسجل')], rows, cards=[{'label': 'عدد العملاء الجداد', 'value': len(rows), 'type': 'number'}])

def inactive_customers(t, p):
    Inv = M('sales', 'SaleInvoice'); lim = int(p.get('days') or 30); now = timezone.now(); rows = []
    for c in M('customers', 'Customer').objects.filter(tenant=t):
        last = Inv.objects.filter(customer=c).aggregate(m=Max('invoice_date_time'), s=Sum('total_amount'))
        if last['m'] and (now - last['m']).days >= lim:
            rows.append({'code': c.code, 'name': c.name, 'phone': c.phone, 'last': str(timezone.localtime(last['m']))[:10], 'days': (now - last['m']).days, 'total': f(last['s'])})
    rows.sort(key=lambda r: -r['total'])
    return rep('عملاء بطلوا ييجوا (من 30 يوم أو أكتر)', [('code', 'الكود'), ('name', 'العميل'), ('phone', 'التليفون'), ('last', 'آخر شراء'), ('days', 'بقالهم (يوم)', 'number'), ('total', 'اشتروا قبل كده', 'money')], rows)

def customer_debts(t, p):
    rows = [{'code': c.code, 'name': c.name, 'phone': c.phone, 'bal': f(c.credit_balance), 'limit': f(c.credit_limit)} for c in M('customers', 'Customer').objects.filter(tenant=t, credit_balance__gt=0).order_by('-credit_balance')]
    return rep('ديون العملاء (الآجل)', [('code', 'الكود'), ('name', 'العميل'), ('phone', 'التليفون'), ('bal', 'عليه', 'money'), ('limit', 'حد الدين', 'money')], rows, {'bal': sum(r['bal'] for r in rows)})

def collections(t, p):
    TT = M('treasury', 'TreasuryTransaction'); C = M('customers', 'Customer'); names = {str(c.id): f"{c.code} {c.name}" for c in C.objects.filter(tenant=t)}
    rows = [{'date': str(timezone.localtime(x.created_at))[:16], 'cust': names.get(x.source_document_id, ''), 'tr': x.treasury.name, 'amount': abs(f(x.amount))} for x in rng(TT.objects.filter(treasury__tenant=t, source_document_type='CustomerPayment'), 'created_at', p).select_related('treasury')]
    return rep('التحصيلات من العملاء', [('date', 'التاريخ'), ('cust', 'العميل'), ('tr', 'الخزنة'), ('amount', 'المبلغ', 'money')], rows, {'amount': sum(r['amount'] for r in rows)})

# ---------------- OFFERS ----------------
def offers_performance(t, p):
    rows = [{'name': o.name, 'type': o.offer_type, 'mode': o.apply_mode, 'active': 'شغال' if o.is_active else 'موقوف', 'n': o.usage_count, 'sales': f(o.total_sales), 'disc': f(o.total_discount)} for o in M('discounts', 'Offer').objects.filter(tenant=t).order_by('-usage_count')]
    return rep('أداء العروض', [('name', 'العرض'), ('type', 'النوع'), ('mode', 'التطبيق'), ('active', 'الحالة'), ('n', 'اتستعمل', 'number'), ('sales', 'المبيعات', 'money'), ('disc', 'الخصم', 'money')], rows, {'n': sum(r['n'] for r in rows), 'sales': sum(r['sales'] for r in rows), 'disc': sum(r['disc'] for r in rows)})

def coupons_usage(t, p):
    rows = [{'code': c.code, 'offer': c.offer.name, 'max': c.max_uses if c.max_uses is not None else '∞', 'used': c.used_count, 'st': 'شغال' if c.is_active else 'موقوف'} for c in M('discounts', 'Coupon').objects.filter(tenant=t).select_related('offer').order_by('offer__name', 'code')]
    return rep('الكوبونات', [('code', 'الكود'), ('offer', 'العرض'), ('max', 'أقصى استخدام'), ('used', 'اتستعمل', 'number'), ('st', 'الحالة')], rows, {'used': sum(r['used'] for r in rows)})

# ---------------- RETURNS ----------------
def returns_list(t, p):
    rows = [{'no': r.return_number, 'date': str(timezone.localtime(r.return_date_time))[:16], 'inv': r.original_sale_invoice.invoice_number, 'cashier': r.cashier.username if r.cashier_id else '', 'reason': r.reason or '', 'amount': f(r.total_refund_amount)}
            for r in _returns(t, p).select_related('original_sale_invoice', 'cashier').order_by('-return_date_time')]
    sales = f(invoices(t, p).aggregate(s=Sum('total_amount'))['s']); tot = sum(r['amount'] for r in rows)
    return rep('المرتجعات', [('no', 'المرتجع'), ('date', 'التاريخ'), ('inv', 'الفاتورة'), ('cashier', 'الكاشير'), ('reason', 'السبب'), ('amount', 'المبلغ', 'money')], rows, {'amount': tot},
               [{'label': 'إجمالي المرتجعات', 'value': round(tot, 2), 'type': 'money'}, {'label': 'نسبة المرتجع من المبيعات', 'value': round(tot / sales * 100, 1) if sales else 0, 'type': 'pct'}])

def returns_by_reason(t, p):
    rows = [{'k': x['reason'] or 'بدون سبب', 'n': x['n'], 'amount': f(x['s'])} for x in _returns(t, p).values('reason').annotate(n=Count('id'), s=Sum('total_refund_amount')).order_by('-s')]
    return rep('المرتجعات حسب السبب', [('k', 'السبب'), ('n', 'مرات', 'number'), ('amount', 'المبلغ', 'money')], rows, {'amount': sum(r['amount'] for r in rows)})

def returns_by_item(t, p):
    agg = defaultdict(lambda: [0.0, 0])
    for l in M('returns', 'SalesReturnLineItem').objects.filter(sales_return__in=_returns(t, p)).select_related('original_sale_line', 'product'):
        a = agg[gv(l, ['original_sale_line.display_name']) or l.product.name]; a[0] += f(l.refund_total_price); a[1] += l.quantity_pieces or 0
    rows = sorted([{'k': k, 'pcs': v[1], 'amount': round(v[0], 2)} for k, v in agg.items()], key=lambda r: -r['amount'])
    return rep('المرتجعات حسب الصنف', [('k', 'الصنف'), ('pcs', 'قطع', 'number'), ('amount', 'المبلغ', 'money')], rows, {'amount': sum(r['amount'] for r in rows)})

# ---------------- TREASURY ----------------
def _sgn(x):
    return f(x.amount) if f(x.amount) < 0 else (f(x.amount) if x.transaction_type in ('DEPOSIT', 'TRANSFER_IN') else -f(x.amount))

def treasury_balances(t, p):
    TR = M('treasury', 'Treasury')
    rows = [{'name': x.name, 'type': {'POS_DRAWER': 'درج كاشير', 'MAIN_SAFE': 'خزينة رئيسية', 'BANK': 'بنك / إلكتروني'}.get(x.treasury_type, x.treasury_type), 'bal': f(x.current_balance)} for x in TR.objects.filter(tenant=t, is_active=True)]
    return rep('أرصدة الخزن', [('name', 'الخزنة'), ('type', 'النوع'), ('bal', 'الرصيد', 'money')], rows, {'bal': sum(r['bal'] for r in rows)})

def cash_flow(t, p):
    agg = defaultdict(lambda: [0.0, 0.0])
    for x in rng(M('treasury', 'TreasuryTransaction').objects.filter(treasury__tenant=t).exclude(transaction_type__in=['TRANSFER_IN', 'TRANSFER_OUT']), 'created_at', p):
        v = _sgn(x); a = agg[str(timezone.localtime(x.created_at).date())]
        if v >= 0: a[0] += v
        else: a[1] += -v
    rows = sorted([{'d': k, 'in': round(v[0], 2), 'out': round(v[1], 2), 'net': round(v[0] - v[1], 2)} for k, v in agg.items()], key=lambda r: r['d'])
    return rep('التدفق النقدي يوم بيوم (من غير التحويلات الداخلية)', [('d', 'اليوم'), ('in', 'داخل', 'money'), ('out', 'خارج', 'money'), ('net', 'الصافي', 'money')], rows, {k: round(sum(r[k] for r in rows), 2) for k in ('in', 'out', 'net')})

def owner_drawings(t, p):
    rows = [{'date': str(timezone.localtime(x.created_at))[:16], 'tr': x.treasury.name, 'ref': x.source_document_id or '', 'desc': x.description or '', 'amount': abs(f(x.amount))}
            for x in rng(M('treasury', 'TreasuryTransaction').objects.filter(treasury__tenant=t, source_document_type='OwnerDrawing'), 'created_at', p).select_related('treasury')]
    return rep('مسحوبات صاحب المحل', [('date', 'التاريخ'), ('tr', 'من خزنة'), ('ref', 'الوردية'), ('desc', 'البيان'), ('amount', 'المبلغ', 'money')], rows, {'amount': sum(r['amount'] for r in rows)})

def manual_moves(t, p):
    rows = [{'date': str(timezone.localtime(x.created_at))[:16], 'tr': x.treasury.name, 'kind': 'إيداع' if _sgn(x) >= 0 else 'سحب', 'desc': x.description or '', 'amount': _sgn(x)}
            for x in rng(M('treasury', 'TreasuryTransaction').objects.filter(treasury__tenant=t, source_document_type__in=['ManualDeposit', 'ManualWithdrawal']), 'created_at', p).select_related('treasury')]
    return rep('الإيداعات والسحوبات اليدوية', [('date', 'التاريخ'), ('tr', 'الخزنة'), ('kind', 'النوع'), ('desc', 'البيان والموافقة'), ('amount', 'المبلغ', 'money')], rows, {'amount': sum(r['amount'] for r in rows)})

# ---------------- SHIFTS ----------------
def _shifts(t, p):
    qs = rng(M('shifts', 'Shift').objects.filter(tenant=t), 'opened_at', p).select_related('cashier', 'terminal')
    if p.get('cashier'): qs = qs.filter(cashier_id=p['cashier'])
    return qs

def shifts_list(t, p):
    rows = [{'code': s.shift_code, 'cashier': s.cashier.username if s.cashier_id else '', 'open': str(timezone.localtime(s.opened_at))[:16], 'close': str(timezone.localtime(s.closed_at))[:16] if s.closed_at else '',
             'opening': f(s.opening_cash), 'exp': f(s.expected_cash), 'act': f(s.actual_cash), 'diff': f(s.difference), 'hand': f(s.handover_total)} for s in _shifts(t, p).order_by('-opened_at')]
    return rep('الورديات', [('code', 'الوردية'), ('cashier', 'الكاشير'), ('open', 'الفتح'), ('close', 'القفل'), ('opening', 'الافتتاح', 'money'), ('exp', 'المتوقع', 'money'), ('act', 'المعدود', 'money'), ('diff', 'الفرق', 'money'), ('hand', 'اترحّل', 'money')], rows,
               {'diff': round(sum(r['diff'] for r in rows), 2), 'hand': round(sum(r['hand'] for r in rows), 2)})

def cashier_diffs(t, p):
    agg = defaultdict(lambda: [0, 0.0, 0.0])
    for s in _shifts(t, p).filter(status='CLOSED'):
        a = agg[s.cashier.username if s.cashier_id else '—']; a[0] += 1; d = f(s.difference)
        if d < 0: a[1] += -d
        else: a[2] += d
    rows = [{'k': k, 'n': v[0], 'short': round(v[1], 2), 'over': round(v[2], 2), 'net': round(v[2] - v[1], 2)} for k, v in agg.items()]
    return rep('العجز والزيادة لكل كاشير', [('k', 'الكاشير'), ('n', 'ورديات', 'number'), ('short', 'إجمالي العجز', 'money'), ('over', 'إجمالي الزيادة', 'money'), ('net', 'الصافي', 'money')], rows)

def custodies(t, p):
    rows = [{'cashier': c.cashier.username, 'shift': c.shift.shift_code if c.shift_id else '', 'date': str(timezone.localtime(c.created_at))[:16], 'amount': f(c.amount), 'st': 'مفتوحة' if c.status == 'OPEN' else 'اتسددت'}
            for c in M('shifts', 'CashierCustody').objects.filter(tenant=t).select_related('cashier', 'shift').order_by('status', '-created_at')]
    return rep('عهد الكاشيرية', [('cashier', 'الكاشير'), ('shift', 'الوردية'), ('date', 'التاريخ'), ('amount', 'المبلغ', 'money'), ('st', 'الحالة')], rows, {'amount': round(sum(r['amount'] for r in rows if r['st'] == 'مفتوحة'), 2)})

def cashier_performance(t, p):
    agg = defaultdict(lambda: {'n': 0, 'total': 0.0, 'disc': 0.0, 'ret': 0.0})
    for inv in invoices(t, p).select_related('cashier'):
        a = agg[inv.cashier.username if inv.cashier_id else '—']; a['n'] += 1; a['total'] += f(inv.total_amount); a['disc'] += f(inv.discount_amount)
    for r in _returns(t, p).select_related('cashier'):
        agg[r.cashier.username if r.cashier_id else '—']['ret'] += f(r.total_refund_amount)
    rows = [{'k': k, 'n': v['n'], 'total': round(v['total'], 2), 'avg': round(v['total'] / v['n'], 2) if v['n'] else 0, 'disc': round(v['disc'], 2), 'ret': round(v['ret'], 2)} for k, v in agg.items()]
    rows.sort(key=lambda r: -r['total'])
    return rep('أداء الكاشيرية', [('k', 'الكاشير'), ('n', 'فواتير', 'number'), ('total', 'المبيعات', 'money'), ('avg', 'متوسط الفاتورة', 'money'), ('disc', 'الخصومات', 'money'), ('ret', 'المرتجعات', 'money')], rows)

# ---------------- EXPENSES ----------------
def expenses_by_category(t, p):
    rows = [{'k': x['category__name'], 'n': x['n'], 'amount': f(x['s'])} for x in _expenses(t, p).values('category__name').annotate(n=Count('id'), s=Sum('amount')).order_by('-s')]
    tot = sum(r['amount'] for r in rows)
    for r in rows: r['pct'] = round(r['amount'] / tot * 100, 1) if tot else 0
    return rep('المصروفات حسب البند', [('k', 'البند'), ('n', 'أذونات', 'number'), ('amount', 'المبلغ', 'money'), ('pct', 'النسبة %', 'pct')], rows, {'amount': round(tot, 2)})

def expenses_monthly(t, p):
    E = M('treasury', 'Expense'); rows = []; d = timezone.localdate().replace(day=1)
    for i in range(11, -1, -1):
        y, m = d.year, d.month - i
        while m <= 0: m += 12; y -= 1
        rows.append({'k': f"{y}-{m:02d}", 'amount': f(E.objects.filter(tenant=t, status='ACTIVE', expense_date__year=y, expense_date__month=m).aggregate(s=Sum('amount'))['s'])})
    return rep('المصروفات شهرياً (آخر 12 شهر)', [('k', 'الشهر'), ('amount', 'المبلغ', 'money')], rows, {'amount': sum(r['amount'] for r in rows)})

def expenses_cancelled(t, p):
    rows = [{'no': e.number, 'date': str(e.expense_date), 'cat': e.category.name, 'amount': f(e.amount), 'reason': e.cancel_reason or '', 'by': e.cancelled_by.username if e.cancelled_by_id else ''}
            for e in rngd(M('treasury', 'Expense').objects.filter(tenant=t, status='CANCELLED'), 'expense_date', p).select_related('category', 'cancelled_by')]
    return rep('المصروفات الملغية وأسبابها', [('no', 'الرقم'), ('date', 'التاريخ'), ('cat', 'البند'), ('amount', 'المبلغ', 'money'), ('reason', 'السبب'), ('by', 'ألغاه')], rows)

# ---------------- CONTROL ----------------
def price_changes(t, p):
    rows = [{'date': str(timezone.localtime(x.created_at))[:16], 'by': x.changed_by.username if x.changed_by_id else '', 'what': x.name or x.key or x.code or '', 'grade': GR.get(x.grade, x.grade or ''), 'field': 'الكيلو' if x.field == 'per_kg' else 'القطعة', 'old': f(x.old_price), 'new': f(x.new_price)}
            for x in rng(M('pricing', 'PriceChangeLog').objects.filter(tenant=t), 'created_at', p).select_related('changed_by')]
    return rep('سجل تغيير الأسعار', [('date', 'التاريخ'), ('by', 'بواسطة'), ('what', 'الصنف'), ('grade', 'الدرجة'), ('field', 'السعر'), ('old', 'القديم', 'money'), ('new', 'الجديد', 'money')], rows)

def manager_approvals(t, p):
    rows = []
    for inv in invoices(t, p).filter(notes__icontains='موافقة المدير').select_related('cashier'):
        rows.append({'date': str(timezone.localtime(inv.invoice_date_time))[:16], 'kind': 'تعديل سعر / خصم في فاتورة', 'ref': inv.invoice_number, 'amount': f(inv.discount_amount), 'desc': inv.notes})
    for e in _expenses(t, p).select_related('approved_by', 'category'):
        rows.append({'date': str(e.expense_date), 'kind': 'مصروف', 'ref': e.number, 'amount': f(e.amount), 'desc': f"{e.category.name} - وافق: {e.approved_by.username if e.approved_by_id else ''}"})
    for s in _shifts(t, p).filter(shortage_mode='SHOP'):
        rows.append({'date': str(timezone.localtime(s.closed_at))[:16] if s.closed_at else '', 'kind': 'عجز وردية على المحل', 'ref': s.shift_code, 'amount': f(s.difference), 'desc': ''})
    for s in _shifts(t, p).exclude(opening_difference=0):
        rows.append({'date': str(timezone.localtime(s.opened_at))[:16], 'kind': 'فرق عند فتح وردية', 'ref': s.shift_code, 'amount': f(s.opening_difference), 'desc': ''})
    for x in rng(M('treasury', 'TreasuryTransaction').objects.filter(treasury__tenant=t, description__icontains='بموافقة'), 'created_at', p).select_related('treasury'):
        rows.append({'date': str(timezone.localtime(x.created_at))[:16], 'kind': 'حركة خزنة يدوية / تحويل', 'ref': x.treasury.name, 'amount': _sgn(x), 'desc': x.description})
    rows.sort(key=lambda r: r['date'], reverse=True)
    return rep('كل موافقات المدير', [('date', 'التاريخ'), ('kind', 'النوع'), ('ref', 'المرجع'), ('amount', 'المبلغ', 'money'), ('desc', 'التفاصيل')], rows)

# ---------------- DASHBOARD ----------------
def dashboard(t, p):
    Inv = M('sales', 'SaleInvoice'); today = timezone.localdate()
    s = lambda d: f(Inv.objects.filter(tenant=t, invoice_date_time__date=d).aggregate(x=Sum('total_amount'))['x'])
    mp = {'date_from': str(today.replace(day=1)), 'date_to': str(today)}
    inc = income_statement(t, mp)['cards']; net = next((c['value'] for c in inc if c['label'] == 'صافي الربح'), 0)
    cash = f(M('treasury', 'Treasury').objects.filter(tenant=t, is_active=True).aggregate(x=Sum('current_balance'))['x'])
    cdebt = f(M('customers', 'Customer').objects.filter(tenant=t, credit_balance__gt=0).aggregate(x=Sum('credit_balance'))['x'])
    sdebt = sum(r['bal'] for r in supplier_balances(t, p)['rows'] if r['bal'] > 0)
    stockv = f(M('inventory', 'StockItem').objects.filter(tenant=t, total_weight_kg__gt=0).aggregate(x=Sum('current_total_value'))['x'])
    late = M('sales', 'DeferredSale').objects.filter(tenant=t, status='OPEN', due_date__lt=today).count()
    cust = M('shifts', 'CashierCustody').objects.filter(tenant=t, status='OPEN').count()
    low = len(low_stock(t, {})['rows'])
    cards = [{'label': 'مبيعات النهاردة', 'value': s(today), 'type': 'money'}, {'label': 'مبيعات امبارح', 'value': s(today - timedelta(days=1)), 'type': 'money'},
             {'label': 'نفس اليوم الأسبوع اللي فات', 'value': s(today - timedelta(days=7)), 'type': 'money'}, {'label': 'صافي ربح الشهر', 'value': net, 'type': 'money'},
             {'label': 'الفلوس في كل الخزن', 'value': cash, 'type': 'money'}, {'label': 'ديون العملاء', 'value': cdebt, 'type': 'money'},
             {'label': 'عليكم للموردين', 'value': round(sdebt, 2), 'type': 'money'}, {'label': 'قيمة المخزون (تكلفة)', 'value': stockv, 'type': 'money'}]
    rows = [{'k': 'أمانات متأخرة', 'v': late}, {'k': 'عهد كاشيرية مفتوحة', 'v': cust}, {'k': 'أصناف قربت تخلص', 'v': low}]
    return rep('لوحة المؤشرات', [('k', 'تنبيه'), ('v', 'العدد', 'number')], rows, {}, cards)

CATALOG = [
    ('لوحة المؤشرات', [('dashboard', dashboard)]),
    ('المبيعات', [('sales_daily', sales_daily), ('sales_by_cashier', sales_by_cashier), ('sales_by_terminal', sales_by_terminal), ('sales_by_method', sales_by_method), ('sales_by_hour', sales_by_hour),
                  ('sales_by_weekday', sales_by_weekday), ('sales_by_item', sales_by_item), ('sales_by_grade', sales_by_grade), ('sales_by_kind', sales_by_kind), ('sales_by_segment', sales_by_segment),
                  ('sales_by_brand', sales_by_brand), ('sales_by_mode', sales_by_mode), ('top_items', top_items), ('discounts_approvals', discounts_approvals), ('deferred_report', deferred_report)]),
    ('الأرباح', [('income_statement', income_statement), ('profit_by_item', profit_by_item), ('profit_by_grade', profit_by_grade), ('profit_by_cashier', profit_by_cashier), ('profit_by_shop', profit_by_shop), ('bale_profit', bale_profit), ('monthly_compare', monthly_compare)]),
    ('الفرز', [('sorting_results', sorting_results), ('supplier_quality', supplier_quality), ('pending_lots', pending_lots)]),
    ('المشتريات والموردين', [('purchases_list', purchases_list), ('purchases_by_supplier', purchases_by_supplier), ('supplier_balances', supplier_balances), ('supplier_aging', supplier_aging)]),
    ('المخزون', [('stock_value', stock_value), ('stock_by_location', stock_by_location), ('slow_moving', slow_moving), ('low_stock', low_stock), ('transfers_list', transfers_list), ('holding_goods', holding_goods)]),
    ('العملاء', [('top_customers', top_customers), ('new_customers', new_customers), ('inactive_customers', inactive_customers), ('customer_debts', customer_debts), ('collections', collections)]),
    ('العروض والكوبونات', [('offers_performance', offers_performance), ('coupons_usage', coupons_usage)]),
    ('المرتجعات', [('returns_list', returns_list), ('returns_by_reason', returns_by_reason), ('returns_by_item', returns_by_item)]),
    ('الخزينة والفلوس', [('treasury_balances', treasury_balances), ('cash_flow', cash_flow), ('owner_drawings', owner_drawings), ('manual_moves', manual_moves)]),
    ('الورديات والكاشيرية', [('shifts_list', shifts_list), ('cashier_diffs', cashier_diffs), ('custodies', custodies), ('cashier_performance', cashier_performance)]),
    ('المصروفات', [('expenses_by_category', expenses_by_category), ('expenses_monthly', expenses_monthly), ('expenses_cancelled', expenses_cancelled)]),
    ('الرقابة', [('price_changes', price_changes), ('manager_approvals', manager_approvals)]),
]
REPORTS = {k: fn for _, items in CATALOG for k, fn in items}


def run_report(tenant, name, params):
    fn = REPORTS.get(name)
    if not fn:
        return None
    try:
        out = fn(tenant, params)
    except Exception as ex:
        out = rep(name, [('err', 'غلطة')], [{'err': f'{type(ex).__name__}: {ex}'}])
        out['error'] = True
    out['period'] = period(params)
    return out


def catalog():
    return [{'group': g, 'items': [{'key': k, 'title': (fn.__doc__ or '').strip() or k} for k, fn in items]} for g, items in CATALOG]