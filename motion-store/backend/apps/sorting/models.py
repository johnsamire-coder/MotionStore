from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class SortingStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft / Sorting In Progress (مسودة / قيد الفرز)'
    COMPLETED = 'COMPLETED', 'Completed & Reconciled (مكتمل ومعتمد)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغي)'


class ReconciliationStatus(models.TextChoices):
    BALANCED = 'BALANCED', 'Balanced (متطابق بالوزن)'
    UNBALANCED = 'UNBALANCED', 'Unbalanced (غير متطابق)'


class WasteClassification(models.TextChoices):
    NORMAL = 'NORMAL', 'Normal / Expected Waste (هالك طبيعي متوقع)'
    ABNORMAL = 'ABNORMAL', 'Abnormal / Exceptional Waste (هالك غير طبيعي / استثنائي)'


class SortingOrder(TenantAwareModel):
    order_code = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Sorting Order Code"
    )
    raw_lot = models.ForeignKey(
        'raw_lots.RawLot',
        on_delete=models.PROTECT,
        related_name="sorting_orders",
        verbose_name="Source Raw Bale / Lot"
    )
    sorter = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="performed_sortings",
        verbose_name="Sorter / Responsible User"
    )
    sorting_date = models.DateField(verbose_name="Sorting Date")
    status = models.CharField(
        max_length=20,
        choices=SortingStatus.choices,
        default=SortingStatus.DRAFT,
        db_index=True
    )
    reconciliation_status = models.CharField(
        max_length=20,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.UNBALANCED,
        db_index=True
    )
    total_good_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name="Total Good Output Weight (KG)"
    )
    total_waste_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name="Total Waste Weight (KG)"
    )
    adjustment_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000'),
        help_text="Approved adjustment difference (if any)"
    )
    adjustment_reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "sorting_orders"
        ordering = ["-sorting_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "order_code"],
                name="unique_sorting_order_code_per_tenant"
            )
        ]

    def __str__(self):
        return f"SORT #{self.order_code} - Lot: {self.raw_lot.lot_code} ({self.get_reconciliation_status_display()})"

    def reconcile(self) -> bool:
        """
        Core Reconciliation Engine:
        Received Weight == Good Outputs Weight + Waste Weight + Adjustments
        """
        good_wt = sum(line.weight_kg for line in self.output_lines.all())
        waste_wt = sum(line.weight_kg for line in self.waste_lines.all())
        
        self.total_good_weight_kg = good_wt
        self.total_waste_weight_kg = waste_wt
        
        calculated_total = good_wt + waste_wt + self.adjustment_weight_kg
        expected_weight = self.raw_lot.original_weight_kg

        # Precise comparison with 3 decimal places tolerance
        is_balanced = abs(calculated_total - expected_weight) <= Decimal('0.001')
        self.reconciliation_status = ReconciliationStatus.BALANCED if is_balanced else ReconciliationStatus.UNBALANCED
        self.save()
        return is_balanced


class SortingOutputLine(TenantAwareModel):
    sorting_order = models.ForeignKey(
        SortingOrder,
        on_delete=models.CASCADE,
        related_name="output_lines"
    )
    grade = models.CharField(
        max_length=30,
        choices=GradeChoice.choices,
        verbose_name="Output Grade"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sorting_outputs",
        verbose_name="Target Catalog Product"
    )
    weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        verbose_name="Weight (KG)"
    )
    quantity_pieces = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Quantity (Pieces)"
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="sorting_outputs",
        verbose_name="Destination Warehouse"
    )
    allocated_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Allocated Cost Total"
    )
    cost_per_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Calculated Cost per KG"
    )

    class Meta:
        db_table = "sorting_output_lines"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.get_grade_display()} - {self.weight_kg} KG ({self.sorting_order.order_code})"


class SortingWasteLine(TenantAwareModel):
    sorting_order = models.ForeignKey(
        SortingOrder,
        on_delete=models.CASCADE,
        related_name="waste_lines"
    )
    weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        verbose_name="Waste Weight (KG)"
    )
    quantity_pieces = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Waste Quantity (Pieces)"
    )
    classification = models.CharField(
        max_length=20,
        choices=WasteClassification.choices,
        default=WasteClassification.NORMAL,
        verbose_name="Waste Classification"
    )
    reason = models.TextField(blank=True, null=True, verbose_name="Waste Reason / Defect Notes")
    allocated_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Allocated Waste Cost"
    )

    class Meta:
        db_table = "sorting_waste_lines"
        ordering = ["created_at"]

    def __str__(self):
        return f"Waste ({self.get_classification_display()}) - {self.weight_kg} KG"
