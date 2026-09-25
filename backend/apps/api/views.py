from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.tenants.models import Tenant
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
from apps.pricing.models import PriceList, PriceListItem

from .serializers import (
    CategorySerializer, ProductSerializer, SupplierSerializer,
    PurchaseInvoiceSerializer, RawLotSerializer, SortingOrderSerializer,
    StockItemSerializer, SaleInvoiceSerializer, ShiftSerializer,
    TreasurySerializer, JournalEntrySerializer, PriceListItemSerializer
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'tenant') and user.tenant:
            return Category.objects.filter(tenant=user.tenant)
        return Category.objects.all()

    def perform_create(self, serializer):
        user = self.request.user
        tenant = getattr(user, 'tenant', None) if user and user.is_authenticated else None
        if not tenant:
            tenant = Tenant.objects.first()
        serializer.save(tenant=tenant)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'tenant') and user.tenant:
            return Product.objects.filter(tenant=user.tenant)
        return Product.objects.all()

    def perform_create(self, serializer):
        tenant = getattr(self.request.user, 'tenant', None) or Tenant.objects.first()
        category = serializer.validated_data.get('category')
        if not category:
            category, _ = Category.objects.get_or_create(
                tenant=tenant,
                name='عام',
                defaults={'code': 'CAT-GEN', 'is_active': True}
            )
        serializer.save(tenant=tenant, category=category)

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

class PurchaseInvoiceViewSet(viewsets.ModelViewSet):
    queryset = PurchaseInvoice.objects.all()
    serializer_class = PurchaseInvoiceSerializer

class RawLotViewSet(viewsets.ModelViewSet):
    queryset = RawLot.objects.all()
    serializer_class = RawLotSerializer

class SortingOrderViewSet(viewsets.ModelViewSet):
    queryset = SortingOrder.objects.all()
    serializer_class = SortingOrderSerializer

class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockItemSerializer

class SaleInvoiceViewSet(viewsets.ModelViewSet):
    queryset = SaleInvoice.objects.all()
    serializer_class = SaleInvoiceSerializer

class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer

class TreasuryViewSet(viewsets.ModelViewSet):
    queryset = Treasury.objects.all()
    serializer_class = TreasurySerializer

class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer

class PriceListItemViewSet(viewsets.ModelViewSet):
    queryset = PriceListItem.objects.all()
    serializer_class = PriceListItemSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'tenant') and user.tenant:
            return PriceListItem.objects.filter(tenant=user.tenant)
        return PriceListItem.objects.all()

    def perform_create(self, serializer):
        tenant = getattr(self.request.user, 'tenant', None) or Tenant.objects.first()
        serializer.save(tenant=tenant)