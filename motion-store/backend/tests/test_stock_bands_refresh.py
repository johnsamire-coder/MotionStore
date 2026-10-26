import datetime
from decimal import Decimal
from django.test import TestCase, RequestFactory
from apps.tenants.models import Tenant
from apps.tenants.context import set_current_tenant
from apps.users.models import User
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.warehouses.models import Warehouse
from apps.products.models import Category, Product, GradeChoice, UnitOfMeasure
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice, PurchaseLineItem, InvoiceStatus
from apps.raw_lots.models import RawLot, RawLotStatus
from apps.inventory.models import StockItem
from apps.pricing.models import PieceItem, StoreItem
from apps.treasury.models import Treasury, TreasuryType
from apps.payments.models import PaymentMethod, PaymentMethodType
from apps.pos.models import POSTerminal
from apps.shifts.services import open_shift
from apps.sales.services import process_pos_sale
from apps.returns.services import process_sales_return_v2
from apps.accounting.services import init_standard_chart_of_accounts
from apps.api.serializers import PieceItemSerializer
from apps.api.views import _rebuild_store_items

PERFUME_GRADE = 'سوبر كريم'


class StockBandsFollowSalesTest(TestCase):
    """ The availability a code shows must follow the real stock after a sale or a return """

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Motion Bands", slug="motion-bands")
        set_current_tenant(self.tenant)
        init_standard_chart_of_accounts(self.tenant)
        self.company = Company.objects.create(tenant=self.tenant, name="Motion Bands Co", currency="EGP")
        self.branch = Branch.objects.create(tenant=self.tenant, company=self.company, name="Main Branch")
        self.shop = Warehouse.objects.create(tenant=self.tenant, branch=self.branch, name="Shop", warehouse_type="MAIN")
        self.other_shop = Warehouse.objects.create(tenant=self.tenant, branch=self.branch, name="Second Shop", warehouse_type="MAIN")
        self.drawer = Treasury.objects.create(tenant=self.tenant, name="POS Drawer", branch=self.branch, treasury_type=TreasuryType.POS_DRAWER)
        self.pm_cash = PaymentMethod.objects.create(tenant=self.tenant, name="Cash", method_type=PaymentMethodType.CASH, treasury=self.drawer)
        self.user = User.objects.create_user(username="cashier1", password="Pass2026Password", role="CASHIER", tenant=self.tenant)
        self.terminal = POSTerminal.objects.create(tenant=self.tenant, name="POS 1", code="POS-01", branch=self.branch,
                                                   default_warehouse=self.shop, cash_drawer=self.drawer)
        self.category = Category.objects.create(tenant=self.tenant, name="Perfume", code="PRF")
        self.product = Product.objects.create(tenant=self.tenant, category=self.category, name="Perfume", unit_of_measure=UnitOfMeasure.BOTH)
        self.supplier = Supplier.objects.create(tenant=self.tenant, name="Seller", code="SUP-1")
        self.rf = RequestFactory()

    def _stock(self, warehouse, pieces, weight_kg):
        """ One shipment of the perfume in stock, with the purchase identity the code is bound to """
        invoice = PurchaseInvoice.objects.create(tenant=self.tenant, supplier=self.supplier, warehouse=warehouse,
                                                 invoice_number=f"PINV-{warehouse.name}", invoice_date=datetime.date.today(),
                                                 status=InvoiceStatus.CONFIRMED)
        line = PurchaseLineItem.objects.create(tenant=self.tenant, invoice=invoice, description="Perfume bale",
                                               category=self.category, weight_kg=Decimal(str(weight_kg)),
                                               unit_cost=Decimal('10.00'), total_cost=Decimal('1000.00'),
                                               purchase_kind='BALE', grade=PERFUME_GRADE, segment='حريمي', season='صيفي',
                                               item_name='برفيوم', brand='بدون براند')
        lot = RawLot.objects.create(tenant=self.tenant, lot_code=f"LOT-{warehouse.name}", purchase_invoice=invoice,
                                    supplier=self.supplier, purchase_line_item=line, warehouse=warehouse,
                                    original_weight_kg=Decimal(str(weight_kg)), purchase_cost=Decimal('1000.00'),
                                    status=RawLotStatus.RECEIVED, received_date=datetime.date.today())
        return StockItem.objects.create(tenant=self.tenant, product=self.product, grade=GradeChoice.NEW_COLLECTION,
                                        warehouse=warehouse, source_lot=lot, total_weight_kg=Decimal(str(weight_kg)),
                                        total_quantity_pieces=pieces, avg_cost_per_kg=Decimal('10.00'),
                                        current_total_value=Decimal('1000.00'))

    def _code(self):
        _rebuild_store_items(self.tenant)
        code = PieceItem.objects.create(tenant=self.tenant, code="P-1", name="برفيوم", source_kind='BALE',
                                        segment='حريمي', season='صيفي', purchase_grade=PERFUME_GRADE,
                                        price_per_piece=Decimal('50.00'), price_per_kg=Decimal('100.00'))
        StoreItem.objects.filter(tenant=self.tenant, category_name='برفيوم').update(coding_item=code)
        _rebuild_store_items(self.tenant)
        return code

    def _available(self, code, warehouse=None):
        req = self.rf.get('/piece-items/', {'warehouse': warehouse.id} if warehouse else {})
        return PieceItemSerializer(code, context={'request': req}).data['total_available_pieces']

    def test_sale_drops_the_code_availability(self):
        si = self._stock(self.shop, 10, 5)
        code = self._code()
        self.assertEqual(self._available(code), 10)

        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        invoice = process_pos_sale(
            shift_id=shift.id, cashier=self.user,
            items_data=[{'piece_item_id': code.id, 'quantity_pieces': 3, 'weight_kg': '0',
                         'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}],
            payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('150.00')}]
        )
        self.assertEqual(invoice.total_amount, Decimal('150.00'))

        si.refresh_from_db()
        self.assertEqual(si.total_quantity_pieces, 7)
        self.assertEqual(self._available(code), 7)
        self.assertEqual(StoreItem.objects.get(tenant=self.tenant, coding_item=code, warehouse=self.shop).quantity_pieces, 7)

    def test_return_raises_the_code_availability(self):
        si = self._stock(self.shop, 10, 5)
        code = self._code()
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        invoice = process_pos_sale(
            shift_id=shift.id, cashier=self.user,
            items_data=[{'piece_item_id': code.id, 'quantity_pieces': 4, 'weight_kg': '0',
                         'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}],
            payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('200.00')}]
        )
        self.assertEqual(self._available(code), 6)

        process_sales_return_v2(invoice.id, shift.id, self.user,
                                [{'sale_line_id': invoice.lines.first().id, 'quantity_pieces': 2, 'weight_kg': '0'}])
        si.refresh_from_db()
        self.assertEqual(si.total_quantity_pieces, 8)
        self.assertEqual(self._available(code), 8)

    def test_availability_can_be_scoped_to_one_warehouse(self):
        self._stock(self.shop, 10, 5)
        code = self._code()
        self._stock(self.other_shop, 4, 2)
        _rebuild_store_items(self.tenant)
        self.assertEqual(self._available(code), 14)
        self.assertEqual(self._available(code, warehouse=self.shop), 10)
        self.assertEqual(self._available(code, warehouse=self.other_shop), 4)

    def test_the_pos_codes_list_shows_the_new_number(self):
        """ What the POS table reads over HTTP, after a service sale and after a real checkout """
        from rest_framework.test import APIClient
        boss = User.objects.create_user(username="boss1", password="Pass2026Password", role="ADMIN", tenant=self.tenant)
        self._stock(self.shop, 10, 5)
        code = self._code()
        client = APIClient()
        client.force_authenticate(user=boss)
        url = f'/api/v1/piece-items/?warehouse={self.shop.id}'

        def rows():
            body = client.get(url).data
            return (body.get('results') if isinstance(body, dict) else body) or []

        self.assertEqual([r for r in rows() if r['id'] == str(code.id)][0]['total_available_pieces'], 10)
        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))
        process_pos_sale(
            shift_id=shift.id, cashier=self.user,
            items_data=[{'piece_item_id': code.id, 'quantity_pieces': 3, 'weight_kg': '0',
                         'unit_price': Decimal('50.00'), 'price_mode': 'PIECE'}],
            payments_data=[{'payment_method': self.pm_cash, 'amount': Decimal('150.00')}]
        )
        self.assertEqual([r for r in rows() if r['id'] == str(code.id)][0]['total_available_pieces'], 7)

        resp = client.post('/api/v1/sales/checkout/', {
            'shift_id': str(shift.id),
            'items': [{'piece_item_id': str(code.id), 'quantity_pieces': 2, 'weight_kg': '0',
                       'unit_price': '50.00', 'price_mode': 'PIECE'}],
            'payments': [{'payment_method_id': str(self.pm_cash.id), 'amount': '100.00'}],
            'discount_amount': '0.00'
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual([r for r in rows() if r['id'] == str(code.id)][0]['total_available_pieces'], 5)
        si = StockItem.objects.get(tenant=self.tenant, warehouse=self.shop)
        self.assertEqual(si.total_quantity_pieces, 5)
