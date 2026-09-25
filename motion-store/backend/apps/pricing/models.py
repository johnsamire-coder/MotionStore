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
