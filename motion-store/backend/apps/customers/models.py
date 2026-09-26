from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel

class Customer(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Customer Name")
    code = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    credit_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Outstanding receivable balance (deferred sales)"
    )
    credit_limit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Maximum allowed credit (0 = cash only)"
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "customers"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.phone or 'No phone'})"
