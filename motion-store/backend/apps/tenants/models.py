import uuid
import datetime
from decimal import Decimal
from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from .managers import TenantAwareManager

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, verbose_name="Tenant Name")
    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    logo_base64 = models.TextField(blank=True, null=True, verbose_name="Company Logo Base64")

    class Meta:
        db_table = "tenants"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.slug})"


def serialize_model(instance):
    """ Helper to safely serialize any django model instance to a JSON-compatible dict """
    data = {}
    for field in instance._meta.fields:
        val = getattr(instance, field.name)
        if val is None:
            data[field.name] = None
        elif isinstance(val, (uuid.UUID, Decimal)):
            data[field.name] = str(val)
        elif isinstance(val, (datetime.date, datetime.datetime, datetime.time)):
            data[field.name] = val.isoformat()
        elif isinstance(val, (int, float, bool, str)):
            data[field.name] = val
        elif isinstance(val, (dict, list)):
            data[field.name] = val
        elif hasattr(val, 'pk'):
            data[field.name] = str(val.pk) if val.pk else None
        else:
            data[field.name] = str(val)
    return data


class TenantAwareModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantAwareManager()
    all_objects = models.Manager()

    logo_base64 = models.TextField(blank=True, null=True, verbose_name="Company Logo Base64")

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        from apps.tenants.context import get_current_tenant
        from apps.audit.services import record_audit

        if not self.tenant_id:
            current_tenant = get_current_tenant()
            if current_tenant:
                self.tenant = current_tenant

        is_new = self._state.adding
        old_values = None

        if not is_new:
            try:
                original = self.__class__.all_objects.get(pk=self.pk)
                old_values = serialize_model(original)
            except self.__class__.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        new_values = serialize_model(self)
        action = 'CREATE' if is_new else 'UPDATE'
        
        record_audit(
            action=action,
            domain=self._meta.app_label,
            entity_type=self.__class__.__name__,
            entity_id=str(self.pk),
            old_values=old_values,
            new_values=new_values,
            tenant=self.tenant
        )

    def delete(self, *args, **kwargs):
        from apps.audit.services import record_audit
        
        old_values = serialize_model(self)
        pk_str = str(self.pk)
        app_label = self._meta.app_label
        class_name = self.__class__.__name__
        tenant_copy = self.tenant

        super().delete(*args, **kwargs)

        record_audit(
            action='DELETE',
            domain=app_label,
            entity_type=class_name,
            entity_id=pk_str,
            old_values=old_values,
            new_values=None,
            tenant=tenant_copy
        )
