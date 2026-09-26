from rest_framework.permissions import AllowAny
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
    @action(detail=False, methods=['post'])
    def add_location(self, request):
        from apps.branches.models import Branch
        from apps.treasury.models import Treasury
        from apps.pos.models import POSTerminal
        from django.db import transaction as dbt
        tenant = self.get_tenant()
        name = (request.data.get('name') or '').strip()
        kind = request.data.get('kind') or 'MAIN'
        if not name or kind not in ('STORE', 'MAIN'):
            return Response({'detail': 'اكتب الاسم واختار النوع (مخزن أو محل)'}, status=400)
        if Warehouse.objects.filter(tenant=tenant, name=name).exists():
            return Response({'detail': 'الاسم ده موجود قبل كده'}, status=400)
        branch = Branch.objects.filter(tenant=tenant).first()
        if not branch:
            return Response({'detail': 'مفيش فرع متسجل للشركة'}, status=400)
        with dbt.atomic():
            wh = Warehouse.objects.create(tenant=tenant, branch=branch, name=name, warehouse_type=kind, is_active=True)
            result = {'warehouse': WarehouseSerializer(wh).data, 'terminal': None}
            if kind == 'STORE':
                drawer = Treasury.objects.create(tenant=tenant, branch=branch, name=f'درج كاشير - {name}', treasury_type='POS_DRAWER', current_balance=Decimal('0.00'), is_active=True)
                n = POSTerminal.objects.filter(tenant=tenant).count() + 1
                code = f'POS-S{n:02d}'
                while POSTerminal.objects.filter(code=code).exists():
                    n += 1
                    code = f'POS-S{n:02d}'
                term = POSTerminal.objects.create(tenant=tenant, branch=branch, name=f'كاشير {name}', code=code, default_warehouse=wh, cash_drawer=drawer, is_active=True)
                result['terminal'] = term.code
        return Response(result, status=201)

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


from apps.customers.models import Customer
from apps.payments.models import PaymentMethod
from apps.purchasing.models import PurchaseInvoice, PurchaseLineItem, PurchaseItemType, InvoiceStatus
from apps.raw_lots.models import RawLot, RawLotStatus
from apps.products.models import Product

class CustomerViewSet(BaseTenantViewSet):
    model = Customer
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            from django.db.models import Q as _Q
            qs = qs.filter(_Q(name__icontains=q) | _Q(phone__icontains=q) | _Q(code__icontains=q))
        return qs.order_by('code', 'name')

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

    def create(self, request, *args, **kwargs):
        t = self.get_tenant()
        name = (request.data.get('name') or '').strip()
        phone = ''.join(ch for ch in str(request.data.get('phone') or '') if ch.isdigit())
        if not name or len(phone) < 6:
            return Response({'detail': 'اكتب اسم العميل ورقم تليفونه'}, status=400)
        if Customer.objects.filter(tenant=t, phone=phone).exists():
            return Response({'detail': 'الرقم ده متسجل لعميل تاني'}, status=400)
        nums = [int(x[1:]) for x in Customer.objects.filter(tenant=t).values_list('code', flat=True) if x and x[1:].isdigit()]
        c = Customer.objects.create(tenant=t, name=name, phone=phone, code=f"C{(max(nums + [0]) + 1):04d}", address=request.data.get('address') or '',
                                    notes=request.data.get('notes') or '', credit_limit=Decimal(str(request.data.get('credit_limit') or '0')), is_active=True)
        return Response(CustomerSerializer(c).data, status=201)

    @action(detail=False, methods=['get'])
    def by_phone(self, request):
        phone = ''.join(ch for ch in str(request.query_params.get('phone') or '') if ch.isdigit())
        c = Customer.objects.filter(tenant=self.get_tenant(), phone=phone).first() if phone else None
        if not c:
            return Response({'detail': 'عميل جديد'}, status=404)
        return Response(CustomerSerializer(c).data)

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        q = (request.query_params.get('q') or '').strip()
        t = self.get_tenant()
        c = None
        if q:
            c = Customer.objects.filter(tenant=t, code__iexact=q).first()
            if not c:
                digits = ''.join(ch for ch in q if ch.isdigit())
                if digits:
                    c = Customer.objects.filter(tenant=t, phone=digits).first()
        if not c:
            return Response({'detail': 'عميل جديد'}, status=404)
        return Response(CustomerSerializer(c).data)

    @action(detail=True, methods=['post'])
    def collect(self, request, pk=None):
        from django.db import transaction as dbt
        from apps.payments.models import PaymentMethod
        from apps.treasury.services import record_treasury_transaction
        from apps.treasury.models import TreasuryTransactionType
        c = self.get_object()
        amt = Decimal(str(request.data.get('amount') or '0'))
        if amt <= 0:
            return Response({'detail': 'اكتب المبلغ'}, status=400)
        pm = PaymentMethod.objects.filter(tenant=c.tenant, pk=request.data.get('payment_method_id')).first()
        if not pm or pm.method_type == 'CREDIT' or not pm.treasury_id:
            return Response({'detail': 'اختار طريقة دفع ليها خزنة'}, status=400)
        with dbt.atomic():
            record_treasury_transaction(treasury_id=pm.treasury_id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=amt, payment_method=pm,
                                        source_document_type='CustomerPayment', source_document_id=str(c.id), description=f"تحصيل من العميل {c.code or ''} {c.name} {request.data.get('notes') or ''}".strip())
            c.credit_balance -= amt
            c.save(update_fields=['credit_balance'])
        return Response(CustomerSerializer(c).data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        from apps.sales.models import SaleInvoice, SaleLineItem, SalePayment
        c = self.get_object()
        out = []
        total = Decimal('0.00')
        for inv in SaleInvoice.objects.filter(tenant=c.tenant, customer=c).order_by('-invoice_date_time'):
            total += inv.total_amount
            out.append({
                'id': str(inv.id), 'number': inv.invoice_number, 'date': inv.invoice_date_time, 'total': str(inv.total_amount),
                'payments': [{'method': p.payment_method.name, 'type': p.payment_method.method_type, 'amount': str(p.amount)} for p in SalePayment.objects.filter(sale_invoice=inv).select_related('payment_method')],
                'lines': [{'name': l.display_name or l.product.name, 'pieces': l.quantity_pieces, 'kg': str(l.weight_kg), 'total': str(l.total_price), 'bundle': l.bundle_label} for l in SaleLineItem.objects.filter(sale_invoice=inv).select_related('product')]
            })
        from apps.treasury.models import TreasuryTransaction as _TT
        cols = [{'date': t.created_at, 'amount': str(t.amount), 'method': t.payment_method.name if t.payment_method_id else '', 'note': t.description} for t in _TT.objects.filter(source_document_type='CustomerPayment', source_document_id=str(c.id)).order_by('-created_at')]
        return Response({'customer': CustomerSerializer(c).data, 'invoices_count': len(out), 'total_spent': str(total), 'invoices': out, 'collections': cols})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        from apps.sales.models import SaleInvoice, SaleLineItem
        from django.db.models import Sum, Count, Max
        t = self.get_tenant()
        stats = {str(r['customer']): r for r in SaleInvoice.objects.filter(tenant=t, customer__isnull=False).values('customer').annotate(n=Count('id'), total=Sum('total_amount'), last=Max('invoice_date_time'))}
        rows = []
        for c in Customer.objects.filter(tenant=t).order_by('code', 'name'):
            st = stats.get(str(c.id), {})
            top = list(SaleLineItem.objects.filter(sale_invoice__customer=c).values('display_name').annotate(q=Count('id')).order_by('-q')[:3])
            rows.append({'id': str(c.id), 'code': c.code, 'name': c.name, 'phone': c.phone, 'invoices': st.get('n', 0), 'total': str(st.get('total') or 0), 'last': st.get('last'), 'credit_balance': str(c.credit_balance), 'top_items': [x['display_name'] for x in top if x['display_name']]})
        return Response(rows)

class PaymentMethodViewSet(BaseTenantViewSet):
    model = PaymentMethod
    serializer_class = PaymentMethodSerializer

class PurchaseInvoiceViewSet(BaseTenantViewSet):
    model = PurchaseInvoice
    serializer_class = PurchaseInvoiceSerializer

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        data = request.data
        from django.utils import timezone
        import uuid
        from decimal import Decimal

        supplier_id = data.get('supplier_id')
        if not supplier_id:
            from apps.suppliers.models import Supplier as _Sup
            _def_sup, _ = _Sup.objects.get_or_create(tenant=tenant, name='بدون مورد (شراء مباشر)', defaults={'is_active': True})
            supplier_id = _def_sup.id
        warehouse_id = data.get('warehouse_id')
        freight_cost = Decimal(str(data.get('freight_cost', '0.00')))

        inv_num = f"PINV-{timezone.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

        invoice = PurchaseInvoice.objects.create(
            tenant=tenant,
            supplier_id=supplier_id,
            warehouse_id=warehouse_id,
            invoice_number=inv_num,
            invoice_date=timezone.now().date(),
            status=InvoiceStatus.CONFIRMED,
            additional_costs=freight_cost,
            subtotal=Decimal('0.00'),
            total_cost=freight_cost
        )

        subtotal = Decimal('0.00')
        items_data = data.get('items', [])
        # --- freight allocation by VALUE (last line takes the remainder) ---
        def _line_value(it):
            _w = Decimal(str(it.get('weight_kg', '0.000')))
            _q = Decimal(str(int(it.get('quantity', 1))))
            _u = Decimal(str(it.get('unit_price', '0.00')))
            return (_w * _u) if _w > 0 else (_q * _u)
        _values = [_line_value(it) for it in items_data]
        _pre_subtotal = sum(_values, Decimal('0.00'))
        _freight_shares = []
        _allocated = Decimal('0.00')
        for _i, _val in enumerate(_values):
            if _pre_subtotal <= 0 or freight_cost <= 0:
                _freight_shares.append(Decimal('0.00'))
            elif _i == len(_values) - 1:
                _freight_shares.append(freight_cost - _allocated)
            else:
                _s = (freight_cost * _val / _pre_subtotal).quantize(Decimal('0.01'))
                _freight_shares.append(_s)
                _allocated += _s

        for idx, item in enumerate(items_data):
            prod_id = item.get('product_id')
            cat_id = item.get('category_id')
            desc = item.get('description', '')

            if prod_id and not desc:
                p_obj = Product.objects.filter(id=prod_id).first()
                if p_obj:
                    desc = p_obj.name
                    if not cat_id and p_obj.category_id:
                        cat_id = p_obj.category_id

            if not desc:
                desc = 'بند مشتريات'

            qty_pcs = int(item.get('quantity', 1))
            weight_kg = Decimal(str(item.get('weight_kg', '0.000')))
            unit_cost = Decimal(str(item.get('unit_price', '0.00')))

            line_total = (weight_kg * unit_cost) if weight_kg > 0 else (Decimal(str(qty_pcs)) * unit_cost)
            subtotal += line_total

            item_type = PurchaseItemType.FINISHED_GOODS if prod_id else PurchaseItemType.RAW_BALE

            line = PurchaseLineItem.objects.create(
                tenant=tenant,
                invoice=invoice,
                item_type=item_type,
                category_id=cat_id if cat_id else None,
                description=desc,
                weight_kg=weight_kg,
                quantity_pieces=qty_pcs,
                unit_cost=unit_cost,
                total_cost=line_total,
                purchase_kind=item.get('purchase_kind') or None,
                bale_type=item.get('bale_type') or None,
                grade=item.get('grade') or None,
                segment=item.get('segment') or None,
                stock_type=item.get('stock_type') or None,
                brand=item.get('brand') or None,
                item_name=item.get('item_name') or None,
                extra_description=item.get('extra_description') or None
            )

            # If RAW_BALE, create RawLot automatically for the Sorting Hub
            if item_type == PurchaseItemType.RAW_BALE or not prod_id:
                lot_code = f"LOT-{inv_num}-{idx+1}"
                RawLot.objects.create(
                    tenant=tenant,
                    lot_code=lot_code,
                    purchase_invoice=invoice,
                    purchase_line_item=line,
                    supplier_id=supplier_id,
                    warehouse_id=warehouse_id,
                    category_id=cat_id if cat_id else None,
                    original_weight_kg=weight_kg,
                    original_quantity_pieces=qty_pcs,
                    purchase_cost=line_total + _freight_shares[idx],
                    status=RawLotStatus.RECEIVED,
                    received_date=timezone.now().date(),
                    notes=f"Auto-created from Invoice #{inv_num} ({desc})"
                )

        invoice.subtotal = subtotal
        invoice.total_cost = subtotal + freight_cost
        invoice.save()

        return Response({
            'id': str(invoice.id),
            'invoice_number': invoice.invoice_number,
            'total_amount': str(invoice.total_cost),
            'status': 'success'
        }, status=201)


class RawLotViewSet(BaseTenantViewSet):
    model = RawLot
    serializer_class = RawLotSerializer




class SortingOrderViewSet(BaseTenantViewSet):
    model = SortingOrder
    serializer_class = SortingOrderSerializer

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        from apps.sorting.models import SortingOrder
        from django.utils import timezone
        import uuid

        raw_lot_id = request.data.get('raw_lot')
        existing_order = SortingOrder.objects.filter(tenant=tenant, raw_lot_id=raw_lot_id).first()
        if existing_order:
            serializer = self.get_serializer(existing_order)
            return Response(serializer.data, status=200)

        order_code = request.data.get('order_code') or f"SRT-{uuid.uuid4().hex[:6].upper()}"
        order = SortingOrder.objects.create(
            tenant=tenant,
            raw_lot_id=raw_lot_id,
            order_code=order_code,
            sorting_date=timezone.now().date(),
            status='DRAFT',
            notes=request.data.get('notes', 'بدء عملية الفرز')
        )
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        order = self.get_object()
        tenant = self.get_tenant()
        from apps.sorting.models import SortingOutputLine, SortingWasteLine
        from apps.products.models import Product, Category
        from apps.warehouses.models import Warehouse
        
        category, _ = Category.objects.get_or_create(tenant=tenant, name="أصناف مفروزة عامة")
        _li = getattr(getattr(order, 'raw_lot', None), 'purchase_line_item', None)
        _base = None
        if _li and _li.purchase_kind == 'BALE':
            _base = ' '.join([x for x in [_li.bale_type, _li.segment] if x]) or 'بالة'
        elif _li and _li.purchase_kind == 'STOCK':
            _base = f"استوك {_li.brand}" if (_li.stock_type == 'ONE_BRAND' and _li.brand) else 'استوك ميكس'
        elif _li and _li.purchase_kind == 'DIRECT':
            _base = _li.item_name or 'أصناف خاصة'

        def _next_code():
            nums = [int(x) for x in Product.objects.filter(tenant=tenant).values_list('code', flat=True) if x and str(x).isdigit()]
            return str(max(nums + [1000]) + 1)

        # Get target warehouse from raw lot or default main warehouse
        target_wh = None
        if hasattr(order, 'raw_lot') and order.raw_lot and order.raw_lot.warehouse:
            target_wh = order.raw_lot.warehouse
        if not target_wh:
            target_wh = Warehouse.objects.filter(tenant=tenant, warehouse_type='MAIN').first()
        if not target_wh:
            target_wh = Warehouse.objects.filter(tenant=tenant).first()

        data = request.data
        outputs = data.get('outputs', [])
        wastes = data.get('wastes', [])

        SortingOutputLine.objects.filter(sorting_order=order).delete()
        SortingWasteLine.objects.filter(sorting_order=order).delete()

        for out in outputs:
            grade = out.get('grade')
            weight = float(out.get('weight_kg', 0))
            pcs = int(out.get('quantity_pieces', 0))
            if weight > 0 or pcs > 0:
                grade_name = "عالي" if grade == "NEW_COLLECTION" else ("وسط" if grade == "MIDDLE" else "تصفيات")
                prod, _ = Product.objects.get_or_create(
                    tenant=tenant,
                    category=category,
                    name=(f"{_base} - {grade_name}" if _base else grade_name),
                    defaults={'code': _next_code()}
                )
                SortingOutputLine.objects.create(
                    tenant=tenant,
                    sorting_order=order,
                    product=prod,
                    warehouse=target_wh,
                    grade=grade,
                    weight_kg=weight,
                    quantity_pieces=pcs
                )

        for wst in wastes:
            w_weight = float(wst.get('weight_kg', 0))
            w_pcs = int(wst.get('quantity_pieces', 0))
            w_class = wst.get('waste_classification', 'NORMAL')
            if w_weight > 0 or w_pcs > 0:
                SortingWasteLine.objects.create(
                    tenant=tenant,
                    sorting_order=order,
                    weight_kg=w_weight,
                    quantity_pieces=w_pcs,
                    classification=w_class,
                    reason=wst.get('notes', 'هالك فرز')
                )

        is_balanced = order.reconcile()
        return Response({'balanced': is_balanced, 'status': order.reconciliation_status, 'message': 'تم حفظ ومطابقة أوزان الفرز بنجاح'})


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
    def get_queryset(self):
        qs = super().get_queryset().select_related('product', 'warehouse')
        p = self.request.query_params
        if p.get('warehouse'):
            qs = qs.filter(warehouse_id=p['warehouse'])
        if p.get('warehouse_type'):
            qs = qs.filter(warehouse__warehouse_type=p['warehouse_type'])
        if p.get('only_positive') == '1':
            qs = qs.filter(total_weight_kg__gt=0)
        return qs
    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

class InventoryTransactionViewSet(BaseTenantViewSet):
    model = InventoryTransaction
    serializer_class = InventoryTransactionSerializer
    def get_queryset(self):
        qs = super().get_queryset().select_related('product', 'warehouse').order_by('-created_at')
        p = self.request.query_params
        if p.get('date_from'):
            qs = qs.filter(created_at__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(created_at__date__lte=p['date_to'])
        if p.get('warehouse'):
            qs = qs.filter(warehouse_id=p['warehouse'])
        if p.get('warehouse_type'):
            qs = qs.filter(warehouse__warehouse_type=p['warehouse_type'])
        if p.get('product'):
            qs = qs.filter(product_id=p['product'])
        if p.get('grade'):
            qs = qs.filter(grade=p['grade'])
        if p.get('transaction_type'):
            qs = qs.filter(transaction_type__in=p['transaction_type'].split(','))
        if p.get('direction') == 'in':
            qs = qs.filter(weight_change_kg__gt=0)
        if p.get('direction') == 'out':
            qs = qs.filter(weight_change_kg__lt=0)
        return qs
    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

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
    def get_queryset(self):
        from django.db.models import Q as _Q
        from apps.sales.models import SalePayment
        qs = super().get_queryset().select_related('customer', 'cashier', 'pos_terminal').prefetch_related('lines').order_by('-invoice_date_time')
        p = self.request.query_params
        if p.get('date_from'):
            qs = qs.filter(invoice_date_time__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(invoice_date_time__date__lte=p['date_to'])
        if p.get('cashier'):
            qs = qs.filter(cashier_id=p['cashier'])
        if p.get('terminal'):
            qs = qs.filter(pos_terminal_id=p['terminal'])
        if p.get('customer'):
            qs = qs.filter(customer_id=p['customer'])
        if p.get('payment_method'):
            qs = qs.filter(id__in=SalePayment.objects.filter(payment_method_id=p['payment_method']).values('sale_invoice_id'))
        q = (p.get('q') or '').strip()
        if q:
            qs = qs.filter(_Q(invoice_number__icontains=q) | _Q(customer__phone__icontains=q) | _Q(customer__name__icontains=q) | _Q(customer__code__iexact=q))
        return qs

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

    @action(detail=False, methods=['post'])
    def verify_manager(self, request):
        from django.contrib.auth import get_user_model
        from django.db.models import Q
        pwd = request.data.get('password') or ''
        tenant = self.get_tenant()
        managers = get_user_model().objects.filter(is_active=True).filter(Q(tenant=tenant) | Q(is_superuser=True)).filter(Q(role__in=['ADMIN', 'MANAGER']) | Q(is_superuser=True))
        if pwd:
            for m in managers:
                if m.check_password(pwd):
                    return Response({'ok': True, 'manager': m.username})
        return Response({'ok': False, 'detail': 'الباسورد غلط أو صاحبه مش مدير'}, status=403)

    @action(detail=False, methods=['post'])
    def checkout(self, request):
        # Resolve customer if sent
        customer_id = request.data.get('customer_id')
        customer_obj = None
        if customer_id:
            from apps.customers.models import Customer
            customer_obj = Customer.objects.filter(id=customer_id).first()
        _phone = ''.join(ch for ch in str(request.data.get('customer_phone') or '') if ch.isdigit())
        _cname = (request.data.get('customer_name') or '').strip()
        if not customer_obj and _phone:
            from apps.customers.models import Customer
            _t = self.get_tenant()
            customer_obj = Customer.objects.filter(tenant=_t, phone=_phone).first()
            if not customer_obj:
                _nums = [int(x[1:]) for x in Customer.objects.filter(tenant=_t).values_list('code', flat=True) if x and x[1:].isdigit()]
                customer_obj = Customer.objects.create(tenant=_t, name=_cname or _phone, phone=_phone, code=f"C{(max(_nums + [0]) + 1):04d}", is_active=True)
            elif _cname and (not customer_obj.name or customer_obj.name == customer_obj.phone):
                customer_obj.name = _cname
                customer_obj.save(update_fields=['name'])

        from django.core.exceptions import ValidationError as _DjVE
        try:
            invoice = process_pos_sale(
                shift_id=request.data['shift_id'],
                cashier=request.user,
                items_data=request.data['items'],
                payments_data=request.data['payments'],
                discount_amount=Decimal(str(request.data.get('discount_amount', '0.00'))),
                delivery_fee=Decimal(str(request.data.get('delivery_fee', '0.00'))),
                previous_balance=Decimal(str(request.data.get('previous_balance', '0.00'))),
                customer=customer_obj,
                notes=request.data.get('notes'),
                coupon_code=(request.data.get('coupon_code') or '').strip() or None,
                applied_offers=request.data.get('applied_offers') or []
            )
        except _DjVE as e:
            return Response({'detail': '; '.join(e.messages)}, status=400)
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
    def get_queryset(self):
        from django.db.models import Q as _Q
        qs = super().get_queryset().select_related('original_sale_invoice__customer', 'cashier', 'refund_method', 'shift__terminal').prefetch_related('lines').order_by('-return_date_time')
        p = self.request.query_params
        if p.get('date_from'):
            qs = qs.filter(return_date_time__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(return_date_time__date__lte=p['date_to'])
        q = (p.get('q') or '').strip()
        if q:
            qs = qs.filter(_Q(return_number__icontains=q) | _Q(original_sale_invoice__invoice_number__icontains=q) | _Q(original_sale_invoice__customer__phone__icontains=q) | _Q(original_sale_invoice__customer__code__iexact=q))
        return qs

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

    @action(detail=False, methods=['get'])
    def invoice_lookup(self, request):
        from django.db.models import Q as _Q, Sum
        from apps.returns.models import SalesReturnLineItem, ReturnStatus
        q = (request.query_params.get('q') or '').strip()
        base_inv = SaleInvoice.objects.filter(tenant=self.get_tenant())
        if q:
            qs = base_inv.filter(_Q(invoice_number__icontains=q) | _Q(customer__phone__icontains=q) | _Q(customer__code__iexact=q)).order_by('-invoice_date_time')[:20]
        else:
            qs = base_inv.order_by('-invoice_date_time')[:20]
        out = []
        for inv in qs:
            d = SaleInvoiceSerializer(inv).data
            for ln in d.get('lines', []):
                agg = SalesReturnLineItem.objects.filter(original_sale_line_id=ln['id'], sales_return__status=ReturnStatus.COMPLETED).aggregate(w=Sum('weight_kg'), p=Sum('quantity_pieces'))
                ln['returned_weight'] = str(agg['w'] or 0)
                ln['returned_pieces'] = agg['p'] or 0
                qp = int(ln.get('quantity_pieces') or 0)
                ln['piece_mode'] = qp > 0 and abs(Decimal(str(ln['subtotal'])) - Decimal(qp) * Decimal(str(ln['unit_price']))) < Decimal('0.02')
            out.append(d)
        return Response(out)

    def create(self, request, *args, **kwargs):
        from django.core.exceptions import ValidationError as _DjVE
        from apps.returns.services import process_sales_return_v2
        d = request.data
        try:
            sr = process_sales_return_v2(invoice_id=d.get('invoice_id'), shift_id=d.get('shift_id'), cashier=request.user, items=d.get('items') or [],
                                         refund_method_id=d.get('refund_method_id'), refund_to_credit=bool(d.get('refund_to_credit')), reason=d.get('reason'))
        except _DjVE as e:
            return Response({'detail': '; '.join(e.messages)}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)
        return Response(SalesReturnSerializer(sr).data, status=201)

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

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def public_info(self, request):
        tenant = Tenant.objects.filter(is_active=True).first()
        if not tenant:
            return Response({'name': 'جاكي ستور', 'logo_base64': None})
        return Response({
            'id': str(tenant.id),
            'name': tenant.name,
            'logo_base64': tenant.logo_base64
        })


class TreasuryViewSet(BaseTenantViewSet):
    model = Treasury
    serializer_class = TreasurySerializer


from apps.customers.models import Customer
from apps.payments.models import PaymentMethod

from apps.purchasing.models import PurchaseOption, PurchaseOptionType
from apps.api.serializers import PurchaseOptionSerializer

class PurchaseOptionViewSet(BaseTenantViewSet):
    model = PurchaseOption
    serializer_class = PurchaseOptionSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(is_active=True)
        t = self.request.query_params.get('option_type')
        if t:
            qs = qs.filter(option_type=t)
        return qs

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        name = (request.data.get('name') or '').strip()
        otype = request.data.get('option_type')
        if not name or otype not in PurchaseOptionType.values:
            return Response({'detail': 'اكتب الاسم واختار النوع'}, status=400)
        obj, created = PurchaseOption.objects.get_or_create(tenant=tenant, option_type=otype, name=name, defaults={'is_active': True})
        if not obj.is_active:
            obj.is_active = True
            obj.save()
        return Response(PurchaseOptionSerializer(obj).data, status=201 if created else 200)

from django.db.models import Q
from apps.transfers.models import TransferOrder
from apps.transfers.services import create_transfer_order, ship_transfer_order, receive_transfer_order
from apps.api.serializers import TransferOrderSerializer

class TransferOrderViewSet(BaseTenantViewSet):
    model = TransferOrder
    serializer_class = TransferOrderSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('source_warehouse', 'destination_warehouse', 'requested_by').prefetch_related('lines__product').order_by('-created_at')
        p = self.request.query_params
        if p.get('date_from'):
            qs = qs.filter(transfer_date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(transfer_date__lte=p['date_to'])
        if p.get('warehouse'):
            qs = qs.filter(Q(source_warehouse_id=p['warehouse']) | Q(destination_warehouse_id=p['warehouse']))
        return qs

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

    def create(self, request, *args, **kwargs):
        from django.core.exceptions import ValidationError as DjVE
        from django.db import transaction as dbt
        tenant = self.get_tenant()
        d = request.data
        src = Warehouse.objects.filter(tenant=tenant, pk=d.get('source_warehouse_id')).first()
        dst = Warehouse.objects.filter(tenant=tenant, pk=d.get('destination_warehouse_id')).first()
        if not src or not dst:
            return Response({'detail': 'اختار المكان اللي طالعة منه البضاعة والمكان اللي رايحة له'}, status=400)
        if src.pk == dst.pk:
            return Response({'detail': 'مينفعش تنقل لنفس المكان'}, status=400)
        items = []
        for it in d.get('items', []):
            si = StockItem.objects.filter(tenant=tenant, pk=it.get('stock_item_id'), warehouse=src).first()
            if not si:
                return Response({'detail': f'فيه صنف مش موجود في {src.name}'}, status=400)
            w = Decimal(str(it.get('weight_kg') or '0'))
            if w <= 0:
                return Response({'detail': 'اكتب الوزن المنقول'}, status=400)
            if w > si.total_weight_kg:
                return Response({'detail': f'الوزن المطلوب من {si.product.name} أكبر من المتاح ({si.total_weight_kg} كجم)'}, status=400)
            pcs = it.get('quantity_pieces')
            if pcs in (None, ''):
                pcs = int(round(float(si.total_quantity_pieces) * float(w) / float(si.total_weight_kg))) if si.total_weight_kg > 0 else 0
            pcs = max(0, min(int(pcs), int(si.total_quantity_pieces)))
            items.append({'stock_item_id': si.pk, 'weight_kg': w, 'quantity_pieces': pcs})
        if not items:
            return Response({'detail': 'ضيف صنف واحد على الأقل'}, status=400)
        user = request.user if request.user.is_authenticated else None
        try:
            with dbt.atomic():
                tr = create_transfer_order(tenant, src, dst, user, items, d.get('notes'))
                ship_transfer_order(tr.pk)
                receive_transfer_order(tr.pk)
        except DjVE as e:
            return Response({'detail': '; '.join(e.messages)}, status=400)
        tr.refresh_from_db()
        return Response(TransferOrderSerializer(tr).data, status=201)

from apps.pricing.models import WeightPrice, PieceItem, PriceChangeLog, PriceKind, SortedGrade
from apps.api.serializers import WeightPriceSerializer, PieceItemSerializer, PriceChangeLogSerializer

BALE_PURCHASE_GRADES = ['سوبر كريم', 'كريم', 'كريم في واحد', 'نمرة 1', 'نمرة 2', 'سحبة']


def _dec(v):
    try:
        return Decimal(str(v if v not in (None, '') else '0'))
    except Exception:
        return None


def _log_price(tenant, user, target, field, old, new, **kw):
    if old is not None and Decimal(str(old)) == Decimal(str(new)):
        return
    PriceChangeLog.objects.create(
        tenant=tenant, target=target, field=field, old_price=old, new_price=new,
        changed_by=user if (user is not None and user.is_authenticated) else None, **kw
    )


class _AllPagesMixin:
    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)


class WeightPriceViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = WeightPrice
    serializer_class = WeightPriceSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('kind'):
            qs = qs.filter(kind=p['kind'])
        if p.get('key') is not None and p.get('key') != '':
            qs = qs.filter(key=p['key'])
        return qs.order_by('kind', 'key', 'grade')

    @action(detail=False, methods=['post'])
    def set_prices(self, request):
        from django.db import transaction as dbt
        tenant = self.get_tenant()
        kind = request.data.get('kind')
        key = (request.data.get('key') or '').strip()
        prices = request.data.get('prices') or {}
        if kind not in PriceKind.values:
            return Response({'detail': 'نوع التسعير غلط'}, status=400)
        if kind == 'BALE':
            key = ''
        elif not key:
            return Response({'detail': 'اختار البراند أو النوع الأول'}, status=400)
        with dbt.atomic():
            for grade, val in prices.items():
                if grade not in SortedGrade.values:
                    continue
                new = _dec(val)
                if new is None or new < 0:
                    return Response({'detail': 'فيه سعر مكتوب غلط'}, status=400)
                obj, created = WeightPrice.objects.get_or_create(tenant=tenant, kind=kind, key=key, grade=grade, defaults={'price_per_kg': new})
                old = None if created else obj.price_per_kg
                if not created and obj.price_per_kg != new:
                    obj.price_per_kg = new
                    obj.save()
                _log_price(tenant, request.user, 'WEIGHT', 'per_kg', old, new, kind=kind, key=key, grade=grade, name=(key or 'بالة'))
        qs = WeightPrice.objects.filter(tenant=tenant, kind=kind, key=key)
        return Response(WeightPriceSerializer(qs, many=True).data)


class PieceItemViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = PieceItem
    serializer_class = PieceItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('include_inactive') != '1':
            qs = qs.filter(is_active=True)
        if p.get('source_kind'):
            qs = qs.filter(source_kind=p['source_kind'])
        return qs.order_by('code')

    def _clean(self, data, instance=None):
        tenant = self.get_tenant()
        out = {}
        code = (data.get('code', instance.code if instance else '') or '').strip()
        name = (data.get('name', instance.name if instance else '') or '').strip()
        kind = data.get('source_kind', instance.source_kind if instance else None)
        if not code:
            return None, 'اكتب كود القطعة'
        if not name:
            return None, 'اكتب اسم القطعة'
        if kind not in PriceKind.values:
            return None, 'اختار تصنيف القطعة (بالة / استوك / شراء مباشر)'
        dup = PieceItem.objects.filter(tenant=tenant, code=code)
        if instance:
            dup = dup.exclude(pk=instance.pk)
        if dup.exists():
            return None, f'الكود {code} مستعمل قبل كده'
        grade = data.get('purchase_grade', instance.purchase_grade if instance else None)
        if kind == 'BALE':
            if grade and grade not in BALE_PURCHASE_GRADES:
                return None, 'درجة البالة غلط'
        else:
            grade = None
        pp = _dec(data.get('price_per_piece', instance.price_per_piece if instance else 0))
        pk_ = _dec(data.get('price_per_kg', instance.price_per_kg if instance else 0))
        if pp is None or pk_ is None or pp < 0 or pk_ < 0:
            return None, 'فيه سعر مكتوب غلط'
        if pp == 0 and pk_ == 0:
            return None, 'اكتب سعر القطعة أو سعر الكيلو'
        out.update({'code': code, 'name': name, 'source_kind': kind, 'purchase_grade': grade,
                    'segment': data.get('segment', instance.segment if instance else None) or None,
                    'season': data.get('season', instance.season if instance else None) or None,
                    'brand': data.get('brand', instance.brand if instance else None) or None,
                    'price_per_piece': pp, 'price_per_kg': pk_})
        return out, None

    def create(self, request, *args, **kwargs):
        tenant = self.get_tenant()
        clean, err = self._clean(request.data)
        if err:
            return Response({'detail': err}, status=400)
        obj = PieceItem.objects.create(tenant=tenant, is_active=True, **clean)
        meta = {'code': obj.code, 'name': f'{obj.name} {obj.segment or ""}'.strip(), 'kind': obj.source_kind, 'key': obj.brand, 'segment': obj.segment, 'grade': obj.purchase_grade, 'season': obj.season}
        if obj.price_per_piece > 0:
            _log_price(tenant, request.user, 'PIECE', 'per_piece', None, obj.price_per_piece, **meta)
        if obj.price_per_kg > 0:
            _log_price(tenant, request.user, 'PIECE', 'per_kg', None, obj.price_per_kg, **meta)
        return Response(PieceItemSerializer(obj).data, status=201)

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        tenant = self.get_tenant()
        old_pp, old_kg = obj.price_per_piece, obj.price_per_kg
        clean, err = self._clean(request.data, instance=obj)
        if err:
            return Response({'detail': err}, status=400)
        for k, val in clean.items():
            setattr(obj, k, val)
        if 'is_active' in request.data:
            obj.is_active = bool(request.data.get('is_active'))
        obj.save()
        meta = {'code': obj.code, 'name': f'{obj.name} {obj.segment or ""}'.strip(), 'kind': obj.source_kind, 'key': obj.brand, 'segment': obj.segment, 'grade': obj.purchase_grade, 'season': obj.season}
        _log_price(tenant, request.user, 'PIECE', 'per_piece', old_pp, obj.price_per_piece, **meta)
        _log_price(tenant, request.user, 'PIECE', 'per_kg', old_kg, obj.price_per_kg, **meta)
        return Response(PieceItemSerializer(obj).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.is_active = False
        obj.save()
        return Response(status=204)

    @action(detail=False, methods=['get'])
    def by_code(self, request):
        code = (request.query_params.get('code') or '').strip()
        obj = PieceItem.objects.filter(tenant=self.get_tenant(), code=code, is_active=True).first()
        if not obj:
            return Response({'detail': 'الكود ده مش موجود'}, status=404)
        return Response(PieceItemSerializer(obj).data)


class PriceChangeLogViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = PriceChangeLog
    serializer_class = PriceChangeLogSerializer
    http_method_names = ['get']

    def get_queryset(self):
        qs = super().get_queryset().select_related('changed_by').order_by('-created_at')
        p = self.request.query_params
        if p.get('date_from'):
            qs = qs.filter(created_at__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(created_at__date__lte=p['date_to'])
        if p.get('target'):
            qs = qs.filter(target=p['target'])
        if p.get('kind'):
            qs = qs.filter(kind=p['kind'])
        if p.get('code'):
            qs = qs.filter(code=p['code'])
        if p.get('user'):
            qs = qs.filter(changed_by_id=p['user'])
        return qs

from apps.discounts.models import Offer, OFFER_DAYS
from apps.api.serializers import OfferSerializer


import random as _rnd
from rest_framework.exceptions import ValidationError as _DRFVE
_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def _new_coupon_code(tenant):
    from apps.discounts.models import Coupon
    while True:
        code = 'MS-' + ''.join(_rnd.choice(_CODE_CHARS) for _ in range(5))
        if not Coupon.objects.filter(tenant=tenant, code=code).exists():
            return code


def _next_offer_piece_code(tenant):
    nums = [int(x) for x in PieceItem.objects.filter(tenant=tenant).values_list('code', flat=True) if str(x).isdigit()]
    return str(max(nums + [9000]) + 1) if max(nums + [0]) >= 9000 else '9001'


def _offer_is_live(o, shop=None):
    from django.utils import timezone
    now = timezone.localtime()
    today = now.date(); t = now.time()
    day = OFFER_DAYS[(now.weekday() + 2) % 7]
    if not o.is_active:
        return False, 'العرض موقوف'
    if o.date_from and today < o.date_from:
        return False, 'العرض لسه مابدأش'
    if o.date_to and today > o.date_to:
        return False, 'العرض انتهى'
    if o.time_from and o.time_to and not (o.time_from <= t <= o.time_to):
        return False, 'العرض مش في ساعته دلوقتي'
    if o.days and day not in o.days:
        return False, 'العرض مش شغال النهاردة'
    if o.shops and shop and shop not in [str(x) for x in o.shops]:
        return False, 'العرض مش شغال في المحل ده'
    return True, ''


def _sync_offer(offer):
    from apps.discounts.models import Coupon
    p = offer.params or {}
    if offer.offer_type in ('ANYPIECE', 'ITEMPRICE'):
        piece = PieceItem.objects.filter(tenant=offer.tenant, offer=offer).first()
        code = (p.get('piece_code') or '').strip() or (piece.code if piece else _next_offer_piece_code(offer.tenant))
        clash = PieceItem.objects.filter(tenant=offer.tenant, code=code)
        if piece:
            clash = clash.exclude(pk=piece.pk)
        if clash.exists():
            raise _DRFVE({'detail': f'الكود {code} مستعمل قبل كده'})
        kind = p.get('source_kind') or 'BALE'
        vals = dict(code=code, name=(p.get('piece_name') or offer.name).strip(), source_kind=kind,
                    segment=p.get('segment') or None, season=p.get('season') or None,
                    purchase_grade=(p.get('purchase_grade') or None) if kind == 'BALE' else None,
                    brand=(p.get('brand') or None) if kind == 'STOCK' else None,
                    price_per_piece=_dec(p.get('price')) or Decimal('0'), price_per_kg=Decimal('0'), is_active=offer.is_active)
        if piece:
            for k, val in vals.items():
                setattr(piece, k, val)
            piece.save()
        else:
            PieceItem.objects.create(tenant=offer.tenant, offer=offer, **vals)
        if (p.get('piece_code') or '') != code:
            offer.params = {**p, 'piece_code': code}
            offer.save(update_fields=['params'])
    if offer.offer_type == 'COUPON' or offer.apply_mode == 'COUPON':
        if (offer.coupon_mode or 'SHARED') == 'SHARED':
            code = (p.get('coupon') or '').strip()
            if code:
                c = Coupon.objects.filter(tenant=offer.tenant, offer=offer).first()
                if c:
                    c.code = code; c.max_uses = offer.coupon_max_uses; c.is_active = offer.is_active; c.save()
                else:
                    Coupon.objects.create(tenant=offer.tenant, offer=offer, code=code, max_uses=offer.coupon_max_uses, is_active=offer.is_active)
        else:
            Coupon.objects.filter(offer=offer).update(is_active=offer.is_active)


def redeem_coupon(tenant, code, invoice_number, user, discount_amount):
    """ Called by checkout: records the use and increments counters """
    from apps.discounts.models import Coupon, CouponUse
    c = Coupon.objects.select_for_update().filter(tenant=tenant, code=code).first()
    if not c:
        raise _DRFVE({'detail': 'الكوبون مش موجود'})
    if c.max_uses is not None and c.used_count >= c.max_uses:
        raise _DRFVE({'detail': 'الكوبون ده اتستعمل قبل كده' if c.max_uses == 1 else 'الكوبون خلص عدد استخدامه'})
    c.used_count += 1
    c.save(update_fields=['used_count'])
    CouponUse.objects.create(tenant=tenant, coupon=c, invoice_number=invoice_number, used_by=user if (user is not None and user.is_authenticated) else None, discount_amount=discount_amount)
    return c

class OfferViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = Offer
    serializer_class = OfferSerializer

    def perform_create(self, serializer):
        from django.db import transaction as dbt
        with dbt.atomic():
            offer = serializer.save(tenant=self.get_tenant())
            _sync_offer(offer)

    def perform_update(self, serializer):
        from django.db import transaction as dbt
        with dbt.atomic():
            offer = serializer.save()
            _sync_offer(offer)

    @action(detail=True, methods=['post'])
    def generate_coupons(self, request, pk=None):
        from django.db import transaction as dbt
        from apps.discounts.models import Coupon
        offer = self.get_object()
        try:
            n = int(request.data.get('count') or 0)
        except Exception:
            n = 0
        if n < 1 or n > 1000:
            return Response({'detail': 'اكتب عدد من 1 لـ 1000'}, status=400)
        if (offer.coupon_mode or 'SHARED') != 'UNIQUE':
            return Response({'detail': 'العرض ده كوبونه كود واحد للكل'}, status=400)
        codes = []
        with dbt.atomic():
            for _ in range(n):
                code = _new_coupon_code(offer.tenant)
                Coupon.objects.create(tenant=offer.tenant, offer=offer, code=code, max_uses=1, is_active=offer.is_active)
                codes.append(code)
        return Response({'created': n, 'codes': codes}, status=201)

    @action(detail=True, methods=['get'])
    def coupons(self, request, pk=None):
        offer = self.get_object()
        return Response([{'code': c.code, 'max_uses': c.max_uses, 'used_count': c.used_count, 'is_active': c.is_active} for c in offer.coupons.all().order_by('code')])

    @action(detail=False, methods=['get'])
    def validate_coupon(self, request):
        from apps.discounts.models import Coupon
        code = (request.query_params.get('code') or '').strip()
        c = Coupon.objects.select_related('offer').filter(tenant=self.get_tenant(), code=code).first()
        if not c:
            return Response({'valid': False, 'detail': 'الكوبون مش موجود'}, status=400)
        if not c.is_active:
            return Response({'valid': False, 'detail': 'الكوبون موقوف'}, status=400)
        ok, why = _offer_is_live(c.offer, request.query_params.get('warehouse'))
        if not ok:
            return Response({'valid': False, 'detail': why}, status=400)
        if c.max_uses is not None and c.used_count >= c.max_uses:
            return Response({'valid': False, 'detail': 'الكوبون ده اتستعمل قبل كده' if c.max_uses == 1 else 'الكوبون خلص عدد استخدامه'}, status=400)
        return Response({'valid': True, 'code': c.code, 'offer': OfferSerializer(c.offer).data})

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    @action(detail=False, methods=['get'])
    def active_now(self, request):
        from django.utils import timezone
        now = timezone.localtime()
        today = now.date(); t = now.time()
        day = OFFER_DAYS[(now.weekday() + 2) % 7]
        shop = request.query_params.get('warehouse')
        out = []
        for o in Offer.objects.filter(tenant=self.get_tenant(), is_active=True):
            if o.date_from and today < o.date_from:
                continue
            if o.date_to and today > o.date_to:
                continue
            if o.time_from and o.time_to and not (o.time_from <= t <= o.time_to):
                continue
            if o.days and day not in o.days:
                continue
            if o.shops and shop and shop not in [str(x) for x in o.shops]:
                continue
            out.append(o)
        return Response(OfferSerializer(out, many=True).data)

from apps.sales.models import DeferredSale
from apps.api.serializers import DeferredSaleSerializer


def _resolve_customer(tenant, data):
    from apps.customers.models import Customer
    cid = data.get('customer_id')
    if cid:
        c = Customer.objects.filter(tenant=tenant, pk=cid).first()
        if c:
            return c
    phone = ''.join(ch for ch in str(data.get('customer_phone') or '') if ch.isdigit())
    name = (data.get('customer_name') or '').strip()
    if not phone:
        return None
    c = Customer.objects.filter(tenant=tenant, phone=phone).first()
    if not c:
        nums = [int(x[1:]) for x in Customer.objects.filter(tenant=tenant).values_list('code', flat=True) if x and x[1:].isdigit()]
        c = Customer.objects.create(tenant=tenant, name=name or phone, phone=phone, code=f"C{(max(nums + [0]) + 1):04d}", is_active=True)
    elif name and (not c.name or c.name == c.phone):
        c.name = name
        c.save(update_fields=['name'])
    return c


def _holding_for(shop):
    w = Warehouse.objects.filter(tenant=shop.tenant, warehouse_type='TRANSIT', name=f"أمانات عند العملاء - {shop.name}").first()
    if w:
        return w
    skip = ('id', 'created_at', 'updated_at', 'name', 'warehouse_type')
    vals = {f.attname: getattr(shop, f.attname) for f in Warehouse._meta.concrete_fields if f.name not in skip and not f.primary_key}
    w = Warehouse(**vals)
    w.name = f"أمانات عند العملاء - {shop.name}"
    w.warehouse_type = 'TRANSIT'
    if hasattr(w, 'code'):
        base = f"HOLD-{getattr(shop, 'code', '') or str(shop.pk)[:6]}"
        w.code = base[:Warehouse._meta.get_field('code').max_length]
    w.save()
    return w


class DeferredSaleViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = DeferredSale
    serializer_class = DeferredSaleSerializer
    http_method_names = ['get', 'post']

    def get_queryset(self):
        qs = super().get_queryset().select_related('customer', 'cashier', 'deposit_method', 'terminal', 'sale_invoice').order_by('-created_at')
        p = self.request.query_params
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('terminal'):
            qs = qs.filter(terminal_id=p['terminal'])
        q = (p.get('q') or '').strip()
        if q:
            from django.db.models import Q as _Q
            qs = qs.filter(_Q(number__icontains=q) | _Q(customer__phone__icontains=q) | _Q(customer__name__icontains=q) | _Q(customer__code__iexact=q))
        return qs

    def create(self, request, *args, **kwargs):
        from datetime import timedelta
        from django.db import transaction as dbt
        from django.utils import timezone
        from django.core.exceptions import ValidationError as _DjVE
        from apps.shifts.models import Shift
        from apps.payments.models import PaymentMethod
        from apps.sales.services import _find_stock_for_piece
        from apps.transfers.services import create_transfer_order, ship_transfer_order, receive_transfer_order
        from apps.treasury.services import record_treasury_transaction
        from apps.treasury.models import TreasuryTransactionType
        tenant = self.get_tenant()
        d = request.data
        shift = Shift.objects.filter(pk=d.get('shift_id'), status='OPEN').first()
        if not shift:
            return Response({'detail': 'لازم تفتح وردية الأول'}, status=400)
        terminal = shift.terminal
        shop = terminal.default_warehouse
        if not shop:
            return Response({'detail': 'نقطة البيع دي مش مربوطة بمحل'}, status=400)
        items_in = d.get('items') or []
        if not items_in:
            return Response({'detail': 'الفاتورة فاضية'}, status=400)
        try:
            with dbt.atomic():
                customer = _resolve_customer(tenant, d)
                if not customer:
                    raise _DjVE('الفاتورة المؤجلة لازم يكون فيها اسم العميل وتليفونه')
                holding = _holding_for(shop)
                today = timezone.localdate()
                seq = DeferredSale.objects.filter(tenant=tenant, created_at__date=today).count() + 1
                number = f"DEF-{terminal.code}-{today.strftime('%Y%m%d')}-{seq:03d}"
                transfer_items, metas, total = [], [], Decimal('0.00')
                for it in items_in:
                    mode = it.get('price_mode') or 'KG'
                    qty = int(it.get('quantity_pieces') or 0)
                    price = Decimal(str(it.get('unit_price') or '0'))
                    if it.get('piece_item_id'):
                        piece = PieceItem.objects.get(pk=it['piece_item_id'], tenant=tenant)
                        qty = max(1, qty)
                        si = _find_stock_for_piece(piece, terminal, qty)
                        w = Decimal(str(it.get('weight_kg') or '0'))
                        if w <= 0:
                            per = (si.total_weight_kg / si.total_quantity_pieces) if si.total_quantity_pieces else Decimal('0')
                            w = (per * qty).quantize(Decimal('0.001'))
                    else:
                        si = StockItem.objects.filter(tenant=tenant, pk=it.get('stock_item_id'), warehouse=shop).first()
                        if not si:
                            raise _DjVE('فيه صنف مش موجود في رصيد المحل ده')
                        w = Decimal(str(it.get('weight_kg') or '0'))
                        if w <= 0:
                            raise _DjVE('فيه سطر ناقص الوزن')
                        if qty <= 0 and si.total_weight_kg > 0:
                            qty = int(round(float(si.total_quantity_pieces) * float(w) / float(si.total_weight_kg)))
                    if w > si.total_weight_kg:
                        raise _DjVE(f'الوزن المطلوب من {si.product.name} أكبر من المتاح ({si.total_weight_kg} كجم)')
                    qty = max(0, min(qty, int(si.total_quantity_pieces)))
                    line_total = ((Decimal(qty) * price) if mode == 'PIECE' else (w * price)).quantize(Decimal('0.01'))
                    total += line_total
                    transfer_items.append({'stock_item_id': si.pk, 'weight_kg': w, 'quantity_pieces': qty})
                    metas.append({'src': si, 'weight_kg': str(w), 'quantity_pieces': qty, 'unit_price': str(price), 'price_mode': mode, 'line_total': str(line_total),
                                  'display_name': it.get('display_name') or si.product.name, 'bundle_label': it.get('bundle_label'), 'offer_label': it.get('offer_label')})
                user = request.user if request.user.is_authenticated else None
                tr = create_transfer_order(tenant, shop, holding, user, transfer_items, f"فاتورة مؤجلة {number} - {customer.name} {customer.phone}")
                ship_transfer_order(tr.pk)
                receive_transfer_order(tr.pk)
                lines = []
                for mt in metas:
                    src = mt.pop('src')
                    h = StockItem.objects.get(tenant=tenant, product=src.product, grade=src.grade, warehouse=holding, source_lot=src.source_lot)
                    mt['holding_stock_item_id'] = str(h.pk)
                    lines.append(mt)
                deposit = Decimal(str(d.get('deposit_amount') or '0'))
                dm = None
                if deposit > 0:
                    dm = PaymentMethod.objects.filter(tenant=tenant, pk=d.get('deposit_method_id')).first()
                    if not dm or dm.method_type == 'CREDIT':
                        raise _DjVE('اختار طريقة دفع العربون')
                    if deposit > total:
                        raise _DjVE('العربون أكبر من قيمة الفاتورة')
                    target = dm.treasury or terminal.cash_drawer
                    record_treasury_transaction(treasury_id=target.id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=deposit, payment_method=dm,
                                                source_document_type='DeferredSale', source_document_id=number, description=f"عربون فاتورة مؤجلة {number}")
                    if dm.method_type == 'CASH':
                        shift.cash_sales_total += deposit
                        shift.save()
                days = int(d.get('due_days') or 3)
                ds = DeferredSale.objects.create(tenant=tenant, number=number, terminal=terminal, shift=shift, cashier=user, customer=customer, shop_warehouse=shop,
                                                 holding_warehouse=holding, lines=lines, total_amount=total, deposit_amount=deposit, deposit_method=dm,
                                                 due_date=today + timedelta(days=max(0, days)), transfer_out_code=tr.transfer_code, notes=d.get('notes'))
        except _DjVE as e:
            return Response({'detail': '; '.join(e.messages)}, status=400)
        return Response(DeferredSaleSerializer(ds).data, status=201)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        from django.db import transaction as dbt
        from django.utils import timezone
        from django.core.exceptions import ValidationError as _DjVE
        from apps.shifts.models import Shift
        from apps.sales.services import process_pos_sale
        from apps.treasury.services import record_treasury_transaction
        from apps.treasury.models import TreasuryTransactionType
        ds = self.get_object()
        if ds.status != 'OPEN':
            return Response({'detail': 'الفاتورة دي اتقفلت قبل كده'}, status=400)
        d = request.data
        shift = Shift.objects.filter(pk=d.get('shift_id'), status='OPEN').first()
        if not shift:
            return Response({'detail': 'لازم تفتح وردية الأول'}, status=400)
        try:
            with dbt.atomic():
                payments = list(d.get('payments') or [])
                if ds.deposit_amount > 0 and ds.deposit_method:
                    target = ds.deposit_method.treasury or ds.terminal.cash_drawer
                    record_treasury_transaction(treasury_id=target.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=ds.deposit_amount, payment_method=ds.deposit_method,
                                                source_document_type='DeferredSale', source_document_id=ds.number, description=f"تحويل عربون {ds.number} لفاتورة بيع", allow_negative=True)
                    if ds.deposit_method.method_type == 'CASH':
                        shift.cash_sales_total -= ds.deposit_amount
                        shift.save()
                    payments.append({'payment_method_id': str(ds.deposit_method_id), 'amount': str(ds.deposit_amount)})
                items = [{'stock_item_id': l['holding_stock_item_id'], 'weight_kg': l['weight_kg'], 'quantity_pieces': l['quantity_pieces'], 'unit_price': l['unit_price'],
                          'price_mode': l['price_mode'], 'display_name': l.get('display_name'), 'bundle_label': l.get('bundle_label'), 'offer_label': l.get('offer_label')} for l in ds.lines]
                inv = process_pos_sale(shift_id=shift.pk, cashier=request.user, items_data=items, payments_data=payments,
                                       discount_amount=Decimal(str(d.get('discount_amount') or '0')), customer=ds.customer,
                                       notes=(f"تحويل الفاتورة المؤجلة {ds.number} " + (d.get('notes') or '')).strip(), allowed_warehouse_id=ds.holding_warehouse_id)
                ds.status = 'SOLD'
                ds.sale_invoice = inv
                ds.closed_by = request.user if request.user.is_authenticated else None
                ds.closed_at = timezone.now()
                ds.save()
        except _DjVE as e:
            return Response({'detail': '; '.join(e.messages)}, status=400)
        return Response({'deferred': DeferredSaleSerializer(ds).data, 'invoice_number': inv.invoice_number, 'invoice_id': str(inv.id)})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        from django.db import transaction as dbt
        from django.utils import timezone
        from django.core.exceptions import ValidationError as _DjVE
        from apps.shifts.models import Shift
        from apps.transfers.services import create_transfer_order, ship_transfer_order, receive_transfer_order
        from apps.treasury.services import record_treasury_transaction
        from apps.treasury.models import TreasuryTransactionType
        ds = self.get_object()
        if ds.status != 'OPEN':
            return Response({'detail': 'الفاتورة دي اتقفلت قبل كده'}, status=400)
        refund = str(request.data.get('refund_deposit', 'true')).lower() not in ('false', '0', 'no')
        try:
            with dbt.atomic():
                user = request.user if request.user.is_authenticated else None
                back = [{'stock_item_id': l['holding_stock_item_id'], 'weight_kg': Decimal(str(l['weight_kg'])), 'quantity_pieces': int(l['quantity_pieces'])} for l in ds.lines]
                tr = create_transfer_order(ds.tenant, ds.holding_warehouse, ds.shop_warehouse, user, back, f"إلغاء فاتورة مؤجلة {ds.number}")
                ship_transfer_order(tr.pk)
                receive_transfer_order(tr.pk)
                if refund and ds.deposit_amount > 0 and ds.deposit_method:
                    target = ds.deposit_method.treasury or ds.terminal.cash_drawer
                    record_treasury_transaction(treasury_id=target.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=ds.deposit_amount, payment_method=ds.deposit_method,
                                                source_document_type='DeferredSale', source_document_id=ds.number, description=f"رد عربون {ds.number}", allow_negative=True)
                    if ds.deposit_method.method_type == 'CASH':
                        sh = Shift.objects.filter(terminal=ds.terminal, status='OPEN').first()
                        if sh:
                            sh.cash_sales_total -= ds.deposit_amount
                            sh.save()
                ds.status = 'CANCELLED'
                ds.transfer_back_code = tr.transfer_code
                ds.closed_by = user
                ds.closed_at = timezone.now()
                ds.notes = ((ds.notes or '') + (' | العربون اترجع للعميل' if refund and ds.deposit_amount > 0 else (' | العربون ماترجعش' if ds.deposit_amount > 0 else ''))).strip(' |')
                ds.save()
        except _DjVE as e:
            return Response({'detail': '; '.join(e.messages)}, status=400)
        return Response(DeferredSaleSerializer(ds).data)
