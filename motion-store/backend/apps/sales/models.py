from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class SaleStatus(models.TextChoices):
    COMPLETED = 'COMPLETED', 'Completed (مكتملة)'
    REFUNDED = 'REFUNDED', 'Fully Refunded (مسترجعة بالكامل)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغاة)'


class SaleInvoice(TenantAwareModel):
    invoice_number = models.CharField(max_length=100, db_index=True, verbose_name="Sale Invoice #")
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.PROTECT,
        related_name="sales_invoices"
    )
    pos_terminal = models.ForeignKey(
        'pos.POSTerminal',
        on_delete=models.PROTECT,
        related_name="sales_invoices"
    )
    shift = models.ForeignKey(
        'shifts.Shift',
        on_delete=models.PROTECT,
        related_name="sales_invoices"
    )
    cashier = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name="sales_invoices"
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_invoices"
    )
    invoice_date_time = models.DateTimeField(verbose_name="Invoice Date/Time")
    status = models.CharField(
        max_length=20,
        choices=SaleStatus.choices,
        default=SaleStatus.COMPLETED,
        db_index=True
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'), verbose_name="Delivery Fee (مصاريف التوصيل)")
    previous_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'), verbose_name="Previous Customer Balance (الرصيد السابق للعميل)")
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'), verbose_name="Net Revenue")
    total_cogs = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'), verbose_name="Total COGS")
    gross_profit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'), verbose_name="Gross Profit")
    notes = models.TextField(blank=True, null=True)

    coupon_code = models.CharField(max_length=40, blank=True, null=True)
    applied_offers = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "sales_invoices"
        ordering = ["-invoice_date_time", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "invoice_number"],
                name="unique_sale_invoice_number_per_tenant"
            )
        ]

    def __str__(self):
        return f"Sale #{self.invoice_number} - {self.total_amount} EGP ({self.cashier.username})"


class SaleLineItem(TenantAwareModel):
    sale_invoice = models.ForeignKey(
        SaleInvoice,
        on_delete=models.CASCADE,
        related_name="lines"
    )
    stock_item = models.ForeignKey(
        'inventory.StockItem',
        on_delete=models.PROTECT,
        related_name="sale_lines"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        related_name="sale_lines"
    )
    grade = models.CharField(max_length=30, choices=GradeChoice.choices)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="Sold Weight (KG)")
    quantity_pieces = models.IntegerField(default=0, verbose_name="Sold Pieces")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Selling Price per Unit/KG")
    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_price = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Line Net Revenue")
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Unit Cost (COGS/KG)")
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Line Total COGS")
    gross_profit = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Line Gross Profit")

    display_name = models.CharField(max_length=200, blank=True, null=True)
    piece_item = models.ForeignKey('pricing.PieceItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='sale_lines')
    bundle_label = models.CharField(max_length=50, blank=True, null=True)
    offer_label = models.CharField(max_length=150, blank=True, null=True)

    class Meta:
        db_table = "sale_line_items"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.name} ({self.weight_kg} KG) @ {self.unit_price} -> {self.total_price} EGP"


class SalePayment(TenantAwareModel):
    sale_invoice = models.ForeignKey(
        SaleInvoice,
        on_delete=models.CASCADE,
        related_name="payments"
    )
    payment_method = models.ForeignKey(
        'payments.PaymentMethod',
        on_delete=models.PROTECT,
        related_name="sale_payments"
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    reference_number = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "sale_payments"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.payment_method.name}: {self.amount} EGP"

# ================= Deferred sales (goods taken on approval) =================
from django.conf import settings as _ds
from apps.tenants.models import TenantAwareModel as _DTAM


class DeferredSale(_DTAM):
    number = models.CharField(max_length=40, db_index=True)
    terminal = models.ForeignKey('pos.POSTerminal', on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_sales')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_sales')
    cashier = models.ForeignKey(_ds.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='deferred_sales_made')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='deferred_sales')
    shop_warehouse = models.ForeignKey('warehouses.Warehouse', on_delete=models.PROTECT, related_name='+')
    holding_warehouse = models.ForeignKey('warehouses.Warehouse', on_delete=models.PROTECT, related_name='+')
    lines = models.JSONField(default=list, blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    deposit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    deposit_method = models.ForeignKey('payments.PaymentMethod', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    due_date = models.DateField()
    status = models.CharField(max_length=12, default='OPEN', db_index=True)  # OPEN | SOLD | CANCELLED
    transfer_out_code = models.CharField(max_length=40, blank=True, null=True)
    transfer_back_code = models.CharField(max_length=40, blank=True, null=True)
    sale_invoice = models.ForeignKey('sales.SaleInvoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='from_deferred')
    closed_by = models.ForeignKey(_ds.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "deferred_sales"
        ordering = ["-created_at"]

    def __str__(self):
        return self.number
