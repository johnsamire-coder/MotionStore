from django.db import models
from apps.tenants.models import TenantAwareModel

class RawLotStatus(models.TextChoices):
    RECEIVED = 'RECEIVED', 'Received / In Storage (مستلمة بالمخزن الخام)'
    SORTING_IN_PROGRESS = 'SORTING_IN_PROGRESS', 'Sorting In Progress (قيد الفرز)'
    SORTED = 'SORTED', 'Fully Sorted (تم الفرز والتوزيع بالكامل)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغاة)'


class RawLot(TenantAwareModel):
    lot_code = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Bale / Raw Lot ID"
    )
    purchase_invoice = models.ForeignKey(
        'purchasing.PurchaseInvoice',
        on_delete=models.PROTECT,
        related_name="raw_lots",
        verbose_name="Source Purchase Invoice"
    )
    purchase_line_item = models.ForeignKey(
        'purchasing.PurchaseLineItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="raw_lots",
        verbose_name="Source Invoice Line"
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.PROTECT,
        related_name="raw_lots",
        verbose_name="Supplier"
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="raw_lots",
        verbose_name="Current Storage Warehouse"
    )
    category = models.ForeignKey(
        'products.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="raw_lots",
        verbose_name="Bale Category / Type"
    )
    original_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        verbose_name="Original Received Weight (KG)"
    )
    original_quantity_pieces = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Original Estimated / Counted Pieces"
    )
    purchase_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name="Total Actual Purchase Cost"
    )
    status = models.CharField(
        max_length=30,
        choices=RawLotStatus.choices,
        default=RawLotStatus.RECEIVED,
        db_index=True,
        verbose_name="Status"
    )
    received_date = models.DateField(verbose_name="Receiving Date")
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "raw_lots"
        ordering = ["-received_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "lot_code"],
                name="unique_raw_lot_code_per_tenant"
            )
        ]

    def __str__(self):
        return f"LOT #{self.lot_code} - {self.original_weight_kg} KG ({self.get_status_display()})"
