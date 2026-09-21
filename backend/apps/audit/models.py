import uuid
from django.db import models
from django.core.exceptions import PermissionDenied

class AuditLog(models.Model):
    """
    Immutable audit trail for all business events and state mutations.
    Write-only: Updates and deletions are strictly forbidden.
    """
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('POST', 'Post/Confirm'),
        ('REVERSE', 'Reverse/Cancel'),
        ('APPROVE', 'Approve'),
        ('LOGIN', 'Login'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
        db_index=True
    )
    actor_id = models.CharField(max_length=255, null=True, blank=True)
    actor_email = models.CharField(max_length=255, null=True, blank=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES, db_index=True)
    domain = models.CharField(max_length=50, db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)
    entity_id = models.CharField(max_length=100, db_index=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"[{self.timestamp}] {self.action} on {self.domain}.{self.entity_type}:{self.entity_id}"

    def delete(self, *args, **kwargs):
        raise PermissionDenied("Audit records cannot be deleted. Write-only policy enforced.")

    def save(self, *args, **kwargs):
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise PermissionDenied("Audit records cannot be modified once created.")
        super().save(*args, **kwargs)
