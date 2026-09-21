from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel

class TreasuryType(models.TextChoices):
    MAIN_SAFE = 'MAIN_SAFE', 'Main Safe (الخزينة الرئيسية)'
    POS_DRAWER = 'POS_DRAWER', 'POS Cash Drawer (درج الكاشير)'
    BANK = 'BANK', 'Bank Account (حساب بنكي)'


class TreasuryTransactionType(models.TextChoices):
    DEPOSIT = 'DEPOSIT', 'Deposit / Income (إيداع / وارد)'
    WITHDRAWAL = 'WITHDRAWAL', 'Withdrawal / Expense (سحب / منصرف)'
    TRANSFER_IN = 'TRANSFER_IN', 'Transfer In (تحويل وارد)'
    TRANSFER_OUT = 'TRANSFER_OUT', 'Transfer Out (تحويل صادر)'


class Treasury(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Treasury Name")
    treasury_type = models.CharField(
        max_length=20,
        choices=TreasuryType.choices,
        default=TreasuryType.MAIN_SAFE
    )
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.PROTECT,
        related_name="treasuries"
    )
    current_balance = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name="Current Balance (Sum of Ledger)"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "treasuries"
        ordering = ["name"]
        verbose_name_plural = "treasuries"

    def __str__(self):
        return f"{self.name} ({self.get_treasury_type_display()}): {self.current_balance} EGP"


class TreasuryTransaction(TenantAwareModel):
    treasury = models.ForeignKey(
        Treasury,
        on_delete=models.PROTECT,
        related_name="transactions"
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TreasuryTransactionType.choices,
        db_index=True
    )
    amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        help_text="Signed amount (+ increases balance, - decreases balance)"
    )
    payment_method_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Payment method name (e.g. Cash, Visa)"
    )
    source_document_type = models.CharField(max_length=100, blank=True, null=True)
    source_document_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    running_balance = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "treasury_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.get_transaction_type_display()}] {self.amount} EGP @ {self.treasury.name}"
