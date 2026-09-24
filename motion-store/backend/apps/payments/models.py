from django.db import models
from apps.tenants.models import TenantAwareModel

class PaymentMethodType(models.TextChoices):
    CASH = 'CASH', 'Cash (نقدي)'
    ELECTRONIC = 'ELECTRONIC', 'Electronic / Card / Wallet (فيزا / محفظة إلكترونية)'
    CREDIT = 'CREDIT', 'Credit / Deferred (آجل على العميل)'


class PaymentMethod(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Payment Method Name")
    method_type = models.CharField(
        max_length=20,
        choices=PaymentMethodType.choices,
        default=PaymentMethodType.CASH
    )
    treasury = models.ForeignKey(
        'treasury.Treasury',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_methods",
        help_text="Target treasury that receives funds from this method"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "payment_methods"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_method_type_display()})"
