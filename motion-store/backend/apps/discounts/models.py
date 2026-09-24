from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.users.models import User

class DiscountType(models.TextChoices):
    PERCENTAGE = 'PERCENTAGE', 'Percentage Discount (نسبة مئوية %)'
    FIXED_AMOUNT = 'FIXED_AMOUNT', 'Fixed Amount Discount (مبلغ ثابت ج.م)'


class DiscountRule(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Discount Name")
    code = models.CharField(max_length=50, blank=True, null=True, verbose_name="Promo Code")
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE
    )
    value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Discount percentage value (e.g. 10.00 for 10%) or fixed EGP amount"
    )
    max_discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum allowed discount cap in EGP"
    )
    minimum_order_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Minimum invoice subtotal required to apply discount"
    )
    required_role = models.CharField(
        max_length=30,
        choices=User.ROLE_CHOICES,
        default='CASHIER',
        help_text="Minimum authority role required to apply this discount"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "discount_rules"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.value} {'%' if self.discount_type == DiscountType.PERCENTAGE else 'EGP'})"
