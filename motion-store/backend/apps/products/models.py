from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel

class GradeChoice(models.TextChoices):
    NEW_COLLECTION = 'NEW_COLLECTION', 'New Collection (كريمة / سوبر لوكس)'
    MIDDLE = 'MIDDLE', 'Middle (وسط / درجة ثانية)'
    CLEARANCE = 'CLEARANCE', 'Clearance (تصفيات / شعبي)'
    WASTE = 'WASTE', 'Waste (تالف / هالك فرز)'


class UnitOfMeasure(models.TextChoices):
    PIECE = 'PIECE', 'قطعة / عدد'
    KG = 'KG', 'كيلو / كجم'
    BOTH = 'BOTH', 'قطعة + وزن'
    BALE = 'BALE', 'باله'
    DOZEN = 'DOZEN', 'دسته'
    CARTON = 'CARTON', 'كرتونه'
    SACK = 'SACK', 'شيكارة'
    BARREL = 'BARREL', 'برميل'
    BOX = 'BOX', 'علبة'
    JAR = 'JAR', 'برطمان'
    JERRYCAN = 'JERRYCAN', 'جركن'
    LITER = 'LITER', 'لتر'
    BAG = 'BAG', 'كيس'
    TANK = 'TANK', 'تنك'
    BUNDLE = 'BUNDLE', 'هبط'
    SET = 'SET', 'مجموعة'
    EMPTY = 'EMPTY', 'فوارغ'
    CARD = 'CARD', 'كارت'
    TOTE = 'TOTE', 'شنطة'
    LIST = 'LIST', 'لسته'
    OTHER = 'OTHER', 'غير محدد'


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
    name = models.CharField(max_length=255, verbose_name="Product Name (اسم الصنف)")
    code = models.CharField(max_length=100, blank=True, null=True, verbose_name="Internal SKU / Code (الكود)")
    barcode = models.CharField(max_length=100, blank=True, null=True, db_index=True, verbose_name="Barcode / EAN (الباركود)")
    wholesale_code = models.CharField(max_length=100, blank=True, null=True, verbose_name="Wholesale Code (كود الجملة)")
    unit_of_measure = models.CharField(
        max_length=30,
        choices=UnitOfMeasure.choices,
        default=UnitOfMeasure.PIECE,
        verbose_name="Default Unit of Measure (وحدة القياس)"
    )
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Purchase Price (سعر الشراء)"
    )
    retail_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Retail Price (سعر البيع القطاعي)"
    )
    wholesale_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Wholesale Price (سعر بيع الجملة)"
    )
    special_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Special Price (سعر بيع خاص)"
    )
    carton_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Carton Price (سعر الكرتونة / الشيكارة)"
    )
    carton_capacity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal('1.000'),
        verbose_name="Carton Capacity (سعة الكرتونة)"
    )
    min_stock_level = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name="Min Stock Alert (الحد الأدنى)"
    )
    package_type = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Package Type (نوع العبوة)"
    )
    opening_balance = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name="Opening Stock (رصيد أول المدة)"
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
