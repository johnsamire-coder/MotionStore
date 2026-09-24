from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class TransferStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft (مسودة)'
    SHIPPED = 'SHIPPED', 'Shipped / In Transit (تم الشحن / في الطريق)'
    RECEIVED = 'RECEIVED', 'Received / Completed (تم الاستلام بالمخزن المستهدف)'
    CANCELLED = 'CANCELLED', 'Cancelled (ملغي)'


class TransferOrder(TenantAwareModel):
    transfer_code = models.CharField(max_length=100, db_index=True, verbose_name="Transfer #")
    source_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="outgoing_transfers"
    )
    destination_warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="incoming_transfers"
    )
    requested_by = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name="created_transfers"
    )
    transfer_date = models.DateField(verbose_name="Transfer Date")
    shipped_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=TransferStatus.choices,
        default=TransferStatus.DRAFT,
        db_index=True
    )
    total_weight_kg = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('0.000'))
    total_cost_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "transfer_orders"
        ordering = ["-transfer_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "transfer_code"],
                name="unique_transfer_code_per_tenant"
            )
        ]

    def __str__(self):
        return f"Transfer #{self.transfer_code} [{self.source_warehouse.name} -> {self.destination_warehouse.name}] ({self.get_status_display()})"


class TransferLineItem(TenantAwareModel):
    transfer_order = models.ForeignKey(
        TransferOrder,
        on_delete=models.CASCADE,
        related_name="lines"
    )
    stock_item = models.ForeignKey(
        'inventory.StockItem',
        on_delete=models.PROTECT,
        related_name="transfer_lines"
    )
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT)
    grade = models.CharField(max_length=30, choices=GradeChoice.choices)
    weight_kg = models.DecimalField(max_digits=12, decimal_places=3)
    quantity_pieces = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    total_cost = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "transfer_line_items"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.name} ({self.weight_kg} KG) - Transfer #{self.transfer_order.transfer_code}"
