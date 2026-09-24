from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.treasury.models import Treasury, TreasuryTransaction, TreasuryTransactionType

@transaction.atomic
def record_treasury_transaction(
    treasury_id,
    transaction_type: str,
    amount: Decimal,
    payment_method=None,
    source_document_type: str = None,
    source_document_id: str = None,
    description: str = None,
    allow_negative: bool = False
) -> TreasuryTransaction:
    """
    Central Treasury Ledger Writer.
    Signs the amount by type and updates the cumulative balance safely.
    """
    treasury = Treasury.objects.select_for_update().get(pk=treasury_id)

    # Determine sign
    if transaction_type in (TreasuryTransactionType.DEPOSIT, TreasuryTransactionType.TRANSFER_IN):
        signed_amount = abs(amount)
    else:
        signed_amount = -abs(amount)

    new_balance = treasury.current_balance + signed_amount

    if new_balance < 0 and not allow_negative:
        raise ValidationError(
            f"Insufficient funds in {treasury.name}. Balance: {treasury.current_balance}, Attempted: {signed_amount}"
        )

    treasury.current_balance = new_balance
    treasury.save()

    # Extract payment method name safely
    pm_name = getattr(payment_method, 'name', str(payment_method)) if payment_method else None

    entry = TreasuryTransaction.objects.create(
        tenant=treasury.tenant,
        treasury=treasury,
        transaction_type=transaction_type,
        amount=signed_amount,
        payment_method_name=pm_name,
        source_document_type=source_document_type,
        source_document_id=str(source_document_id) if source_document_id else None,
        running_balance=new_balance,
        description=description
    )
    return entry


@transaction.atomic
def transfer_between_treasuries(from_treasury_id, to_treasury_id, amount: Decimal, description: str = None):
    """ Moves funds between two treasuries as a paired ledger operation. """
    out_txn = record_treasury_transaction(
        treasury_id=from_treasury_id,
        transaction_type=TreasuryTransactionType.TRANSFER_OUT,
        amount=amount,
        source_document_type='TreasuryTransfer',
        description=description or 'Internal treasury transfer (out)'
    )
    in_txn = record_treasury_transaction(
        treasury_id=to_treasury_id,
        transaction_type=TreasuryTransactionType.TRANSFER_IN,
        amount=amount,
        source_document_type='TreasuryTransfer',
        description=description or 'Internal treasury transfer (in)'
    )
    return out_txn, in_txn
