from apps.customers.models import Customer
from apps.payments.models import PaymentMethod
from apps.users.models import User
from apps.discounts.models import DiscountRule
from rest_framework import serializers
from apps.tenants.models import Tenant
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.warehouses.models import Warehouse
from apps.products.models import Category, Product
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice, PurchaseLineItem
from apps.raw_lots.models import RawLot
from apps.sorting.models import SortingOrder, SortingOutputLine, SortingWasteLine
from apps.costing.models import CostingConfiguration, CostingParameter
from apps.inventory.models import StockItem, InventoryTransaction
from apps.pricing.models import PriceList, PriceListItem, PriceHistory

from apps.treasury.models import Treasury, TreasuryTransaction
from apps.pos.models import POSTerminal
from apps.shifts.models import Shift
from apps.sales.models import SaleInvoice, SaleLineItem
from apps.returns.models import SalesReturn, SalesReturnLineItem
from apps.accounting.models import Account, JournalEntry

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = '__all__'

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'code', 'created_at', 'updated_at']
        extra_kwargs = {'tenant': {'required': False, 'allow_null': True}}
        validators = []

    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'code', 'created_at', 'updated_at']

class PurchaseLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseLineItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PurchaseInvoiceSerializer(serializers.ModelSerializer):
    items = PurchaseLineItemSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    class Meta:
        model = PurchaseInvoice
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class RawLotSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    line_info = serializers.SerializerMethodField()
    class Meta:
        model = RawLot
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def get_line_info(self, obj):
        li = getattr(obj, 'purchase_line_item', None)
        if not li or not li.purchase_kind:
            return None
        return {'kind': li.purchase_kind, 'grade': li.grade, 'bale_type': li.bale_type, 'segment': li.segment,
                'stock_type': li.stock_type, 'brand': li.brand, 'item_name': li.item_name}

class SortingOutputLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = SortingOutputLine
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SortingWasteLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SortingWasteLine
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SortingOrderSerializer(serializers.ModelSerializer):
    output_lines = SortingOutputLineSerializer(many=True, read_only=True)
    waste_lines = SortingWasteLineSerializer(many=True, read_only=True)
    class Meta:
        model = SortingOrder
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class StockItemSerializer(serializers.ModelSerializer):
    selling_price_per_kg = serializers.SerializerMethodField()
    line_info = serializers.SerializerMethodField()
    retail_price = serializers.ReadOnlyField(source='product.retail_price')
    warehouse_type = serializers.ReadOnlyField(source='warehouse.warehouse_type')
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    class Meta:
        model = StockItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

    def get_selling_price_per_kg(self, obj):  # pricing_v2
        from apps.pricing.models import WeightPrice
        info = self.get_line_info(obj)
        kind = info['kind'] if info else None
        key = ''
        if kind == 'STOCK':
            key = info.get('brand') if (info.get('stock_type') == 'ONE_BRAND' and info.get('brand')) else 'MIX'
        elif kind == 'DIRECT':
            key = info.get('item_name') or ''
        if kind:
            wp = WeightPrice.objects.filter(tenant=obj.tenant, kind=kind, key=key, grade=obj.grade).first()
            if wp and wp.price_per_kg > 0:
                return str(wp.price_per_kg)
        rp = getattr(obj.product, 'retail_price', None)
        return str(rp) if rp else None

    def get_line_info(self, obj):  # stock_line_info
        lot = getattr(obj, 'source_lot', None)
        li = getattr(lot, 'purchase_line_item', None) if lot else None
        if not li or not li.purchase_kind:
            return None
        return {'kind': li.purchase_kind, 'bale_type': li.bale_type, 'segment': li.segment, 'stock_type': li.stock_type, 'brand': li.brand, 'item_name': li.item_name}

class InventoryTransactionSerializer(serializers.ModelSerializer):
    warehouse_type = serializers.ReadOnlyField(source='warehouse.warehouse_type')
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    class Meta:
        model = InventoryTransaction
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PriceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceList
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PriceListItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = PriceListItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class POSTerminalSerializer(serializers.ModelSerializer):
    class Meta:
        model = POSTerminal
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class ShiftSerializer(serializers.ModelSerializer):
    cashier_username = serializers.ReadOnlyField(source='cashier.username')
    class Meta:
        model = Shift
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SaleLineItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = SaleLineItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SaleInvoiceSerializer(serializers.ModelSerializer):
    lines = SaleLineItemSerializer(many=True, read_only=True)
    cashier_username = serializers.ReadOnlyField(source='cashier.username')
    branch_name = serializers.ReadOnlyField(source='branch.name')
    class Meta:
        model = SaleInvoice
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class TreasuryTransactionSerializer(serializers.ModelSerializer):
    treasury_name = serializers.ReadOnlyField(source='treasury.name')
    class Meta:
        model = TreasuryTransaction
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SalesReturnLineItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = SalesReturnLineItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SalesReturnSerializer(serializers.ModelSerializer):
    lines = SalesReturnLineItemSerializer(many=True, read_only=True)
    cashier_username = serializers.ReadOnlyField(source='cashier.username')
    original_invoice_number = serializers.ReadOnlyField(source='original_sale_invoice.invoice_number')
    class Meta:
        model = SalesReturn
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PriceHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    changed_by_username = serializers.ReadOnlyField(source='changed_by.username')
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    class Meta:
        model = PriceHistory
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class DiscountRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountRule
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class UserManagementSerializer(serializers.ModelSerializer):
    tenant_name = serializers.ReadOnlyField(source='tenant.name')
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'role_display', 'tenant', 'tenant_name', 'assigned_branches', 'is_active', 'password', 'date_joined']
        read_only_fields = ['id', 'tenant', 'date_joined']

class TreasurySerializer(serializers.ModelSerializer):
    class Meta:
        model = Treasury
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = '__all__'

from apps.purchasing.models import PurchaseOption

class PurchaseOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOption
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

from apps.transfers.models import TransferOrder, TransferLineItem

class TransferLineItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = TransferLineItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class TransferOrderSerializer(serializers.ModelSerializer):
    lines = TransferLineItemSerializer(many=True, read_only=True)
    source_name = serializers.ReadOnlyField(source='source_warehouse.name')
    destination_name = serializers.ReadOnlyField(source='destination_warehouse.name')
    requested_by_name = serializers.ReadOnlyField(source='requested_by.username')
    class Meta:
        model = TransferOrder
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

from apps.pricing.models import WeightPrice, PieceItem, PriceChangeLog

class WeightPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightPrice
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PieceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PieceItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PriceChangeLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.ReadOnlyField(source='changed_by.username')
    class Meta:
        model = PriceChangeLog
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']
