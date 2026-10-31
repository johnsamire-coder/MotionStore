"""
Puts back stock balances that drifted away from the inventory ledger.

Cause (fixed): deleting or editing a sale invoice with two lines on the same stock item gave
back only one of them, while both ledger rows were removed. The ledger (and the books, which
follow it) are right; only the cached balance on StockItem is wrong.

    python manage.py repair_stock_from_ledger            # preview only, writes nothing
    python manage.py repair_stock_from_ledger --apply    # set weight, pieces and value back to the ledger
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum


class Command(BaseCommand):
    help = "Set StockItem weight/pieces/value back to what the inventory ledger says (preview by default)"

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **opts):
        from apps.tenants.models import Tenant
        from apps.tenants.context import set_current_tenant
        from apps.inventory.models import StockItem, InventoryTransaction as T
        apply = opts['apply']
        self.stdout.write('APPLY MODE' if apply else 'PREVIEW ONLY - nothing will be written (add --apply)')
        cent = Decimal('0.01')
        for tenant in Tenant.objects.all():
            set_current_tenant(tenant)
            fixed, total = 0, Decimal('0')
            ids = T.objects.filter(tenant=tenant).order_by().values_list('stock_item_id', flat=True).distinct()
            for sid in ids:
                with transaction.atomic():
                    si = StockItem.objects.select_for_update().select_related('product', 'warehouse').get(pk=sid)
                    a = T.objects.filter(stock_item_id=sid).aggregate(w=Sum('weight_change_kg'), p=Sum('quantity_change_pieces'), v=Sum('total_cost_change'))
                    w, p, v = a['w'] or Decimal('0'), a['p'] or 0, (a['v'] or Decimal('0')).quantize(cent)
                    if w <= 0:
                        continue   # nothing left by the ledger: leave as is
                    if si.total_weight_kg == w and si.total_quantity_pieces == p and abs(si.current_total_value - v) < cent:
                        continue
                    gap = v - si.current_total_value
                    total += gap; fixed += 1
                    self.stdout.write(f"  {str(gap).rjust(10)} | kg {si.total_weight_kg} -> {w} | pcs {si.total_quantity_pieces} -> {p} | "
                                      f"value {si.current_total_value} -> {v} | {si.warehouse.name} | {si.product.name[:60]}")
                    if apply:
                        si.total_weight_kg, si.total_quantity_pieces, si.current_total_value = w, p, v
                        si.avg_cost_per_kg = (v / w).quantize(cent)
                        si.save(update_fields=['total_weight_kg', 'total_quantity_pieces', 'current_total_value', 'avg_cost_per_kg', 'updated_at'])
            self.stdout.write(f"[{tenant.name}] items: {fixed} | value put back: {total}" + ('' if apply else '  (preview)'))
        if apply:
            try:
                from apps.api.views import _rebuild_store_items
                for tenant in Tenant.objects.all():
                    set_current_tenant(tenant)
                    _rebuild_store_items(tenant)
                self.stdout.write(self.style.SUCCESS('Done. Shop availability refreshed.'))
            except Exception as ex:
                self.stdout.write(f'Done. (availability refresh skipped: {ex})')
