from django.db import models
from apps.tenants.models import TenantAwareModel

class GradeChoice(models.TextChoices):
    NEW_COLLECTION = 'NEW_COLLECTION', 'New Collection (كريمة / سوبر لوكس)'
    MIDDLE = 'MIDDLE', 'Middle (وسط / درجة ثانية)'
    CLEARANCE = 'CLEARANCE', 'Clearance (تصفيات / شعبي)'
    WASTE = 'WASTE', 'Waste (تالف / هالك فرز)'


class UnitOfMeasure(models.TextChoices):
    PIECE = 'PIECE', 'By Piece (بالقطعة)'
    KG = 'KG', 'By Weight / KG (بالوزن / كجم)'
    BOTH = 'BOTH', 'Piece + Weight Tracked (بالقطعة مع وزن فعلي)'


class Category(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Category Name")
    code = models.CharField(max_length=50, blank=True, null=True, verbose_name="Category Code")
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "categories"
        verbose_name_plural = "categories"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_category_name_per_tenant"
            )
        ]

    def __str__(self):
        return self.name


class Product(TenantAwareModel):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products"
    )
    name = models.CharField(max_length=255, verbose_name="Product Name")
    code = models.CharField(max_length=100, blank=True, null=True, verbose_name="Internal SKU / Code")
    barcode = models.CharField(max_length=100, blank=True, null=True, db_index=True, verbose_name="Barcode / EAN")
    unit_of_measure = models.CharField(
        max_length=20,
        choices=UnitOfMeasure.choices,
        default=UnitOfMeasure.PIECE,
        verbose_name="Default Unit of Measure"
    )
    attributes = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Product Attributes (Size, Color, Gender, Season)"
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "products"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "barcode"],
                condition=models.Q(barcode__isnull=False),
                name="unique_non_null_barcode_per_tenant"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.category.name})"
