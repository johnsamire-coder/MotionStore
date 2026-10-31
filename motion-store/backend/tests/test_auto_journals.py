from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenants.models import Tenant
from apps.tenants.context import set_current_tenant
from apps.users.models import User
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.warehouses.models import Warehouse
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice
from apps.raw_lots.models import RawLot
from apps.accounting.models import JournalEntry, JournalEntryLine
from apps.accounting.services import init_standard_chart_of_accounts

PWD = 'Pass2026Password'


class PurchaseAndSortingJournalsTest(TestCase):
    """ Purchases and sortings post their own journal entries, and never get blocked by them """

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Motion JV", slug="motion-jv")
        set_current_tenant(self.tenant)
        init_standard_chart_of_accounts(self.tenant)
        company = Company.objects.create(tenant=self.tenant, name="JV Co", currency="EGP")
        branch = Branch.objects.create(tenant=self.tenant, company=company, name="Main")
        self.wh = Warehouse.objects.create(tenant=self.tenant, branch=branch, name="Store", warehouse_type="MAIN")
        self.sup = Supplier.objects.create(tenant=self.tenant, name="Seller", code="SUP-1")
        self.boss = User.objects.create_user(username="boss", password=PWD, role="ADMIN", tenant=self.tenant)
        self.c = APIClient()
        self.c.force_authenticate(user=self.boss)
        self.c.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))

    # ---- helpers
    def _item(self, weight='50', price='100'):
        return {'purchase_kind': 'BALE', 'weight_kg': weight, 'unit_price': price, 'quantity': 1, 'segment': 'حريمي',
                'season': 'صيفي', 'grade': 'كريم', 'item_name': 'بلوزة', 'ton_type': 'NORMAL'}

    def _buy(self, freight='0', **kw):
        r = self.c.post('/api/v1/purchases/', {'supplier_id': str(self.sup.id), 'warehouse_id': str(self.wh.id),
                                               'freight_cost': freight, 'items': [self._item(**kw)]}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return PurchaseInvoice.objects.get(pk=r.data['id'])

    def _net(self, code, doc_type=None, doc_id=None):
        qs = JournalEntryLine.objects.filter(tenant=self.tenant, account__code=code)
        if doc_type:
            qs = qs.filter(journal_entry__source_document_type=doc_type, journal_entry__source_document_id=str(doc_id))
        a = qs.aggregate(d=Sum('debit'), c=Sum('credit'))
        return (a['d'] or Decimal('0')) - (a['c'] or Decimal('0'))

    def _all_balanced(self):
        for je in JournalEntry.objects.filter(tenant=self.tenant):
            a = je.lines.aggregate(d=Sum('debit'), c=Sum('credit')) if hasattr(je, 'lines') else \
                JournalEntryLine.objects.filter(journal_entry=je).aggregate(d=Sum('debit'), c=Sum('credit'))
            self.assertEqual(a['d'], a['c'], je.entry_number)

    # ---- tests
    def test_purchase_posts_raw_bales_against_supplier(self):
        inv = self._buy(freight='200')                                     # 50kg x 100 + 200 freight
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('5200.00'))
        self.assertEqual(self._net('2010', 'PurchaseInvoice', inv.id), Decimal('-5200.00'))
        self._all_balanced()

    def test_edit_and_cancel_post_only_the_difference(self):
        inv = self._buy()
        r = self.c.post(f'/api/v1/purchases/{inv.id}/edit/', {'manager_password': PWD, 'freight_cost': '300'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('5300.00'))
        self.assertEqual(JournalEntry.objects.filter(source_document_id=str(inv.id)).count(), 2)  # original + adjustment
        r = self.c.post(f'/api/v1/purchases/{inv.id}/cancel/', {'manager_password': PWD, 'reason': 'غلط'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('0.00'))
        self.assertEqual(self._net('2010', 'PurchaseInvoice', inv.id), Decimal('0.00'))
        self._all_balanced()

    def test_replace_keeps_one_invoice_in_the_books(self):
        inv = self._buy()
        r = self.c.post(f'/api/v1/purchases/{inv.id}/replace/', {'manager_password': PWD, 'supplier_id': str(self.sup.id),
                        'warehouse_id': str(self.wh.id), 'freight_cost': '0', 'items': [self._item(weight='40')]}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._net('1010'), Decimal('4000.00'))          # nothing left from the temporary copy
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('4000.00'))
        self._all_balanced()

    def test_sorting_moves_cost_to_finished_goods_and_waste(self):
        inv = self._buy()                                                  # lot cost 5000, 50 kg
        lot = RawLot.objects.get(purchase_invoice=inv)
        r = self.c.post(f'/api/v1/raw-lots/{lot.id}/sort_and_transfer/', {'lines': [
            {'grade': 'HIGH', 'weight_kg': '45', 'quantity_pieces': 90},
            {'grade': 'WASTE', 'weight_kg': '5', 'quantity_pieces': 0}]}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._net('1010'), Decimal('0.00'))              # raw bale fully cleared
        good, loss = self._net('1020'), self._net('5020')
        self.assertEqual(good + loss, Decimal('5000.00'))
        self.assertGreater(good, Decimal('0'))
        from apps.inventory.models import StockItem
        stock_value = StockItem.objects.filter(tenant=self.tenant).aggregate(v=Sum('current_total_value'))['v']
        self.assertEqual(good, stock_value)                                # books = inventory value
        self._all_balanced()

    def test_journal_failure_never_blocks_purchase_and_backfill_posts_it_later(self):
        from unittest import mock
        with mock.patch('apps.accounting.services.create_balanced_journal_entry', side_effect=RuntimeError('boom')):
            inv = self._buy()                                              # still saved (201)
        self.assertTrue(RawLot.objects.filter(purchase_invoice=inv).exists())
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('0'))

        out = StringIO()
        call_command('post_missing_journals', stdout=out)                 # preview writes nothing
        self.assertIn(inv.invoice_number, out.getvalue())
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('0'))
        call_command('post_missing_journals', '--apply', stdout=StringIO())
        self.assertEqual(self._net('1010', 'PurchaseInvoice', inv.id), Decimal('5000.00'))
        call_command('post_missing_journals', '--apply', stdout=StringIO())   # running again changes nothing
        self.assertEqual(JournalEntry.objects.filter(source_document_id=str(inv.id)).count(), 1)

    def _cash(self, balance='10000'):
        from apps.treasury.models import Treasury, TreasuryType
        from apps.payments.models import PaymentMethod, PaymentMethodType
        safe = Treasury.objects.create(tenant=self.tenant, name="Main Safe", treasury_type=TreasuryType.MAIN_SAFE,
                                       branch=self.wh.branch, current_balance=Decimal(balance))
        return PaymentMethod.objects.create(tenant=self.tenant, name="Cash", method_type=PaymentMethodType.CASH, treasury=safe)

    def test_supplier_payment_clears_the_supplier(self):
        inv = self._buy()                                                  # we owe 5000
        pm = self._cash()
        r = self.c.post(f'/api/v1/suppliers/{self.sup.id}/pay/', {'amount': '3000', 'payment_method_id': str(pm.id),
                        'purchase_invoice_id': str(inv.id)}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self._net('2010'), Decimal('-2000.00'))          # 5000 owed - 3000 paid
        self.assertEqual(self._net('1030'), Decimal('-3000.00'))
        r = self.c.post(f'/api/v1/suppliers/{self.sup.id}/pay/', {'amount': '2000', 'payment_method_id': 'OWNER'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self._net('2010'), Decimal('0.00'))
        self.assertEqual(self._net('3010'), Decimal('-2000.00'))          # owner's own money
        self.assertEqual(self._net('1030'), Decimal('-3000.00'))
        self._all_balanced()

    def test_supplier_payment_failure_never_blocks_and_backfill_posts_it(self):
        from unittest import mock
        pm = self._cash()
        with mock.patch('apps.accounting.services.create_balanced_journal_entry', side_effect=RuntimeError('boom')):
            r = self.c.post(f'/api/v1/suppliers/{self.sup.id}/pay/', {'amount': '500', 'payment_method_id': str(pm.id)}, format='json')
        self.assertEqual(r.status_code, 201, r.data)                      # payment saved, money left the safe
        pm.treasury.refresh_from_db()
        self.assertEqual(pm.treasury.current_balance, Decimal('9500.00'))
        self.assertEqual(self._net('2010'), Decimal('0'))
        call_command('post_missing_journals', '--apply', stdout=StringIO())
        call_command('post_missing_journals', '--apply', stdout=StringIO())
        self.assertEqual(self._net('2010'), Decimal('500.00'))
        self.assertEqual(self._net('1030'), Decimal('-500.00'))
        self.assertEqual(JournalEntry.objects.filter(source_document_type='SupplierPayment').count(), 1)
