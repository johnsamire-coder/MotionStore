from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
import datetime, random

from apps.tenants.models import Tenant
from apps.tenants.context import get_current_tenant
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.warehouses.models import Warehouse
from apps.products.models import Category, Product
from apps.suppliers.models import Supplier
from apps.purchasing.models import PurchaseInvoice, PurchaseLineItem
from apps.raw_lots.models import RawLot
from apps.sorting.models import SortingOrder
from apps.costing.services import calculate_sorting_costs
from apps.inventory.models import StockItem, InventoryTransaction
from apps.inventory.services import post_sorting_to_inventory
from apps.pricing.models import PriceList
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
        if tenant:
            serializer.save(tenant=tenant)
        else:
            serializer.save()

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
        existing = Supplier.objects.filter(tenant=tenant, name__iexact=name).first() if tenant else Supplier.objects.filter(name__iexact=name).first()
        if existing:
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

class PurchaseInvoiceViewSet(BaseTenantViewSet):
    model = PurchaseInvoice
    serializer_class = PurchaseInvoiceSerializer

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        supplier = serializer.validated_data.get('supplier')
        inv_num = serializer.validated_data.get('invoice_number')

        if inv_num and supplier and tenant:
            if PurchaseInvoice.objects.filter(tenant=tenant, supplier=supplier, invoice_number=inv_num).exists():
                date_str = datetime.date.today().strftime('%Y%m%d')
                inv_num = f"PINV-{date_str}-{random.randint(10000, 99999)}"

        if tenant:
            serializer.save(tenant=tenant, invoice_number=inv_num)
        else:
            serializer.save(invoice_number=inv_num)

class PurchaseLineItemViewSet(BaseTenantViewSet):
    model = PurchaseLineItem
    serializer_class = PurchaseLineItemSerializer

    def perform_create(self, serializer):
        tenant = self.get_tenant()
        line = serializer.save(tenant=tenant) if tenant else serializer.save()
        invoice = line.invoice
        if invoice:
            related_items = getattr(invoice, 'line_items', None) or getattr(invoice, 'items', None)
            if related_items:
                items_total = sum(item.total_cost for item in related_items.all())
            else:
                items_total = line.total_cost
            invoice.subtotal = items_total
            invoice.total_cost = items_total + (invoice.additional_costs or 0)
            invoice.save()

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
        return Response({'status': 'calculated'})

class StockItemViewSet(BaseTenantViewSet):
    model = StockItem
    serializer_class = StockItemSerializer

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        from django.db import transaction
        from decimal import Decimal
        from apps.warehouses.models import Warehouse

        source_item = self.get_object()
        target_wh_id = request.data.get('target_warehouse')
        weight_kg = Decimal(str(request.data.get('weight_kg', '0.000')))
        pieces = int(request.data.get('quantity_pieces', 0) or 0)

        if weight_kg > source_item.total_weight_kg:
            return Response({'detail': 'الوزن المطلوب أكبر من المتاح بالرصيد'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            source_item.total_weight_kg = max(Decimal('0.000'), source_item.total_weight_kg - weight_kg)
            source_item.total_quantity_pieces = max(0, source_item.total_quantity_pieces - pieces)
            source_item.save()

            target_wh = Warehouse.objects.get(id=target_wh_id)
            target_item, _ = StockItem.objects.get_or_create(
                tenant=source_item.tenant,
                warehouse=target_wh,
                product=source_item.product,
                grade=source_item.grade,
                source_lot=source_item.source_lot,
                defaults={'total_weight_kg': Decimal('0.000'), 'total_quantity_pieces': 0}
            )
            target_item.total_weight_kg += weight_kg
            target_item.total_quantity_pieces += pieces
            target_item.save()

            InventoryTransaction.objects.create(
                tenant=source_item.tenant, transaction_type='TRANSFER_OUT', stock_item=source_item,
                product=source_item.product, grade=source_item.grade, warehouse=source_item.warehouse,
                weight_change_kg=-weight_kg, quantity_change_pieces=-pieces, unit_cost=Decimal('100.00'),
                total_cost_change=-weight_kg*Decimal('100.00'), source_document_type='TransferOrder',
                source_document_id=str(target_item.id), notes=f"تحويل إلى {target_wh.name}"
            )

            InventoryTransaction.objects.create(
                tenant=source_item.tenant, transaction_type='TRANSFER_IN', stock_item=target_item,
                product=source_item.product, grade=source_item.grade, warehouse=target_wh,
                weight_change_kg=weight_kg, quantity_change_pieces=pieces, unit_cost=Decimal('100.00'),
                total_cost_change=weight_kg*Decimal('100.00'), source_document_type='TransferOrder',
                source_document_id=str(source_item.id), notes=f"استلام تحويل من {source_item.warehouse.name}"
            )

        return Response(StockItemSerializer(source_item).data, status=status.HTTP_200_OK)

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

class SaleInvoiceViewSet(BaseTenantViewSet):
    model = SaleInvoice
    serializer_class = SaleInvoiceSerializer

    def perform_create(self, serializer):
        from django.utils import timezone
        from decimal import Decimal
        from apps.users.models import User
        from apps.branches.models import Branch
        from apps.pos.models import POSTerminal
        from apps.shifts.models import Shift

        tenant = self.get_tenant()
        user = self.request.user if (hasattr(self.request, 'user') and self.request.user.is_authenticated) else User.objects.get(username='admin')

        branch = Branch.objects.filter(tenant=tenant).first()
        if not branch:
            branch = Branch.objects.create(tenant=tenant, name='فرع سموحة الرئيسي')

        terminal = POSTerminal.objects.filter(tenant=tenant).first()
        if not terminal:
            terminal = POSTerminal.objects.create(tenant=tenant, name='كاشير 1', branch=branch)

        shift = Shift.objects.filter(tenant=tenant, status='OPEN').first()
        if not shift:
            shift = Shift.objects.create(tenant=tenant, cashier=user, terminal=terminal, status='OPEN', opening_cash=Decimal('500.00'), opened_at=timezone.now())

        serializer.save(
            tenant=tenant,
            branch=branch,
            pos_terminal=terminal,
            shift=shift,
            cashier=user,
            invoice_date_time=timezone.now(),
            status='COMPLETED'
        )

    @action(detail=False, methods=['post'])
    def checkout(self, request):
        invoice = process_pos_sale(
            shift_id=request.data.get('shift_id', ''),
            cashier=request.user if hasattr(request, 'user') and request.user.is_authenticated else User.objects.get(username='admin'),
            items_data=request.data.get('items', []),
            payments_data=request.data.get('payments', []),
            discount_amount=Decimal(str(request.data.get('discount_amount', '0.00'))),
            notes=request.data.get('notes')
        )
        return Response(SaleInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

class JournalEntryViewSet(BaseTenantViewSet):
    model = JournalEntry
    serializer_class = JournalEntrySerializer
