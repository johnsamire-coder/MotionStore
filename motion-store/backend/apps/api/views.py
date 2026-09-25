from apps.users.models import RolePermission
from apps.users.serializers import RolePermissionSerializer
from apps.discounts.models import DiscountRule
from apps.returns.models import SalesReturn
from apps.treasury.models import TreasuryTransaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from apps.tenants.models import Tenant
from apps.tenants.context import get_current_tenant
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.warehouses.models import Warehouse
from apps.products.models import Category, Product
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice
from apps.raw_lots.models import RawLot
from apps.sorting.models import SortingOrder
from apps.costing.services import calculate_sorting_costs
from apps.inventory.models import StockItem, InventoryTransaction
from apps.inventory.services import post_sorting_to_inventory
from apps.pricing.models import PriceList, PriceListItem, PriceHistory
from apps.pos.models import POSTerminal
from apps.shifts.models import Shift
from apps.shifts.services import open_shift, close_shift
from apps.sales.models import SaleInvoice
from apps.sales.services import process_pos_sale
from apps.accounting.models import JournalEntry
from apps.api.serializers import *

class BaseTenantViewSet(viewsets.ModelViewSet):
    def get_tenant(self):
        tenant = getattr(self.request, 'tenant', None) or get_current_tenant()
        if not tenant and hasattr(self.request, 'user') and self.request.user.is_authenticated:
            tenant = getattr(self.request.user, 'tenant', None)
        if not tenant:
            tenant = Tenant.objects.filter(is_active=True).first()
        return tenant

    def get_queryset(self):
        tenant = self.get_tenant()
        if tenant:
            return self.model.objects.filter(tenant=tenant)
        return self.model.objects.all()

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        serializer.save(tenant=tenant)

class CompanyViewSet(BaseTenantViewSet):
    model = Company
    serializer_class = CompanySerializer

class BranchViewSet(BaseTenantViewSet):
    model = Branch
    serializer_class = BranchSerializer

class WarehouseViewSet(BaseTenantViewSet):
    model = Warehouse
    serializer_class = WarehouseSerializer

class CategoryViewSet(BaseTenantViewSet):
    model = Category
    serializer_class = CategorySerializer

class ProductViewSet(BaseTenantViewSet):
    model = Product
    serializer_class = ProductSerializer

class SupplierViewSet(BaseTenantViewSet):
    model = Supplier
    serializer_class = SupplierSerializer

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        name = request.data.get('name', '').strip()
        
        # Check if supplier with same name exists for this tenant
        existing = Supplier.objects.filter(tenant=tenant, name__iexact=name).first() if tenant else Supplier.objects.filter(name__iexact=name).first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        return super().create(request, *args, **kwargs)

class PurchaseInvoiceViewSet(BaseTenantViewSet):
    model = PurchaseInvoice
    serializer_class = PurchaseInvoiceSerializer

class RawLotViewSet(BaseTenantViewSet):
    model = RawLot
    serializer_class = RawLotSerializer

class SortingOrderViewSet(BaseTenantViewSet):
    model = SortingOrder
    serializer_class = SortingOrderSerializer

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        order = self.get_object()
        is_balanced = order.reconcile()
        return Response({'balanced': is_balanced, 'status': order.reconciliation_status})

    @action(detail=True, methods=['post'])
    def calculate_costing(self, request, pk=None):
        order = self.get_object()
        record = calculate_sorting_costs(order.id)
        return Response({
            'status': 'Calculated',
            'method': record.method_used,
            'allocated_cost': str(record.total_allocated_cost),
            'waste_loss': str(record.waste_loss_amount)
        })

    @action(detail=True, methods=['post'])
    def post_inventory(self, request, pk=None):
        order = self.get_object()
        txns = post_sorting_to_inventory(order.id)
        return Response({'status': 'Posted', 'entries_created': len(txns)})

class StockItemViewSet(BaseTenantViewSet):
    model = StockItem
    serializer_class = StockItemSerializer

class InventoryTransactionViewSet(BaseTenantViewSet):
    model = InventoryTransaction
    serializer_class = InventoryTransactionSerializer

class PriceListViewSet(BaseTenantViewSet):
    model = PriceList
    serializer_class = PriceListSerializer

class POSTerminalViewSet(BaseTenantViewSet):
    model = POSTerminal
    serializer_class = POSTerminalSerializer

class ShiftViewSet(BaseTenantViewSet):
    model = Shift
    serializer_class = ShiftSerializer

    @action(detail=False, methods=['post'])
    def open(self, request):
        shift = open_shift(
            terminal_id=request.data['terminal_id'],
            cashier=request.user,
            opening_cash=Decimal(str(request.data.get('opening_cash', '0.00'))),
            notes=request.data.get('notes')
        )
        return Response(ShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        shift = close_shift(
            shift_id=pk,
            actual_cash=Decimal(str(request.data['actual_cash'])),
            notes=request.data.get('notes')
        )
        return Response(ShiftSerializer(shift).data)

class SaleInvoiceViewSet(BaseTenantViewSet):
    model = SaleInvoice
    serializer_class = SaleInvoiceSerializer

    @action(detail=False, methods=['post'])
    def checkout(self, request):
        # Resolve customer if sent
        customer_id = request.data.get('customer_id')
        customer_obj = None
        if customer_id:
            from apps.customers.models import Customer
            customer_obj = Customer.objects.filter(id=customer_id).first()

        invoice = process_pos_sale(
            shift_id=request.data['shift_id'],
            cashier=request.user,
            items_data=request.data['items'],
            payments_data=request.data['payments'],
            discount_amount=Decimal(str(request.data.get('discount_amount', '0.00'))),
            delivery_fee=Decimal(str(request.data.get('delivery_fee', '0.00'))),
            previous_balance=Decimal(str(request.data.get('previous_balance', '0.00'))),
            customer=customer_obj,
            notes=request.data.get('notes')
        )
        return Response(SaleInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

class JournalEntryViewSet(BaseTenantViewSet):
    model = JournalEntry
    serializer_class = JournalEntrySerializer



class PurchaseLineItemViewSet(BaseTenantViewSet):
    model = PurchaseLineItem
    serializer_class = PurchaseLineItemSerializer

class TreasuryTransactionViewSet(BaseTenantViewSet):
    model = TreasuryTransaction
    serializer_class = TreasuryTransactionSerializer

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        instance = serializer.save(tenant=tenant)
        # Update treasury balance automatically
        treasury = instance.treasury
        if instance.transaction_type in ['DEPOSIT', 'TRANSFER_IN']:
            treasury.current_balance += instance.amount
        else:
            treasury.current_balance -= abs(instance.amount)
        treasury.save()

class SalesReturnViewSet(BaseTenantViewSet):
    model = SalesReturn
    serializer_class = SalesReturnSerializer

class PriceListItemViewSet(BaseTenantViewSet):
    model = PriceListItem
    serializer_class = PriceListItemSerializer

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        from apps.pricing.models import PriceList, PriceHistory
        from apps.branches.models import Branch

        branch_id = request.data.get('branch_id')
        branch = Branch.objects.filter(tenant=tenant, id=branch_id).first() if branch_id else None

        price_list = PriceList.objects.filter(tenant=tenant, branch=branch, is_default=True).first()
        if not price_list:
            price_list = PriceList.objects.filter(tenant=tenant, is_default=True).first()
        if not price_list:
            price_list = PriceList.objects.create(tenant=tenant, branch=branch, name="القائمة الرئيسية", is_default=True)

        product_id = request.data.get('product')
        grade = request.data.get('grade')
        price_per_kg = Decimal(str(request.data.get('price_per_kg', '0.00')))
        price_per_piece = Decimal(str(request.data.get('price_per_piece', '0.00')))

        query = {'tenant': tenant, 'price_list': price_list, 'grade': grade}
        if product_id:
            query['product_id'] = product_id
        else:
            query['product__isnull'] = True

        old_item = PriceListItem.objects.filter(**query).first()
        old_price = Decimal('0.00')
        if old_item:
            old_price = old_item.price_per_kg if price_per_kg > 0 else (old_item.price_per_piece or Decimal('0.00'))

        item, created = PriceListItem.objects.update_or_create(
            tenant=tenant,
            price_list=price_list,
            product_id=product_id if product_id else None,
            grade=grade,
            defaults={
                'price_per_kg': price_per_kg,
                'price_per_piece': price_per_piece,
                'is_active': True
            }
        )

        new_price = price_per_kg if price_per_kg > 0 else price_per_piece
        pricing_type = 'KG' if price_per_kg > 0 else 'PIECE'

        if created or old_price != new_price:
            PriceHistory.objects.create(
                tenant=tenant,
                branch=branch,
                product_id=product_id if product_id else None,
                grade=grade,
                pricing_type=pricing_type,
                old_price=old_price,
                new_price=new_price,
                changed_by=request.user if request.user.is_authenticated else None,
                notes='تحديث سعر فردي'
            )

        return Response({'status': 'success', 'new_price': str(new_price), 'old_price': str(old_price)})

    serializer_class = PriceListItemSerializer

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        from apps.pricing.models import PriceList, PriceHistory
        from apps.branches.models import Branch

        branch_id = request.data.get('branch_id')
        branch = Branch.objects.filter(tenant=tenant, id=branch_id).first() if branch_id else None

        price_list = PriceList.objects.filter(tenant=tenant, branch=branch, is_default=True).first()
        if not price_list:
            price_list = PriceList.objects.filter(tenant=tenant, is_default=True).first()
        if not price_list:
            price_list = PriceList.objects.create(tenant=tenant, branch=branch, name="القائمة الرئيسية", is_default=True)

        product_id = request.data.get('product')
        grade = request.data.get('grade')
        price_per_kg = Decimal(str(request.data.get('price_per_kg', '0.00')))
        price_per_piece = Decimal(str(request.data.get('price_per_piece', '0.00')))

        query = {'tenant': tenant, 'price_list': price_list, 'grade': grade}
        if product_id:
            query['product_id'] = product_id
        else:
            query['product__isnull'] = True

        old_item = PriceListItem.objects.filter(**query).first()
        old_price = Decimal('0.00')
        if old_item:
            old_price = old_item.price_per_kg if price_per_kg > 0 else (old_item.price_per_piece or Decimal('0.00'))

        item, created = PriceListItem.objects.update_or_create(
            tenant=tenant,
            price_list=price_list,
            product_id=product_id if product_id else None,
            grade=grade,
            defaults={
                'price_per_kg': price_per_kg,
                'price_per_piece': price_per_piece,
                'is_active': True
            }
        )

        new_price = price_per_kg if price_per_kg > 0 else price_per_piece
        pricing_type = 'KG' if price_per_kg > 0 else 'PIECE'

        if created or old_price != new_price:
            PriceHistory.objects.create(
                tenant=tenant,
                branch=branch,
                product_id=product_id if product_id else None,
                grade=grade,
                pricing_type=pricing_type,
                old_price=old_price,
                new_price=new_price,
                changed_by=request.user if request.user.is_authenticated else None,
                notes='تحديث سعر فردي'
            )

        return Response({'status': 'success', 'new_price': str(new_price), 'old_price': str(old_price)})

    serializer_class = PriceListItemSerializer

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        instance = serializer.save(tenant=tenant)
        # Record history log
        PriceHistory.objects.create(
            tenant=tenant,
            product=instance.product,
            grade=instance.grade,
            pricing_type='KG' if instance.price_per_kg > 0 else 'PIECE',
            old_price=Decimal('0.00'),
            new_price=instance.price_per_kg or instance.price_per_piece or Decimal('0.00'),
            changed_by=self.request.user if self.request.user.is_authenticated else None,
            notes='تسجيل سعر جديد'
        )

class PriceHistoryViewSet(BaseTenantViewSet):
    model = PriceHistory
    serializer_class = PriceHistorySerializer

class DiscountRuleViewSet(BaseTenantViewSet):
    model = DiscountRule
    serializer_class = DiscountRuleSerializer

class RolePermissionViewSet(viewsets.ModelViewSet):
    # This is a system-wide configuration, not tenant-isolated (or can be tenant-isolated if you prefer, but usually global for the app)
    queryset = RolePermission.objects.all()
    serializer_class = RolePermissionSerializer
    
    def get_permissions(self):
        # Only ADMIN should edit permissions, but anyone can read to know their own limits
        return super().get_permissions()



class UserViewSet(BaseTenantViewSet):
    model = User
    serializer_class = UserManagementSerializer

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        password = self.request.data.get('password', '123456')
        user_inst = serializer.save(tenant=tenant)
        user_inst.set_password(password)
        user_inst.save()

    def perform_update(self, serializer):
        user_inst = serializer.save()
        password = self.request.data.get('password')
        if password and password.trim():
            user_inst.set_password(password)
            user_inst.save()

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        user_inst = self.get_object()
        new_password = request.data.get('new_password')
        if not new_password:
            return Response({'detail': 'New password is required'}, status=status.HTTP_400_BAD_REQUEST)
        user_inst.set_password(new_password)
        user_inst.save()
        return Response({'status': 'password updated successfully'})


class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
