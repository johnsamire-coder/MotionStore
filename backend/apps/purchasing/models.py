from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel

class InvoiceStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft (مسودة)'
    CONFIRMED = 'CONFIRMED', 'Confirmed (مؤكدة)'
    RECEIVED = 'RECEIVED', 'Received / Goods In (مستلمة بالمخزن)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغاة)'


class PurchaseItemType(models.TextChoices):
    RAW_BALE = 'RAW_BALE', 'Raw Bale / Lot (بالة خام للفرز)'
    FINISHED_GOODS = 'FINISHED_GOODS', 'Direct Finished Goods (بضاعة جاهزة)'


class PurchaseInvoice(TenantAwareModel):
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name="purchase_invoices"
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="purchase_invoices",
        help_text="Receiving Warehouse / Sorting Area"
    )
    invoice_number = models.CharField(max_length=100, db_index=True, verbose_name="Supplier Invoice #")
    invoice_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT,
        db_index=True
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    additional_costs = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Freight, customs, transport costs to be absorbed"
    )
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "purchase_invoices"
        ordering = ["-invoice_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "supplier", "invoice_number"],
                name="unique_invoice_per_supplier_and_tenant"
            )
        ]

    def __str__(self):
        return f"INV #{self.invoice_number} - {self.supplier.name} ({self.get_status_display()})"

    def recalculate_totals(self):
        """ Recalculates subtotal and total cost based on line items with strict Decimal precision """
        item_total = sum((item.total_cost for item in self.items.all()), Decimal('0.00'))
        self.subtotal = Decimal(str(item_total))
        add_costs = Decimal(str(self.additional_costs or '0.00'))
        self.total_cost = self.subtotal + add_costs
        self.save()


class PurchaseLineItem(TenantAwareModel):
    invoice = models.ForeignKey(
        PurchaseInvoice,
        on_delete=models.CASCADE,
        related_name="items"
    )
    item_type = models.CharField(
        max_length=20,
        choices=PurchaseItemType.choices,
        default=PurchaseItemType.RAW_BALE
    )
    description = models.CharField(max_length=255, verbose_name="Item / Bale Description")
    category = models.ForeignKey(
        'products.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_items",
        help_text="Target category of the bale (e.g. Mixed Summer, Jackets, etc.)"
    )
    weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000'),
        help_text="Total Weight in KG (دقة 3 خانات عشرية)"
    )
    quantity_pieces = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Estimated or counted piece count if applicable"
    )
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = "purchase_line_items"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.description} ({self.weight_kg} KG) - {self.total_cost} EGP"

    def save(self, *args, **kwargs):
        if not self.total_cost and self.unit_cost and self.weight_kg:
            self.total_cost = Decimal(str(self.unit_cost)) * Decimal(str(self.weight_kg))
        super().save(*args, **kwargs)
