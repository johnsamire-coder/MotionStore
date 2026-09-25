import uuid
from rest_framework import serializers

from apps.products.models import Category, Product
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice
from apps.raw_lots.models import RawLot
from apps.sorting.models import SortingOrder
from apps.inventory.models import StockItem
from apps.sales.models import SaleInvoice
from apps.shifts.models import Shift
from apps.treasury.models import Treasury
from apps.accounting.models import JournalEntry
from apps.pricing.models import PriceListItem

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ('tenant', 'id', 'created_at', 'updated_at')

class ProductSerializer(serializers.ModelSerializer):
    barcode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ('tenant', 'id', 'created_at', 'updated_at')

    def validate(self, attrs):
        if not attrs.get('barcode'):
            attrs['barcode'] = attrs.get('code') or f"BC-{uuid.uuid4().hex[:8].upper()}"
        return attrs

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

class PurchaseInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseInvoice
        fields = '__all__'

class RawLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawLot
        fields = '__all__'

class SortingOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = SortingOrder
        fields = '__all__'

class StockItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockItem
        fields = '__all__'

class SaleInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleInvoice
        fields = '__all__'

class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = '__all__'

class TreasurySerializer(serializers.ModelSerializer):
    class Meta:
        model = Treasury
        fields = '__all__'

class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = '__all__'

class PriceListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceListItem
        fields = '__all__'
        read_only_fields = ('tenant', 'id', 'created_at', 'updated_at')