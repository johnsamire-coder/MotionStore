from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class CostingMethod(models.TextChoices):
    PIECE = 'PIECE', 'بالقطعة (تكلفة موحدة لكل قطعة)'
    WEIGHT = 'WEIGHT', 'بالوزن (تكلفة موحدة لكل كيلو)'
    PERCENTAGE = 'PERCENTAGE', 'بنسب ثابتة لكل درجة (عالي / وسط / تصفيات / هالك)'
    # الحفاظ على القيم القديمة لمنع كسر أي بيانات سابقة
    EQUAL_WEIGHT = 'EQUAL_WEIGHT', 'Equal Weight Allocation (قديم)'
    COEFFICIENTS = 'COEFFICIENTS', 'Weighted Coefficients (قديم)'
    SALES_VALUE = 'SALES_VALUE', 'Relative Sales Value (قديم)'
    STANDARD = 'STANDARD', 'Standard Costing (قديم)'


class WasteTreatment(models.TextChoices):
    SEPARATE = 'SEPARATE', 'تسجيل الهالك كخسارة منفصلة (خسارة هالك الفرز)'
    ABSORBED = 'ABSORBED', 'Absorbed by Good Output (قديم)'
    SPLIT = 'SPLIT', 'Split Normal/Abnormal (قديم)'


class CostingConfiguration(TenantAwareModel):
    name = models.CharField(max_length=255, default="سياسة التكلفة الافتراضية")
    method = models.CharField(
        max_length=30,
        choices=CostingMethod.choices,
        default=CostingMethod.WEIGHT,
        verbose_name="طريقة حساب التكلفة"
    )
    waste_treatment = models.CharField(
        max_length=30,
        choices=WasteTreatment.choices,
        default=WasteTreatment.SEPARATE,
        verbose_name="معالجة الهالك"
    )
    # نسب الدرجات الأربعة في حالة اختيار طريقة (بنسب ثابتة لكل درجة)
    high_grade_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('55.00'),
        verbose_name="نسبة العالي %"
    )
    mid_grade_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('30.00'),
        verbose_name="نسبة الوسط %"
    )
    liquidation_grade_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('10.00'),
        verbose_name="نسبة التصفيات %"
    )
    waste_grade_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('5.00'),
        verbose_name="نسبة الهالك %"
    )
    normal_waste_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('5.00'),
        help_text="نسبة الهالك المعيارية"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "costing_configurations"

    def __str__(self):
        return f"{self.name} - {self.get_method_display()}"


class CostingParameter(TenantAwareModel):
    configuration = models.ForeignKey(
        CostingConfiguration,
        on_delete=models.CASCADE,
        related_name="parameters"
    )
    grade = models.CharField(max_length=20, choices=GradeChoice.choices)
    coefficient = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))
    expected_selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    standard_cost_per_kg = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = "costing_parameters"


class CostingCalculationRecord(TenantAwareModel):
    sorting_order = models.OneToOneField(
        'sorting.SortingOrder',
        on_delete=models.PROTECT,
        related_name="costing_record"
    )
    method_used = models.CharField(max_length=30)
    waste_treatment_used = models.CharField(max_length=30, default=WasteTreatment.SEPARATE)
    parameters_used = models.JSONField(default=dict)
    variance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    waste_loss_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_allocated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = "costing_calculation_records"