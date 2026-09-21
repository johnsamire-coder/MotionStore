from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class TransactionType(models.TextChoices):
    SORT_IN = 'SORT_IN', 'Sorting Good Output (إدخال من الفرز)'
    SALE = 'SALE', 'POS / Customer Sale (صرف بيع)'
    RETURN_IN = 'RETURN_IN', 'Sales Return (إرجاع مبيعات)'
    TRANSFER_OUT = 'TRANSFER_OUT', 'Transfer Out (نقل صادر لمخزن آخر)'
    TRANSFER_IN = 'TRANSFER_IN', 'Transfer In (نقل وارد من مخزن آخر)'
    ADJUSTMENT_PLUS = 'ADJUSTMENT_PLUS', 'Stock Count Surplus (تسوية جرد بالزيادة)'
    ADJUSTMENT_MINUS = 'ADJUSTMENT_MINUS', 'Stock Count Deficit (تسوية جرد بالعجز)'
    WRITE_DOWN = 'WRITE_DOWN', 'Inventory Write-Down (تخفيض قيمة المخزون)'


class StockItem(TenantAwareModel):
    """
    Cumulative Stock Balance representation per product, grade, warehouse, and source lot.
    """
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        related_name="stock_items"
    )
    grade = models.CharField(
        max_length=30,
        choices=GradeChoice.choices,
        default=GradeChoice.NEW_COLLECTION,
        db_index=True
    )
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="stock_items"
    )
    source_lot = models.ForeignKey(
        'raw_lots.RawLot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finished_stock_items",
        help_text="Direct link to source raw bale for full traceability"
    )
    total_weight_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name="Available Weight (KG)"
    )
    total_quantity_pieces = models.IntegerField(
        default=0,
        verbose_name="Available Pieces"
    )
    avg_cost_per_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Current Unit Cost per KG"
    )
    current_total_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Total Current Valuation"
    )

    class Meta:
        db_table = "stock_items"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "product", "grade", "warehouse", "source_lot"],
                name="unique_stock_item_per_lot_grade_wh"
            )
        ]

    def __str__(self):
        return f"{self.product.name} [{self.get_grade_display()}] @ {self.warehouse.name}: {self.total_weight_kg} KG"


class InventoryTransaction(TenantAwareModel):
    """
    Immutable Inventory Ledger Entry.
    Every change in stock must be recorded here.
    """
    transaction_type = models.CharField(
        max_length=30,
        choices=TransactionType.choices,
        db_index=True
    )
    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.PROTECT,
        related_name="transactions"
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.PROTECT,
        related_name="inventory_ledger"
    )
    grade = models.CharField(max_length=30, choices=GradeChoice.choices)
    warehouse = models.ForeignKey(
        'warehouses.Warehouse',
        on_delete=models.PROTECT,
        related_name="warehouse_ledger"
    )
    weight_change_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        help_text="Signed weight change (+ for in, - for out)"
    )
    quantity_change_pieces = models.IntegerField(
        default=0,
        help_text="Signed pieces change (+ for in, - for out)"
    )
    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Unit cost applied at transaction time"
    )
    total_cost_change = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="Total value change (+ for increase, - for decrease)"
    )
    source_document_type = models.CharField(
        max_length=100,
        help_text="e.g. SortingOrder, SaleInvoice, TransferOrder"
    )
    source_document_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="UUID or Code of source document"
    )
    running_weight_balance = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal('0.000')
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "inventory_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.get_transaction_type_display()}] {self.product.name} ({self.weight_change_kg} KG) @ {self.warehouse.name}"
