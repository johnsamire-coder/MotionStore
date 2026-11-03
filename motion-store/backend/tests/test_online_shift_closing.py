from decimal import Decimal
from django.core.exceptions import ValidationError
from apps.treasury.models import Treasury, TreasuryType
from apps.payments.models import PaymentMethod, PaymentMethodType
from apps.shifts.services import open_shift
from apps.sales.services import process_pos_sale
from apps.returns.services import process_sales_return_v2
from apps.api.views import ShiftViewSet
from tests.test_stock_bands_refresh import StockBandsFollowSalesTest


class OnlineOrdersHaveTheirOwnClosingTest(StockBandsFollowSalesTest):
    """ Online orders are closed on their own, away from the cash drawer closing """

    def _sale(self, shift, code, pieces, pm, online=None):
        return process_pos_sale(shift_id=shift.id, cashier=self.user,
                                items_data=[{'piece_item_id': code.id, 'quantity_pieces': pieces, 'weight_kg': '0', 'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}],
                                payments_data=[{'payment_method': pm, 'amount': Decimal('50.00') * pieces}], online=online)

    def test_online_sales_and_returns_stay_out_of_the_cash_closing(self):
        self._stock(self.shop, 20, 10)
        code = self._code()
        bank = Treasury.objects.create(tenant=self.tenant, name="InstaPay", branch=self.branch, treasury_type=TreasuryType.BANK)
        pm_insta = PaymentMethod.objects.create(tenant=self.tenant, name="إنستاباي", method_type=PaymentMethodType.ELECTRONIC, treasury=bank)
        pm_no_tr = PaymentMethod.objects.create(tenant=self.tenant, name="محفظة من غير خزنة", method_type=PaymentMethodType.ELECTRONIC)
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))

        self._sale(shift, code, 3, self.pm_cash)                                   # store: 150 cash
        onl = self._sale(shift, code, 2, pm_insta, online={'name': 'Mona', 'courier': 'Bosta'})  # online: 100 instapay
        with self.assertRaises(ValidationError):                                  # would land in the drawer
            self._sale(shift, code, 1, pm_no_tr, online={'name': 'x'})
        with self.assertRaises(ValidationError):
            self._sale(shift, code, 1, self.pm_cash, online={'name': 'x'})
        process_sales_return_v2(onl.id, shift.id, self.user, [{'sale_line_id': onl.lines.first().id, 'quantity_pieces': 1, 'weight_kg': '0'}], refund_method_id=pm_insta.id)

        s = ShiftViewSet()._summary(shift)
        self.assertEqual(Decimal(s['sales_total']), Decimal('150.00'))
        self.assertEqual(s['invoices'], 1)
        self.assertEqual([m['method'] for m in s['by_method']], ['Cash'])
        self.assertEqual(Decimal(s['expected']), Decimal('650.00'))
        self.assertEqual(s['returns_by_method'], [])
        self.assertEqual(s['online_count'], 1)
        self.assertEqual(Decimal(s['online_total']), Decimal('100.00'))
        self.assertEqual(Decimal(s['online_returns_total']), Decimal('50.00'))
        self.assertEqual(Decimal(s['online_net_total']), Decimal('50.00'))
        self.assertEqual(s['online_orders'][0]['courier'], 'Bosta')
        self.assertNotIn('OnlineInDrawer', [m['key'] for m in s['moves']])

    def test_payment_methods_list_creates_cash_on_delivery_methods(self):
        from rest_framework.test import APIClient
        from apps.users.models import User
        boss = User.objects.create_user(username="boss2", password="Pass2026Password", role="ADMIN", tenant=self.tenant)
        c = APIClient(); c.force_authenticate(user=boss)
        self.assertEqual(c.get('/api/v1/payments/').status_code, 200)
        cod = PaymentMethod.objects.get(tenant=self.tenant, name='عند الاستلام - مندوب')
        self.assertNotEqual(cod.treasury_id, self.drawer.id)


class ShiftCashInTest(StockBandsFollowSalesTest):
    """ Money put in the drawer that is not a sale: counted in the drawer, listed on its own in the closing """

    def test_owner_treasury_and_other_cash_in(self):
        from rest_framework.test import APIClient
        from apps.users.models import User
        from apps.api import reports_v2
        boss = User.objects.create_user(username="boss3", password="Pass2026Password", role="ADMIN", tenant=self.tenant)
        safe = Treasury.objects.create(tenant=self.tenant, name="الخزنة الرئيسية", branch=self.branch, treasury_type=TreasuryType.MAIN_SAFE, current_balance=Decimal('1000'))
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        c = APIClient(); c.force_authenticate(user=boss)
        url = f'/api/v1/shifts/{shift.id}/cash_in/'
        self.assertEqual(c.post(url, {'source': 'OWNER', 'amount': '2000'}, format='json').status_code, 403)          # no manager password
        pw = {'manager_password': 'Pass2026Password'}
        self.assertEqual(c.post(url, {'source': 'OWNER', 'amount': '2000', 'notes': 'المرتبات', **pw}, format='json').status_code, 200)
        self.assertEqual(c.post(url, {'source': 'TREASURY', 'treasury_id': str(safe.id), 'amount': '300', **pw}, format='json').status_code, 200)
        self.assertEqual(c.post(url, {'source': 'OTHER', 'amount': '50', **pw}, format='json').status_code, 400)       # reason needed
        self.assertEqual(c.post(url, {'source': 'OTHER', 'amount': '50', 'notes': 'بيع كراتين', **pw}, format='json').status_code, 200)
        self.assertEqual(c.post(url, {'source': 'TREASURY', 'treasury_id': str(safe.id), 'amount': '5000', **pw}, format='json').status_code, 400)  # not enough

        s = ShiftViewSet()._summary(shift)
        self.assertEqual(Decimal(s['expected']), Decimal('2850.00'))
        self.assertEqual(Decimal(s['sales_total']), Decimal('0'))
        self.assertEqual([c_['label'] for c_ in s['cash_in']], ['فلوس من صاحب المحل', 'فلوس جاية من خزنة تانية', 'وارد تاني (مش بيع)'])
        self.assertEqual(Decimal(s['cash_in_total']), Decimal('2350.00'))
        self.assertIn('المرتبات', s['cash_in'][0]['notes'])
        safe.refresh_from_db(); self.assertEqual(safe.current_balance, Decimal('700.00'))
        rep = reports_v2.owner_deposits(self.tenant, {})
        self.assertEqual(rep['totals']['amount'], 2050.0)
