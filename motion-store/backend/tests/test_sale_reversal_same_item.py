from decimal import Decimal
from django.db.models import Sum
from rest_framework.test import APIClient
from apps.users.models import User
from apps.inventory.models import StockItem, InventoryTransaction
from apps.shifts.services import open_shift
from apps.sales.services import process_pos_sale
from tests.test_stock_bands_refresh import StockBandsFollowSalesTest

PWD = 'Pass2026Password'


class SaleReversalWithTwoLinesOfTheSameItemTest(StockBandsFollowSalesTest):
    """ Deleting or editing an invoice that has two lines on the same stock item must give BOTH lines back """

    def _ledger(self, si):
        a = InventoryTransaction.objects.filter(stock_item=si).aggregate(w=Sum('weight_change_kg'), p=Sum('quantity_change_pieces'), v=Sum('total_cost_change'))
        return a['w'] or Decimal('0'), a['p'] or 0, a['v'] or Decimal('0')

    def _setup_sale(self):
        si = self._stock(self.shop, 10, 5)                      # 5 kg, 10 pcs, value 1000 (no opening ledger row)
        InventoryTransaction.objects.create(tenant=self.tenant, transaction_type='SORT_IN', stock_item=si, product=si.product,
                                            grade=si.grade, warehouse=si.warehouse, weight_change_kg=Decimal('5.000'),
                                            quantity_change_pieces=10, unit_cost=Decimal('200.00'), total_cost_change=Decimal('1000.00'),
                                            source_document_type='Opening', source_document_id='open', running_weight_balance=Decimal('5.000'))
        self.boss = User.objects.create_user(username="boss3", password=PWD, role="ADMIN", tenant=self.tenant)
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        inv = process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=[
            {'stock_item_id': si.id, 'weight_kg': '1.000', 'quantity_pieces': 2, 'unit_price': Decimal('100.00'), 'price_mode': 'KG'},
            {'stock_item_id': si.id, 'weight_kg': '0.500', 'quantity_pieces': 1, 'unit_price': Decimal('100.00'), 'price_mode': 'KG'}],
            payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('150.00')}])
        si.refresh_from_db()
        self.assertEqual(si.total_weight_kg, Decimal('3.500'))
        c = APIClient(); c.force_authenticate(user=self.boss); c.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))
        return si, inv, shift, c

    def test_delete_gives_back_both_lines(self):
        si, inv, shift, c = self._setup_sale()
        r = c.post(f'/api/v1/sales/{inv.id}/delete_sale/', {'manager_password': PWD}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        si.refresh_from_db()
        self.assertEqual(si.total_weight_kg, Decimal('5.000'))
        self.assertEqual(si.total_quantity_pieces, 10)
        self.assertEqual(si.current_total_value, Decimal('1000.00'))
        w, p, v = self._ledger(si)
        self.assertEqual((si.total_weight_kg, si.total_quantity_pieces, si.current_total_value), (w, p, v))

    def test_edit_keeps_stock_equal_to_ledger(self):
        si, inv, shift, c = self._setup_sale()
        r = c.post(f'/api/v1/sales/{inv.id}/replace/', {'manager_password': PWD, 'shift_id': str(shift.id),
                   'items': [{'stock_item_id': str(si.id), 'weight_kg': '0.500', 'quantity_pieces': 1, 'unit_price': '100.00', 'price_mode': 'KG'}],
                   'payments': [{'payment_method_id': str(self.pm_cash.id), 'amount': '50.00'}]}, format='json')
        self.assertIn(r.status_code, (200, 201), r.data)
        si.refresh_from_db()
        self.assertEqual(si.total_weight_kg, Decimal('4.500'))
        self.assertEqual(si.total_quantity_pieces, 9)
        w, p, v = self._ledger(si)
        self.assertEqual((si.total_weight_kg, si.total_quantity_pieces, si.current_total_value), (w, p, v))

    def test_repair_command_puts_old_drift_back(self):
        from io import StringIO
        from django.core.management import call_command
        si, inv, shift, c = self._setup_sale()
        StockItem.objects.filter(pk=si.pk).update(total_weight_kg=Decimal('2.500'), total_quantity_pieces=6,
                                                   current_total_value=Decimal('500.00'))   # what the old bug left behind
        call_command('repair_stock_from_ledger', stdout=StringIO())                       # preview: nothing changes
        si.refresh_from_db(); self.assertEqual(si.total_weight_kg, Decimal('2.500'))
        call_command('repair_stock_from_ledger', '--apply', stdout=StringIO())
        si.refresh_from_db()
        w, p, v = self._ledger(si)
        self.assertEqual((si.total_weight_kg, si.total_quantity_pieces, si.current_total_value), (w, p, v))
        self.assertEqual(si.total_weight_kg, Decimal('3.500'))
