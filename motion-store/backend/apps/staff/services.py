"""
Attendance engine (phase 1). All minute math lives here so the screens and the coming payroll use
the same numbers.

Times past midnight: a schedule whose end is earlier than its start ends the next day, and a
check-out earlier than the check-in is the next day too.
"""
import datetime
from collections import defaultdict

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import (AttendanceDay, AttendanceEditLog, DayStatus, Employee, OffDay, PublicHoliday,
                     StaffSettings)

DAY = 24 * 60


def _mins(t):
    return t.hour * 60 + t.minute


def _span(start, end):
    """ Minutes from start to end, wrapping past midnight. """
    s, e = _mins(start), _mins(end)
    return e - s if e > s else e + DAY - s


def schedule_minutes(emp):
    return _span(emp.start_time, emp.end_time)


def compute_day(emp, status, check_in, check_out, settings, manual_overtime=None):
    """ -> dict(late_minutes, early_minutes, overtime_minutes, worked_minutes). Raw minutes: the grace and
    the deduction rules are applied by payroll, so the owner always sees the real lateness. """
    out = {'late_minutes': 0, 'early_minutes': 0, 'overtime_minutes': 0, 'worked_minutes': 0}
    if status != DayStatus.PRESENT:
        return out
    if check_in is None or check_out is None:
        raise ValidationError('الحاضر لازم يبقى ليه ساعة حضور وساعة انصراف')
    sched = schedule_minutes(emp)
    # position of the check-in / check-out on the schedule's timeline (0 = schedule start)
    cin = (_mins(check_in) - _mins(emp.start_time)) % DAY
    if cin > DAY - 6 * 60:          # up to 6 hours early counts as early arrival, not a very late one
        cin -= DAY
    worked = _span(check_in, check_out)
    cout = cin + worked
    out['worked_minutes'] = worked
    out['late_minutes'] = max(0, cin)
    out['early_minutes'] = max(0, sched - cout)
    mode = settings.get('overtime_mode')
    if mode == 'AUTO':
        ot = max(0, cout - sched)
        out['overtime_minutes'] = ot if ot >= int(settings.get('overtime_min_minutes') or 0) else 0
    elif mode == 'MANUAL':
        out['overtime_minutes'] = max(0, int(manual_overtime or 0))
    return out


def _parse_time(v):
    if v in (None, ''):
        return None
    if isinstance(v, datetime.time):
        return v
    try:
        h, m = str(v).strip()[:5].split(':')
        return datetime.time(int(h), int(m))
    except Exception:
        raise ValidationError(f'الساعة «{v}» مش مظبوطة. اكتبها كده: 09:30')


def _is_off(emp, date, off_set):
    if (emp.id, date) in off_set:
        return True
    return emp.fixed_off_weekday is not None and date.weekday() == emp.fixed_off_weekday


def day_sheet(tenant, date):
    """ One row per active employee for the attendance screen: what was saved, or the default
    (holiday / rotating day off / blank). """
    emps = list(Employee.objects.filter(tenant=tenant, is_active=True).order_by('name'))
    saved = {d.employee_id: d for d in AttendanceDay.objects.filter(tenant=tenant, date=date)}
    holiday = PublicHoliday.objects.filter(tenant=tenant, date=date).first()
    off_set = set(OffDay.objects.filter(tenant=tenant, date=date).values_list('employee_id', 'date'))
    rows = []
    for e in emps:
        d = saved.get(e.id)
        is_off = _is_off(e, date, off_set)
        default = DayStatus.HOLIDAY if holiday else (DayStatus.OFF if is_off else '')
        rows.append({
            'employee_id': str(e.id), 'name': e.name, 'job_title': e.job_title,
            'start_time': e.start_time.strftime('%H:%M'), 'end_time': e.end_time.strftime('%H:%M'),
            'saved': d is not None, 'locked': bool(d and d.locked),
            'status': d.status if d else default,
            'check_in': d.check_in.strftime('%H:%M') if d and d.check_in else '',
            'check_out': d.check_out.strftime('%H:%M') if d and d.check_out else '',
            'late_minutes': d.late_minutes if d else 0, 'early_minutes': d.early_minutes if d else 0,
            'overtime_minutes': d.overtime_minutes if d else 0, 'worked_minutes': d.worked_minutes if d else 0,
            'notes': d.notes if d else '', 'is_off_day': is_off, 'is_holiday': bool(holiday),
        })
    return {'date': date.isoformat(), 'holiday': holiday.name if holiday else '', 'rows': rows}


def _snap(d):
    return {'status': d.status, 'check_in': d.check_in.strftime('%H:%M') if d.check_in else '',
            'check_out': d.check_out.strftime('%H:%M') if d.check_out else '',
            'overtime_minutes': d.overtime_minutes, 'notes': d.notes}


@transaction.atomic
def save_day(tenant, date, rows, user=None):
    """ Saves the attendance sheet of one date. Rows with an empty status are skipped (not absence).
    Locked days (used by an approved payroll) cannot change. Every change to an existing day is logged. """
    if date > datetime.date.today():
        raise ValidationError('مينفعش تسجل حضور ليوم لسه ماجاش')
    settings = StaffSettings.for_tenant(tenant).merged()
    holiday = PublicHoliday.objects.filter(tenant=tenant, date=date).exists()
    off_set = set(OffDay.objects.filter(tenant=tenant, date=date).values_list('employee_id', 'date'))
    emps = {str(e.id): e for e in Employee.objects.filter(tenant=tenant)}
    saved = 0
    for n, r in enumerate(rows, start=1):
        emp = emps.get(str(r.get('employee_id')))
        if emp is None:
            raise ValidationError(f'السطر {n}: الموظف مش موجود')
        status = (r.get('status') or '').strip()
        if not status:
            continue
        if status not in DayStatus.values:
            raise ValidationError(f'{emp.name}: الحالة غلط')
        cin, cout = _parse_time(r.get('check_in')), _parse_time(r.get('check_out'))
        if status != DayStatus.PRESENT:
            cin = cout = None
        try:
            calc = compute_day(emp, status, cin, cout, settings, r.get('overtime_minutes'))
        except ValidationError as e:
            raise ValidationError(f"{emp.name}: {'; '.join(e.messages)}")
        values = {'status': status, 'check_in': cin, 'check_out': cout, 'notes': (r.get('notes') or '')[:255],
                  'is_holiday': holiday, 'is_off_day': _is_off(emp, date, off_set), **calc}
        day = AttendanceDay.objects.select_for_update().filter(tenant=tenant, employee=emp, date=date).first()
        if day is None:
            AttendanceDay.objects.create(tenant=tenant, employee=emp, date=date, updated_by=user, **values)
            saved += 1
            continue
        before = _snap(day)
        for k, v in values.items():
            setattr(day, k, v)
        after = _snap(day)
        if before == after and not any(getattr(day, k) != v for k, v in calc.items()):
            continue
        if day.locked:
            raise ValidationError(f'{emp.name}: اليوم ده اتحسب في مرتب اتعمد، ومينفعش يتعدل')
        day.updated_by = user
        day.save()
        if before != after:
            AttendanceEditLog.objects.create(tenant=tenant, day=day, user=user, before=before, after=after)
        saved += 1
    return saved


def week_roster(tenant, start):
    """ 7 days from start: who is off each day, with warnings (too many / too few days off, crowded day). """
    days = [start + datetime.timedelta(days=i) for i in range(7)]
    emps = list(Employee.objects.filter(tenant=tenant, is_active=True).order_by('name'))
    offs = set(OffDay.objects.filter(tenant=tenant, date__gte=days[0], date__lte=days[-1]).values_list('employee_id', 'date'))
    holidays = {h.date: h.name for h in PublicHoliday.objects.filter(tenant=tenant, date__gte=days[0], date__lte=days[-1])}
    per_day = defaultdict(int)
    rows, warnings = [], []
    for e in emps:
        marks = [_is_off(e, d, offs) for d in days]
        for d, m in zip(days, marks):
            if m:
                per_day[d] += 1
        cnt = sum(marks)
        if cnt != e.off_days_per_week:
            warnings.append(f'{e.name}: ليه {cnt} يوم إجازة في الأسبوع ده، والمفروض {e.off_days_per_week}')
        rows.append({'employee_id': str(e.id), 'name': e.name, 'off_days_per_week': e.off_days_per_week,
                     'fixed_off_weekday': e.fixed_off_weekday, 'off': marks})
    if emps:
        limit = max(1, len(emps) // 3)
        for d in days:
            if per_day[d] > limit:
                warnings.append(f'{d.isoformat()}: {per_day[d]} موظفين إجازة في نفس اليوم')
    return {'days': [d.isoformat() for d in days], 'holidays': {k.isoformat(): v for k, v in holidays.items()},
            'rows': rows, 'warnings': warnings}


def set_off_day(tenant, employee_id, date, off):
    emp = Employee.objects.get(tenant=tenant, pk=employee_id)
    if AttendanceDay.objects.filter(employee=emp, date=date, locked=True).exists():
        raise ValidationError('اليوم ده اتحسب في مرتب اتعمد')
    if off:
        OffDay.objects.get_or_create(tenant=tenant, employee=emp, date=date)
    else:
        OffDay.objects.filter(tenant=tenant, employee=emp, date=date).delete()


def attendance_report(tenant, date_from, date_to, employee_id=None):
    """ Per employee totals for a period + the days that were never entered (needed before payroll). """
    if date_to < date_from:
        raise ValidationError('تاريخ النهاية قبل البداية')
    emps = Employee.objects.filter(tenant=tenant)
    if employee_id:
        emps = emps.filter(pk=employee_id)
    else:
        emps = emps.filter(is_active=True)
    days = list(AttendanceDay.objects.filter(tenant=tenant, date__gte=date_from, date__lte=date_to, employee__in=emps))
    by_emp = defaultdict(list)
    for d in days:
        by_emp[d.employee_id].append(d)
    settings = StaffSettings.for_tenant(tenant).merged()
    grace = int(settings.get('grace_minutes') or 0)
    span = [date_from + datetime.timedelta(days=i) for i in range((date_to - date_from).days + 1)]
    out = []
    for e in emps.order_by('name'):
        ds = by_emp.get(e.id, [])
        st = defaultdict(int)
        for d in ds:
            st[d.status] += 1
        entered = {d.date for d in ds}
        first = max(date_from, e.hire_date) if e.hire_date else date_from
        missing = [d.isoformat() for d in span if d >= first and d not in entered and d <= datetime.date.today()]
        late_days = [d for d in ds if d.late_minutes > 0]
        out.append({
            'employee_id': str(e.id), 'name': e.name, 'job_title': e.job_title, 'pay_type': e.pay_type,
            'present': st[DayStatus.PRESENT], 'absent': st[DayStatus.ABSENT], 'leave_paid': st[DayStatus.LEAVE_PAID],
            'leave_unpaid': st[DayStatus.LEAVE_UNPAID], 'off': st[DayStatus.OFF], 'holiday': st[DayStatus.HOLIDAY],
            'worked_on_holiday': sum(1 for d in ds if d.status == DayStatus.PRESENT and d.is_holiday),
            'worked_on_off_day': sum(1 for d in ds if d.status == DayStatus.PRESENT and d.is_off_day),
            'late_days': len(late_days), 'late_minutes': sum(d.late_minutes for d in ds),
            'late_beyond_grace': sum(max(0, d.late_minutes - grace) for d in ds),
            'early_minutes': sum(d.early_minutes for d in ds), 'overtime_minutes': sum(d.overtime_minutes for d in ds),
            'worked_minutes': sum(d.worked_minutes for d in ds), 'missing_days': missing,
        })
    return {'from': date_from.isoformat(), 'to': date_to.isoformat(), 'grace_minutes': grace, 'rows': out}


# ---------------------------------------------------------------- phase 2: employee account
from decimal import Decimal  # noqa: E402

from .models import OWED_SIGN, PENDING_KINDS, EmployeeLedgerEntry, LedgerKind  # noqa: E402

PREFIX = {LedgerKind.ADVANCE: 'SADV', LedgerKind.DEDUCTION: 'SDED', LedgerKind.BONUS: 'SBON', LedgerKind.REPAYMENT: 'SREP'}
CREATABLE = tuple(PREFIX)          # GOODS and RECOVERY come from sales (phase 4) and payroll (phase 3)
CENT = Decimal('0.01')


def _money(v, name='المبلغ'):
    try:
        d = Decimal(str(v)).quantize(CENT)
    except Exception:
        raise ValidationError(f'{name} لازم يبقى رقم')
    return d


def _next_ledger_number(tenant, prefix):
    last = (EmployeeLedgerEntry.objects.select_for_update().filter(tenant=tenant, number__startswith=prefix + '-')
            .order_by('-number').values_list('number', flat=True).first())
    n = int(last.split('-')[-1]) + 1 if last else 1
    return f"{prefix}-{n:05d}"


def employee_balance(emp):
    """ -> (owed, pending_deductions, pending_bonuses). owed = what the employee owes the shop. """
    owed = pend_d = pend_b = Decimal('0.00')
    for kind, amount, settled in EmployeeLedgerEntry.objects.filter(employee=emp, cancelled=False).values_list('kind', 'amount', 'settled_run'):
        if kind in OWED_SIGN:
            owed += amount * OWED_SIGN[kind]
        elif kind == LedgerKind.DEDUCTION and not settled:
            pend_d += amount
        elif kind == LedgerKind.BONUS and not settled:
            pend_b += amount
    return owed, pend_d, pend_b


@transaction.atomic
def add_ledger_entry(tenant, emp, kind, amount, date, reason='', treasury=None, installment=None, user=None, approver=None):
    """ Advances leave the chosen treasury, repayments go into it; both post a journal entry.
    Deductions and bonuses wait for the next payroll. """
    from apps.treasury.models import TreasuryTransactionType
    from apps.treasury.services import record_treasury_transaction
    from apps.accounting.auto_journals import sync_staff_entry_journal
    if kind not in CREATABLE:
        raise ValidationError('نوع الحركة غلط')
    amount = _money(amount)
    if amount <= 0:
        raise ValidationError('المبلغ لازم يبقى أكبر من صفر')
    if date > datetime.date.today():
        raise ValidationError('مينفعش تسجل حركة بتاريخ لسه ماجاش')
    reason = (reason or '').strip()[:255]
    if kind in (LedgerKind.DEDUCTION, LedgerKind.BONUS) and not reason:
        raise ValidationError('اكتب سبب الخصم أو المكافأة')
    emp = Employee.objects.select_for_update().get(pk=emp.pk)
    if not emp.is_active and kind != LedgerKind.REPAYMENT:
        raise ValidationError('الموظف ده موقوف')
    if kind in (LedgerKind.ADVANCE, LedgerKind.REPAYMENT):
        if treasury is None:
            raise ValidationError('اختار الخزنة')
        if treasury.tenant_id != tenant.id:
            raise ValidationError('الخزنة مش تبع الشركة')
    else:
        treasury = None
    if kind == LedgerKind.ADVANCE and installment not in (None, ''):
        installment = _money(installment, 'القسط')
        if installment <= 0 or installment > amount:
            raise ValidationError('القسط لازم يبقى أكبر من صفر ومش أكبر من السلفة')
    else:
        installment = None
    if kind == LedgerKind.REPAYMENT:
        owed = employee_balance(emp)[0]
        if amount > owed:
            raise ValidationError(f'الموظف عليه {owed} بس، مينفعش يسدد أكتر من كده')
    entry = EmployeeLedgerEntry.objects.create(
        tenant=tenant, number=_next_ledger_number(tenant, PREFIX[kind]), employee=emp, kind=kind, date=date, amount=amount,
        installment=installment, treasury=treasury, reason=reason, created_by=user, approved_by=approver)
    if kind == LedgerKind.ADVANCE:
        try:
            record_treasury_transaction(treasury_id=treasury.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=amount,
                                        source_document_type='StaffAdvance', source_document_id=entry.number,
                                        description=f"سلفة {emp.name} {entry.number}")
        except ValidationError as e:
            if 'Insufficient' in ' '.join(e.messages):
                raise ValidationError(f'الخزنة «{treasury.name}» مفيهاش فلوس كفاية (رصيدها {treasury.current_balance})')
            raise
    elif kind == LedgerKind.REPAYMENT:
        record_treasury_transaction(treasury_id=treasury.id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=amount,
                                    source_document_type='StaffRepayment', source_document_id=entry.number,
                                    description=f"سداد {emp.name} {entry.number}")
    sync_staff_entry_journal(entry)
    return entry


@transaction.atomic
def cancel_ledger_entry(tenant, entry_id, reason, user=None):
    from django.utils import timezone
    from apps.treasury.models import TreasuryTransactionType
    from apps.treasury.services import record_treasury_transaction
    from apps.accounting.auto_journals import sync_staff_entry_journal
    e = EmployeeLedgerEntry.objects.select_for_update().select_related('employee', 'treasury').get(tenant=tenant, pk=entry_id)
    reason = (reason or '').strip()
    if not reason:
        raise ValidationError('اكتب سبب الإلغاء')
    if e.cancelled:
        raise ValidationError('الحركة دي ملغية قبل كده')
    if e.settled_run:
        raise ValidationError('الحركة دي اتحسبت في مرتب، مينفعش تتلغي')
    if e.kind not in CREATABLE:
        raise ValidationError('الحركة دي بتتلغي من مكانها الأصلي')
    if e.kind == LedgerKind.ADVANCE:
        owed_after = employee_balance(e.employee)[0] - e.amount
        if owed_after < 0:
            raise ValidationError('الموظف سدد جزء من السلفة دي. الغي السداد الأول')
        record_treasury_transaction(treasury_id=e.treasury_id, transaction_type=TreasuryTransactionType.DEPOSIT, amount=e.amount,
                                    source_document_type='StaffAdvanceCancel', source_document_id=e.number,
                                    description=f"إلغاء سلفة {e.employee.name} {e.number}")
    elif e.kind == LedgerKind.REPAYMENT:
        try:
            record_treasury_transaction(treasury_id=e.treasury_id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=e.amount,
                                        source_document_type='StaffRepaymentCancel', source_document_id=e.number,
                                        description=f"إلغاء سداد {e.employee.name} {e.number}")
        except ValidationError:
            raise ValidationError(f'الخزنة «{e.treasury.name}» مفيهاش فلوس كفاية علشان يرجع السداد')
    e.cancelled, e.cancel_reason, e.cancelled_by, e.cancelled_at = True, reason[:255], user, timezone.now()
    e.save(update_fields=['cancelled', 'cancel_reason', 'cancelled_by', 'cancelled_at', 'updated_at'])
    sync_staff_entry_journal(e)
    return e


def _entry_row(e):
    return {'id': str(e.id), 'number': e.number, 'date': e.date.isoformat(), 'kind': e.kind, 'kind_label': e.get_kind_display(),
            'amount': str(e.amount), 'installment': str(e.installment) if e.installment is not None else '',
            'treasury': getattr(e.treasury, 'name', '') or '', 'reason': e.reason,
            'by': getattr(e.created_by, 'username', '') or '', 'approved_by': getattr(e.approved_by, 'username', '') or '',
            'cancelled': e.cancelled, 'cancel_reason': e.cancel_reason, 'settled': bool(e.settled_run)}


def employee_statement(tenant, emp, date_from=None, date_to=None):
    """ Every movement with the running 'owes' balance; deductions/bonuses shown as waiting for payroll. """
    qs = EmployeeLedgerEntry.objects.filter(tenant=tenant, employee=emp).select_related('treasury', 'created_by', 'approved_by')
    opening = Decimal('0.00')
    if date_from:
        for k, a in qs.filter(date__lt=date_from, cancelled=False).values_list('kind', 'amount'):
            opening += a * OWED_SIGN.get(k, 0)
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)
    run, rows = opening, []
    for e in qs.order_by('date', 'created_at'):
        r = _entry_row(e)
        if not e.cancelled and e.kind in OWED_SIGN:
            run += e.amount * OWED_SIGN[e.kind]
        r['balance'] = str(run)
        rows.append(r)
    owed, pend_d, pend_b = employee_balance(emp)
    return {'employee_id': str(emp.id), 'name': emp.name, 'opening': str(opening), 'rows': rows,
            'owed': str(owed), 'pending_deductions': str(pend_d), 'pending_bonuses': str(pend_b)}


def balances(tenant):
    out = []
    for e in Employee.objects.filter(tenant=tenant).order_by('-is_active', 'name'):
        owed, pend_d, pend_b = employee_balance(e)
        if not e.is_active and owed == 0 and pend_d == 0 and pend_b == 0:
            continue
        out.append({'employee_id': str(e.id), 'name': e.name, 'job_title': e.job_title, 'is_active': e.is_active,
                    'owed': str(owed), 'pending_deductions': str(pend_d), 'pending_bonuses': str(pend_b)})
    return out
