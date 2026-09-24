from django.db import models
from apps.tenants.models import TenantAwareModel

class Branch(TenantAwareModel):
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="branches"
    )
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = "branches"
        verbose_name_plural = "branches"

    def __str__(self):
        return f"{self.name} ({self.company.name})"
