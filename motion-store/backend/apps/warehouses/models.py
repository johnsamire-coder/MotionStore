from django.db import models
from apps.tenants.models import TenantAwareModel

class Warehouse(TenantAwareModel):
    TYPE_CHOICES = [
        ('MAIN', 'Main Store / Sales Floor'),
        ('SORTING', 'Sorting Area'),
        ('TRANSIT', 'In-Transit Storage'),
        ('RETURNS', 'Returns Warehouse'),
        ('STORE', 'Retail Store / Shop (محل)'),
    ]

    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.CASCADE,
        related_name="warehouses"
    )
    name = models.CharField(max_length=255)
    warehouse_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='MAIN')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "warehouses"

    def __str__(self):
        return f"{self.name} ({self.get_warehouse_type_display()})"
