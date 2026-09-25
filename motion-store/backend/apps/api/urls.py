from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.api.views import *

router = DefaultRouter()
router.register(r"companies", CompanyViewSet, basename="companies")
router.register(r"branches", BranchViewSet, basename="branches")
router.register(r"warehouses", WarehouseViewSet, basename="warehouses")
router.register(r"categories", CategoryViewSet, basename="categories")
router.register(r"products", ProductViewSet, basename="products")
router.register(r"suppliers", SupplierViewSet, basename="suppliers")
router.register(r"purchases", PurchaseInvoiceViewSet, basename="purchases")
router.register(r"purchase-line-items", PurchaseLineItemViewSet, basename="purchase-line-items")
router.register(r"raw-lots", RawLotViewSet, basename="raw-lots")
router.register(r"sorting-orders", SortingOrderViewSet, basename="sorting-orders")
router.register(r"stock-items", StockItemViewSet, basename="stock-items")
router.register(r"inventory-ledger", InventoryTransactionViewSet, basename="inventory-ledger")
router.register(r"price-lists", PriceListViewSet, basename="price-lists")
router.register(r"price-list-items", PriceListItemViewSet, basename="price-list-items")
router.register(r"price-history", PriceHistoryViewSet, basename="price-history")
router.register(r"discount-rules", DiscountRuleViewSet, basename="discount-rules")
router.register(r"role-permissions", RolePermissionViewSet, basename="role-permissions")
router.register(r"users", UserViewSet, basename="users")
router.register(r"pos-terminals", POSTerminalViewSet, basename="pos-terminals")
router.register(r"shifts", ShiftViewSet, basename="shifts")
router.register(r"sales", SaleInvoiceViewSet, basename="sales")
router.register(r"journal-entries", JournalEntryViewSet, basename="journal-entries")
router.register(r"treasury-transactions", TreasuryTransactionViewSet, basename="treasury-transactions")
router.register(r"returns", SalesReturnViewSet, basename="returns")

urlpatterns = [
    path("", include(router.urls)),
]
