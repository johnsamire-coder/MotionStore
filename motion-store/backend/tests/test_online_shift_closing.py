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


class PerfumeCounterTest(StockBandsFollowSalesTest):
    """ Perfume counter sales: their own drawer and their own closing, out of the cashier closing """

    def test_perfume_sales_have_their_own_drawer_and_closing(self):
        from rest_framework.test import APIClient
        from apps.users.models import User
        from apps.sales.services import PERFUME_DRAWER_NAME
        self._stock(self.shop, 20, 10)
        code = self._code()
        boss = User.objects.create_user(username="boss4", password="Pass2026Password", role="ADMIN", tenant=self.tenant)
        safe = Treasury.objects.create(tenant=self.tenant, name="الخزنة الرئيسية", branch=self.branch, treasury_type=TreasuryType.MAIN_SAFE)
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        item = lambda n: [{'piece_item_id': code.id, 'quantity_pieces': n, 'weight_kg': '0', 'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}]
        process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item(1), payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('50.00')}])
        p = process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item(4), payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('200.00')}], perfume=True)
        self.assertEqual(p.channel, 'PERFUME')
        with self.assertRaises(ValidationError):
            process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item(1), payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('50.00')}], perfume=True, online={'name': 'x'})
        process_sales_return_v2(p.id, shift.id, self.user, [{'sale_line_id': p.lines.first().id, 'quantity_pieces': 1, 'weight_kg': '0'}], refund_method_id=self.pm_cash.id)

        pdr = Treasury.objects.get(tenant=self.tenant, name=PERFUME_DRAWER_NAME)
        self.assertEqual(pdr.current_balance, Decimal('150.00'))
        self.drawer.refresh_from_db()
        self.assertEqual(self.drawer.current_balance, Decimal('550.00'))          # only the store sale

        s = ShiftViewSet()._summary(shift)
        self.assertEqual((s['invoices'], Decimal(s['sales_total']), Decimal(s['expected'])), (1, Decimal('50.00'), Decimal('550.00')))
        self.assertEqual(s['returns_by_method'], [])
        self.assertEqual((s['perfume_count'], Decimal(s['perfume_total']), Decimal(s['perfume_returns_total']), Decimal(s['perfume_net_total'])),
                         (1, Decimal('200.00'), Decimal('50.00'), Decimal('150.00')))
        self.assertEqual(Decimal(s['perfume_drawer_balance']), Decimal('150.00'))

        c = APIClient(); c.force_authenticate(user=boss)
        url = f'/api/v1/shifts/{shift.id}/perfume_close/'
        self.assertEqual(c.post(url, {'actual_cash': '140'}, format='json').status_code, 403)
        r = c.post(url, {'actual_cash': '140', 'handover_amount': '140', 'destination': 'TREASURY', 'treasury_id': str(safe.id), 'manager_password': 'Pass2026Password'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['difference'], r.data['remaining']), ('-10.00', '0.00'))
        safe.refresh_from_db(); self.assertEqual(safe.current_balance, Decimal('140.00'))
        self.drawer.refresh_from_db(); self.assertEqual(self.drawer.current_balance, Decimal('550.00'))


class PerfumeDrawerAnyTimeTest(PerfumeCounterTest):
    def test_perfume_drawer_without_a_shift_and_handed_to_a_person(self):
        from rest_framework.test import APIClient
        from apps.users.models import User
        from apps.shifts.services import close_shift
        from apps.sales.services import PERFUME_DRAWER_NAME
        self._stock(self.shop, 20, 10)
        code = self._code()
        boss = User.objects.create_user(username="boss5", password="Pass2026Password", role="ADMIN", tenant=self.tenant)
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=[{'piece_item_id': code.id, 'quantity_pieces': 2, 'weight_kg': '0', 'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}],
                         payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('100.00')}], perfume=True)
        shift.status = 'CLOSED'; shift.save()
        c = APIClient(); c.force_authenticate(user=boss)
        r = c.get('/api/v1/shifts/perfume_drawer/')
        self.assertEqual((r.status_code, r.data['balance']), (200, '100.00'))
        pw = {'manager_password': 'Pass2026Password'}
        self.assertEqual(c.post('/api/v1/shifts/perfume_drawer/', {'actual_cash': '100', 'handover_amount': '100', 'destination': 'PERSON', **pw}, format='json').status_code, 400)  # name needed
        r = c.post('/api/v1/shifts/perfume_drawer/', {'actual_cash': '100', 'handover_amount': '100', 'destination': 'PERSON', 'receiver': 'أستاذ جون', **pw}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['remaining'], r.data['receiver']), ('0.00', 'أستاذ جون'))
        self.assertEqual(Treasury.objects.get(tenant=self.tenant, name=PERFUME_DRAWER_NAME).current_balance, Decimal('0.00'))


class PerfumeSalesReportTest(StockBandsFollowSalesTest):
    def test_perfume_sales_by_channel(self):
        from apps.api import reports_v2
        self._stock(self.shop, 20, 10)
        code = self._code()                                          # named «برفيوم»
        bank = Treasury.objects.create(tenant=self.tenant, name="InstaPay", branch=self.branch, treasury_type=TreasuryType.BANK)
        insta = PaymentMethod.objects.create(tenant=self.tenant, name="إنستاباي", method_type=PaymentMethodType.ELECTRONIC, treasury=bank)
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        item = lambda n: [{'piece_item_id': code.id, 'quantity_pieces': n, 'weight_kg': '0', 'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}]
        p = process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item(4), payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('200.00')}], perfume=True)
        process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item(1), payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('50.00')}])
        process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item(2), payments_data=[{'payment_method': insta, 'amount': Decimal('100.00')}], online={'name': 'x'})
        process_sales_return_v2(p.id, shift.id, self.user, [{'sale_line_id': p.lines.first().id, 'quantity_pieces': 1, 'weight_kg': '0'}], refund_method_id=self.pm_cash.id)
        r = reports_v2.perfume_sales(self.tenant, {})
        cards = {c['label'].split(' (')[0]: c['value'] for c in r['cards']}
        self.assertEqual(cards['🌸 برفانات محل'], 150.0)            # 200 - 50 returned
        self.assertEqual(cards['🛒 أونلاين'], 100.0)
        self.assertEqual(cards['🏪 بيع عادي في المحل'], 50.0)
        self.assertEqual(cards['إجمالي البرفانات'], 300.0)
        self.assertEqual((r['totals']['amount'], r['totals']['pcs']), (300.0, 6))
