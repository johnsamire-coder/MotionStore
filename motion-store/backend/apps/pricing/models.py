from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class PriceList(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Price List Name")
    code = models.CharField(max_length=50, blank=True, null=True, verbose_name="Price List Code")
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="price_lists"
    )
    is_default = models.BooleanField(default=False, verbose_name="Is Global Default")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "price_lists"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} {'(Default)' if self.is_default else ''}"


class PriceListItem(TenantAwareModel):
    price_list = models.ForeignKey(
        PriceList,
        on_delete=models.CASCADE,
        related_name="items"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="price_list_items"
    )
    grade = models.CharField(
        max_length=30,
        choices=GradeChoice.choices,
        default=GradeChoice.NEW_COLLECTION,
        db_index=True
    )
    price_per_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Selling Price per KG"
    )
    price_per_piece = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Selling Price per Piece (Optional)"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "price_list_items"

    def __str__(self):
        prod_name = self.product.name if self.product else "عام (وزن)"
        return f"{prod_name} [{self.get_grade_display()}] -> {self.price_per_kg} EGP/KG"


class PriceHistory(TenantAwareModel):
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="price_history"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="price_history"
    )
    grade = models.CharField(
        max_length=30,
        choices=GradeChoice.choices,
        default=GradeChoice.NEW_COLLECTION
    )
    pricing_type = models.CharField(
        max_length=20,
        choices=[('KG', 'بالوزن / كجم'), ('PIECE', 'بالقطعة')],
        default='KG'
    )
    old_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    new_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    changed_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="price_changes"
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "price_history"
        ordering = ["-created_at"]

    def __str__(self):
        prod_name = self.product.name if self.product else "عام"
        return f"{prod_name} [{self.grade}] ({self.pricing_type}): {self.old_price} -> {self.new_price} EGP"

# ================= Pricing v2 =================
from django.conf import settings as _settings


class PriceKind(models.TextChoices):
    BALE = 'BALE', 'Bale (بالة)'
    STOCK = 'STOCK', 'Stock (استوك)'
    DIRECT = 'DIRECT', 'Direct / Special (أصناف خاصة)'


class SortedGrade(models.TextChoices):
    NEW_COLLECTION = 'NEW_COLLECTION', 'High (عالي)'
    MIDDLE = 'MIDDLE', 'Medium (وسط)'
    CLEARANCE = 'CLEARANCE', 'Low (تصفيات)'


class WeightPrice(TenantAwareModel):
    """ Price per KG for sorted goods: BALE (key=''), STOCK (key=brand or 'MIX'), DIRECT (key=item name) x grade """
    kind = models.CharField(max_length=10, choices=PriceKind.choices, db_index=True)
    key = models.CharField(max_length=150, blank=True, default='')
    grade = models.CharField(max_length=20, choices=SortedGrade.choices)
    price_per_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "pricing_weight_prices"
        constraints = [models.UniqueConstraint(fields=["tenant", "kind", "key", "grade"], name="unique_weight_price")]

    def __str__(self):
        return f"{self.kind} {self.key} {self.grade}: {self.price_per_kg}"


class PieceItem(TenantAwareModel):
    """ A sellable piece type with its own code (typed at POS) """
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    source_kind = models.CharField(max_length=10, choices=PriceKind.choices)
    segment = models.CharField(max_length=100, blank=True, null=True)
    purchase_grade = models.CharField(max_length=50, blank=True, null=True)
    season = models.CharField(max_length=100, blank=True, null=True)
    brand = models.CharField(max_length=100, blank=True, null=True)
    price_per_piece = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price_per_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "pricing_piece_items"
        ordering = ["code"]
        constraints = [models.UniqueConstraint(fields=["tenant", "code"], name="unique_piece_code_per_tenant")]

    def __str__(self):
        return f"{self.code} - {self.name} {self.segment or ''}"


class PriceChangeLog(TenantAwareModel):
    """ Every price change (weights and pieces) """
    target = models.CharField(max_length=10)  # WEIGHT | PIECE
    code = models.CharField(max_length=50, blank=True, null=True)
    name = models.CharField(max_length=200, blank=True, null=True)
    kind = models.CharField(max_length=10, blank=True, null=True)
    key = models.CharField(max_length=150, blank=True, null=True)
    segment = models.CharField(max_length=100, blank=True, null=True)
    grade = models.CharField(max_length=50, blank=True, null=True)
    season = models.CharField(max_length=100, blank=True, null=True)
    field = models.CharField(max_length=20)  # per_kg | per_piece
    old_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    new_price = models.DecimalField(max_digits=12, decimal_places=2)
    changed_by = models.ForeignKey(_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="price_changes_v2")
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "pricing_change_log"
        ordering = ["-created_at"]
