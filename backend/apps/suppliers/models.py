from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.tenants.context import get_current_tenant

class Supplier(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Supplier Name")
    code = models.CharField(max_length=50, blank=True, null=True, verbose_name="Supplier Code")
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    tax_number = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "suppliers"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_supplier_name_per_tenant"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code or 'No Code'})"

    def save(self, *args, **kwargs):
        if not self.tenant_id:
            ct = get_current_tenant()
            if ct:
                self.tenant = ct
        if not self.code:
            count = Supplier.objects.filter(tenant_id=self.tenant_id).count() + 1 if self.tenant_id else Supplier.objects.count() + 1
            self.code = f"SUP-{count:04d}"
        super().save(*args, **kwargs)
