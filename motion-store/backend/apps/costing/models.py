from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class CostingMethod(models.TextChoices):
    EQUAL_WEIGHT = 'EQUAL_WEIGHT', 'Equal Weight Allocation (التوزيع بالوزن بالتساوي)'
    COEFFICIENTS = 'COEFFICIENTS', 'Weighted Coefficients (التوزيع بالمعاملات)'
    SALES_VALUE = 'SALES_VALUE', 'Relative Sales Value (التوزيع بالقيمة البيعية المتوقعة)'
    STANDARD = 'STANDARD', 'Standard Costing (التكلفة المعيارية مع الفروقات)'


class WasteTreatment(models.TextChoices):
    ABSORBED = 'ABSORBED', 'Absorbed by Good Output (امتصاص الهالك)'
    SEPARATE = 'SEPARATE', 'Recognized as Separate Loss (خسارة منفصلة)'
    SPLIT = 'SPLIT', 'Split Normal/Abnormal (طبيعي ممتص / زائد كخسارة)'


class CostingConfiguration(TenantAwareModel):
    name = models.CharField(max_length=255, default="Default Costing Policy")
    method = models.CharField(
        max_length=30,
        choices=CostingMethod.choices,
        default=CostingMethod.EQUAL_WEIGHT
    )
    waste_treatment = models.CharField(
        max_length=30,
        choices=WasteTreatment.choices,
        default=WasteTreatment.ABSORBED
    )
    normal_waste_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5.00,
        help_text="Expected normal waste percentage (e.g. 5.00 for 5%)"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "costing_configurations"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "is_active"],
                condition=models.Q(is_active=True),
                name="unique_active_costing_config_per_tenant"
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.get_method_display()} / {self.get_waste_treatment_display()}"


class CostingParameter(TenantAwareModel):
    configuration = models.ForeignKey(
        CostingConfiguration,
        on_delete=models.CASCADE,
        related_name="parameters"
    )
    grade = models.CharField(
        max_length=30,
        choices=GradeChoice.choices,
        verbose_name="Product Grade"
    )
    coefficient = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=1.00,
        help_text="Coefficient multiplier (Method B)"
    )
    expected_selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Expected selling price per KG (Method C)"
    )
    standard_cost_per_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Standard cost per KG (Method D)"
    )

    class Meta:
        db_table = "costing_parameters"
        constraints = [
            models.UniqueConstraint(
                fields=["configuration", "grade"],
                name="unique_grade_parameter_per_configuration"
            )
        ]

    def __str__(self):
        return f"Grade {self.get_grade_display()} Parameters"


class CostingCalculationRecord(TenantAwareModel):
    sorting_order = models.ForeignKey(
        'sorting.SortingOrder',
        on_delete=models.PROTECT,
        related_name="costing_records"
    )
    method_used = models.CharField(max_length=50)
    waste_treatment_used = models.CharField(max_length=50)
    parameters_used = models.JSONField(default=dict)
    variance_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    waste_loss_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    total_allocated_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    class Meta:
        db_table = "costing_calculation_records"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Costing Run for Order {self.sorting_order.order_code} ({self.created_at})"
