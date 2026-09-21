import datetime
from decimal import Decimal
from django.test import TestCase
from apps.tenants.models import Tenant
from apps.tenants.context import set_current_tenant
from apps.users.models import User
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.warehouses.models import Warehouse
from apps.products.models import Category, Product, GradeChoice, UnitOfMeasure
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice, PurchaseLineItem, InvoiceStatus, PurchaseItemType
from apps.raw_lots.models import RawLot, RawLotStatus
from apps.sorting.models import SortingOrder, SortingOutputLine, SortingWasteLine, SortingStatus, WasteClassification
from apps.costing.models import CostingConfiguration, CostingParameter, CostingMethod, WasteTreatment
from apps.costing.services import calculate_sorting_costs
from apps.inventory.models import StockItem, InventoryTransaction
from apps.inventory.services import post_sorting_to_inventory
from apps.pricing.models import PriceList, PriceListItem
from apps.treasury.models import Treasury, TreasuryType
from apps.payments.models import PaymentMethod, PaymentMethodType
from apps.pos.models import POSTerminal
from apps.shifts.models import Shift, ShiftStatus
from apps.shifts.services import open_shift, close_shift
from apps.sales.models import SaleInvoice
from apps.sales.services import process_pos_sale
from apps.accounting.models import Account, JournalEntry
from apps.accounting.services import init_standard_chart_of_accounts
from apps.reports.services import get_sales_performance_summary, get_bale_profitability_summary

class MotionStoreEndToEndMasterFlowTest(TestCase):
    """
    Automated System-Wide Test validating the Complete Business & Accounting Cycle:
    Supplier -> Purchase -> Bale Receiving -> Sorting -> Costing -> Inventory Ledger -> POS Shift -> Sale -> COGS -> Accounting Double-Entry
    """
    def setUp(self):
        # 1. Foundation setup
        self.tenant = Tenant.objects.create(name="Motion Master SaaS", slug="motion-master")
        set_current_tenant(self.tenant)
        self.accounts = init_standard_chart_of_accounts(self.tenant)

        self.company = Company.objects.create(name="Motion Enterprise", currency="EGP")
        self.branch = Branch.objects.create(company=self.company, name="Cairo Branch")
        self.sorting_wh = Warehouse.objects.create(branch=self.branch, name="Sorting Hub", warehouse_type="SORTING")
        self.retail_wh = Warehouse.objects.create(branch=self.branch, name="Retail Store", warehouse_type="MAIN")
        self.safe = Treasury.objects.create(name="Main Safe", branch=self.branch, treasury_type=TreasuryType.MAIN_SAFE)
        self.drawer = Treasury.objects.create(name="POS Drawer", branch=self.branch, treasury_type=TreasuryType.POS_DRAWER)
        self.pm_cash = PaymentMethod.objects.create(name="Cash", method_type=PaymentMethodType.CASH, treasury=self.drawer)

        self.user = User.objects.create_user(username="lead_cashier", password="Pass2026Password", role="CASHIER", tenant=self.tenant)
        self.terminal = POSTerminal.objects.create(name="POS 1", code="POS-01", branch=self.branch, default_warehouse=self.retail_wh, cash_drawer=self.drawer)

        self.category = Category.objects.create(name="Apparel", code="APP")
        self.product = Product.objects.create(category=self.category, name="Assorted Thrift Garments", unit_of_measure=UnitOfMeasure.BOTH)

    def test_complete_bale_lifecycle_and_accounting_flow(self):
        # === PHASE 1: SUPPLIER & PURCHASE ===
        supplier = Supplier.objects.create(name="Global European Bales", code="SUP-EUR")
        invoice = PurchaseInvoice.objects.create(
            supplier=supplier,
            warehouse=self.sorting_wh,
            invoice_number="PINV-1001",
            invoice_date=datetime.date.today(),
            status=InvoiceStatus.CONFIRMED
        )
        PurchaseLineItem.objects.create(
            invoice=invoice,
            item_type=PurchaseItemType.RAW_BALE,
            description="100KG Mixed Bale",
            category=self.category,
            weight_kg=Decimal('100.000'),
            unit_cost=Decimal('100.00'),
            total_cost=Decimal('10000.00')
        )
        invoice.recalculate_totals()
        self.assertEqual(invoice.total_cost, Decimal('10000.00'))

        # === PHASE 2: RAW BALE RECEIVING ===
        raw_lot = RawLot.objects.create(
            lot_code="LOT-100-KG",
            purchase_invoice=invoice,
            supplier=supplier,
            warehouse=self.sorting_wh,
            original_weight_kg=Decimal('100.000'),
            purchase_cost=Decimal('10000.00'),
            status=RawLotStatus.RECEIVED,
            received_date=datetime.date.today()
        )

        # === PHASE 3: SORTING & RECONCILIATION ===
        order = SortingOrder.objects.create(
            order_code="SORT-1001",
            raw_lot=raw_lot,
            sorting_date=datetime.date.today()
        )
        SortingOutputLine.objects.create(sorting_order=order, grade=GradeChoice.NEW_COLLECTION, product=self.product, weight_kg=Decimal('30.000'), warehouse=self.retail_wh)
        SortingOutputLine.objects.create(sorting_order=order, grade=GradeChoice.MIDDLE, product=self.product, weight_kg=Decimal('50.000'), warehouse=self.retail_wh)
        SortingOutputLine.objects.create(sorting_order=order, grade=GradeChoice.CLEARANCE, product=self.product, weight_kg=Decimal('10.000'), warehouse=self.retail_wh)
        SortingWasteLine.objects.create(sorting_order=order, weight_kg=Decimal('10.000'), classification=WasteClassification.NORMAL)

        is_balanced = order.reconcile()
        self.assertTrue(is_balanced)

        # === PHASE 4: COSTING ENGINE (Method B & Case 2) ===
        config = CostingConfiguration.objects.create(
            tenant=self.tenant,
            is_active=True,
            method=CostingMethod.COEFFICIENTS,
            waste_treatment=WasteTreatment.SEPARATE
        )
        CostingParameter.objects.create(configuration=config, grade=GradeChoice.NEW_COLLECTION, coefficient=Decimal('3.00'))
        CostingParameter.objects.create(configuration=config, grade=GradeChoice.MIDDLE, coefficient=Decimal('1.50'))
        CostingParameter.objects.create(configuration=config, grade=GradeChoice.CLEARANCE, coefficient=Decimal('0.50'))

        calc_record = calculate_sorting_costs(order.id)
        self.assertEqual(calc_record.waste_loss_amount, Decimal('1000.00'))

        # === PHASE 5: INVENTORY LEDGER POSTING ===
        txns = post_sorting_to_inventory(order.id)
        self.assertEqual(len(txns), 3)

        item_new = StockItem.objects.get(grade=GradeChoice.NEW_COLLECTION)
        item_mid = StockItem.objects.get(grade=GradeChoice.MIDDLE)
        item_clr = StockItem.objects.get(grade=GradeChoice.CLEARANCE)
        self.assertEqual(item_new.total_weight_kg, Decimal('30.000'))
        self.assertEqual(item_mid.total_weight_kg, Decimal('50.000'))
        self.assertEqual(item_clr.total_weight_kg, Decimal('10.000'))

        # === PHASE 6: PRICING & POS SHIFT ===
        price_list = PriceList.objects.create(name="Retail Prices", is_default=True)
        PriceListItem.objects.create(price_list=price_list, product=self.product, grade=GradeChoice.NEW_COLLECTION, price_per_kg=Decimal('300.00'))
        PriceListItem.objects.create(price_list=price_list, product=self.product, grade=GradeChoice.MIDDLE, price_per_kg=Decimal('150.00'))
        PriceListItem.objects.create(price_list=price_list, product=self.product, grade=GradeChoice.CLEARANCE, price_per_kg=Decimal('50.00'))

        shift = open_shift(self.terminal.id, self.user, Decimal('500.00'))

        # === PHASE 7: PARTIAL SALE (10KG New + 20KG Mid + 5KG Clear) ===
        sale_items = [
            {'stock_item_id': item_new.id, 'weight_kg': Decimal('10.000'), 'unit_price': Decimal('300.00')},
            {'stock_item_id': item_mid.id, 'weight_kg': Decimal('20.000'), 'unit_price': Decimal('150.00')},
            {'stock_item_id': item_clr.id, 'weight_kg': Decimal('5.000'), 'unit_price': Decimal('50.00')}
        ]
        payments = [{'payment_method': self.pm_cash, 'amount': Decimal('6250.00')}]

        sale_inv = process_pos_sale(
            shift_id=shift.id,
            cashier=self.user,
            items_data=sale_items,
            payments_data=payments
        )

        self.assertEqual(sale_inv.total_amount, Decimal('6250.00'))

        # Verify stock decrements
        item_new.refresh_from_db()
        item_mid.refresh_from_db()
        item_clr.refresh_from_db()
        self.assertEqual(item_new.total_weight_kg, Decimal('20.000'))
        self.assertEqual(item_mid.total_weight_kg, Decimal('30.000'))
        self.assertEqual(item_clr.total_weight_kg, Decimal('5.000'))

        # === PHASE 8: SHIFT CLOSING & TREASURY ===
        closed_shift = close_shift(shift.id, actual_cash=Decimal('6750.00'))  # 500 float + 6250 sale
        self.assertEqual(closed_shift.status, ShiftStatus.CLOSED)
        self.assertEqual(closed_shift.difference, Decimal('0.00'))

        # === PHASE 9: ACCOUNTING INTEGRATION CHECK ===
        jv_sale = JournalEntry.objects.get(source_document_id=str(sale_inv.id))
        self.assertEqual(jv_sale.total_debit, jv_sale.total_credit)

        # === PHASE 10: REPORTING AUDIT ===
        bale_rep = get_bale_profitability_summary(self.tenant, raw_lot.id)
        self.assertEqual(bale_rep['sold_revenue'], Decimal('6250.00'))
        self.assertEqual(bale_rep['sold_weight_kg'], Decimal('35.000'))
        self.assertEqual(bale_rep['remaining_stock_weight_kg'], Decimal('55.000'))
