from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, ProductViewSet, SupplierViewSet, PurchaseInvoiceViewSet,
    RawLotViewSet, SortingOrderViewSet, StockItemViewSet,
    SaleInvoiceViewSet, ShiftViewSet, TreasuryViewSet,
    JournalEntryViewSet, PriceListItemViewSet
)

router = DefaultRouter()
router.register(r'products/items', ProductViewSet, basename='product')
router.register(r'products', ProductViewSet, basename='product-main')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'purchases', PurchaseInvoiceViewSet, basename='purchase')
router.register(r'raw-lots', RawLotViewSet, basename='raw-lot')
router.register(r'sorting-orders', SortingOrderViewSet, basename='sorting-order')
router.register(r'inventory/stock', StockItemViewSet, basename='stock-item')
router.register(r'sales', SaleInvoiceViewSet, basename='sale')
router.register(r'shifts', ShiftViewSet, basename='shift')
router.register(r'treasuries', TreasuryViewSet, basename='treasury')
router.register(r'accounting/entries', JournalEntryViewSet, basename='journal-entry')
router.register(r'pricing/price-list-items', PriceListItemViewSet, basename='pricelist-item')

urlpatterns = [
    # Explicit Category List/Create Endpoint to avoid DRF URL Collision
    path('products/categories/', CategoryViewSet.as_view({'get': 'list', 'post': 'create'}), name='category-list-create'),
    path('products/categories/<uuid:pk>/', CategoryViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='category-detail'),
    path('categories/', CategoryViewSet.as_view({'get': 'list', 'post': 'create'}), name='category-alt-list'),
    path('', include(router.urls)),
]