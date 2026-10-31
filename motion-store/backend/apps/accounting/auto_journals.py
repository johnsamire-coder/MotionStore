"""
Automatic journal entries for purchases and sorting.

    Purchase invoice:  Dr 1010 Raw Bale Inventory  /  Cr 2010 Suppliers        (invoice total incl. freight)
    Sorting a lot:     Dr 1020 Finished Goods      (cost that went into stock)
                       Dr 5020 Sorting Waste Loss  (the rest of the lot cost)
                       /  Cr 1010 Raw Bale Inventory (full lot cost)

Safety rules (the shop is live):
  * Every posting runs in its own savepoint and never raises: if it fails, the purchase or
    sorting that called it is saved exactly as before, and the entry can be posted later
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
