"""
Posts the purchase, sorting and supplier payment journal entries that are missing (data entered before the
automatic entries existed, or an entry that failed). Safe to run any number of times.

    python manage.py post_missing_journals            # preview only, writes nothing
    python manage.py post_missing_journals --apply    # post the missing entries
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Post missing purchase (Dr 1010 / Cr 2010), sorting (Dr 1020 + 5020 / Cr 1010) and supplier payment (Dr 2010 / Cr 1030) journal entries"

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Actually post (default is preview only)')

    def handle(self, *args, **opts):
        from apps.tenants.models import Tenant
        from apps.tenants.context import set_current_tenant
        from apps.purchasing.models import PurchaseInvoice
        from apps.sorting.models import SortingOrder
        from apps.inventory.models import InventoryTransaction
        from apps.accounting.models import JournalEntry
        from apps.suppliers.models import SupplierPayment
        from apps.accounting.auto_journals import (sync_purchase_journal, post_sorting_journal, post_supplier_payment_journal,
                                                   _posted_on, _q, RAW, ZERO)
        apply = opts['apply']
        self.stdout.write('APPLY MODE - posting entries' if apply else 'PREVIEW ONLY - nothing will be written (add --apply to post)')
        grand = {'pur': 0, 'srt': 0, 'pay': 0, 'fail': 0}
        for tenant in Tenant.objects.all():
            set_current_tenant(tenant)
            pur_todo, srt_todo = [], []
            for inv in PurchaseInvoice.objects.filter(tenant=tenant).order_by('invoice_date', 'created_at'):
                target = ZERO if str(inv.status) == 'CANCELLED' else _q(inv.total_cost)
                if target != _posted_on(tenant, 'PurchaseInvoice', inv.id, RAW):
                    pur_todo.append(inv)
            done_ids = set(InventoryTransaction.objects.filter(tenant=tenant, source_document_type='SortingOrder')
                           .values_list('source_document_id', flat=True))
            posted_ids = set(JournalEntry.objects.filter(tenant=tenant, source_document_type='SortingOrder')
                             .values_list('source_document_id', flat=True))
            for order in SortingOrder.objects.filter(tenant=tenant).select_related('raw_lot').order_by('sorting_date', 'created_at'):
                if str(order.id) in done_ids and str(order.id) not in posted_ids:
                    srt_todo.append(order)
            paid_ids = set(JournalEntry.objects.filter(tenant=tenant, source_document_type='SupplierPayment')
                           .values_list('source_document_id', flat=True))
            pay_todo = [p for p in SupplierPayment.objects.filter(tenant=tenant).select_related('supplier').order_by('created_at')
                        if str(p.id) not in paid_ids and _q(p.amount) > ZERO]
            if not pur_todo and not srt_todo and not pay_todo:
                continue
            pur_total = sum((_q(i.total_cost) for i in pur_todo if str(i.status) != 'CANCELLED'), Decimal('0'))
            srt_total = sum((_q(o.raw_lot.purchase_cost) for o in srt_todo), Decimal('0'))
            pay_total = sum((_q(p.amount) for p in pay_todo), Decimal('0'))
            self.stdout.write(f"\n[{tenant.name}] purchases: {len(pur_todo)} (total {pur_total}) | sortings: {len(srt_todo)} (lot cost {srt_total})"
                              f" | supplier payments: {len(pay_todo)} (total {pay_total})")
            for i in pur_todo:
                self.stdout.write(f"  purchase {i.invoice_number}  {i.invoice_date}  {i.total_cost}  {i.status}")
            for o in srt_todo:
                self.stdout.write(f"  sorting  {o.order_code}  {o.sorting_date}  lot {o.raw_lot.lot_code}  {o.raw_lot.purchase_cost}")
            for p in pay_todo:
                self.stdout.write(f"  payment  {p.supplier.name}  {p.created_at.date()}  {p.amount}")
            if not apply:
                continue
            # purchases first (raw bales in), then sortings (raw bales out), each dated on its own document
            for i in pur_todo:
                ok = sync_purchase_journal(i)
                grand['pur' if ok else 'fail'] += 1
            for o in srt_todo:
                ok = post_sorting_journal(o)
                grand['srt' if ok else 'fail'] += 1
            for p in pay_todo:
                ok = post_supplier_payment_journal(p)
                grand['pay' if ok else 'fail'] += 1
        if apply:
            self.stdout.write(self.style.SUCCESS(f"\nDone: {grand['pur']} purchase entries, {grand['srt']} sorting entries, {grand['pay']} supplier payment entries, {grand['fail']} failed"))
        else:
            self.stdout.write("\nPreview finished.")
