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
from apps.pricing.models import PriceList, PriceListItem
from apps.discounts.models import DiscountRule
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
    class Meta:
        model = RawLot
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

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
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    class Meta:
        model = StockItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class InventoryTransactionSerializer(serializers.ModelSerializer):
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
