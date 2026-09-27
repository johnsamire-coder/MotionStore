import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    phone = models.CharField(max_length=30, blank=True, default='')
    pos_terminal = models.ForeignKey('pos.POSTerminal', on_delete=models.SET_NULL, null=True, blank=True, related_name='bound_users')
    pin_hash = models.CharField(max_length=200, blank=True, default='')
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('MANAGER', 'Manager'),
        ('CASHIER', 'Cashier'),
        ('WAREHOUSE_KEEPER', 'Warehouse Keeper'),
        ('ACCOUNTANT', 'Accountant'),
        ('SORTER', 'Sorter'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        db_index=True
    )
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='CASHIER')
    assigned_branches = models.ManyToManyField(
        'branches.Branch',
        blank=True,
        related_name="assigned_users"
    )

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class RolePermission(models.Model):
    allowed_actions = models.JSONField(null=True, blank=True, default=None)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, null=True, blank=True, related_name='role_permissions')
    role = models.CharField(max_length=50, choices=User.ROLE_CHOICES, db_index=True)
    allowed_screens = models.JSONField(
        default=list, 
        help_text="List of frontend route paths allowed for this role. Example: ['/pos', '/reports']"
    )
    
    class Meta:
        db_table = "role_permissions"
        verbose_name_plural = "Role Permissions"

    def __str__(self):
        return f"{self.get_role_display()} Permissions"
