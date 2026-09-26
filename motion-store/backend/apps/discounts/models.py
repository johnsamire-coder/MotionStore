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

# ================= Offers v2 =================
from decimal import Decimal as _D
from django.db import models as _m
from apps.tenants.models import TenantAwareModel as _TAM

OFFER_TYPES = ['QTY', 'BXGY', 'WKG', 'TIERS', 'ANYPIECE', 'ITEMPRICE', 'KGDAY', 'SCALEFIX', 'BAG', 'COMBO', 'TARGET', 'AGING', 'INVOICE', 'GIFT', 'COUPON']
OFFER_DAYS = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI']


class Offer(_TAM):
    name = _m.CharField(max_length=150)
    offer_type = _m.CharField(max_length=20)
    params = _m.JSONField(default=dict, blank=True)
    targets = _m.JSONField(default=dict, blank=True)
    date_from = _m.DateField(null=True, blank=True)
    date_to = _m.DateField(null=True, blank=True)
    time_from = _m.TimeField(null=True, blank=True)
    time_to = _m.TimeField(null=True, blank=True)
    days = _m.JSONField(default=list, blank=True)
    shops = _m.JSONField(default=list, blank=True)
    apply_mode = _m.CharField(max_length=10, default='CASHIER')  # AUTO | CASHIER | COUPON
    stackable = _m.BooleanField(default=False)
    max_discount = _m.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    required_role = _m.CharField(max_length=20, default='ANY')  # ANY | MANAGER
    coupon_mode = _m.CharField(max_length=10, blank=True, default='')  # SHARED | UNIQUE
    coupon_max_uses = _m.PositiveIntegerField(null=True, blank=True)
    is_active = _m.BooleanField(default=True)
    usage_count = _m.PositiveIntegerField(default=0)
    total_sales = _m.DecimalField(max_digits=14, decimal_places=2, default=_D('0.00'))
    total_discount = _m.DecimalField(max_digits=14, decimal_places=2, default=_D('0.00'))

    class Meta:
        db_table = "offers_v2"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.offer_type})"

from django.conf import settings as _s


class Coupon(_TAM):
    offer = _m.ForeignKey(Offer, on_delete=_m.CASCADE, related_name='coupons')
    code = _m.CharField(max_length=40)
    max_uses = _m.PositiveIntegerField(null=True, blank=True)
    used_count = _m.PositiveIntegerField(default=0)
    is_active = _m.BooleanField(default=True)

    class Meta:
        db_table = "offer_coupons"
        constraints = [_m.UniqueConstraint(fields=["tenant", "code"], name="unique_coupon_code_per_tenant")]

    def __str__(self):
        return self.code


class CouponUse(_TAM):
    coupon = _m.ForeignKey(Coupon, on_delete=_m.CASCADE, related_name='uses')
    invoice_number = _m.CharField(max_length=100, blank=True, null=True)
    used_by = _m.ForeignKey(_s.AUTH_USER_MODEL, on_delete=_m.SET_NULL, null=True, blank=True, related_name='coupon_uses')
    discount_amount = _m.DecimalField(max_digits=12, decimal_places=2, default=_D('0.00'))

    class Meta:
        db_table = "offer_coupon_uses"
        ordering = ["-created_at"]
