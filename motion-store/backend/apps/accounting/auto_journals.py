"""
Automatic journal entries for purchases, sorting and supplier payments.

    Purchase invoice:  Dr 1010 Raw Bale Inventory  /  Cr 2010 Suppliers        (invoice total incl. freight)
    Sorting a lot:     Dr 1020 Finished Goods      (cost that went into stock)
                       Dr 5020 Sorting Waste Loss  (the rest of the lot cost)
                       /  Cr 1010 Raw Bale Inventory (full lot cost)
    Supplier payment:  Dr 2010 Suppliers  /  Cr 1030 Cash  (Cr 3010 when the owner paid from his own money)

Safety rules (the shop is live):
  * Every posting runs in its own savepoint and never raises: if it fails, the purchase or
    sorting that called it is saved exactly as before (same for a supplier payment), and the entry can be posted later
    with `python manage.py post_missing_journals`.
  * Postings are idempotent: the purchase entry is kept equal to the invoice (an edit or a
    cancel posts only the difference as a new adjusting entry, nothing is deleted), and a
    sorting order is posted once.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

logger = logging.getLogger(__name__)

ZERO = Decimal('0.00')
RAW, FINISHED, SUPPLIERS, WASTE_LOSS = '1010', '1020', '2010', '5020'


def _q(v) -> Decimal:
    return Decimal(str(v or 0)).quantize(Decimal('0.01'))


def _ensure_accounts(tenant):
    from apps.accounting.services import init_standard_chart_of_accounts
    init_standard_chart_of_accounts(tenant)  # get_or_create only: never changes existing accounts


def _posted_on(tenant, doc_type, doc_id, code) -> Decimal:
    """ Net (debit - credit) already posted on one account for one source document. """
    from apps.accounting.models import JournalEntryLine
    agg = JournalEntryLine.objects.filter(
        tenant=tenant, account__code=code,
        journal_entry__tenant=tenant,
        journal_entry__source_document_type=doc_type,
        journal_entry__source_document_id=str(doc_id),
    ).aggregate(d=Sum('debit'), c=Sum('credit'))
    return _q(agg['d']) - _q(agg['c'])


def _next_number(tenant, base) -> str:
    from apps.accounting.models import JournalEntry
    if not JournalEntry.objects.filter(tenant=tenant, entry_number=base).exists():
        return base
    n = 1
    while JournalEntry.objects.filter(tenant=tenant, entry_number=f"{base}-ADJ{n}").exists():
        n += 1
    return f"{base}-ADJ{n}"


def _line(code, amount, desc):
    """ Positive amount = debit, negative = credit. """
    amount = _q(amount)
    return {'account_code': code, 'debit': amount if amount > 0 else ZERO,
            'credit': -amount if amount < 0 else ZERO, 'desc': desc[:255]}


def sync_purchase_journal(invoice, entry_date=None) -> bool:
    """ Makes the posted amount for this purchase invoice equal its current total (0 if cancelled). """
    from django.utils import timezone
    from apps.accounting.services import create_balanced_journal_entry
    try:
        with transaction.atomic():
            tenant = invoice.tenant
            _ensure_accounts(tenant)
            target = ZERO if str(invoice.status) == 'CANCELLED' else _q(invoice.total_cost)
            posted = _posted_on(tenant, 'PurchaseInvoice', invoice.id, RAW)
            diff = target - posted
            if diff == ZERO:
                return True
            num = invoice.invoice_number
            first = posted == ZERO and target > ZERO
            if first:
                note = f"Purchase Invoice #{num}"
                when = entry_date or invoice.invoice_date or timezone.localdate()
            else:
                note = (f"Cancel Purchase Invoice #{num}" if target == ZERO else f"Edit Purchase Invoice #{num}")
                when = entry_date or timezone.localdate()
            create_balanced_journal_entry(
                tenant=tenant,
                entry_number=_next_number(tenant, f"JV-PUR-{num}"),
                entry_date=when,
                source_document_type='PurchaseInvoice',
                source_document_id=str(invoice.id),
                notes=note,
                lines_data=[_line(RAW, diff, f"Raw bales {note}"), _line(SUPPLIERS, -diff, f"Supplier {note}")],
            )
        return True
    except Exception:
        logger.exception("Purchase journal not posted for invoice %s", getattr(invoice, 'invoice_number', '?'))
        return False


def post_sorting_journal(order, entry_date=None) -> bool:
    """ Moves the lot cost out of raw bales: the stocked cost to finished goods, the rest to sorting waste loss. """
    from django.utils import timezone
    from apps.accounting.models import JournalEntry
    from apps.accounting.services import create_balanced_journal_entry
    try:
        with transaction.atomic():
            tenant = order.tenant
            if JournalEntry.objects.filter(tenant=tenant, source_document_type='SortingOrder',
                                           source_document_id=str(order.id)).exists():
                return True
            lot_cost = _q(order.raw_lot.purchase_cost)
            good = _q(sum((_q(l.allocated_cost) for l in order.output_lines.all()), ZERO))
            loss = lot_cost - good
            if lot_cost == ZERO and good == ZERO:
                return True
            _ensure_accounts(tenant)
            code = order.order_code
            lines = [_line(FINISHED, good, f"Sorted goods #{code}")]
            if loss != ZERO:
                lines.append(_line(WASTE_LOSS, loss, f"Sorting waste #{code}"))
            lines.append(_line(RAW, -lot_cost, f"Raw lot {order.raw_lot.lot_code} sorted #{code}"))
            lines = [l for l in lines if l['debit'] or l['credit']]
            create_balanced_journal_entry(
                tenant=tenant,
                entry_number=_next_number(tenant, f"JV-SRT-{code}"),
                entry_date=entry_date or order.sorting_date or timezone.localdate(),
                source_document_type='SortingOrder',
                source_document_id=str(order.id),
                notes=f"Sorting #{code} - Lot {order.raw_lot.lot_code}",
                lines_data=lines,
            )
        return True
    except Exception:
        logger.exception("Sorting journal not posted for order %s", getattr(order, 'order_code', '?'))
        return False


CASH, OWNER_EQUITY = '1030', '3010'
OWNER_TREASURY_NAME = 'جاري صاحب المحل'


def _supplier_payment_credit_account(payment) -> str:
    """ Owner paid from his own pocket -> 3010 (owner capital). Any treasury -> 1030, like sales and expenses. """
    from apps.treasury.models import TreasuryTransaction
    tt = TreasuryTransaction.objects.filter(tenant=payment.tenant, source_document_type='SupplierPayment',
                                            source_document_id=str(payment.id)).select_related('treasury').first()
    if tt is not None and getattr(tt.treasury, 'name', '') == OWNER_TREASURY_NAME:
        return OWNER_EQUITY
    if tt is None and payment.payment_method_id is None:
        return OWNER_EQUITY
    return CASH


def post_supplier_payment_journal(payment, entry_date=None) -> bool:
    """ Dr 2010 Suppliers / Cr 1030 Cash (or 3010 when the owner paid from his own money). Posted once. """
    from apps.accounting.models import JournalEntry
    from apps.accounting.services import create_balanced_journal_entry
    try:
        with transaction.atomic():
            tenant = payment.tenant
            if JournalEntry.objects.filter(tenant=tenant, source_document_type='SupplierPayment',
                                           source_document_id=str(payment.id)).exists():
                return True
            amt = _q(payment.amount)
            if amt <= ZERO:
                return True
            _ensure_accounts(tenant)
            credit = _supplier_payment_credit_account(payment)
            name = getattr(payment.supplier, 'name', '')
            short = str(payment.id).split('-')[0].upper()
            create_balanced_journal_entry(
                tenant=tenant,
                entry_number=_next_number(tenant, f"JV-SPAY-{short}"),
                entry_date=entry_date or payment.created_at.date(),
                source_document_type='SupplierPayment',
                source_document_id=str(payment.id),
                notes=f"Supplier payment - {name}" + (' (owner money)' if credit == OWNER_EQUITY else ''),
                lines_data=[_line(SUPPLIERS, amt, f"Paid to supplier {name}"),
                            _line(credit, -amt, f"Supplier payment {name}")],
            )
        return True
    except Exception:
        logger.exception("Supplier payment journal not posted for payment %s", getattr(payment, 'id', '?'))
        return False


EMPLOYEES = '1060'


def sync_staff_entry_journal(entry, entry_date=None) -> bool:
    """ Advance:   Dr 1060 Employee receivables / Cr 1030 Cash
        Repayment: Dr 1030 Cash / Cr 1060 Employee receivables
        A cancelled entry is brought back to zero by a reversing entry (nothing is deleted).
        Deductions and bonuses post nothing here: they are booked when the payroll is approved. """
    from django.utils import timezone
    from apps.accounting.services import create_balanced_journal_entry
    sign = {'ADVANCE': 1, 'REPAYMENT': -1}.get(entry.kind)
    if sign is None:
        return True
    try:
        with transaction.atomic():
            tenant = entry.tenant
            _ensure_accounts(tenant)
            target = ZERO if entry.cancelled else _q(entry.amount) * sign
            posted = _posted_on(tenant, 'StaffLedger', entry.id, EMPLOYEES)
            diff = target - posted
            if diff == ZERO:
                return True
            name = entry.employee.name
            first = posted == ZERO
            label = {'ADVANCE': 'Advance', 'REPAYMENT': 'Repayment'}[entry.kind]
            note = f"{label} {entry.number} - {name}" + ('' if first else ' (cancelled)')
            create_balanced_journal_entry(
                tenant=tenant,
                entry_number=_next_number(tenant, f"JV-{entry.number}"),
                entry_date=entry_date or (entry.date if first else timezone.localdate()),
                source_document_type='StaffLedger',
                source_document_id=str(entry.id),
                notes=note,
                lines_data=[_line(EMPLOYEES, diff, f"Employee {name} {entry.number}"),
                            _line(CASH, -diff, f"Cash {entry.number}")],
            )
        return True
    except Exception:
        logger.exception("Staff ledger journal not posted for %s", getattr(entry, 'number', '?'))
        return False


SALARIES_PAYABLE, PENALTY_INCOME, SALARIES = '2030', '4030', '5110'


def post_payroll_journal(run) -> bool:
    """ On approval, once per run:
        Dr 5110 salaries (pay earned after attendance deductions)   Dr 1060 shortfalls kept on the employees
        Cr 4030 penalties   Cr 1060 advances/goods taken back   Cr 2030 net to pay """
    from apps.accounting.models import JournalEntry
    from apps.accounting.services import create_balanced_journal_entry
    from apps.staff.services import earnings_of
    try:
        with transaction.atomic():
            tenant = run.tenant
            if JournalEntry.objects.filter(tenant=tenant, source_document_type='PayrollRun', source_document_id=str(run.id)).exists():
                return True
            lines = list(run.lines.all())
            earn = _q(sum((earnings_of(l) for l in lines), ZERO))
            pen = _q(sum((l.penalties for l in lines), ZERO))
            rec = _q(sum((l.recovered for l in lines), ZERO))
            net = _q(sum((l.net for l in lines), ZERO))
            short = _q(sum((l.shortfall for l in lines), ZERO))
            if not any((earn, pen, rec, net, short)):
                return True
            _ensure_accounts(tenant)
            data = [_line(SALARIES, earn, f"Salaries {run.number}"), _line(EMPLOYEES, short - rec, f"Employees recovered/shortfall {run.number}"),
                    _line(PENALTY_INCOME, -pen, f"Penalties {run.number}"), _line(SALARIES_PAYABLE, -net, f"Net payable {run.number}")]
            data = [l for l in data if l['debit'] or l['credit']]
            create_balanced_journal_entry(tenant=tenant, entry_number=_next_number(tenant, f"JV-{run.number}"), entry_date=run.period_end,
                                          source_document_type='PayrollRun', source_document_id=str(run.id),
                                          notes=f"Payroll {run.number} {run.period_start} - {run.period_end}", lines_data=data)
        return True
    except Exception:
        logger.exception("Payroll journal not posted for %s", getattr(run, 'number', '?'))
        return False


def post_payroll_payment_journal(run, amount=None, when=None, tag=None) -> bool:
    """ Dr 2030 / Cr 1030 for whatever was paid and not posted yet (all payments of the run add up). """
    from django.db.models import Sum
    from django.utils import timezone
    from apps.accounting.services import create_balanced_journal_entry
    try:
        with transaction.atomic():
            tenant = run.tenant
            paid = _q(run.lines.aggregate(x=Sum('paid_amount'))['x'] or 0)
            posted = _posted_on(tenant, 'PayrollPayment', run.id, SALARIES_PAYABLE)
            diff = paid - posted
            if diff == ZERO:
                return True
            _ensure_accounts(tenant)
            create_balanced_journal_entry(tenant=tenant, entry_number=_next_number(tenant, f"JV-PAY-{run.number}"), entry_date=when or timezone.localdate(),
                                          source_document_type='PayrollPayment', source_document_id=str(run.id), notes=f"Salaries paid {run.number}",
                                          lines_data=[_line(SALARIES_PAYABLE, diff, f"Paid {run.number}"), _line(CASH, -diff, f"Cash {run.number}")])
        return True
    except Exception:
        logger.exception("Payroll payment journal not posted for %s", getattr(run, 'number', '?'))
        return False
