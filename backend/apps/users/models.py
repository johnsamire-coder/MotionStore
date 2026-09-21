import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
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
