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
    product_code = serializers.ReadOnlyField(source='product.code')
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
    branch_name = serializers.ReadOnlyField(source='branch.name')
    warehouse_name = serializers.ReadOnlyField(source='default_warehouse.name')
    cash_drawer_name = serializers.ReadOnlyField(source='cash_drawer.name')
    class Meta:
        model = POSTerminal
        fields = ['id', 'tenant', 'created_at', 'updated_at', 'name', 'code', 'branch', 'branch_name', 'default_warehouse', 'warehouse_name', 'cash_drawer', 'cash_drawer_name', 'is_active']
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at', 'branch_name', 'warehouse_name', 'cash_drawer_name']

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
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    customer_code = serializers.ReadOnlyField(source='customer.code')
    terminal_code = serializers.ReadOnlyField(source='pos_terminal.code')
    terminal_name = serializers.ReadOnlyField(source='pos_terminal.name')
    payments_info = serializers.SerializerMethodField()

    def get_payments_info(self, obj):
        from apps.sales.models import SalePayment
        return [{'method': p.payment_method.name, 'type': p.payment_method.method_type, 'amount': str(p.amount)} for p in SalePayment.objects.filter(sale_invoice=obj).select_related('payment_method')]
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
    display_name = serializers.ReadOnlyField(source='original_sale_line.display_name')
    product_name = serializers.ReadOnlyField(source='product.name')
    class Meta:
        model = SalesReturnLineItem
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class SalesReturnSerializer(serializers.ModelSerializer):
    lines = SalesReturnLineItemSerializer(many=True, read_only=True)
    cashier_username = serializers.ReadOnlyField(source='cashier.username')
    original_invoice_number = serializers.ReadOnlyField(source='original_sale_invoice.invoice_number')
    customer_name = serializers.ReadOnlyField(source='original_sale_invoice.customer.name')
    customer_phone = serializers.ReadOnlyField(source='original_sale_invoice.customer.phone')
    customer_code = serializers.ReadOnlyField(source='original_sale_invoice.customer.code')
    refund_method_name = serializers.ReadOnlyField(source='refund_method.name')
    terminal_code = serializers.ReadOnlyField(source='shift.terminal.code')
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
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)
    pos_terminal_name = serializers.ReadOnlyField(source='pos_terminal.name')
    has_pin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'phone', 'email', 'role', 'role_display', 'tenant', 'tenant_name', 'assigned_branches', 'pos_terminal', 'pos_terminal_name',
                  'is_active', 'password', 'pin', 'has_pin', 'last_login', 'date_joined']
        read_only_fields = ['id', 'tenant', 'date_joined', 'last_login']

    def get_has_pin(self, obj):
        return bool(obj.pin_hash)

    def validate_pin(self, value):
        v = str(value or '').strip()
        if v and v != 'CLEAR' and not (v.isdigit() and 4 <= len(v) <= 6):
            raise serializers.ValidationError('الرقم السري لازم يبقى من 4 لـ 6 أرقام')
        return v

    def _apply_pin(self, inst, pin):
        from django.contrib.auth.hashers import make_password
        if not pin:
            return
        inst.pin_hash = '' if pin == 'CLEAR' else make_password(pin)
        inst.save(update_fields=['pin_hash'])

    def create(self, validated_data):
        pin = validated_data.pop('pin', '')
        inst = super().create(validated_data)
        self._apply_pin(inst, pin)
        return inst

    def update(self, instance, validated_data):
        pin = validated_data.pop('pin', '')
        inst = super().update(instance, validated_data)
        self._apply_pin(inst, pin)
        return inst

class TreasurySerializer(serializers.ModelSerializer):
    branch_name = serializers.ReadOnlyField(source='branch.name')
    class Meta:
        model = Treasury
        fields = ['id', 'tenant', 'created_at', 'updated_at', 'name', 'treasury_type', 'branch', 'branch_name', 'current_balance', 'is_active']
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at', 'branch_name', 'current_balance']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class PaymentMethodSerializer(serializers.ModelSerializer):
    treasury_name = serializers.ReadOnlyField(source='treasury.name')
    class Meta:
        model = PaymentMethod
        fields = ['id', 'tenant', 'created_at', 'updated_at', 'name', 'method_type', 'treasury', 'treasury_name', 'is_active']
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at', 'treasury_name']

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
        read_only_fields = ['tenant']
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class PriceChangeLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.ReadOnlyField(source='changed_by.username')
    class Meta:
        model = PriceChangeLog
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

from apps.discounts.models import Offer, OFFER_TYPES, OFFER_DAYS

class OfferSerializer(serializers.ModelSerializer):
    coupons_total = serializers.SerializerMethodField()
    coupons_used = serializers.SerializerMethodField()
    offer_piece_code = serializers.SerializerMethodField()

    def get_coupons_total(self, o):
        return o.coupons.count()

    def get_coupons_used(self, o):
        return sum(c.used_count for c in o.coupons.all())

    def get_offer_piece_code(self, o):
        p = o.offer_pieces.first()
        return p.code if p else None

    class Meta:
        model = Offer
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at', 'usage_count', 'total_sales', 'total_discount']

    def validate(self, attrs):
        t = attrs.get('offer_type', getattr(self.instance, 'offer_type', None))
        if t not in OFFER_TYPES:
            raise serializers.ValidationError({'detail': 'نوع العرض غلط'})
        if not (attrs.get('name', getattr(self.instance, 'name', '')) or '').strip():
            raise serializers.ValidationError({'detail': 'اكتب اسم العرض'})
        mode = attrs.get('apply_mode', getattr(self.instance, 'apply_mode', 'CASHIER'))
        if mode not in ('AUTO', 'CASHIER', 'COUPON'):
            raise serializers.ValidationError({'detail': 'طريقة التطبيق غلط'})
        days = attrs.get('days', getattr(self.instance, 'days', []) or [])
        if any(d not in OFFER_DAYS for d in days):
            raise serializers.ValidationError({'detail': 'الأيام غلط'})
        params = attrs.get('params', getattr(self.instance, 'params', {}) or {}) or {}
        coupon = (params.get('coupon') or '').strip() if isinstance(params, dict) else ''
        if t == 'COUPON' or mode == 'COUPON':
            cmode = attrs.get('coupon_mode', getattr(self.instance, 'coupon_mode', '')) or 'SHARED'
            if cmode not in ('SHARED', 'UNIQUE'):
                raise serializers.ValidationError({'detail': 'نوع الكوبون غلط'})
            if cmode == 'SHARED':
                if not coupon:
                    raise serializers.ValidationError({'detail': 'اكتب كود الكوبون أو دوس توليد'})
                from apps.discounts.models import Coupon
                request = self.context.get('request')
                tenant = getattr(request, 'tenant', None) if request is not None else None
                q1 = Offer.objects.filter(params__coupon=coupon)
                q2 = Coupon.objects.filter(code=coupon)
                if self.instance:
                    q1 = q1.exclude(pk=self.instance.pk)
                    q2 = q2.exclude(offer=self.instance)
                if tenant:
                    q1 = q1.filter(tenant=tenant)
                    q2 = q2.filter(tenant=tenant)
                if q1.exists() or q2.exists():
                    raise serializers.ValidationError({'detail': f'الكوبون {coupon} مستعمل قبل كده'})
        if t in ('ANYPIECE', 'ITEMPRICE'):
            if not str(params.get('piece_name') or '').strip():
                raise serializers.ValidationError({'detail': 'اكتب اسم القطعة'})
            if not str(params.get('price') or '').strip():
                raise serializers.ValidationError({'detail': 'اكتب سعر العرض'})
        return attrs

from apps.sales.models import DeferredSale

class DeferredSaleSerializer(serializers.ModelSerializer):
    customer_name = serializers.ReadOnlyField(source='customer.name')
    customer_phone = serializers.ReadOnlyField(source='customer.phone')
    customer_code = serializers.ReadOnlyField(source='customer.code')
    cashier_name = serializers.ReadOnlyField(source='cashier.username')
    closed_by_name = serializers.ReadOnlyField(source='closed_by.username')
    deposit_method_name = serializers.ReadOnlyField(source='deposit_method.name')
    terminal_code = serializers.ReadOnlyField(source='terminal.code')
    sale_invoice_number = serializers.ReadOnlyField(source='sale_invoice.invoice_number')
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = DeferredSale
        fields = '__all__'

    def get_is_overdue(self, o):
        from django.utils import timezone
        return o.status == 'OPEN' and o.due_date < timezone.localdate()

from apps.treasury.models import Expense, ExpenseCategory

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']

class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    treasury_name = serializers.ReadOnlyField(source='treasury.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.username')
    approved_by_name = serializers.ReadOnlyField(source='approved_by.username')
    cancelled_by_name = serializers.ReadOnlyField(source='cancelled_by.username')
    shift_code = serializers.ReadOnlyField(source='shift.shift_code')
    class Meta:
        model = Expense
        fields = '__all__'


from apps.costing.models import CostingConfiguration, CostingMethod

class CostingConfigurationSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = CostingConfiguration
        fields = [
            'id', 'name', 'method', 'method_display', 'waste_treatment',
            'high_grade_pct', 'mid_grade_pct', 'liquidation_grade_pct', 'waste_grade_pct',
            'normal_waste_percentage', 'is_active'
        ]

    def validate(self, data):
        from decimal import Decimal
        method = data.get('method', getattr(self.instance, 'method', None))
        if method == CostingMethod.PERCENTAGE:
            high = data.get('high_grade_pct', getattr(self.instance, 'high_grade_pct', 0)) or 0
            mid = data.get('mid_grade_pct', getattr(self.instance, 'mid_grade_pct', 0)) or 0
            liq = data.get('liquidation_grade_pct', getattr(self.instance, 'liquidation_grade_pct', 0)) or 0
            waste = data.get('waste_grade_pct', getattr(self.instance, 'waste_grade_pct', 0)) or 0
            total = Decimal(str(high)) + Decimal(str(mid)) + Decimal(str(liq)) + Decimal(str(waste))
            if total != Decimal('100.00'):
                raise serializers.ValidationError({'non_field_errors': [f'مجموع نسب الدرجات يجب أن يساوي 100% تماماً (المجموع الحالي: {total}%)']})
        return data


from apps.costing.models import CostingConfiguration, CostingMethod
from apps.pricing.models import StoreItem, PieceItem, PriceChangeLog

class CostingConfigurationSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = CostingConfiguration
        fields = [
            'id', 'name', 'method', 'method_display', 'waste_treatment',
            'high_grade_pct', 'mid_grade_pct', 'liquidation_grade_pct', 'waste_grade_pct',
            'normal_waste_percentage', 'is_active'
        ]

    def validate(self, data):
        from decimal import Decimal
        method = data.get('method', getattr(self.instance, 'method', None))
        if method == CostingMethod.PERCENTAGE:
            high = data.get('high_grade_pct', getattr(self.instance, 'high_grade_pct', 0)) or 0
            mid = data.get('mid_grade_pct', getattr(self.instance, 'mid_grade_pct', 0)) or 0
            liq = data.get('liquidation_grade_pct', getattr(self.instance, 'liquidation_grade_pct', 0)) or 0
            waste = data.get('waste_grade_pct', getattr(self.instance, 'waste_grade_pct', 0)) or 0
            total = Decimal(str(high)) + Decimal(str(mid)) + Decimal(str(liq)) + Decimal(str(waste))
            if total != Decimal('100.00'):
                raise serializers.ValidationError({'non_field_errors': [f'مجموع نسب الدرجات يجب أن يساوي 100% تماماً (المجموع الحالي: {total}%)']})
        return data


class StoreItemSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    coding_code = serializers.CharField(source='coding_item.code', read_only=True, allow_null=True)

    class Meta:
        model = StoreItem
        fields = '__all__'
        read_only_fields = ['tenant']


class PieceItemSerializer(serializers.ModelSerializer):
    linked_items_count = serializers.IntegerField(source='linked_store_items.count', read_only=True)
    total_available_pieces = serializers.SerializerMethodField()
    total_available_weight_kg = serializers.SerializerMethodField()

    source_kind = serializers.CharField(required=False, default="بالة", allow_blank=True, allow_null=True)
    segment = serializers.CharField(required=False, default="حريمي", allow_blank=True, allow_null=True)
    season = serializers.CharField(required=False, default="صيفي", allow_blank=True, allow_null=True)
    purchase_grade = serializers.CharField(required=False, default="سوبر كريم", allow_blank=True, allow_null=True)
    brand = serializers.CharField(required=False, default="بدون براند", allow_blank=True, allow_null=True)
    price_per_piece = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)
    price_per_kg = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)

    class Meta:
        model = PieceItem
        fields = '__all__'
        read_only_fields = ['tenant']

    def get_total_available_pieces(self, obj):
        return sum((item.quantity_pieces or 0) for item in obj.linked_store_items.all())

    def get_total_available_weight_kg(self, obj):
        return float(sum((item.weight_kg or 0) for item in obj.linked_store_items.all()))

    def validate_code(self, value):
        request = self.context.get('request')
        tenant = getattr(request.user, 'tenant', None) if request else None
        qs = PieceItem.objects.filter(code=value)
        if tenant:
            qs = qs.filter(tenant=tenant)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"❌ الكود [{value}] مستخدم بالفعل في الشركة! كود البيع يجب أن يكون فريداً.")
        return value


from apps.costing.models import CostingConfiguration, CostingMethod
from apps.pricing.models import StoreItem, PieceItem, PriceChangeLog

class CostingConfigurationSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = CostingConfiguration
        fields = [
            'id', 'name', 'method', 'method_display', 'waste_treatment',
            'high_grade_pct', 'mid_grade_pct', 'liquidation_grade_pct', 'waste_grade_pct',
            'normal_waste_percentage', 'is_active'
        ]

    def validate(self, data):
        from decimal import Decimal
        method = data.get('method', getattr(self.instance, 'method', None))
        if method == CostingMethod.PERCENTAGE:
            high = data.get('high_grade_pct', getattr(self.instance, 'high_grade_pct', 0)) or 0
            mid = data.get('mid_grade_pct', getattr(self.instance, 'mid_grade_pct', 0)) or 0
            liq = data.get('liquidation_grade_pct', getattr(self.instance, 'liquidation_grade_pct', 0)) or 0
            waste = data.get('waste_grade_pct', getattr(self.instance, 'waste_grade_pct', 0)) or 0
            total = Decimal(str(high)) + Decimal(str(mid)) + Decimal(str(liq)) + Decimal(str(waste))
            if total != Decimal('100.00'):
                raise serializers.ValidationError({'non_field_errors': [f'مجموع نسب الدرجات يجب أن يساوي 100% تماماً (المجموع الحالي: {total}%)']})
        return data


class StoreItemSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    coding_code = serializers.CharField(source='coding_item.code', read_only=True, allow_null=True)

    class Meta:
        model = StoreItem
        fields = '__all__'
        read_only_fields = ['tenant']


class PieceItemSerializer(serializers.ModelSerializer):
    linked_items_count = serializers.IntegerField(source='linked_store_items.count', read_only=True)
    total_available_pieces = serializers.SerializerMethodField()
    total_available_weight_kg = serializers.SerializerMethodField()

    source_kind = serializers.CharField(required=False, default="بالة", allow_blank=True, allow_null=True)
    segment = serializers.CharField(required=False, default="حريمي", allow_blank=True, allow_null=True)
    season = serializers.CharField(required=False, default="صيفي", allow_blank=True, allow_null=True)
    purchase_grade = serializers.CharField(required=False, default="سوبر كريم", allow_blank=True, allow_null=True)
    brand = serializers.CharField(required=False, default="بدون براند", allow_blank=True, allow_null=True)
    price_per_piece = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)
    price_per_kg = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)

    class Meta:
        model = PieceItem
        fields = '__all__'
        read_only_fields = ['tenant']

    def get_total_available_pieces(self, obj):
        return sum((item.quantity_pieces or 0) for item in obj.linked_store_items.all())

    def get_total_available_weight_kg(self, obj):
        return float(sum((item.weight_kg or 0) for item in obj.linked_store_items.all()))

    def validate_code(self, value):
        request = self.context.get('request')
        tenant = getattr(request.user, 'tenant', None) if request else None
        qs = PieceItem.objects.filter(code=value)
        if tenant:
            qs = qs.filter(tenant=tenant)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"❌ الكود [{value}] مستخدم بالفعل في الشركة! كود البيع يجب أن يكون فريداً.")
        return value
