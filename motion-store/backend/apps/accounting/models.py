from decimal import Decimal
from django.db import models
from django.core.exceptions import ValidationError
from apps.tenants.models import TenantAwareModel

class AccountType(models.TextChoices):
    ASSET = 'ASSET', 'Asset (أصول)'
    LIABILITY = 'LIABILITY', 'Liability (التزامات / خصوم)'
    EQUITY = 'EQUITY', 'Equity (حقوق ملكية)'
    REVENUE = 'REVENUE', 'Revenue (إيرادات)'
    EXPENSE = 'EXPENSE', 'Expense / Cost (مصروفات وتكاليف)'


class JournalEntryStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft (مسودة)'
    POSTED = 'POSTED', 'Posted / Confirmed (مرحل)'
    REVERSED = 'REVERSED', 'Reversed / Cancelled (معكوس)'


class Account(TenantAwareModel):
    code = models.CharField(max_length=50, db_index=True, verbose_name="Account Code")
    name = models.CharField(max_length=255, verbose_name="Account Name")
    account_type = models.CharField(max_length=20, choices=AccountType.choices, db_index=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children"
    )
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "accounts"
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "code"],
                name="unique_account_code_per_tenant"
            )
        ]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.get_account_type_display()})"


class JournalEntry(TenantAwareModel):
    entry_number = models.CharField(max_length=100, db_index=True, verbose_name="Entry #")
    entry_date = models.DateField(verbose_name="Entry Date")
    status = models.CharField(
        max_length=20,
        choices=JournalEntryStatus.choices,
        default=JournalEntryStatus.POSTED,
        db_index=True
    )
    total_debit = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    total_credit = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    source_document_type = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. PurchaseInvoice, SaleInvoice, SortingOrder")
    source_document_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "journal_entries"
        ordering = ["-entry_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "entry_number"],
                name="unique_journal_entry_number_per_tenant"
            )
        ]

    def __str__(self):
        return f"JV #{self.entry_number} [{self.entry_date}] - Total: {self.total_debit} EGP ({self.get_status_display()})"


class JournalEntryLine(TenantAwareModel):
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="lines"
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.PROTECT,
        related_name="journal_lines"
    )
    debit = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "journal_entry_lines"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.account.name}: Dr {self.debit} | Cr {self.credit}"
