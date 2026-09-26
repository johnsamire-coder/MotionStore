from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class ReturnStatus(models.TextChoices):
    COMPLETED = 'COMPLETED', 'Completed (مكتمل ومسترجع)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغي)'


class SalesReturn(TenantAwareModel):
    return_number = models.CharField(max_length=100, db_index=True, verbose_name="Return #")
    original_sale_invoice = models.ForeignKey(
        'sales.SaleInvoice',
        on_delete=models.PROTECT,
        related_name="returns"
    )
    shift = models.ForeignKey(
        'shifts.Shift',
        on_delete=models.PROTECT,
        related_name="returns"
    )
    cashier = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name="performed_returns"
    )
    return_date_time = models.DateTimeField(verbose_name="Return Date/Time")
    total_refund_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_cogs_reversed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(
        max_length=20,
        choices=ReturnStatus.choices,
        default=ReturnStatus.COMPLETED,
        db_index=True
    )
    reason = models.TextField(blank=True, null=True)

    refund_method = models.ForeignKey('payments.PaymentMethod', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    refund_to_credit = models.BooleanField(default=False)
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_returns')

    class Meta:
        db_table = "sales_returns"
        ordering = ["-return_date_time", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "return_number"],
                name="unique_sales_return_number_per_tenant"
            )
        ]

    def __str__(self):
        return f"Return #{self.return_number} (Ref: {self.original_sale_invoice.invoice_number}) - Refund: {self.total_refund_amount} EGP"


class SalesReturnLineItem(TenantAwareModel):
    sales_return = models.ForeignKey(
        SalesReturn,
        on_delete=models.CASCADE,
        related_name="lines"
    )
    original_sale_line = models.ForeignKey(
        'sales.SaleLineItem',
        on_delete=models.PROTECT,
        related_name="return_lines"
    )
    stock_item = models.ForeignKey(
        'inventory.StockItem',
        on_delete=models.PROTECT,
        related_name="return_lines"
    )
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT)
    grade = models.CharField(max_length=30, choices=GradeChoice.choices)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3, verbose_name="Returned Weight (KG)")
    quantity_pieces = models.IntegerField(default=0, verbose_name="Returned Pieces")
    refund_unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    refund_total_price = models.DecimalField(max_digits=14, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total_cogs_reversed = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "sales_return_line_items"
        ordering = ["created_at"]

    def __str__(self):
        return f"Return Item: {self.product.name} ({self.weight_kg} KG)"
