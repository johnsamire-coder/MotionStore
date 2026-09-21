from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.sorting.models import WasteClassification

class WasteDisposalStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending in Waste Storage (في مخزن الهالك / معلق)'
    DISPOSED = 'DISPOSED', 'Disposed / Destroyed (تم الإعدام / التخلص)'
    SOLD_AS_SCRAP = 'SOLD_AS_SCRAP', 'Sold as Scrap / Rags (تم البيع كخردة / أقمشة)'


class WasteRecord(TenantAwareModel):
    sorting_order = models.ForeignKey(
        'sorting.SortingOrder',
        on_delete=models.PROTECT,
        related_name="waste_records"
    )
    raw_lot = models.ForeignKey(
        'raw_lots.RawLot',
        on_delete=models.PROTECT,
        related_name="waste_records"
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="waste_records"
    )
    weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        verbose_name="Waste Weight (KG)"
    )
    quantity_pieces = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Waste Pieces (if counted)"
    )
    classification = models.CharField(
        max_length=20,
        choices=WasteClassification.choices,
        default=WasteClassification.NORMAL
    )
    reason = models.TextField(blank=True, null=True)
    allocated_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Financial cost recognized for this waste"
    )
    disposal_status = models.CharField(
        max_length=30,
        choices=WasteDisposalStatus.choices,
        default=WasteDisposalStatus.PENDING,
        db_index=True
    )
    disposal_revenue = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Revenue if sold as scrap/rags"
    )
    disposal_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "waste_records"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Waste from Lot #{self.raw_lot.lot_code}: {self.weight_kg} KG [{self.get_classification_display()}]"
