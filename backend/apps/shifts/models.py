from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel

class ShiftStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open / Active (مفتوحة)'
    CLOSED = 'CLOSED', 'Closed (مغلقة ومطابقة)'
    REVIEW = 'REVIEW', 'Closed with Discrepancy / Under Review (مغلقة بفرق عجز/زيادة)'


class Shift(TenantAwareModel):
    shift_code = models.CharField(max_length=100, db_index=True, verbose_name="Shift #")
    terminal = models.ForeignKey(
        'pos.POSTerminal',
        on_delete=models.PROTECT,
        related_name="shifts"
    )
    cashier = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name="shifts",
        verbose_name="Cashier"
    )
    opened_at = models.DateTimeField(verbose_name="Opened At")
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="Closed At")
    status = models.CharField(
        max_length=20,
        choices=ShiftStatus.choices,
        default=ShiftStatus.OPEN,
        db_index=True
    )
    opening_cash = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Opening Float (رصيد الافتتاح)"
    )
    cash_sales_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Total Cash Collected from Sales"
    )
    expected_cash = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Expected Cash in Drawer"
    )
    actual_cash = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Actual Cash Counted by Cashier"
    )
    difference = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Actual - Expected (Negative = Shortage, Positive = Surplus)"
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "shifts"
        ordering = ["-opened_at"]

    def __str__(self):
        return f"Shift #{self.shift_code} - {self.cashier.username} @ {self.terminal.code} ({self.get_status_display()})"
