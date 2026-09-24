from django.db import models
from .context import get_current_tenant

class TenantAwareQuerySet(models.QuerySet):
    def filter_by_current_tenant(self):
        tenant = get_current_tenant()
        if tenant:
            return self.filter(tenant=tenant)
        return self

class TenantAwareManager(models.Manager):
    def get_queryset(self):
        tenant = get_current_tenant()
        qs = TenantAwareQuerySet(self.model, using=self._db)
        if tenant:
            return qs.filter(tenant=tenant)
        return qs
