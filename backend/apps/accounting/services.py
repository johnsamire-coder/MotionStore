from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.accounting.models import Account, AccountType, JournalEntry, JournalEntryLine, JournalEntryStatus

STANDARD_COA_TEMPLATE = [
    # ASSETS (1000)
    ('1010', 'Raw Bale Inventory (مخزون البالات الخام)', AccountType.ASSET),
    ('1020', 'Finished Goods Inventory (مخزون بضاعة تامة الصنع)', AccountType.ASSET),
    ('1030', 'Cash on Hand / Safe (النقدية بالصناديق والخزائن)', AccountType.ASSET),
    ('1040', 'Bank Accounts (حسابات البنوك)', AccountType.ASSET),
    ('1050', 'Accounts Receivable / Customers (العملاء المدينون)', AccountType.ASSET),
    # LIABILITIES (2000)
    ('2010', 'Accounts Payable / Suppliers (الموردون الدائنون)', AccountType.LIABILITY),
    # EQUITY (3000)
    ('3010', 'Retained Earnings (الأرباح المبقاة / رأس المال)', AccountType.EQUITY),
    # REVENUE (4000)
    ('4010', 'Sales Revenue (إيرادات المبيعات)', AccountType.REVENUE),
    ('4020', 'Scrap & Waste Sales Revenue (إيرادات بيع هالك وخردة)', AccountType.REVENUE),
    # EXPENSES & COSTS (5000)
    ('5010', 'Cost of Goods Sold - COGS (تكلفة البضاعة المباعة)', AccountType.EXPENSE),
    ('5020', 'Sorting Waste Loss (خسائر هالك الفرز المستقلة)', AccountType.EXPENSE),
    ('5030', 'Inventory Write-Down Loss (خسائر هبوط أسعار المخزون)', AccountType.EXPENSE),
    ('5040', 'Purchase Variance (فروقات أسعار الشراء والمعيارية)', AccountType.EXPENSE),
]

def init_standard_chart_of_accounts(tenant):
    """ Creates standard Chart of Accounts for a tenant if not already present """
    created_accounts = {}
    for code, name, acc_type in STANDARD_COA_TEMPLATE:
        acc, _ = Account.objects.get_or_create(
            tenant=tenant,
            code=code,
            defaults={
                'name': name,
                'account_type': acc_type
            }
        )
        created_accounts[code] = acc
    return created_accounts


@transaction.atomic
def create_balanced_journal_entry(
    tenant,
    entry_number: str,
    entry_date,
    lines_data: list,
    source_document_type: str = None,
    source_document_id: str = None,
    notes: str = None,
    status: str = JournalEntryStatus.POSTED
) -> JournalEntry:
    """
    Core Double-Entry Journal Writer.
    Enforces strict mathematical balance (Sum Debit == Sum Credit) before posting.
    lines_data format: [{'account_code': '1010', 'debit': Decimal('100.00'), 'credit': Decimal('0.00'), 'desc': '...'}]
    """
    total_debit = sum(line.get('debit', Decimal('0.00')) for line in lines_data)
    total_credit = sum(line.get('credit', Decimal('0.00')) for line in lines_data)

    # Validate Double-Entry Balance
    if abs(total_debit - total_credit) > Decimal('0.001'):
        raise ValidationError(
            f"Unbalanced Journal Entry {entry_number}. Total Debit: {total_debit} != Total Credit: {total_credit}"
        )

    # Create Master Journal Entry
    entry = JournalEntry.objects.create(
        tenant=tenant,
        entry_number=entry_number,
        entry_date=entry_date,
        status=status,
        total_debit=total_debit,
        total_credit=total_credit,
        source_document_type=source_document_type,
        source_document_id=str(source_document_id) if source_document_id else None,
        notes=notes
    )

    # Create Lines
    for line in lines_data:
        acc = line.get('account')
        if not acc and 'account_code' in line:
            acc = Account.objects.get(tenant=tenant, code=line['account_code'])

        JournalEntryLine.objects.create(
            tenant=tenant,
            journal_entry=entry,
            account=acc,
            debit=line.get('debit', Decimal('0.00')),
            credit=line.get('credit', Decimal('0.00')),
            description=line.get('desc')
        )

    return entry
