from django.db import models
from apps.tenants.models import TenantAwareModel

class Company(TenantAwareModel):
    promo_prices = models.CharField(max_length=200, blank=True, default='')
    phone = models.CharField(max_length=40, blank=True, default='')
    name = models.CharField(max_length=255)
    tax_number = models.CharField(max_length=50, blank=True, null=True)
    registration_number = models.CharField(max_length=50, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    currency = models.CharField(max_length=10, default='EGP')

    class Meta:
        db_table = "companies"
        verbose_name_plural = "companies"

    def __str__(self):
        return self.name
