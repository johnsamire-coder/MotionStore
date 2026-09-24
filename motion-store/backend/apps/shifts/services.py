import datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.shifts.models import Shift, ShiftStatus
from apps.pos.models import POSTerminal
from apps.treasury.models import TreasuryTransactionType
from apps.treasury.services import record_treasury_transaction

@transaction.atomic
def open_shift(terminal_id, cashier, opening_cash: Decimal, notes: str = None) -> Shift:
    """
    Opens a new shift on a POS terminal.
    Ensures terminal has no currently active open shifts.
    """
    terminal = POSTerminal.objects.get(pk=terminal_id)

    # 1. Ensure no open shift on this terminal
    active_shift = Shift.objects.filter(terminal=terminal, status=ShiftStatus.OPEN).first()
    if active_shift:
        raise ValidationError(
            f"Terminal {terminal.code} already has an active open shift (#{active_shift.shift_code}) by {active_shift.cashier.username}."
        )

    # 2. Generate shift code
    now = timezone.now()
    date_str = now.strftime('%Y%m%d')
    seq = Shift.objects.filter(tenant=terminal.tenant, opened_at__date=now.date()).count() + 1
    shift_code = f"SH-{terminal.code}-{date_str}-{seq:03d}"

    # 3. Create Shift Record
    shift = Shift.objects.create(
        tenant=terminal.tenant,
        shift_code=shift_code,
        terminal=terminal,
        cashier=cashier,
        opened_at=now,
        status=ShiftStatus.OPEN,
        opening_cash=opening_cash,
        expected_cash=opening_cash,
        notes=notes
    )

    # 4. If opening cash provided, record opening float in Treasury Drawer
    if opening_cash > 0:
        record_treasury_transaction(
            treasury_id=terminal.cash_drawer_id,
            transaction_type=TreasuryTransactionType.DEPOSIT,
            amount=opening_cash,
            source_document_type='ShiftOpening',
            source_document_id=shift_code,
            description=f"Opening float for Shift #{shift_code}"
        )

    return shift


@transaction.atomic
def close_shift(shift_id, actual_cash: Decimal, notes: str = None) -> Shift:
    """
    Closes an active shift, calculates expected cash vs actual cash, and evaluates discrepancies.
    """
    shift = Shift.objects.select_for_update().get(pk=shift_id)

    if shift.status != ShiftStatus.OPEN:
        raise ValidationError(f"Shift #{shift.shift_code} is not currently open (Status: {shift.status}).")

    # 1. Compute expected cash: opening float + cash sales
    shift.expected_cash = shift.opening_cash + shift.cash_sales_total
    shift.actual_cash = actual_cash
    shift.difference = actual_cash - shift.expected_cash
    shift.closed_at = timezone.now()

    if notes:
        shift.notes = (shift.notes or '') + f"\nClosing Note: {notes}"

    # 2. Evaluate discrepancy
    if abs(shift.difference) > Decimal('0.001'):
        shift.status = ShiftStatus.REVIEW
    else:
        shift.status = ShiftStatus.CLOSED

    shift.save()
    return shift
