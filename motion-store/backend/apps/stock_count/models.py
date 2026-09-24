from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class StockCountStatus(models.TextChoices):
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress (قيد الجرد الفعلي)'
    COMPLETED = 'COMPLETED', 'Completed & Audited (مكتمل بانتظار الاعتماد)'
    APPLIED = 'APPLIED', 'Applied to Ledger (تم تطبيق التسوية بالدفاتر)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغي)'


class StockCountSession(TenantAwareModel):
    session_code = models.CharField(max_length=100, db_index=True, verbose_name="Count Session #")
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="stock_counts"
    )
    counted_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name="performed_counts"
    )
    count_date = models.DateField(verbose_name="Count Date")
    status = models.CharField(
        max_length=20,
        choices=StockCountStatus.choices,
        default=StockCountStatus.IN_PROGRESS,
        db_index=True
    )
    total_weight_difference = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('0.000'))
    total_cost_adjustment = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "stock_count_sessions"
        ordering = ["-count_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "session_code"],
                name="unique_stock_count_session_code_per_tenant"
            )
        ]

    def __str__(self):
        return f"Audit Session #{self.session_code} @ {self.warehouse.name} ({self.get_status_display()})"


class StockCountLineItem(TenantAwareModel):
    session = models.ForeignKey(
        StockCountSession,
        on_delete=models.CASCADE,
        related_name="lines"
    )
    stock_item = models.ForeignKey(
        'inventory.StockItem',
        on_delete=models.PROTECT,
        related_name="count_lines"
    )
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT)
    grade = models.CharField(max_length=30, choices=GradeChoice.choices)
    system_weight_kg = models.DecimalField(max_digits=12, decimal_places=3)
    counted_weight_kg = models.DecimalField(max_digits=12, decimal_places=3)
    weight_difference_kg = models.DecimalField(max_digits=12, decimal_places=3, help_text="Counted - System")
    system_quantity_pieces = models.IntegerField(default=0)
    counted_quantity_pieces = models.IntegerField(default=0)
    quantity_difference_pieces = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total_adjustment_cost = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "stock_count_line_items"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.name} [{self.get_grade_display()}]: Diff {self.weight_difference_kg} KG ({self.total_adjustment_cost} EGP)"
