
from decimal import Decimal
from apps.costing.models import CostingConfiguration, CostingMethod
from apps.pricing.models import StoreItem, PieceItem, PriceChangeLog
from .serializers import CostingConfigurationSerializer, StoreItemSerializer, PieceItemSerializer
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from apps.users.models import RolePermission
from apps.users.serializers import RolePermissionSerializer
from apps.discounts.models import DiscountRule
from apps.returns.models import SalesReturn
from apps.treasury.models import Treasury, TreasuryTransaction
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

    @action(detail=False, methods=['get'])
    def summary(self, request):
        from django.db.models import Sum, Count, Max
        from apps.purchasing.models import PurchaseInvoice
        from apps.suppliers.models import SupplierPayment
        t = self.get_tenant()
        inv = {str(r['supplier']): r for r in PurchaseInvoice.objects.filter(tenant=t).exclude(status='CANCELLED').values('supplier').annotate(n=Count('id'), total=Sum('total_cost'), last=Max('invoice_date'))}
        pay = {str(r['supplier']): r['s'] for r in SupplierPayment.objects.filter(tenant=t).values('supplier').annotate(s=Sum('amount'))}
        rows = []
        for sp in Supplier.objects.filter(tenant=t).order_by('name'):
            i = inv.get(str(sp.id), {}); total = i.get('total') or Decimal('0'); paid = pay.get(str(sp.id)) or Decimal('0')
            rows.append({'id': str(sp.id), 'code': sp.code, 'name': sp.name, 'phone': sp.phone, 'invoices': i.get('n', 0), 'total': str(Decimal(total).quantize(Decimal('0.01'))), 'paid': str(Decimal(paid).quantize(Decimal('0.01'))), 'balance': str((Decimal(total) - Decimal(paid)).quantize(Decimal('0.01'))), 'last': i.get('last')})
        return Response(rows)

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        from apps.purchasing.models import PurchaseInvoice
        from apps.suppliers.models import SupplierPayment
        sp = self.get_object()
        from apps.purchasing.models import PurchaseLineItem
        _fk = next(f.name for f in PurchaseLineItem._meta.fields if f.is_relation and f.related_model is PurchaseInvoice)
        ev = []
        for pi in PurchaseInvoice.objects.filter(tenant=sp.tenant, supplier=sp).exclude(status='CANCELLED'):
            lines = []
            for l in PurchaseLineItem.objects.filter(**{_fk: pi}):
                desc = ' - '.join([str(getattr(l, f)) for f in ('bale_type', 'segment', 'grade', 'brand', 'item_name', 'description') if getattr(l, f, None)])
                tot = next((getattr(l, f) for f in ('total_price', 'line_total', 'subtotal', 'total_cost', 'total') if getattr(l, f, None) is not None), '')
                lines.append({'desc': desc, 'kg': str(getattr(l, 'weight_kg', '') or ''), 'total': str(tot)})
            ev.append({'kind': 'INVOICE', 'id': str(pi.id), 'date': str(pi.invoice_date), 'at': pi.created_at, 'ref': pi.invoice_number, 'amount': pi.total_cost, 'lines': lines, 'notes': pi.notes})
        for p in SupplierPayment.objects.filter(tenant=sp.tenant, supplier=sp).select_related('payment_method', 'paid_by', 'purchase_invoice'):
            ev.append({'kind': 'PAYMENT', 'id': str(p.id), 'date': str(p.created_at.date()), 'at': p.created_at, 'ref': p.purchase_invoice.invoice_number if p.purchase_invoice_id else '', 'amount': p.amount,
                       'method': p.payment_method.name if p.payment_method_id else '', 'by': p.paid_by.username if p.paid_by_id else '', 'notes': p.notes})
        ev.sort(key=lambda e: (e['date'], e['at']))
        bal = Decimal('0')
        for e in ev:
            bal += e['amount'] if e['kind'] == 'INVOICE' else -e['amount']
            e['balance'] = str(bal.quantize(Decimal('0.01'))); e['amount'] = str(Decimal(e['amount']).quantize(Decimal('0.01'))); e['at'] = e['at'].isoformat()
        return Response({'supplier': {'id': str(sp.id), 'code': sp.code, 'name': sp.name, 'phone': sp.phone}, 'balance': str(bal.quantize(Decimal('0.01'))), 'entries': ev})

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        from django.db import transaction as dbt
        from apps.payments.models import PaymentMethod
        from apps.purchasing.models import PurchaseInvoice
        from apps.suppliers.models import SupplierPayment
        from apps.treasury.services import record_treasury_transaction
        from apps.treasury.models import TreasuryTransactionType
        sp = self.get_object()
        amt = Decimal(str(request.data.get('amount') or '0'))
        if amt <= 0:
            return Response({'detail': 'اكتب المبلغ'}, status=400)
        pm = PaymentMethod.objects.filter(tenant=sp.tenant, pk=request.data.get('payment_method_id')).first()
        if not pm or pm.method_type == 'CREDIT' or not pm.treasury_id:
            return Response({'detail': 'اختار طريقة دفع ليها خزنة'}, status=400)
        pi = PurchaseInvoice.objects.filter(tenant=sp.tenant, supplier=sp, pk=request.data.get('purchase_invoice_id')).first() if request.data.get('purchase_invoice_id') else None
        try:
            with dbt.atomic():
                p = SupplierPayment.objects.create(tenant=sp.tenant, supplier=sp, amount=amt, payment_method=pm, purchase_invoice=pi,
                                                   paid_by=request.user if request.user.is_authenticated else None, notes=request.data.get('notes'))
                record_treasury_transaction(treasury_id=pm.treasury_id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=amt, payment_method=pm,
                                            source_document_type='SupplierPayment', source_document_id=str(p.id), description=f"دفع للمورد {sp.name}")
                if pi:
                    pi.paid_amount = (pi.paid_amount or Decimal('0')) + amt
                    pi.save(update_fields=['paid_amount'])
        except Exception as e:
            msg = '; '.join(getattr(e, 'messages', []) or [str(e)])
            return Response({'detail': ('الخزنة مفيهاش فلوس كفاية للمبلغ ده' if 'Insufficient' in msg else msg) or 'حصلت مشكلة'}, status=400)
        return Response({'ok': True, 'payment_id': str(p.id)}, status=201)

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

    def _admin_only(self):
        u = self.request.user
        return u.is_superuser or getattr(u, 'role', None) == 'ADMIN'

    def get_queryset(self):
        qs = super().get_queryset()
        if not self._admin_only():
            qs = qs.filter(is_active=True)
        return qs

    def _validate_treasury(self):
        treasury_id = self.request.data.get('treasury')
        if treasury_id and not Treasury.objects.filter(tenant=self.get_tenant(), pk=treasury_id).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'treasury': 'الخزنة لازم تكون من نفس الشركة'})

    def create(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يعدّل طرق الدفع'}, status=403)
        self._validate_treasury()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يعدّل طرق الدفع'}, status=403)
        self._validate_treasury()
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يعدّل طرق الدفع'}, status=403)
        obj = self.get_object()
        obj.is_active = False
        obj.save(update_fields=['is_active'])
        return Response(status=204)

class PurchaseInvoiceViewSet(BaseTenantViewSet):
    model = PurchaseInvoice
    serializer_class = PurchaseInvoiceSerializer

    def _lots_locked(self, inv):
        from apps.raw_lots.models import RawLot
        busy = RawLot.objects.filter(purchase_invoice=inv).exclude(status__in=['RECEIVED', 'CANCELLED']).first()
        return busy.lot_code if busy else None

    @action(detail=False, methods=['post'], url_path='check_manager')
    def check_manager(self, request):
        if not _verify_manager(self.get_tenant(), request.data.get('manager_password')):
            return Response({'detail': 'باسورد المدير غلط'}, status=403)
        return Response({'ok': True})

    @action(detail=True, methods=['post'], url_path='replace')
    def replace_invoice(self, request, pk=None):
        from django.db import transaction as dbt
        from apps.raw_lots.models import RawLot
        old = self.get_object(); t = old.tenant
        if not _verify_manager(t, request.data.get('manager_password')):
            return Response({'detail': 'تعديل فاتورة الشراء محتاج باسورد المدير'}, status=403)
        if old.status == 'CANCELLED':
            return Response({'detail': 'الفاتورة دي ملغية'}, status=400)
        busy = self._lots_locked(old)
        if busy:
            return Response({'detail': f'مينفعش تتعدّل: البالة {busy} بدأت تتفرز'}, status=400)

        class _Stop(Exception):
            pass
        holder = {}
        try:
            with dbt.atomic():
                RawLot.objects.filter(purchase_invoice=old).delete()
                PurchaseLineItem.objects.filter(invoice=old).delete()
                resp = self.create(request)
                if resp.status_code != 201:
                    holder['resp'] = resp
                    raise _Stop()
                new = PurchaseInvoice.objects.get(pk=resp.data['id'])
                PurchaseLineItem.objects.filter(invoice=new).update(invoice=old)
                for i, lot in enumerate(RawLot.objects.filter(purchase_invoice=new).order_by('lot_code')):
                    lot.purchase_invoice = old
                    lot.lot_code = f"LOT-{old.invoice_number}-{i + 1}"
                    lot.notes = f"Edited invoice #{old.invoice_number}"
                    lot.save()
                old.supplier_id = new.supplier_id
                old.warehouse_id = new.warehouse_id
                old.subtotal = new.subtotal
                old.additional_costs = new.additional_costs
                old.total_cost = new.total_cost
                old.save()
                new.delete()
        except _Stop:
            return holder['resp']
        except Exception as ex:
            return Response({'detail': f'مينفعش تتعدّل: {str(ex)[:150]}'}, status=400)
        return Response({'ok': True, 'id': str(old.id), 'invoice_number': old.invoice_number, 'total_amount': str(old.total_cost)})
    @action(detail=True, methods=['post'], url_path='edit')
    def edit_invoice(self, request, pk=None):
        from django.db import transaction as dbt
        from apps.raw_lots.models import RawLot
        from apps.suppliers.models import Supplier
        inv = self.get_object(); t = inv.tenant; d = request.data
        if not _verify_manager(t, d.get('manager_password')):
            return Response({'detail': 'تعديل فاتورة الشراء محتاج باسورد المدير'}, status=403)
        if inv.status == 'CANCELLED':
            return Response({'detail': 'الفاتورة دي ملغية'}, status=400)
        busy = self._lots_locked(inv)
        if busy:
            return Response({'detail': f'مينفعش تتعدّل: البالة {busy} بدأت تتفرز'}, status=400)
        try:
            freight = Decimal(str(d.get('freight_cost') if d.get('freight_cost') not in (None, '') else inv.additional_costs))
        except Exception:
            return Response({'detail': 'مصاريف النقل لازم تبقى رقم'}, status=400)
        if freight < 0:
            return Response({'detail': 'مصاريف النقل مينفعش تبقى بالسالب'}, status=400)
        sup = None
        if d.get('supplier_id'):
            sup = Supplier.objects.filter(tenant=t, pk=d.get('supplier_id')).first()
            if not sup:
                return Response({'detail': 'المورد مش موجود'}, status=400)
        with dbt.atomic():
            lines = list(inv.line_items.all().order_by('created_at')) if hasattr(inv, 'line_items') else list(PurchaseLineItem.objects.filter(invoice=inv).order_by('created_at'))
            vals = [l.total_cost for l in lines]; tot = sum(vals, Decimal('0')); allocated = Decimal('0')
            for i, l in enumerate(lines):
                if tot <= 0 or freight <= 0:
                    share = Decimal('0')
                elif i == len(lines) - 1:
                    share = freight - allocated
                else:
                    share = (freight * l.total_cost / tot).quantize(Decimal('0.01')); allocated += share
                RawLot.objects.filter(purchase_line_item=l).update(purchase_cost=l.total_cost + share, **({'supplier': sup} if sup else {}))
            inv.additional_costs = freight
            inv.total_cost = inv.subtotal + freight
            if sup:
                inv.supplier = sup
            if 'notes' in d:
                inv.notes = d.get('notes') or ''
            inv.save()
        return Response({'ok': True, 'total_cost': str(inv.total_cost), 'freight': str(freight)})

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_invoice(self, request, pk=None):
        from django.db import transaction as dbt
        from apps.raw_lots.models import RawLot
        inv = self.get_object(); t = inv.tenant; d = request.data
        if not _verify_manager(t, d.get('manager_password')):
            return Response({'detail': 'إلغاء فاتورة الشراء محتاج باسورد المدير'}, status=403)
        if inv.status == 'CANCELLED':
            return Response({'detail': 'الفاتورة دي ملغية قبل كده'}, status=400)
        reason = (d.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'اكتب سبب الإلغاء'}, status=400)
        busy = self._lots_locked(inv)
        if busy:
            return Response({'detail': f'مينفعش تتلغي: البالة {busy} بدأت تتفرز'}, status=400)
        with dbt.atomic():
            RawLot.objects.filter(purchase_invoice=inv).update(status='CANCELLED')
            inv.status = 'CANCELLED'
            inv.notes = ((inv.notes or '') + f' | ملغية: {reason}').strip(' |')
            inv.save()
        return Response({'ok': True})
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
        # ---- PURCHASES_V3 validation (nothing is saved if any row is wrong) ----
        _GR6 = ['سوبر كريم', 'كريم', 'كريم في واحد', 'نمرة 1', 'نمرة 2', 'سحبة']
        _SEG = ['حريمي', 'رجالي']
        _items = data.get('items', []) or []
        if not _items:
            return Response({'detail': 'الفاتورة فاضية - ضيف سطر واحد على الأقل'}, status=400)
        for _n, _it in enumerate(_items, start=1):
            _k = _it.get('purchase_kind')
            if _k not in ('BALE', 'STOCK', 'DIRECT'):
                continue
            _bad = lambda m: Response({'detail': f'السطر رقم {_n}: {m}'}, status=400)
            try:
                _w = Decimal(str(_it.get('weight_kg') or '0')); _p = Decimal(str(_it.get('unit_price') or '0'))
            except Exception:
                return _bad('الوزن أو سعر الكيلو مش أرقام')
            if _w <= 0:
                return _bad('لازم الوزن يبقى أكبر من صفر')
            if _p <= 0:
                return _bad('لازم سعر الكيلو يبقى أكبر من صفر')
            if (_it.get('segment') or '') not in _SEG:
                return _bad('اختار حريمي أو رجالي')
            _season = _it.get('season') or ''
            if _k in ('BALE', 'STOCK') and _season not in ('صيفي', 'شتوي'):
                return _bad('اختار صيفي أو شتوي')
            if _k == 'DIRECT' and _season not in ('صيفي', 'شتوي', 'ميكس', 'بدون'):
                return _bad('اختار الموسم (صيفي، شتوي، ميكس، بدون)')
            if _k == 'BALE':
                if (_it.get('grade') or '') not in _GR6:
                    return _bad('اختار درجة البالة')
                if not (_it.get('item_name') or '').strip():
                    return _bad('اختار صنف البالة')
                if (_it.get('ton_type') or '') not in ('NORMAL', 'ASSORTED'):
                    return _bad('اختار طن عادي ولا تشكيل')
            if _k == 'STOCK':
                if (_it.get('stock_type') or '') not in ('ONE_BRAND', 'MIX_BRAND'):
                    return _bad('اختار وان براند ولا ميكس')
                if _it.get('stock_type') == 'ONE_BRAND' and not (_it.get('brand') or '').strip():
                    return _bad('اختار البراند')
            if _k == 'DIRECT':
                if not (_it.get('direct_category') or '').strip():
                    return _bad('اختار التصنيف (أحذية، شنط...)')
                if (_it.get('grade') or '') and _it.get('grade') not in _GR6:
                    return _bad('الدرجة مش من الـ 6 درجات')

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

            if item.get('purchase_kind') in ('BALE', 'STOCK', 'DIRECT') and item.get('season'):
                _pk = item.get('purchase_kind')
                if _pk == 'BALE':
                    desc = f"بالة - {item.get('segment')} - {item.get('season')} - {item.get('grade')} - {item.get('item_name')}"
                elif _pk == 'STOCK':
                    _bn = item.get('brand') if item.get('stock_type') == 'ONE_BRAND' else ('ميكس' + (' (' + '، '.join(item.get('brands') or []) + ')' if item.get('brands') else ''))
                    desc = f"استوك - {item.get('segment')} - {item.get('season')} - {_bn}"
                else:
                    desc = ' - '.join([x for x in ['شراء مباشر', item.get('segment'), item.get('season'), item.get('direct_category'), item.get('brand') or '', item.get('grade') or ''] if x])
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
                extra_description=item.get('extra_description') or None,
                season=item.get('season') or '',
                ton_type=item.get('ton_type') or '',
                ton_group=item.get('ton_group') or '',
                brands=item.get('brands') or [],
                direct_category=item.get('direct_category') or ''
            )

            # If RAW_BALE, create RawLot automatically for the Sorting Hub
            if item_type == PurchaseItemType.RAW_BALE or not prod_id:
                lot_code = f"LOT-{inv_num}-{idx+1}"
                kind_map = {'BALE': 'بالة', 'STOCK': 'استوك', 'DIRECT': 'شراء مباشر'}
                pk_val = line.purchase_kind or 'BALE'
                RawLot.objects.create(
                    tenant=tenant,
                    lot_code=lot_code,
                    purchase_invoice=invoice,
                    purchase_line_item=line,
                    supplier_id=supplier_id,
                    warehouse_id=warehouse_id,
                    category_id=cat_id if cat_id else None,
                    source_kind=kind_map.get(pk_val, pk_val),
                    segment=line.segment or 'حريمي',
                    season=line.season or 'صيفي',
                    purchase_grade=line.grade or 'سوبر كريم',
                    category_name=line.item_name or line.direct_category or 'بلوزه',
                    brand=line.brand or '',
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

    def get_queryset(self):  # PENDING_MEANS_WAITING
        qs = super().get_queryset()
        st = self.request.query_params.get('status')
        if st == 'PENDING':
            qs = qs.filter(status__in=['RECEIVED', 'SORTING_IN_PROGRESS'])
        elif st:
            qs = qs.filter(status=st)
        return qs

    @action(detail=True, methods=['post'])
    def sort_and_transfer(self, request, pk=None):
        """ SORT_AND_TRANSFER: one click = sorting order + lines + costing + inventory + bands """
        import uuid
        from django.db import transaction as dbt
        from django.utils import timezone
        from apps.sorting.models import SortingOrder, SortingOutputLine, SortingWasteLine
        from apps.products.models import Product, Category
        from apps.costing.services import calculate_sorting_costs
        from apps.inventory.services import post_sorting_to_inventory
        from apps.inventory.models import InventoryTransaction
        lot = self.get_object(); t = lot.tenant
        if lot.status not in ('RECEIVED', 'SORTING_IN_PROGRESS'):
            return Response({'detail': 'البالة دي اتفرزت قبل كده أو ملغية'}, status=400)
        li = getattr(lot, 'purchase_line_item', None)
        kind = getattr(li, 'purchase_kind', None)
        GMAP = {'HIGH': 'NEW_COLLECTION', 'MID': 'MIDDLE', 'LIQUIDATION': 'CLEARANCE', 'WASTE': 'WASTE'}
        GNAME = {'NEW_COLLECTION': 'عالي', 'MIDDLE': 'وسط', 'CLEARANCE': 'تصفيات'}
        goods, wastes = [], []
        for n, l in enumerate(request.data.get('lines') or [], start=1):
            g = GMAP.get(l.get('grade'))
            if not g:
                return Response({'detail': f'السطر {n}: الدرجة غلط'}, status=400)
            try:
                w = Decimal(str(l.get('weight_kg') or 0)); q = int(l.get('quantity_pieces') or 0)
            except Exception:
                return Response({'detail': f'السطر {n}: الوزن أو العدد مش أرقام'}, status=400)
            if w < 0 or q < 0:
                return Response({'detail': f'السطر {n}: مينفعش أرقام بالسالب'}, status=400)
            if w == 0 and q == 0:
                continue
            if g == 'WASTE':
                wastes.append((w, q)); continue
            if w <= 0 or q <= 0:
                return Response({'detail': f'السطر {n} ({GNAME[g]}): لازم وزن وعدد'}, status=400)
            if kind == 'BALE':
                item = (getattr(li, 'item_name', '') or '').strip(); brand = ''
            else:
                item = (l.get('category_name') or '').strip()
                if not item:
                    return Response({'detail': f'السطر {n} ({GNAME[g]}): اكتب الصنف'}, status=400)
                b = (l.get('brand') or '').strip()
                b = '' if b == 'بدون براند' else b
                if kind == 'STOCK' and getattr(li, 'stock_type', '') == 'ONE_BRAND':
                    b = li.brand or ''
                brand = b or (getattr(li, 'brand', '') or '')
            goods.append((g, w, q, item, brand))
        if not goods:
            return Response({'detail': 'لازم درجة واحدة على الأقل (عالي أو وسط أو تصفيات) بوزن وعدد'}, status=400)
        # WEIGHT_MUST_MATCH: sorted total (goods + waste) must equal the bale weight
        _total = sum((x[1] for x in goods), Decimal('0')) + sum((x[0] for x in wastes), Decimal('0'))
        _lotw = Decimal(str(getattr(lot, 'original_weight_kg', 0) or 0))
        if _lotw > 0 and abs(_total - _lotw) > Decimal('0.01'):
            _diff = (_lotw - _total).quantize(Decimal('0.001'))
            return Response({'detail': f'مجموع وزن الفرز {_total} كجم لازم يساوي وزن البالة {_lotw} كجم. الفرق {_diff} كجم: كمّل الفرز أو حط الفرق في الهالك'}, status=400)
        KIND = {'BALE': 'بالة', 'STOCK': 'استوك', 'DIRECT': 'شراء مباشر'}
        base = [KIND.get(kind, 'فرز'), getattr(li, 'segment', '') or '', getattr(li, 'season', '') or '', getattr(li, 'grade', '') or '']
        try:
            with dbt.atomic():
                order = SortingOrder.objects.filter(tenant=t, raw_lot=lot).first()
                if order and InventoryTransaction.objects.filter(source_document_type='SortingOrder', source_document_id=str(order.id)).exists():
                    return Response({'detail': 'البالة دي اترحّلت للمخزون قبل كده'}, status=400)
                if not order:
                    order = SortingOrder.objects.create(tenant=t, raw_lot=lot, order_code=f"SRT-{uuid.uuid4().hex[:6].upper()}", sorting_date=timezone.now().date(), status='DRAFT', notes='فرز وترحيل')
                SortingOutputLine.objects.filter(sorting_order=order).delete()
                SortingWasteLine.objects.filter(sorting_order=order).delete()
                category, _ = Category.objects.get_or_create(tenant=t, name='أصناف مفروزة عامة')
                for g, w, q, item, brand in goods:
                    pname = ' - '.join([x for x in base + [GNAME[g], item, brand] if x])
                    prod = Product.objects.filter(tenant=t, category=category, name=pname).first()
                    if not prod:
                        nums = [int(x) for x in Product.objects.filter(tenant=t).values_list('code', flat=True) if x and str(x).isdigit()]
                        prod = Product.objects.create(tenant=t, category=category, name=pname, code=str(max(nums + [1000]) + 1))
                    SortingOutputLine.objects.create(tenant=t, sorting_order=order, product=prod, warehouse=lot.warehouse, grade=g, weight_kg=w, quantity_pieces=q, brand=brand[:100], item_name=item[:150])
                for w, q in wastes:
                    SortingWasteLine.objects.create(tenant=t, sorting_order=order, weight_kg=w, quantity_pieces=q, classification='NORMAL', reason='هالك فرز')
                order.reconcile()
                record = calculate_sorting_costs(order.id)
                post_sorting_to_inventory(order.id)
                lot.status = 'SORTED'
                lot.save(update_fields=['status'])
                _rebuild_store_items(t)
        except Exception as ex:
            msg = '; '.join(getattr(ex, 'messages', []) or [str(ex)])
            return Response({'detail': f'الترحيل ماتمش: {msg[:200]}'}, status=400)
        return Response({'ok': True, 'order_code': order.order_code, 'waste_loss': str(getattr(record, 'waste_loss_amount', '0'))})




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

    @action(detail=False, methods=['get'], url_path='band_codes')
    def band_codes(self, request):
        from django.apps import apps as _a
        t = self.get_tenant()
        _rebuild_store_items(t)
        ST = _a.get_model('pricing', 'StoreItem')
        bands = {}
        for b in ST.objects.filter(tenant=t).exclude(coding_item=None).select_related('coding_item'):
            k = (b.source_kind or '', b.segment or '', b.season or '', b.purchase_grade or '', b.sort_grade or '', b.category_name or '', b.brand or '')
            lbl = f"{b.coding_item.code} - {b.coding_item.name}"
            bands[(b.warehouse_id,) + k] = lbl
            bands.setdefault(('ANY',) + k, lbl)
        qs = StockItem.objects.filter(tenant=t, total_weight_kg__gt=0).select_related('source_lot__purchase_line_item', 'product')
        if request.query_params.get('warehouse'):
            qs = qs.filter(warehouse_id=request.query_params['warehouse'])
        out = {}
        for si in qs:
            k = _stock_identity(si)
            if k:
                lbl = bands.get((si.warehouse_id,) + k) or bands.get(('ANY',) + k)
                if lbl:
                    out[str(si.pk)] = lbl
        return Response(out)
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

    def _admin_only(self):
        u = self.request.user
        return u.is_superuser or getattr(u, 'role', None) == 'ADMIN'

    def get_queryset(self):  # bound cashier sees only his terminal
        qs = super().get_queryset()
        if not self._admin_only():
            qs = qs.filter(is_active=True)
        tid = getattr(self.request.user, 'pos_terminal_id', None)
        return qs.filter(pk=tid) if tid else qs

    def create(self, request, *args, **kwargs):
        from django.db import transaction as dbt
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يضيف نقطة بيع'}, status=403)
        tenant = self.get_tenant()
        data = request.data.copy()
        name = (data.get('name') or '').strip()
        branch = Branch.objects.filter(tenant=tenant, pk=data.get('branch')).first()
        warehouse = Warehouse.objects.filter(tenant=tenant, pk=data.get('default_warehouse')).first()
        if not name or not branch or not warehouse:
            return Response({'detail': 'اكتب اسم نقطة البيع واختار الفرع والمخزن'}, status=400)
        if warehouse.branch_id != branch.id:
            return Response({'detail': 'المخزن لازم يكون تابع لنفس الفرع'}, status=400)
        if not data.get('code'):
            n = POSTerminal.objects.filter(tenant=tenant).count() + 1
            data['code'] = f'POS-{n:02d}'
        with dbt.atomic():
            drawer = None
            if data.get('cash_drawer'):
                drawer = Treasury.objects.filter(tenant=tenant, pk=data.get('cash_drawer')).first()
                if not drawer or drawer.treasury_type != 'POS_DRAWER' or drawer.branch_id != branch.id:
                    return Response({'detail': 'اختار درج كاشير صحيح تابع لنفس الفرع'}, status=400)
            else:
                drawer = Treasury.objects.create(tenant=tenant, branch=branch, name=f'درج كاشير - {name}', treasury_type='POS_DRAWER', current_balance=Decimal('0.00'), is_active=True)
            data['cash_drawer'] = str(drawer.pk)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يعدّل نقطة البيع'}, status=403)
        obj = self.get_object()
        branch_id = request.data.get('branch', obj.branch_id)
        warehouse_id = request.data.get('default_warehouse', obj.default_warehouse_id)
        branch = Branch.objects.filter(tenant=obj.tenant, pk=branch_id).first()
        warehouse = Warehouse.objects.filter(tenant=obj.tenant, pk=warehouse_id).first()
        if not branch or not warehouse or warehouse.branch_id != branch.id:
            return Response({'detail': 'الفرع والمخزن لازم يكونوا صحيحين وتابعين لبعض'}, status=400)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يوقف نقطة البيع'}, status=403)
        obj = self.get_object()
        obj.is_active = False
        obj.save(update_fields=['is_active'])
        return Response(status=204)

class ShiftViewSet(BaseTenantViewSet):
    model = Shift
    serializer_class = ShiftSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('terminal', 'cashier').order_by('-opened_at')
        p = self.request.query_params
        if p.get('terminal'):
            qs = qs.filter(terminal_id=p['terminal'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('date_from'):
            qs = qs.filter(opened_at__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(opened_at__date__lte=p['date_to'])
        return qs

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == '1':
            return None
        return super().paginate_queryset(queryset)

    @action(detail=False, methods=['post'])
    def open_v2(self, request):
        from django.db import transaction as dbt
        from django.utils import timezone
        from apps.pos.models import POSTerminal
        from apps.treasury.models import TreasuryTransactionType
        from apps.treasury.services import record_treasury_transaction
        t = self.get_tenant()
        term = POSTerminal.objects.filter(tenant=t, pk=request.data.get('terminal_id')).first()
        if not term or not term.cash_drawer_id:
            return Response({'detail': 'نقطة البيع دي مالهاش درج'}, status=400)
        if getattr(request.user, 'pos_terminal_id', None) and term.pk != request.user.pos_terminal_id:
            return Response({'detail': 'إنت مربوط بنقطة بيع تانية'}, status=403)
        if Shift.objects.filter(terminal=term, status='OPEN').exists():
            return Response({'detail': 'فيه وردية مفتوحة بالفعل على نقطة البيع دي'}, status=400)
        drawer = term.cash_drawer
        drawer.refresh_from_db()
        bal = drawer.current_balance
        counted = request.data.get('counted_cash')
        counted = bal if counted in (None, '') else Decimal(str(counted))
        diff = counted - bal
        with dbt.atomic():
            if diff != 0:
                if not _verify_manager(t, request.data.get('manager_password')):
                    return Response({'detail': f'الدرج المفروض فيه {bal}، وإنت عدّيت {counted}. الفرق محتاج باسورد المدير', 'drawer_balance': str(bal)}, status=403)
                record_treasury_transaction(treasury_id=drawer.id, transaction_type=TreasuryTransactionType.DEPOSIT if diff > 0 else TreasuryTransactionType.WITHDRAWAL,
                                            amount=abs(diff), source_document_type='ShiftOpeningAdjust', source_document_id=str(term.code), description=f"تظبيط الدرج عند فتح الوردية ({diff})", allow_negative=True)
            now = timezone.now()
            seq = Shift.objects.filter(tenant=t, opened_at__date=now.date()).count() + 1
            sh = Shift.objects.create(tenant=t, shift_code=f"SH-{term.code}-{now.strftime('%Y%m%d')}-{seq:03d}", terminal=term, cashier=request.user, opened_at=now,
                                      status='OPEN', opening_cash=counted, opening_difference=diff, notes=request.data.get('notes'))
        return Response(ShiftSerializer(sh).data, status=201)

    def _summary(self, sh):
        from django.db.models import Sum
        from apps.treasury.models import TreasuryTransaction
        from apps.sales.models import SaleInvoice, SalePayment
        drawer = sh.terminal.cash_drawer
        drawer.refresh_from_db()
        LABELS = {'SaleInvoice': 'مبيعات كاش', 'SalesReturn': 'مرتجعات', 'Expense': 'مصروفات', 'ExpenseCancel': 'إلغاء مصروفات', 'DeferredSale': 'عربون مؤجلة',
                  'CustomerPayment': 'تحصيل من عملاء', 'SupplierPayment': 'دفع لموردين', 'ShiftOpeningAdjust': 'تظبيط الافتتاح', 'ShiftOpening': 'افتتاح (قديم)', 'OwnerDrawing': 'ترحيل لصاحب المحل', 'ShiftShortage': 'عجز على الكاشير', 'ShiftSurplus': 'زيادة خزينة', 'Other': 'ترحيل لخزنة / تحويلات', 'None': 'ترحيل لخزنة / تحويلات'}
        moves = {}
        qs = TreasuryTransaction.objects.filter(treasury=drawer, created_at__gte=sh.opened_at)
        if sh.closed_at:
            qs = qs.filter(created_at__lte=sh.closed_at)
        for tx in qs:
            sign = 1 if tx.transaction_type in ('DEPOSIT', 'TRANSFER_IN') else -1
            key = tx.source_document_type or 'Other'
            moves[key] = moves.get(key, Decimal('0')) + (tx.amount if tx.amount < 0 else sign * tx.amount)
        by_method = {}
        invs = SaleInvoice.objects.filter(shift=sh)
        for p in SalePayment.objects.filter(sale_invoice__in=invs).select_related('payment_method'):
            by_method[p.payment_method.name] = by_method.get(p.payment_method.name, Decimal('0')) + p.amount
        return {'shift': ShiftSerializer(sh).data, 'drawer': drawer.name, 'opening': str(sh.opening_cash), 'expected': str(drawer.current_balance),
                'invoices': invs.count(), 'sales_total': str(invs.aggregate(s=Sum('total_amount'))['s'] or 0),
                'by_method': [{'method': k, 'amount': str(v)} for k, v in by_method.items()],
                'moves': [{'key': k, 'label': LABELS.get(k, k), 'amount': str(v)} for k, v in moves.items()]}

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        return Response(self._summary(self.get_object()))

    @action(detail=True, methods=['post'])
    def close_v2(self, request, pk=None):
        from django.db import transaction as dbt
        from django.utils import timezone
        from apps.treasury.models import Treasury, TreasuryTransactionType, Expense, ExpenseCategory
        from apps.treasury.services import record_treasury_transaction, transfer_between_treasuries
        from apps.shifts.models import CashierCustody, ShiftHandover
        sh = self.get_object()
        if sh.status != 'OPEN':
            return Response({'detail': 'الوردية دي مقفولة'}, status=400)
        t = sh.tenant
        d = request.data
        drawer = sh.terminal.cash_drawer
        drawer.refresh_from_db()
        expected = drawer.current_balance
        actual = Decimal(str(d.get('actual_cash') if d.get('actual_cash') not in (None, '') else '-1'))
        if actual < 0:
            return Response({'detail': 'اكتب الفلوس اللي اتعدّت في الدرج'}, status=400)
        diff = actual - expected
        mode = d.get('shortage_mode') or ''
        hand = d.get('handovers') or []
        htotal = sum((Decimal(str(h.get('amount') or '0')) for h in hand), Decimal('0'))
        if htotal > actual:
            return Response({'detail': 'الترحيل أكبر من الفلوس اللي في الدرج'}, status=400)
        try:
            with dbt.atomic():
                if diff < 0:
                    short = -diff
                    if mode == 'SHOP':
                        mgr = _verify_manager(t, d.get('manager_password'))
                        if not mgr:
                            return Response({'detail': 'العجز على المحل محتاج باسورد المدير'}, status=403)
                        cat, _ = ExpenseCategory.objects.get_or_create(tenant=t, name='عجز خزينة', defaults={'is_active': True})
                        today = timezone.localdate()
                        num = f"EXP-{today.strftime('%Y%m%d')}-{Expense.objects.filter(tenant=t, created_at__date=today).count() + 1:03d}"
                        record_treasury_transaction(treasury_id=drawer.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=short, source_document_type='Expense',
                                                    source_document_id=num, description=f"عجز وردية {sh.shift_code}", allow_negative=True)
                        e = Expense.objects.create(tenant=t, number=num, expense_date=today, category=cat, amount=short, treasury=drawer, shift=sh, paid_to=sh.cashier.username if sh.cashier_id else '',
                                                   description=f"عجز وردية {sh.shift_code}", created_by=request.user, approved_by=mgr)
                        e.journal_posted = _expense_journal(t, num, short, when=today)
                        e.save(update_fields=['journal_posted'])
                    elif mode == 'CASHIER':
                        record_treasury_transaction(treasury_id=drawer.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=short, source_document_type='ShiftShortage',
                                                    source_document_id=sh.shift_code, description=f"عجز على الكاشير - وردية {sh.shift_code}", allow_negative=True)
                        CashierCustody.objects.create(tenant=t, cashier=sh.cashier, shift=sh, amount=short, notes=f"عجز وردية {sh.shift_code}")
                    else:
                        return Response({'detail': 'فيه عجز: اختار هيتسجل على الكاشير ولا على المحل'}, status=400)
                elif diff > 0:
                    record_treasury_transaction(treasury_id=drawer.id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=diff, source_document_type='ShiftSurplus',
                                                source_document_id=sh.shift_code, description=f"زيادة خزينة - وردية {sh.shift_code}")
                for h in hand:
                    amt = Decimal(str(h.get('amount') or '0'))
                    if amt <= 0:
                        continue
                    if h.get('destination') == 'OWNER':
                        record_treasury_transaction(treasury_id=drawer.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=amt, source_document_type='OwnerDrawing',
                                                    source_document_id=sh.shift_code, description=f"ترحيل لصاحب المحل - {h.get('notes') or ''}".strip(' -'))
                        ShiftHandover.objects.create(tenant=t, shift=sh, destination='OWNER', amount=amt, notes=h.get('notes'))
                    else:
                        to = Treasury.objects.filter(tenant=t, pk=h.get('treasury_id')).first()
                        if not to or to.pk == drawer.pk:
                            raise ValueError('اختار الخزنة اللي هيترحّل ليها')
                        transfer_between_treasuries(drawer.id, to.id, amt, f"ترحيل وردية {sh.shift_code}")
                        ShiftHandover.objects.create(tenant=t, shift=sh, destination='TREASURY', to_treasury=to, amount=amt, notes=h.get('notes'))
                sh.expected_cash = expected
                sh.actual_cash = actual
                sh.difference = diff
                sh.shortage_mode = mode if diff < 0 else ''
                sh.handover_total = htotal
                sh.status = 'CLOSED'
                sh.closed_at = timezone.now()
                sh.closed_by = request.user
                sh.notes = ((sh.notes or '') + ' ' + (d.get('notes') or '')).strip()
                sh.save()
        except Exception as ex:
            msg = '; '.join(getattr(ex, 'messages', []) or [str(ex)])
            return Response({'detail': 'الخزنة مفيهاش فلوس كفاية' if 'Insufficient' in msg else msg}, status=400)
        drawer.refresh_from_db()
        out = self._summary(sh)
        out['remaining_in_drawer'] = str(drawer.current_balance)
        return Response(out)

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

    @action(detail=False, methods=['get', 'post'])
    def numbering(self, request):
        from apps.sales.models import NumberSequence
        from apps.returns.models import SalesReturn
        from apps.sales.services import SEQ_DEFAULTS
        t = self.get_tenant()
        used = lambda key, pre: [int(x[len(pre):]) for x in (SaleInvoice.objects.filter(tenant=t, invoice_number__startswith=pre).values_list('invoice_number', flat=True) if key == 'SALE' else SalesReturn.objects.filter(tenant=t, return_number__startswith=pre).values_list('return_number', flat=True)) if x[len(pre):].isdigit()]
        if request.method == 'POST':
            if not _verify_manager(t, request.data.get('manager_password')):
                return Response({'detail': 'تغيير الترقيم محتاج باسورد المدير'}, status=403)
            key = request.data.get('key')
            if key not in SEQ_DEFAULTS:
                return Response({'detail': 'نوع الترقيم غلط'}, status=400)
            seq, _ = NumberSequence.objects.get_or_create(tenant=t, key=key, defaults={'prefix': SEQ_DEFAULTS[key], 'next_value': 1, 'padding': 6})
            pre = (request.data.get('prefix') if request.data.get('prefix') is not None else seq.prefix).strip()
            try:
                nv = int(request.data.get('next_value') or seq.next_value); pad = int(request.data.get('padding') or seq.padding)
            except Exception:
                return Response({'detail': 'اكتب أرقام صح'}, status=400)
            mx = max(used(key, pre) + [0])
            if nv <= mx:
                return Response({'detail': f'آخر رقم اتستعمل بالبادئة دي هو {mx}، فلازم الرقم الجديد يبقى أكبر منه'}, status=400)
            if nv < 1 or pad < 1 or pad > 10:
                return Response({'detail': 'الأرقام مش مظبوطة'}, status=400)
            seq.prefix = pre; seq.next_value = nv; seq.padding = pad; seq.save()
        out = []
        for key, dpre in SEQ_DEFAULTS.items():
            seq = NumberSequence.objects.filter(tenant=t, key=key).first()
            pre = seq.prefix if seq else dpre; nv = seq.next_value if seq else 1; pad = seq.padding if seq else 6
            out.append({'key': key, 'prefix': pre, 'next_value': nv, 'padding': pad, 'last_used': max(used(key, pre) + [0]), 'example': f"{pre}{nv:0{pad}d}"})
        return Response(out)
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

    @action(detail=True, methods=['post'], url_path='replace')
    def replace_sale(self, request, pk=None):
        """ SALE_EDIT: same invoice number/date, old effects reversed, new one saved through the normal checkout """
        from decimal import Decimal as D
        from django.apps import apps as _a
        from django.db import transaction as dbt
        from django.utils import timezone
        G = _a.get_model
        old = self.get_object(); t = old.tenant
        if not _verify_manager(t, request.data.get('manager_password')):
            return Response({'detail': 'تعديل الفاتورة محتاج باسورد المدير'}, status=403)
        SR = G('returns', 'SalesReturn')
        fk = [f.name for f in SR._meta.concrete_fields if getattr(f, 'related_model', None) is G('sales', 'SaleInvoice')]
        if fk and SR.objects.filter(**{fk[0]: old}).exists():
            return Response({'detail': 'الفاتورة دي ليها مرتجع - مينفعش تتعدّل'}, status=400)
        SP = G('sales', 'SalePayment')
        spfk = [f.name for f in SP._meta.concrete_fields if getattr(f, 'related_model', None) is G('sales', 'SaleInvoice')][0]
        pays = list(SP.objects.filter(**{spfk: old}).select_related('payment_method'))
        if any(getattr(x.payment_method, 'method_type', '') == 'CREDIT' for x in pays):
            return Response({'detail': 'الفاتورة دي فيها آجل - عدّلها بمرتجع'}, status=400)
        old_cash = sum((D(str(x.amount)) for x in pays if getattr(x.payment_method, 'method_type', '') == 'CASH'), D('0'))
        num, when = old.invoice_number, old.invoice_date_time
        Shift = G('shifts', 'Shift')
        class _Stop(Exception):
            pass
        box = {}
        try:
            with dbt.atomic():
                IT = G('inventory', 'InventoryTransaction'); TT = G('treasury', 'TreasuryTransaction')
                for x in IT.objects.filter(source_document_type='SaleInvoice', source_document_id=num).select_related('stock_item'):
                    si = x.stock_item
                    si.total_weight_kg = D(str(si.total_weight_kg)) - D(str(x.weight_change_kg or 0))
                    si.total_quantity_pieces = int(si.total_quantity_pieces) - int(x.quantity_change_pieces or 0)
                    si.current_total_value = D(str(si.current_total_value)) - D(str(x.total_cost_change or 0))
                    if si.total_weight_kg > 0:
                        si.avg_cost_per_kg = (si.current_total_value / si.total_weight_kg).quantize(D('0.0001'))
                    si.save(update_fields=['total_weight_kg', 'total_quantity_pieces', 'current_total_value', 'avg_cost_per_kg'])
                    x.delete()
                for x in TT.objects.filter(source_document_type='SaleInvoice', source_document_id=num).select_related('treasury'):
                    tr = x.treasury; tr.refresh_from_db()
                    tr.current_balance = D(str(tr.current_balance)) + (-D(str(x.amount)) if x.transaction_type == 'DEPOSIT' else D(str(x.amount)))
                    tr.save(update_fields=['current_balance']); x.delete()
                G('accounting', 'JournalEntry').objects.filter(source_document_type='SaleInvoice', source_document_id=str(old.id)).delete()
                sh = Shift.objects.filter(pk=request.data.get('shift_id')).first()
                s0 = D(str(sh.cash_sales_total or 0)) if sh else None
                old.delete()
                resp = self.checkout(request)
                if resp.status_code not in (200, 201):
                    box['r'] = resp; raise _Stop()
                new = G('sales', 'SaleInvoice').objects.get(invoice_number=resp.data.get('invoice_number'))
                nn = new.invoice_number
                new.invoice_number = num; new.invoice_date_time = when
                new.notes = ((new.notes or '') + f" | اتعدّلت بواسطة {request.user.username} في {timezone.localtime().strftime('%Y-%m-%d %H:%M')}").strip(' |')
                new.save(update_fields=['invoice_number', 'invoice_date_time', 'notes'])
                IT.objects.filter(source_document_type='SaleInvoice', source_document_id=nn).update(source_document_id=num)
                TT.objects.filter(source_document_type='SaleInvoice', source_document_id=nn).update(source_document_id=num)
                if sh is not None:
                    sh.refresh_from_db()
                    s1 = D(str(sh.cash_sales_total or 0))
                    if s1 != s0:
                        sh.cash_sales_total = s1 - old_cash; sh.save(update_fields=['cash_sales_total'])
                NS = G('sales', 'NumberSequence'); seq = NS.objects.filter(tenant=t, key='SALE').first()
                digits = ''.join(ch for ch in nn if ch.isdigit())
                if seq and digits and int(digits) == seq.next_value - 1:
                    seq.next_value -= 1; seq.save(update_fields=['next_value'])
                try:
                    _rebuild_store_items(t)
                except Exception:
                    pass
        except _Stop:
            return box['r']
        except Exception as ex:
            return Response({'detail': f'التعديل ماتمش: {str(ex)[:200]}'}, status=400)
        return Response({'ok': True, 'invoice_number': num, 'id': str(new.id)}, status=201)

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

        if getattr(request.user, 'pos_terminal_id', None) and request.data.get('shift_id') and not __import__('apps.shifts.models', fromlist=['Shift']).Shift.objects.filter(pk=request.data.get('shift_id'), terminal_id=request.user.pos_terminal_id).exists():
            return Response({'detail': 'إنت مربوط بنقطة بيع تانية'}, status=403)
        if any(__import__('apps.payments.models', fromlist=['PaymentMethod']).PaymentMethod.objects.filter(pk=p.get('payment_method_id'), method_type='CREDIT').exists() for p in (request.data.get('payments') or [])) and not __import__('apps.api.screen_permissions', fromlist=['can']).can(request.user, 'sell_credit'):
            return Response({'detail': 'البيع الآجل مش مسموح ليك - كلّم المدير'}, status=403)
        _exp = _expand_piece_items(self.get_tenant(), request.data)
        if isinstance(_exp, str):
            return Response({'detail': _exp}, status=400)
        if _exp is not None:
            request.data['items'] = _exp
        _vmsg = _verify_checkout(self.get_tenant(), request.data, __import__('apps.shifts.models', fromlist=['Shift']).Shift.objects.filter(pk=request.data.get('shift_id')).select_related('terminal').first().terminal if request.data.get('shift_id') else None)
        if _vmsg:
            return Response({'detail': _vmsg}, status=400)
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

    def get_queryset(self):
        u = self.request.user
        qs = RolePermission.objects.filter(tenant_id=getattr(u, 'tenant_id', None))
        if not (u.is_superuser or getattr(u, 'role', None) == 'ADMIN'):
            qs = qs.filter(role=getattr(u, 'role', None))
        r = self.request.query_params.get('role')
        return qs.filter(role=r) if r else qs

    def perform_create(self, serializer):
        serializer.save(tenant_id=getattr(self.request.user, 'tenant_id', None))
    @action(detail=False, methods=['get'])
    def mine(self, request):
        from apps.api.screen_permissions import allowed_screens, allowed_actions, ACTIONS
        u = request.user
        adm = u.is_superuser or getattr(u, 'role', None) == 'ADMIN'
        return Response({'is_admin': adm, 'screens': ['*'] if adm else allowed_screens(u), 'actions': ['*'] if adm else allowed_actions(u), 'all_actions': ACTIONS})

    @action(detail=False, methods=['get'])
    def defaults(self, request):
        from apps.api.screen_permissions import DEFAULTS, DEFAULT_ACTIONS, ACTIONS
        return Response({'screens': DEFAULTS, 'actions': DEFAULT_ACTIONS, 'all_actions': ACTIONS})
    
    def get_permissions(self):
        # Only ADMIN should edit permissions, but anyone can read to know their own limits
        return super().get_permissions()



class UserViewSet(BaseTenantViewSet):
    model = User
    serializer_class = UserManagementSerializer

    def perform_create(self, serializer):
        self._user_guard(True)
        tenant = self.get_tenant()
        password = self.request.data.get('password', '123456')
        user_inst = serializer.save(tenant=tenant)
        user_inst.set_password(password)
        user_inst.save()

    def _user_guard(self, creating):
        from rest_framework.exceptions import ValidationError as _VE, PermissionDenied as _PD
        me = self.request.user; d = self.request.data
        is_admin = me.is_superuser or getattr(me, 'role', None) == 'ADMIN'
        if d.get('role') == 'ADMIN' and not is_admin:
            raise _PD('مدير النظام بس يقدر يعمل حد مدير نظام')
        if not creating:
            inst = self.get_object()
            if inst.pk == me.pk and (str(d.get('is_active', 'true')).lower() in ('false', '0') or ('role' in d and d.get('role') != inst.role)):
                raise _VE({'detail': 'مينفعش توقّف نفسك أو تغيّر دورك بنفسك'})
            if (inst.is_superuser or inst.role == 'ADMIN') and not is_admin:
                raise _PD('مينفعش تعدّل مدير النظام')
    def perform_update(self, serializer):
        self._user_guard(False)
        user_inst = serializer.save()
        password = self.request.data.get('password')
        if password and str(password).strip():
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

    def get_queryset(self):
        u = self.request.user
        return Tenant.objects.filter(pk=getattr(u, 'tenant_id', None)) if u.is_authenticated else Tenant.objects.none()
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

    def _admin_only(self):
        u = self.request.user
        return u.is_superuser or getattr(u, 'role', None) == 'ADMIN'

    def get_queryset(self):  # drawers-only for roles without treasury screen
        qs = super().get_queryset()
        u = self.request.user
        if u.is_authenticated and not self._admin_only():
            from apps.api.screen_permissions import allowed_screens
            mine = allowed_screens(u)
            if not ('*' in mine or any(sc in mine for sc in ('/treasury', '/expenses', '/settings', '/'))):
                qs = qs.filter(treasury_type='POS_DRAWER')
            qs = qs.filter(is_active=True)
        return qs

    def create(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يضيف خزنة'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يعدّل الخزن'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._admin_only():
            return Response({'detail': 'مدير النظام بس يقدر يوقف الخزنة'}, status=403)
        obj = self.get_object()
        obj.is_active = False
        obj.save(update_fields=['is_active'])
        return Response(status=204)

    def _money_err(self, ex):
        msg = '; '.join(getattr(ex, 'messages', []) or [str(ex)])
        return Response({'detail': 'الخزنة مفيهاش فلوس كفاية للمبلغ ده' if 'Insufficient' in msg else msg}, status=400)

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        from django.db import transaction as dbt
        from apps.treasury.models import Treasury
        from apps.treasury.services import transfer_between_treasuries
        t = self.get_tenant(); d = request.data
        mgr = _verify_manager(t, d.get('manager_password'))
        if not mgr:
            return Response({'detail': 'التحويل محتاج باسورد المدير'}, status=403)
        src = Treasury.objects.filter(tenant=t, pk=d.get('from_id')).first(); dst = Treasury.objects.filter(tenant=t, pk=d.get('to_id')).first()
        amt = Decimal(str(d.get('amount') or '0'))
        if not src or not dst or src.pk == dst.pk or amt <= 0:
            return Response({'detail': 'اختار خزنتين مختلفتين واكتب المبلغ'}, status=400)
        try:
            with dbt.atomic():
                transfer_between_treasuries(src.id, dst.id, amt, f"تحويل من {src.name} إلى {dst.name} - {d.get('notes') or ''} (بموافقة {mgr.username})".strip())
        except Exception as ex:
            return self._money_err(ex)
        return Response({'ok': True})

    @action(detail=False, methods=['post'])
    def adjust(self, request):
        from django.db import transaction as dbt
        from apps.treasury.models import Treasury, TreasuryTransactionType
        from apps.treasury.services import record_treasury_transaction
        t = self.get_tenant(); d = request.data
        mgr = _verify_manager(t, d.get('manager_password'))
        if not mgr:
            return Response({'detail': 'الإيداع والسحب محتاجين باسورد المدير'}, status=403)
        tr = Treasury.objects.filter(tenant=t, pk=d.get('treasury_id')).first()
        amt = Decimal(str(d.get('amount') or '0')); kind = d.get('kind'); reason = (d.get('reason') or '').strip()
        if not tr or amt <= 0 or kind not in ('DEPOSIT', 'WITHDRAWAL') or not reason:
            return Response({'detail': 'اختار الخزنة والنوع واكتب المبلغ والسبب'}, status=400)
        try:
            with dbt.atomic():
                record_treasury_transaction(treasury_id=tr.id, transaction_type=getattr(TreasuryTransactionType, kind), amount=amt, source_document_type='Manual' + kind.title(),
                                            source_document_id=mgr.username, description=f"{'إيداع' if kind == 'DEPOSIT' else 'سحب'} يدوي: {reason} (بموافقة {mgr.username})")
        except Exception as ex:
            return self._money_err(ex)
        return Response({'ok': True})

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        from apps.treasury.models import TreasuryTransaction
        tr = self.get_object(); tr.refresh_from_db()
        p = request.query_params
        sgn = lambda x: x.amount if x.amount < 0 else (x.amount if x.transaction_type in ('DEPOSIT', 'TRANSFER_IN') else -x.amount)
        allq = TreasuryTransaction.objects.filter(treasury=tr)
        later = allq
        if p.get('date_from'):
            later = allq.filter(created_at__date__gte=p['date_from'])
        bal = tr.current_balance - sum((sgn(x) for x in later), Decimal('0'))
        opening = bal
        rows = []
        qs = later.order_by('created_at')
        if p.get('date_to'):
            qs = qs.filter(created_at__date__lte=p['date_to'])
        for x in qs:
            bal += sgn(x)
            rows.append({'date': x.created_at, 'type': x.transaction_type, 'doc': x.source_document_type or '', 'ref': x.source_document_id or '', 'desc': x.description or '', 'amount': str(sgn(x)), 'balance': str(bal)})
        return Response({'treasury': tr.name, 'current_balance': str(tr.current_balance), 'opening': str(opening), 'rows': rows})

    @action(detail=False, methods=['get'])
    def custodies(self, request):
        from apps.shifts.models import CashierCustody
        qs = CashierCustody.objects.filter(tenant=self.get_tenant()).select_related('cashier', 'shift').order_by('status', '-created_at')
        if request.query_params.get('status'):
            qs = qs.filter(status=request.query_params['status'])
        return Response([{'id': str(c.id), 'cashier': c.cashier.username, 'shift': c.shift.shift_code if c.shift_id else '', 'amount': str(c.amount), 'status': c.status, 'notes': c.notes, 'date': c.created_at, 'settled_at': c.settled_at} for c in qs])

    @action(detail=False, methods=['post'])
    def settle_custody(self, request):
        from django.db import transaction as dbt
        from django.utils import timezone
        from apps.shifts.models import CashierCustody
        from apps.treasury.models import Treasury, TreasuryTransactionType
        from apps.treasury.services import record_treasury_transaction
        t = self.get_tenant(); d = request.data
        c = CashierCustody.objects.filter(tenant=t, pk=d.get('custody_id'), status='OPEN').first()
        tr = Treasury.objects.filter(tenant=t, pk=d.get('treasury_id')).first()
        amt = Decimal(str(d.get('amount') or '0'))
        if not c or not tr or amt <= 0 or amt > c.amount:
            return Response({'detail': 'اختار العهدة والخزنة واكتب مبلغ مش أكبر من العهدة'}, status=400)
        with dbt.atomic():
            record_treasury_transaction(treasury_id=tr.id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=amt, source_document_type='CustodySettle',
                                        source_document_id=str(c.id), description=f"تسديد عهدة {c.cashier.username}")
            if amt < c.amount:
                CashierCustody.objects.create(tenant=t, cashier=c.cashier, shift=c.shift, amount=amt, status='SETTLED', notes=f"تسديد جزء من عهدة ({c.notes or ''})", settled_at=timezone.now())
                c.amount -= amt
                c.save(update_fields=['amount'])
            else:
                c.status = 'SETTLED'; c.settled_at = timezone.now(); c.save(update_fields=['status', 'settled_at'])
        return Response({'ok': True})


from apps.customers.models import Customer
from apps.payments.models import PaymentMethod

from apps.purchasing.models import PurchaseOption, PurchaseOptionType
# removed legacy import


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
            try:
                pcs = int(pcs)
            except Exception:
                return Response({'detail': 'عدد القطع لازم يبقى رقم'}, status=400)
            avail_w = si.total_weight_kg
            avail_pcs = int(si.total_quantity_pieces or 0)
            if pcs < 0 or pcs > avail_pcs:
                return Response({'detail': f'عدد القطع المطلوب من {si.product.name} أكبر من المتاح ({avail_pcs} قطعة)'}, status=400)
            is_full_w = (w >= avail_w - Decimal('0.0001'))
            if not is_full_w and pcs >= avail_pcs and avail_pcs > 0:
                max_allowed = max(0, avail_pcs - 1)
                return Response({'detail': f'طالما لم تنقل الوزن بالكامل من {si.product.name}، يجب ترك قطعة واحدة على الأقل (أقصى عدد مسموح به: {max_allowed} قطعة)'}, status=400)
            items.append({'stock_item_id': si.pk, 'weight_kg': w, 'quantity_pieces': pcs})
        if not items:
            return Response({'detail': 'ضيف صنف واحد على الأقل'}, status=400)
        user = request.user if request.user.is_authenticated else None
        try:
            with dbt.atomic():
                from apps.transfers.services import create_transfer_order, ship_transfer_order, receive_transfer_order
                tr = create_transfer_order(tenant, src, dst, user, items, d.get('notes'))
                ship_transfer_order(tr.pk)
                receive_transfer_order(tr.pk)
                _rebuild_store_items(tenant)
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

from apps.treasury.models import Expense, ExpenseCategory
from apps.api.serializers import ExpenseSerializer, ExpenseCategorySerializer
DEFAULT_EXPENSE_CATEGORIES = ['إيجار', 'كهرباء ومياه', 'مرتبات', 'نقل ومواصلات', 'ضيافة', 'صيانة', 'إعلانات', 'مستلزمات (أكياس وشماعات)', 'تليفون وإنترنت', 'مصروفات أخرى']


def _verify_manager(tenant, pwd):
    from django.contrib.auth import get_user_model
    from django.db.models import Q
    if not pwd:
        return None
    for mgr in get_user_model().objects.filter(is_active=True).filter(Q(tenant=tenant) | Q(is_superuser=True)):
        if mgr.check_password(pwd) and __import__('apps.api.screen_permissions', fromlist=['can']).can(mgr, 'approve'):
            return mgr
    return None


def _expense_journal(tenant, number, amount, reverse=False, when=None):
    """ Dr expense / Cr cash (or reversed). Skips quietly if no expense account exists. """
    from django.apps import apps as _apps
    from django.db import transaction as dbt
    from django.utils import timezone
    from apps.accounting.services import create_balanced_journal_entry
    acc_model = None
    for mdl in _apps.get_app_config('accounting').get_models():
        names = [f.name for f in mdl._meta.fields]
        if 'code' in names and 'name' in names and 'tenant' in names:
            acc_model = mdl
            break
    if not acc_model:
        return False
    codes = list(acc_model.objects.filter(tenant=tenant).values_list('code', 'name'))
    exp = next((c for c, n in codes if c.startswith('5') and c != '5010' and ('مصروف' in (n or '') or 'xpens' in (n or ''))), None) or next((c for c, n in codes if c in ('5020', '5030', '5040')), None)
    if not exp or not any(c == '1030' for c, n in codes):
        return False
    amt = Decimal(str(amount))
    lines = [{'account_code': exp, 'debit': amt, 'credit': Decimal('0.00'), 'desc': f'Expense {number}'}, {'account_code': '1030', 'debit': Decimal('0.00'), 'credit': amt, 'desc': f'Expense paid {number}'}]
    if reverse:
        lines = [{'account_code': l['account_code'], 'debit': l['credit'], 'credit': l['debit'], 'desc': 'Reversal ' + l['desc']} for l in lines]
    try:
        with dbt.atomic():
            create_balanced_journal_entry(tenant=tenant, entry_number=f"JV-{'X' if reverse else ''}{number}", entry_date=(when or timezone.localdate()), source_document_type='Expense',
                                          source_document_id=number, notes=('Cancel ' if reverse else '') + f'Expense {number}', lines_data=lines)
        return True
    except Exception:
        return False


class ExpenseCategoryViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = ExpenseCategory
    serializer_class = ExpenseCategorySerializer

    def get_queryset(self):
        t = self.get_tenant()
        if not ExpenseCategory.objects.filter(tenant=t).exists():
            for n in DEFAULT_EXPENSE_CATEGORIES:
                ExpenseCategory.objects.create(tenant=t, name=n)
        return super().get_queryset().filter(is_active=True).order_by('name')

    def create(self, request, *args, **kwargs):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'detail': 'اكتب اسم البند'}, status=400)
        t = self.get_tenant()
        c, _ = ExpenseCategory.objects.get_or_create(tenant=t, name=name, defaults={'is_active': True})
        return Response(ExpenseCategorySerializer(c).data, status=201)


class ExpenseViewSet(_AllPagesMixin, BaseTenantViewSet):
    model = Expense
    serializer_class = ExpenseSerializer
    http_method_names = ['get', 'post']

    def get_queryset(self):
        from django.db.models import Q as _Q
        qs = super().get_queryset().select_related('category', 'treasury', 'created_by', 'approved_by', 'cancelled_by', 'shift')
        p = self.request.query_params
        if p.get('date_from'):
            qs = qs.filter(expense_date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(expense_date__lte=p['date_to'])
        if p.get('category'):
            qs = qs.filter(category_id=p['category'])
        if p.get('treasury'):
            qs = qs.filter(treasury_id=p['treasury'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        q = (p.get('q') or '').strip()
        if q:
            qs = qs.filter(_Q(number__icontains=q) | _Q(paid_to__icontains=q) | _Q(description__icontains=q))
        return qs

    def create(self, request, *args, **kwargs):
        from django.db import transaction as dbt
        from django.utils import timezone
        from apps.treasury.models import Treasury, TreasuryTransactionType
        from apps.treasury.services import record_treasury_transaction
        from apps.shifts.models import Shift
        t = self.get_tenant()
        d = request.data
        mgr = _verify_manager(t, d.get('manager_password'))
        if not mgr:
            return Response({'detail': 'لازم باسورد مدير صح عشان المصروف يتسجل'}, status=403)
        amt = Decimal(str(d.get('amount') or '0'))
        if amt <= 0:
            return Response({'detail': 'اكتب المبلغ'}, status=400)
        cat = ExpenseCategory.objects.filter(tenant=t, pk=d.get('category_id')).first()
        tr = Treasury.objects.filter(tenant=t, pk=d.get('treasury_id')).first()
        if not cat or not tr:
            return Response({'detail': 'اختار البند والخزنة'}, status=400)
        today = timezone.localdate()
        edate = d.get('expense_date') or str(today)
        seq = Expense.objects.filter(tenant=t, created_at__date=today).count() + 1
        number = f"EXP-{today.strftime('%Y%m%d')}-{seq:03d}"
        shift = Shift.objects.filter(tenant=t, status='OPEN', terminal__cash_drawer=tr).first()
        try:
            with dbt.atomic():
                record_treasury_transaction(treasury_id=tr.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=amt, source_document_type='Expense',
                                            source_document_id=number, description=f"مصروف {number} - {cat.name} {d.get('paid_to') or ''}".strip())
                e = Expense.objects.create(tenant=t, number=number, expense_date=edate, category=cat, amount=amt, treasury=tr, shift=shift, paid_to=d.get('paid_to'),
                                           description=d.get('description'), created_by=request.user if request.user.is_authenticated else None, approved_by=mgr)
                e.journal_posted = _expense_journal(t, number, amt, when=today)
                e.save(update_fields=['journal_posted'])
        except Exception as ex:
            msg = '; '.join(getattr(ex, 'messages', []) or [str(ex)])
            return Response({'detail': 'الخزنة مفيهاش فلوس كفاية للمبلغ ده' if 'Insufficient' in msg else msg}, status=400)
        return Response(ExpenseSerializer(e).data, status=201)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        from django.db import transaction as dbt
        from django.utils import timezone
        from apps.treasury.models import TreasuryTransactionType
        from apps.treasury.services import record_treasury_transaction
        e = self.get_object()
        if e.status != 'ACTIVE':
            return Response({'detail': 'المصروف ده اتلغى قبل كده'}, status=400)
        mgr = _verify_manager(e.tenant, request.data.get('manager_password'))
        if not mgr:
            return Response({'detail': 'لازم باسورد مدير صح عشان الإلغاء'}, status=403)
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'اكتب سبب الإلغاء'}, status=400)
        with dbt.atomic():
            record_treasury_transaction(treasury_id=e.treasury_id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=e.amount, source_document_type='ExpenseCancel',
                                        source_document_id=e.number, description=f"إلغاء مصروف {e.number}")
            if e.journal_posted:
                _expense_journal(e.tenant, e.number, e.amount, reverse=True)
            e.status = 'CANCELLED'
            e.cancel_reason = reason
            e.cancelled_by = mgr
            e.cancelled_at = timezone.now()
            e.save()
        return Response(ExpenseSerializer(e).data)

from rest_framework import viewsets as _rvs
from rest_framework.permissions import IsAuthenticated as _RIsAuth


class ReportsV2ViewSet(_rvs.ViewSet):
    permission_classes = [_RIsAuth, __import__('apps.api.screen_permissions', fromlist=['ScreenPermission']).ScreenPermission]

    def list(self, request):
        from apps.api import reports_v2 as R
        return Response(R.catalog())

    @action(detail=False, methods=['get'])
    def run(self, request):
        from apps.api import reports_v2 as R
        t = getattr(request.user, 'tenant', None)
        out = R.run_report(t, request.query_params.get('name'), request.query_params)
        from apps.api.screen_permissions import can as _can
        if out is not None and not _can(request.user, 'view_cost_profit'):
            if request.query_params.get('name') in ('income_statement', 'profit_by_item', 'profit_by_grade', 'profit_by_cashier', 'profit_by_shop', 'bale_profit', 'monthly_compare'):
                return Response({'detail': 'مش مسموحلك تشوف التكلفة والربح'}, status=403)
            _hide = {'cost', 'profit', 'margin', 'cogs', 'gross', 'leftv'}
            out['columns'] = [c for c in out.get('columns', []) if c.get('key') not in _hide]
            out['rows'] = [{k: v for k, v in r.items() if k not in _hide} for r in out.get('rows', [])]
            out['totals'] = {k: v for k, v in (out.get('totals') or {}).items() if k not in _hide}
            out['cards'] = [c for c in out.get('cards', []) if 'تكلفة' not in c.get('label', '') and 'ربح' not in c.get('label', '')]
        if out is None:
            return Response({'detail': 'التقرير ده مش موجود'}, status=404)
        return Response(out)

def _offer_disc_py(o, lines, subtotal):
    P = lambda k: float(((o.params or {}).get(k)) or 0)
    t = o.targets or {}
    sel = [l for l in lines if all(not t.get(k) or l.get(k) == t.get(k) for k in ('kind', 'segment', 'brand', 'grade', 'season'))]
    lt = lambda l: l['qty'] * l['price'] if l['mode'] == 'PIECE' else l['kg'] * l['price']
    cheaper = lambda arr, pr: sum(max(0.0, (l['price'] - pr) * l['kg']) for l in arr)
    ty = o.offer_type; d = 0.0
    if ty == 'QTY':
        if sum(l['qty'] for l in sel if l['mode'] == 'PIECE') >= P('minQty'): d = sum(lt(l) for l in sel) * P('pct') / 100
    elif ty == 'BXGY':
        units = sorted([l['price'] for l in sel if l['mode'] == 'PIECE' for _ in range(int(l['qty']))], reverse=True); g = P('buy') + P('get')
        if g > 0 and P('get') > 0:
            sets = int(len(units) // g); free = units[len(units) - int(sets * P('get')):] if sets else []
            d = sum(free) * (P('getPct') or 100) / 100
    elif ty == 'WKG':
        w = [l for l in sel if l['mode'] == 'KG']
        if sum(l['kg'] for l in w) >= P('minKg') and P('kgPrice') > 0: d = cheaper(w, P('kgPrice'))
    elif ty == 'TIERS':
        w = [l for l in sel if l['mode'] == 'KG']; tk = sum(l['kg'] for l in w); tp = P('t3') if tk > 5 else (P('t2') if tk > 3 else P('t1'))
        if tp > 0: d = cheaper(w, tp)
    elif ty == 'KGDAY':
        if P('kgPrice') > 0: d = cheaper([l for l in lines if l['mode'] == 'KG'], P('kgPrice'))
    elif ty == 'SCALEFIX':
        if P('kgPrice') > 0: d = cheaper([l for l in lines if l['bundle'] and l['mode'] == 'KG'], P('kgPrice'))
    elif ty == 'BAG':
        if P('price') > 0: d = max(0.0, subtotal - P('price'))
    elif ty == 'COMBO':
        codes = [x.strip() for x in str((o.params or {}).get('codes') or '').split(',') if x.strip()]
        found = [next((l for l in lines if l['code'] == cd), None) for cd in codes]
        if codes and all(found): d = max(0.0, sum(l['price'] for l in found) - P('price'))
    elif ty == 'TARGET':
        d = sum(lt(l) for l in sel) * P('pct') / 100
    elif ty == 'INVOICE':
        if subtotal >= P('minAmount'): d = P('fixed') if P('fixed') > 0 else subtotal * P('pct') / 100
    elif ty == 'COUPON':
        d = subtotal * P('pct') / 100
    if o.max_discount and float(o.max_discount) > 0: d = min(d, float(o.max_discount))
    return round(max(0.0, d), 2)


def _verify_checkout(tenant, data, terminal):
    """ Server-side guard: official prices, real offer discounts, manager password for overrides """
    from apps.inventory.models import StockItem
    from apps.discounts.models import Offer, Coupon
    from apps.api.serializers import StockItemSerializer
    mgr = _verify_manager(tenant, data.get('manager_password')) if data.get('manager_password') else None
    ser = StockItemSerializer()
    lines = []; price_changed = False
    for it in data.get('items') or []:
        mode = it.get('price_mode') or 'KG'
        qty = float(it.get('quantity_pieces') or 0); kg = float(it.get('weight_kg') or 0); price = float(it.get('unit_price') or 0)
        if it.get('piece_item_id'):
            pc = PieceItem.objects.filter(tenant=tenant, pk=it['piece_item_id']).first()
            if not pc:
                return 'فيه قطعة مش موجودة'
            official = float(pc.price_per_piece if mode == 'PIECE' else pc.price_per_kg)
            lines.append({'mode': mode, 'qty': qty, 'kg': kg, 'price': price, 'code': pc.code, 'bundle': it.get('bundle_label'), 'kind': pc.source_kind, 'segment': pc.segment, 'brand': pc.brand, 'grade': None, 'season': pc.season})
        else:
            si = StockItem.objects.filter(tenant=tenant, pk=it.get('stock_item_id')).select_related('product', 'source_lot__purchase_line_item').first()
            if not si:
                return 'فيه صنف مش موجود'
            official = float(ser.get_selling_price_per_kg(si) or 0)
            li = gv_li = getattr(si.source_lot, 'purchase_line_item', None) if si.source_lot_id else None
            lines.append({'mode': 'KG', 'qty': qty, 'kg': kg, 'price': price, 'code': si.product.code or '', 'bundle': it.get('bundle_label'), 'kind': getattr(li, 'purchase_kind', None) or 'BALE',
                          'segment': getattr(li, 'segment', None), 'brand': getattr(li, 'brand', None), 'grade': si.grade, 'season': None})
        if abs(price - official) > 0.005:
            price_changed = True
    if price_changed and not mgr:
        return 'فيه سعر اتغيّر عن التسعير الرسمي: محتاج باسورد مدير صح'
    subtotal = sum((l['qty'] * l['price'] if l['mode'] == 'PIECE' else l['kg'] * l['price']) for l in lines)
    client_offers = 0.0; server_offers = 0.0
    for ao in data.get('applied_offers') or []:
        o = Offer.objects.filter(tenant=tenant, pk=ao.get('id')).first()
        if not o:
            return 'فيه عرض مش موجود'
        live, why = _offer_is_live(o, str(terminal.default_warehouse_id) if terminal and terminal.default_warehouse_id else None)
        if not live:
            return f'العرض "{o.name}": {why}'
        if o.offer_type == 'COUPON' or o.apply_mode == 'COUPON':
            code = (data.get('coupon_code') or '').strip()
            cp = Coupon.objects.filter(tenant=tenant, offer=o, code=code, is_active=True).first()
            if not cp or (cp.max_uses is not None and cp.used_count >= cp.max_uses):
                return 'الكوبون مش صالح'
        client_offers += float(ao.get('discount') or 0)
        server_offers += _offer_disc_py(o, lines, subtotal)
    if client_offers > server_offers + 0.05:
        return f'خصم العروض مش مظبوط (المسموح {round(server_offers, 2)})'
    manual = float(data.get('discount_amount') or 0) - client_offers
    if manual > 0.05 and not mgr:
        return 'الخصم اليدوي محتاج باسورد مدير صح'
    return None

class HomeViewSet(_rvs.ViewSet):
    permission_classes = [_RIsAuth]

    def _ctx(self, request):
        from apps.api.screen_permissions import allowed_screens
        u = request.user
        admin = u.is_superuser or getattr(u, 'role', None) == 'ADMIN'
        mine = ['*'] if admin else allowed_screens(u)
        return u, admin, (lambda *s: admin or '*' in mine or any(x in mine for x in s))

    def list(self, request):
        from datetime import timedelta
        from django.utils import timezone
        from django.db.models import Sum
        from apps.api import reports_v2 as R
        from apps.sales.models import SaleInvoice, SalePayment, DeferredSale, HomeSetting
        from apps.shifts.models import Shift, CashierCustody
        from apps.returns.models import SalesReturn
        from apps.discounts.models import Offer
        from apps.treasury.models import Expense
        u, admin, has = self._ctx(request)
        t = u.tenant; today = timezone.localdate(); f = lambda x: float(x or 0)
        hs = HomeSetting.objects.filter(tenant=t).first()
        out = {'user': {'name': u.get_full_name() or u.username, 'role': u.role}, 'company': t.name if t else '', 'date': str(today),
               'announcement': hs.announcement if hs else '', 'daily_target': f(hs.daily_target) if hs else 0, 'can_edit': admin or u.role == 'MANAGER'}
        out['today_sales'] = f(SaleInvoice.objects.filter(tenant=t, invoice_date_time__date=today).aggregate(s=Sum('total_amount'))['s'])
        if has('/pos'):
            sh = Shift.objects.filter(tenant=t, cashier=u, status='OPEN').select_related('terminal').first()
            my = SaleInvoice.objects.filter(tenant=t, cashier=u, invoice_date_time__date=today)
            bym = {}
            for pay in SalePayment.objects.filter(sale_invoice__in=my).select_related('payment_method'):
                bym[pay.payment_method.name] = bym.get(pay.payment_method.name, 0) + f(pay.amount)
            shop_q = SaleInvoice.objects.filter(tenant=t, invoice_date_time__date=today)
            if sh:
                shop_q = shop_q.filter(pos_terminal=sh.terminal)
            dq = DeferredSale.objects.filter(tenant=t, status='OPEN', due_date__lte=today).select_related('customer')
            if sh:
                dq = dq.filter(terminal=sh.terminal)
            offers = []
            for o in Offer.objects.filter(tenant=t, is_active=True):
                ok, _ = _offer_is_live(o, str(sh.terminal.default_warehouse_id) if sh and sh.terminal.default_warehouse_id else None)
                if ok and o.apply_mode != 'COUPON':
                    offers.append({'name': o.name, 'auto': o.apply_mode == 'AUTO'})
            out['cashier'] = {
                'shift': {'code': sh.shift_code, 'since': sh.opened_at, 'terminal': sh.terminal.name} if sh else None,
                'my_count': my.count(), 'my_total': f(my.aggregate(s=Sum('total_amount'))['s']),
                'by_method': [{'k': k, 'v': round(val, 2)} for k, val in bym.items()],
                'my_returns': f(SalesReturn.objects.filter(tenant=t, cashier=u, return_date_time__date=today).aggregate(s=Sum('total_refund_amount'))['s']),
                'shop_sales': f(shop_q.aggregate(s=Sum('total_amount'))['s']),
                'deferred': [{'no': d.number, 'cust': d.customer.name, 'phone': d.customer.phone, 'due': str(d.due_date), 'late': d.due_date < today, 'total': f(d.total_amount)} for d in dq[:8]],
                'offers': offers,
                'custody': f(CashierCustody.objects.filter(tenant=t, cashier=u, status='OPEN').aggregate(s=Sum('amount'))['s']),
                'last': [{'no': i.invoice_number, 'at': i.invoice_date_time, 'total': f(i.total_amount)} for i in my.order_by('-invoice_date_time')[:5]],
            }
        if has('/inventory', '/sorting', '/purchasing'):
            pend = R.pending_lots(t, {})['rows']
            out['stock'] = {'pending_count': len(pend), 'pending': pend[:6], 'low': R.low_stock(t, {})['rows'][:8],
                            'transfers_today': R.M('transfers', 'TransferOrder').objects.filter(tenant=t, transfer_date=today).count()}
        if has('/sorting'):
            out['sorting'] = {'recent': R.sorting_results(t, {})['rows'][-5:][::-1]}
        if has('/treasury', '/expenses', '/reports'):
            out['finance'] = {'expenses_today': f(Expense.objects.filter(tenant=t, status='ACTIVE', expense_date=today).aggregate(s=Sum('amount'))['s']),
                              'supplier_dues': round(sum(r['bal'] for r in R.supplier_balances(t, {})['rows'] if r['bal'] > 0), 2),
                              'customer_debts': round(sum(r['bal'] for r in R.customer_debts(t, {})['rows']), 2),
                              'short_shifts': Shift.objects.filter(tenant=t, status='CLOSED', difference__lt=0, closed_at__date__gte=today - timedelta(days=7)).count()}
        if admin or u.role == 'MANAGER':
            series = []
            for i in range(29, -1, -1):
                d = today - timedelta(days=i)
                series.append({'d': str(d)[5:], 'v': f(SaleInvoice.objects.filter(tenant=t, invoice_date_time__date=d).aggregate(s=Sum('total_amount'))['s'])})
            tp = {'date_from': str(today), 'date_to': str(today)}
            out['manager'] = {'cards': R.dashboard(t, {})['cards'], 'series': series, 'methods': R.sales_by_method(t, tp)['rows'], 'top': R.top_items(t, tp)['rows'][:5],
                              'attention': [{'k': 'عهد كاشيرية مفتوحة', 'v': CashierCustody.objects.filter(tenant=t, status='OPEN').count(), 'to': '/treasury'},
                                            {'k': 'أمانات متأخرة', 'v': DeferredSale.objects.filter(tenant=t, status='OPEN', due_date__lt=today).count(), 'to': '/pos'},
                                            {'k': 'ورديات فيها عجز (7 أيام)', 'v': Shift.objects.filter(tenant=t, status='CLOSED', difference__lt=0, closed_at__date__gte=today - timedelta(days=7)).count(), 'to': '/shifts'},
                                            {'k': 'أصناف قربت تخلص', 'v': len(R.low_stock(t, {})['rows']), 'to': '/inventory'}]}
        return Response(out)

    @action(detail=False, methods=['post'], url_path='settings')
    def save_home_settings(self, request):
        from apps.sales.models import HomeSetting
        u, admin, has = self._ctx(request)
        if not (admin or u.role == 'MANAGER'):
            return Response({'detail': 'المدير بس يقدر يغيّر التارجت والرسالة'}, status=403)
        hs, _ = HomeSetting.objects.get_or_create(tenant=u.tenant)
        if 'daily_target' in request.data:
            hs.daily_target = Decimal(str(request.data.get('daily_target') or '0'))
        if 'announcement' in request.data:
            hs.announcement = (request.data.get('announcement') or '').strip()
        hs.updated_by = u
        hs.save()
        return Response({'ok': True})

def _company_info(t):
    from apps.companies.models import Company
    from apps.printing.models import PrintTemplate
    co = Company.objects.filter(tenant=t).first()
    pt = PrintTemplate.objects.filter(tenant=t, template_type='RECEIPT').first()
    w = str(getattr(pt, 'width', '') or '80')
    return {'name': t.name if t else '', 'logo_raw': t.logo_base64 if t else None,
            'phone': getattr(co, 'phone', '') or '', 'address': getattr(co, 'address', '') or '', 'tax_number': getattr(co, 'tax_number', '') or '',
            'registration_number': getattr(co, 'registration_number', '') or '',
            'header_text': getattr(pt, 'header_text', '') or '', 'footer_text': getattr(pt, 'footer_text', '') or '',
            'show_logo': pt.show_logo if pt else True, 'show_address': pt.show_address if pt else True, 'show_phone': pt.show_phone if pt else True,
            'show_tax': pt.show_tax if pt else False, 'width': '58' if w.startswith('58') else '80'}


class CompanyInfoViewSet(_rvs.ViewSet):
    permission_classes = [_RIsAuth]

    def list(self, request):
        return Response(_company_info(request.user.tenant))

    @action(detail=False, methods=['post'], url_path='save')
    def save_info(self, request):
        from apps.companies.models import Company
        from apps.printing.models import PrintTemplate
        u = request.user
        if not (u.is_superuser or getattr(u, 'role', None) == 'ADMIN'):
            return Response({'detail': 'مدير النظام بس يقدر يعدّل بيانات الشركة والإيصال'}, status=403)
        t = u.tenant; d = request.data
        co = Company.objects.filter(tenant=t).first() or Company.objects.create(tenant=t, name=t.name)
        for f in ('phone', 'address', 'tax_number', 'registration_number'):
            if f in d:
                setattr(co, f, (d.get(f) or '').strip())
        co.save()
        pt = PrintTemplate.objects.filter(tenant=t, template_type='RECEIPT').first()
        if not pt:
            pt = PrintTemplate(tenant=t, name='إيصال الكاشير', template_type='RECEIPT', is_default=True)
        for f in ('header_text', 'footer_text'):
            if f in d:
                setattr(pt, f, (d.get(f) or '').strip())
        for f in ('show_logo', 'show_address', 'show_phone', 'show_tax'):
            if f in d:
                setattr(pt, f, bool(d.get(f)))
        if 'width' in d:
            wf = PrintTemplate._meta.get_field('width')
            wv = '58' if str(d.get('width')).startswith('58') else '80'
            pt.width = int(wv) if wf.get_internal_type() in ('IntegerField', 'PositiveIntegerField', 'SmallIntegerField', 'PositiveSmallIntegerField', 'DecimalField') else wv
        pt.save()
        return Response(_company_info(t))


from apps.costing.models import CostingConfiguration, CostingMethod
from .serializers import CostingConfigurationSerializer

class CostingConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = CostingConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return CostingConfiguration.objects.filter(tenant=tenant)
        return CostingConfiguration.objects.all()

    @action(detail=False, methods=['get', 'patch', 'put'], url_path='current')
    def current_config(self, request):
        from apps.tenants.models import Tenant
        tenant = getattr(request.user, 'tenant', None) or Tenant.objects.first()
        config = CostingConfiguration.objects.filter(tenant=tenant, is_active=True).first()
        if not config:
            config = CostingConfiguration.objects.create(
                tenant=tenant,
                name="سياسة التكلفة الافتراضية",
                method=CostingMethod.WEIGHT,
                is_active=True
            )
        if request.method in ['PATCH', 'PUT']:
            serializer = self.get_serializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        serializer = self.get_serializer(config)
        return Response(serializer.data)



class CostingConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = CostingConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return CostingConfiguration.objects.filter(tenant=tenant)
        return CostingConfiguration.objects.all()

    @action(detail=False, methods=['get', 'patch', 'put'], url_path='current')
    def current_config(self, request):
        from apps.tenants.models import Tenant
        tenant = getattr(request.user, 'tenant', None) or Tenant.objects.first()
        config = CostingConfiguration.objects.filter(tenant=tenant, is_active=True).first()
        if not config:
            config = CostingConfiguration.objects.create(
                tenant=tenant,
                name="سياسة التكلفة الافتراضية",
                method=CostingMethod.WEIGHT,
                is_active=True
            )
        if request.method in ['PATCH', 'PUT']:
            serializer = self.get_serializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        serializer = self.get_serializer(config)
        return Response(serializer.data)


class StoreItemViewSet(viewsets.ModelViewSet):
    serializer_class = StoreItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        qs = StoreItem.objects.filter(tenant=tenant) if tenant else StoreItem.objects.all()

        # مزامنة نتايج الفرز أوتوماتيك
        try:
            from apps.sorting.models import SortingOutputLine
            from apps.warehouses.models import Warehouse
            wh = Warehouse.objects.filter(tenant=tenant).first() if tenant else Warehouse.objects.first()
            _rebuild_store_items(tenant); outputs = []
            for out in outputs:
                cat_str = str(out.product.name) if out.product else "صنف فرز"
                grd_str = str(out.get_grade_display()) if hasattr(out, 'get_grade_display') else str(out.grade)
                StoreItem.objects.get_or_create(
                    tenant=out.tenant,
                    category_name=cat_str,
                    sort_grade=grd_str,
                    defaults={
                        'warehouse': out.warehouse or wh,
                        'source_kind': 'بالة',
                        'segment': 'حريمي',
                        'season': 'صيفي',
                        'purchase_grade': 'سوبر كريم',
                        'quantity_pieces': out.quantity_pieces or 0,
                        'weight_kg': out.weight_kg or 0,
                        'total_allocated_cost': out.allocated_cost or 0
                    }
                )
            qs = StoreItem.objects.filter(tenant=tenant) if tenant else StoreItem.objects.all()
        except Exception:
            pass

        branch_id = self.request.query_params.get('branch')
        if branch_id and branch_id != 'ALL':
            qs = qs.filter(
                models.Q(branch_id=branch_id) |
                models.Q(warehouse_id=branch_id) |
                models.Q(warehouse__branch_id=branch_id)
            )

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(category_name__icontains=search) |
                models.Q(brand__icontains=search) |
                models.Q(source_kind__icontains=search) |
                models.Q(segment__icontains=search) |
                models.Q(season__icontains=search) |
                models.Q(purchase_grade__icontains=search) |
                models.Q(sort_grade__icontains=search)
            )
        return qs.order_by('-sorted_at')


class PieceItemViewSet(viewsets.ModelViewSet):
    serializer_class = PieceItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        return PieceItem.objects.filter(tenant=tenant) if tenant else PieceItem.objects.all()

    def perform_create(self, serializer):
        from apps.tenants.models import Tenant
        tenant = getattr(self.request.user, 'tenant', None) or Tenant.objects.first()
        serializer.save(tenant=tenant)

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_piece_price = old_instance.price_per_piece
        old_kg_price = old_instance.price_per_kg
        updated_instance = serializer.save()

        user = self.request.user
        if old_piece_price != updated_instance.price_per_piece:
            PriceChangeLog.objects.create(
                tenant=updated_instance.tenant,
                target='PIECE',
                code=updated_instance.code,
                name=updated_instance.name,
                field='price_per_piece',
                old_price=old_piece_price or Decimal('0.00'),
                new_price=updated_instance.price_per_piece or Decimal('0.00'),
                changed_by=user
            )
        if old_kg_price != updated_instance.price_per_kg:
            PriceChangeLog.objects.create(
                tenant=updated_instance.tenant,
                target='WEIGHT',
                code=updated_instance.code,
                name=updated_instance.name,
                field='price_per_kg',
                old_price=old_kg_price or Decimal('0.00'),
                new_price=updated_instance.price_per_kg or Decimal('0.00'),
                changed_by=user
            )

    @action(detail=False, methods=['post'], url_path='bind-items')
    def bind_items(self, request):
        code_id = request.data.get('code_id')
        item_ids = request.data.get('item_ids', [])
        force_transfer = request.data.get('force_transfer', False)

        piece_item = PieceItem.objects.get(pk=code_id, tenant=request.user.tenant)
        items = StoreItem.objects.filter(id__in=item_ids, tenant=request.user.tenant)

        conflicts = []
        for item in items:
            if item.coding_item and item.coding_item.id != piece_item.id and not force_transfer:
                conflicts.append({'item_id': str(item.id), 'item_name': item.full_name, 'current_code': item.coding_item.code})

        if conflicts and not force_transfer:
            return Response({'status': 'conflict', 'conflicts': conflicts, 'message': 'بعض البنود مربوطة بأكواد أخرى حالياً. هل تريد نقلها؟'}, status=status.HTTP_409_CONFLICT)

        items.update(coding_item=piece_item)
        return Response({'status': 'success', 'message': f'تم ربط {items.count()} بند بالكود [{piece_item.code}] بنجاح!'})


from decimal import Decimal
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.costing.models import CostingConfiguration, CostingMethod
from apps.pricing.models import StoreItem, PieceItem, PriceChangeLog
from .serializers import CostingConfigurationSerializer, StoreItemSerializer, PieceItemSerializer


class CostingConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = CostingConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        if tenant:
            return CostingConfiguration.objects.filter(tenant=tenant)
        return CostingConfiguration.objects.all()

    @action(detail=False, methods=['get', 'patch', 'put'], url_path='current')
    def current_config(self, request):
        from apps.tenants.models import Tenant
        tenant = getattr(request.user, 'tenant', None) or Tenant.objects.first()
        config = CostingConfiguration.objects.filter(tenant=tenant, is_active=True).first()
        if not config:
            config = CostingConfiguration.objects.create(
                tenant=tenant,
                name="سياسة التكلفة الافتراضية",
                method=CostingMethod.WEIGHT,
                is_active=True
            )
        if request.method in ['PATCH', 'PUT']:
            serializer = self.get_serializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        serializer = self.get_serializer(config)
        return Response(serializer.data)


class StoreItemViewSet(viewsets.ModelViewSet):
    serializer_class = StoreItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        qs = StoreItem.objects.filter(tenant=tenant) if tenant else StoreItem.objects.all()

        try:
            from apps.sorting.models import SortingOutputLine
            from apps.warehouses.models import Warehouse
            wh = Warehouse.objects.filter(tenant=tenant).first() if tenant else Warehouse.objects.first()
            _rebuild_store_items(tenant); outputs = []
            for out in outputs:
                cat_str = str(out.product.name) if out.product else "صنف فرز"
                grd_str = str(out.get_grade_display()) if hasattr(out, 'get_grade_display') else str(out.grade)
                StoreItem.objects.get_or_create(
                    tenant=out.tenant,
                    category_name=cat_str,
                    sort_grade=grd_str,
                    defaults={
                        'warehouse': out.warehouse or wh,
                        'source_kind': 'بالة',
                        'segment': 'حريمي',
                        'season': 'صيفي',
                        'purchase_grade': 'سوبر كريم',
                        'quantity_pieces': out.quantity_pieces or 0,
                        'weight_kg': out.weight_kg or 0,
                        'total_allocated_cost': out.allocated_cost or 0
                    }
                )
            qs = StoreItem.objects.filter(tenant=tenant) if tenant else StoreItem.objects.all()
        except Exception:
            pass

        branch_id = self.request.query_params.get('branch')
        if branch_id and branch_id != 'ALL':
            qs = qs.filter(
                models.Q(branch_id=branch_id) |
                models.Q(warehouse_id=branch_id) |
                models.Q(warehouse__branch_id=branch_id)
            )

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(category_name__icontains=search) |
                models.Q(brand__icontains=search) |
                models.Q(source_kind__icontains=search) |
                models.Q(segment__icontains=search) |
                models.Q(season__icontains=search) |
                models.Q(purchase_grade__icontains=search) |
                models.Q(sort_grade__icontains=search)
            )
        return qs.order_by('-sorted_at')


class PieceItemViewSet(viewsets.ModelViewSet):
    serializer_class = PieceItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        return PieceItem.objects.filter(tenant=tenant) if tenant else PieceItem.objects.all()

    def perform_create(self, serializer):
        from apps.tenants.models import Tenant
        tenant = getattr(self.request.user, 'tenant', None) or Tenant.objects.first()
        serializer.save(tenant=tenant)

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_piece_price = old_instance.price_per_piece
        old_kg_price = old_instance.price_per_kg
        updated_instance = serializer.save()

        user = self.request.user
        if old_piece_price != updated_instance.price_per_piece:
            PriceChangeLog.objects.create(
                tenant=updated_instance.tenant,
                target='PIECE',
                code=updated_instance.code,
                name=updated_instance.name,
                field='price_per_piece',
                old_price=old_piece_price or Decimal('0.00'),
                new_price=updated_instance.price_per_piece or Decimal('0.00'),
                changed_by=user
            )
        if old_kg_price != updated_instance.price_per_kg:
            PriceChangeLog.objects.create(
                tenant=updated_instance.tenant,
                target='WEIGHT',
                code=updated_instance.code,
                name=updated_instance.name,
                field='price_per_kg',
                old_price=old_kg_price or Decimal('0.00'),
                new_price=updated_instance.price_per_kg or Decimal('0.00'),
                changed_by=user
            )

    @action(detail=False, methods=['post'], url_path='bind-items')
    def bind_items(self, request):
        code_id = request.data.get('code_id')
        item_ids = request.data.get('item_ids', [])
        force_transfer = request.data.get('force_transfer', False)

        piece_item = PieceItem.objects.get(pk=code_id, tenant=request.user.tenant)
        items = StoreItem.objects.filter(id__in=item_ids, tenant=request.user.tenant)

        conflicts = []
        for item in items:
            if item.coding_item and item.coding_item.id != piece_item.id and not force_transfer:
                conflicts.append({'item_id': str(item.id), 'item_name': item.full_name, 'current_code': item.coding_item.code})

        if conflicts and not force_transfer:
            return Response({'status': 'conflict', 'conflicts': conflicts, 'message': 'بعض البنود مربوطة بأكواد أخرى حالياً. هل تريد نقلها؟'}, status=status.HTTP_409_CONFLICT)

        items.update(coding_item=piece_item)
        return Response({'status': 'success', 'message': f'تم ربط {items.count()} بند بالكود [{piece_item.code}] بنجاح!'})


class BrandViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        from apps.pricing.models import StoreItem, PieceItem
        from apps.purchasing.models import PurchaseLineItem
        
        tenant = getattr(request.user, 'tenant', None)
        brands = set(['زارا', 'ديجافو', 'H&M', 'LC Waikiki', 'شي إن', 'Bershka', 'Mango', 'Pull & Bear', 'Nike', 'Adidas'])

        s_items = StoreItem.objects.filter(tenant=tenant) if tenant else StoreItem.objects.all()
        for s in s_items:
            if s.brand and s.brand != 'بدون براند':
                brands.add(str(s.brand).strip())

        p_items = PieceItem.objects.filter(tenant=tenant) if tenant else PieceItem.objects.all()
        for p in p_items:
            if hasattr(p, 'brand') and p.brand and p.brand != 'بدون براند':
                brands.add(str(p.brand).strip())

        return Response(sorted(list(brands)))



class WeightPriceViewSet(viewsets.ModelViewSet):
    serializer_class = WeightPriceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request.user, 'tenant', None)
        return WeightPrice.objects.filter(tenant=tenant) if tenant else WeightPrice.objects.all()

    def create(self, request, *args, **kwargs):
        from apps.tenants.models import Tenant
        tenant = getattr(request.user, 'tenant', None) or Tenant.objects.first()
        kind = request.data.get('kind', 'بالة') or 'بالة'
        key = request.data.get('key', '') or ''
        grade = request.data.get('grade', '') or ''
        price_per_kg = request.data.get('price_per_kg', 0.0)

        obj, created = WeightPrice.objects.update_or_create(
            tenant=tenant,
            kind=kind,
            key=key,
            grade=grade,
            defaults={'price_per_kg': price_per_kg}
        )
        serializer = self.get_serializer(obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


def _rebuild_store_items(tenant):
    """ STORE_BANDS_V2: bands built from the REAL stock (full identity, per warehouse, real qty/weight/cost) """
    if tenant is None:
        return
    from django.apps import apps as _a
    from django.utils import timezone
    SI = _a.get_model('inventory', 'StockItem'); ST = _a.get_model('pricing', 'StoreItem'); OL = _a.get_model('sorting', 'SortingOutputLine')
    KIND = {'BALE': 'بالة', 'STOCK': 'استوك', 'DIRECT': 'شراء مباشر'}
    GR = {'NEW_COLLECTION': 'عالي', 'MIDDLE': 'وسط', 'CLEARANCE': 'تصفيات'}
    agg = {}
    for si in SI.objects.filter(tenant=tenant).select_related('warehouse', 'source_lot__purchase_line_item', 'product'):
        lot = si.source_lot
        li = getattr(lot, 'purchase_line_item', None) if lot else None
        if not li or li.purchase_kind not in KIND:
            continue
        ol = OL.objects.filter(sorting_order__raw_lot=lot, product=si.product, grade=si.grade).first()
        if li.purchase_kind == 'BALE':
            item, brand = (li.item_name or ''), ''
        else:
            item = (getattr(ol, 'item_name', '') or '') or (li.direct_category or '')
            brand = (getattr(ol, 'brand', '') or '') or (li.brand or '')
        key = (si.warehouse_id, KIND[li.purchase_kind], li.segment or '', li.season or '', li.grade or '', GR.get(si.grade, si.grade or ''), item, brand)
        a = agg.setdefault(key, {'q': 0, 'w': Decimal('0'), 'c': Decimal('0'), 'wh': si.warehouse})
        a['q'] += int(si.total_quantity_pieces or 0)
        a['w'] += Decimal(str(si.total_weight_kg or 0))
        a['c'] += Decimal(str(si.current_total_value or 0))
    seen = set()
    for key, a in agg.items():
        wh_id, kind, seg, sea, pg, sg, item, brand = key
        obj = ST.objects.filter(tenant=tenant, warehouse_id=wh_id, source_kind=kind, segment=seg, season=sea, purchase_grade=pg, sort_grade=sg, category_name=item, brand=brand).first()
        if not obj:
            obj = ST(tenant=tenant, warehouse_id=wh_id, source_kind=kind, segment=seg, season=sea, purchase_grade=pg, sort_grade=sg, category_name=item, brand=brand, sorted_at=timezone.now())
        obj.branch_id = getattr(a['wh'], 'branch_id', None)
        if not obj.coding_item_id:
            _sib = ST.objects.filter(tenant=tenant, source_kind=kind, segment=seg, season=sea, purchase_grade=pg, sort_grade=sg, category_name=item, brand=brand).exclude(coding_item=None).exclude(warehouse_id=wh_id).first()
            if _sib:
                obj.coding_item_id = _sib.coding_item_id
        obj.quantity_pieces = a['q']; obj.weight_kg = a['w']; obj.total_allocated_cost = a['c']
        obj.save()
        seen.add(obj.pk)
    for obj in ST.objects.filter(tenant=tenant).exclude(pk__in=seen):
        if obj.coding_item_id:
            if obj.quantity_pieces or obj.weight_kg:
                obj.quantity_pieces = 0; obj.weight_kg = 0
                obj.save(update_fields=['quantity_pieces', 'weight_kg'])
        else:
            obj.delete()


def _band_stock_for_piece(piece, warehouse):
    """ SELL_FROM_BANDS: stock behind the bands bound to this code in this warehouse, oldest sorting first """
    from datetime import date as _date
    from django.apps import apps as _a
    ST = _a.get_model('pricing', 'StoreItem'); SI = _a.get_model('inventory', 'StockItem'); OL = _a.get_model('sorting', 'SortingOutputLine')
    KIND = {'BALE': 'بالة', 'STOCK': 'استوك', 'DIRECT': 'شراء مباشر'}
    GR = {'NEW_COLLECTION': 'عالي', 'MIDDLE': 'وسط', 'CLEARANCE': 'تصفيات'}
    bands = list(ST.objects.filter(tenant=piece.tenant, coding_item=piece, warehouse=warehouse))
    if not bands:
        return []
    keys = {(b.source_kind or '', b.segment or '', b.season or '', b.purchase_grade or '', b.sort_grade or '', b.category_name or '', b.brand or '') for b in bands}
    found = []
    for si in SI.objects.filter(tenant=piece.tenant, warehouse=warehouse, total_quantity_pieces__gt=0).select_related('source_lot__purchase_line_item'):
        lot = si.source_lot
        li = getattr(lot, 'purchase_line_item', None) if lot else None
        if not li or li.purchase_kind not in KIND:
            continue
        ol = OL.objects.filter(sorting_order__raw_lot=lot, product=si.product, grade=si.grade).select_related('sorting_order').first()
        if li.purchase_kind == 'BALE':
            item, brand = (li.item_name or ''), ''
        else:
            item = (getattr(ol, 'item_name', '') or '') or (li.direct_category or '')
            brand = (getattr(ol, 'brand', '') or '') or (li.brand or '')
        k = (KIND[li.purchase_kind], li.segment or '', li.season or '', li.grade or '', GR.get(si.grade, si.grade or ''), item, brand)
        if k in keys:
            sd = getattr(getattr(ol, 'sorting_order', None), 'sorting_date', None) or _date.min
            found.append((sd, si.created_at, si))
    found.sort(key=lambda x: (x[0], x[1]))
    return [x[2] for x in found]
def _expand_piece_items(tenant, data):
    """ split each code line over the oldest shipments of its bands; None = nothing to change, str = error """
    from django.apps import apps as _a
    from apps.shifts.models import Shift
    sh = Shift.objects.filter(pk=data.get('shift_id')).select_related('terminal__default_warehouse').first()
    wh = getattr(getattr(sh, 'terminal', None), 'default_warehouse', None)
    if not wh:
        return None
    PI = _a.get_model('pricing', 'PieceItem')
    out = []; changed = False
    for it in (data.get('items') or []):
        if not it.get('piece_item_id') or it.get('stock_item_id'):
            out.append(it); continue
        piece = PI.objects.filter(tenant=tenant, pk=it['piece_item_id']).first()
        stocks = _band_stock_for_piece(piece, wh) if piece else []
        need = int(it.get('quantity_pieces') or 0)
        if not stocks or need <= 0:
            out.append(it); continue
        avail = sum(int(s.total_quantity_pieces or 0) for s in stocks)
        if need > avail:
            return f'الكود {piece.code} ({piece.name}): المتاح في المحل {avail} قطعة بس'
        kg = Decimal(str(it.get('weight_kg') or 0)); left_q = need; left_w = kg
        for s in stocks:
            if left_q <= 0:
                break
            take = min(left_q, int(s.total_quantity_pieces or 0))
            w = left_w if take == left_q else (kg * take / need).quantize(Decimal('0.001'))
            out.append({**it, 'stock_item_id': str(s.pk), 'quantity_pieces': take, 'weight_kg': str(w)})
            left_q -= take; left_w -= w
        changed = True
    return out if changed else None


def _stock_identity(si):
    from django.apps import apps as _a
    OL = _a.get_model('sorting', 'SortingOutputLine')
    KIND = {'BALE': 'بالة', 'STOCK': 'استوك', 'DIRECT': 'شراء مباشر'}
    GR = {'NEW_COLLECTION': 'عالي', 'MIDDLE': 'وسط', 'CLEARANCE': 'تصفيات'}
    lot = si.source_lot
    li = getattr(lot, 'purchase_line_item', None) if lot else None
    if not li or li.purchase_kind not in KIND:
        return None
    ol = OL.objects.filter(sorting_order__raw_lot=lot, product=si.product, grade=si.grade).first()
    if li.purchase_kind == 'BALE':
        item, brand = (li.item_name or ''), ''
    else:
        item = (getattr(ol, 'item_name', '') or '') or (li.direct_category or '')
        brand = (getattr(ol, 'brand', '') or '') or (li.brand or '')
    return (KIND[li.purchase_kind], li.segment or '', li.season or '', li.grade or '', GR.get(si.grade, si.grade or ''), item, brand)

from apps.purchasing.models import PurchaseOption
from apps.api.serializers import PurchaseOptionSerializer
class PurchaseOptionViewSet(BaseTenantViewSet):
    model = PurchaseOption
    serializer_class = PurchaseOptionSerializer
    def get_queryset(self):
        qs = super().get_queryset()
        ot = self.request.query_params.get('option_type')
        if ot:
            qs = qs.filter(option_type=ot)
        return qs
