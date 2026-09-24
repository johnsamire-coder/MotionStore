from django.db import models
from apps.tenants.models import TenantAwareModel

class POSTerminal(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Terminal Name")
    code = models.CharField(max_length=50, db_index=True, verbose_name="Terminal Code")
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.PROTECT,
        related_name="pos_terminals"
    )
    default_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="pos_terminals",
        help_text="Warehouse from which this POS decrements inventory"
    )
    cash_drawer = models.ForeignKey(
        'treasury.Treasury',
        on_delete=models.PROTECT,
        related_name="pos_terminals",
        help_text="Treasury drawer holding this POS cash"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "pos_terminals"
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "code"],
                name="unique_terminal_code_per_tenant"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.code}) - {self.branch.name}"
