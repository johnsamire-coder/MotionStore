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


# ---------------------------------------------------------------- phase 3: payroll
from .models import PayrollCycle, PayrollLine, PayrollRun, PayrollStatus, PayType  # noqa: E402

ZERO2 = Decimal('0.00')
EDITABLE = ('absence_deduction', 'unpaid_leave_deduction', 'unpaid_holiday_deduction', 'late_deduction', 'early_deduction',
            'overtime_amount', 'holiday_extra', 'off_day_extra', 'bonuses', 'penalties', 'recovery_due')


def _r2(x):
    return Decimal(x).quantize(CENT)


def effective_days(tenant, emp, d_from, d_to):
    """ {date: (status, AttendanceDay|None)} for every day of the period the employee was employed.
    A day never entered is its rotating/fixed day off or official holiday when it is one, else MISSING. """
    first = max(d_from, emp.hire_date) if emp.hire_date else d_from
    saved = {d.date: d for d in AttendanceDay.objects.filter(employee=emp, date__gte=first, date__lte=d_to)}
    offs = set(OffDay.objects.filter(employee=emp, date__gte=first, date__lte=d_to).values_list('employee_id', 'date'))
    hols = set(PublicHoliday.objects.filter(tenant=tenant, date__gte=first, date__lte=d_to).values_list('date', flat=True))
    out, d = {}, first
    while d <= d_to:
        rec = saved.get(d)
        if rec:
            out[d] = (rec.status, rec)
        elif d in hols:
            out[d] = (DayStatus.HOLIDAY, None)
        elif _is_off(emp, d, offs):
            out[d] = (DayStatus.OFF, None)
        else:
            out[d] = ('MISSING', None)
        d += datetime.timedelta(days=1)
    return out


def _late_amount(minutes, s, day_rate, minute_rate):
    grace = int(s.get('grace_minutes') or 0)
    if minutes <= grace:
        return ZERO2
    mode = s.get('late_mode')
    if mode == 'PER_MINUTE':
        return _r2((minutes - grace) * minute_rate)
    if mode == 'TIERS':
        for t in sorted(s.get('late_tiers') or [], key=lambda x: int(x['up_to'])):
            if minutes <= int(t['up_to']):
                return _r2(day_rate * Decimal(str(t['day_fraction'])))
        tiers = s.get('late_tiers') or []
        return _r2(day_rate * Decimal(str(tiers[-1]['day_fraction']))) if tiers else ZERO2
    return ZERO2


def _recovery_plan(emp, up_to, mode):
    """ What the payroll may take back: each advance by its installment (all of it when mode ALL or no
    installment), goods/carried shortfalls in full. Repayments and earlier recoveries are applied oldest first. """
    debits, credit = [], Decimal('0')
    for e in EmployeeLedgerEntry.objects.filter(employee=emp, cancelled=False, date__lte=up_to).order_by('date', 'created_at'):
        sign = OWED_SIGN.get(e.kind)
        if sign == 1:
            debits.append([e, e.amount])
        elif sign == -1:
            credit += e.amount
    for item in debits:
        take = min(item[1], credit)
        item[1] -= take
        credit -= take
    due = Decimal('0')
    for e, remaining in debits:
        if remaining <= 0:
            continue
        if e.kind == LedgerKind.ADVANCE and mode == 'INSTALLMENT' and e.installment:
            due += min(remaining, e.installment)
        else:
            due += remaining
    return _r2(due)


def _calc_line(tenant, emp, run, s):
    """ Fills a PayrollLine (not saved) from attendance + ledger. Returns (line, missing_dates). """
    days = effective_days(tenant, emp, run.period_start, run.period_end)
    missing = [d.isoformat() for d, (st, _) in days.items() if st == 'MISSING']
    count = defaultdict(int)
    for st, _ in days.values():
        count[st] += 1
    period_days = (run.period_end - run.period_start).days + 1
    employed = len(days)
    sched = Decimal(schedule_minutes(emp))
    salary = emp.salary
    if emp.pay_type == PayType.MONTHLY:
        if s.get('month_days_basis') == 'WORKING_DAYS':
            work = max(1, period_days - count[DayStatus.OFF])
            day_rate = salary / Decimal(work)
        else:
            day_rate = salary / Decimal(30)
        base = salary if employed >= period_days else _r2(salary * employed / period_days)
    elif emp.pay_type == PayType.WEEKLY:
        day_rate = salary / Decimal(max(1, 7 - emp.off_days_per_week))
        base = _r2(salary * Decimal(period_days) / Decimal(7)) if employed >= period_days else _r2(salary * employed / Decimal(7))
    else:  # DAILY: paid only for the days worked or paid leave/holiday
        day_rate = salary
        paid_days = count[DayStatus.PRESENT] + count[DayStatus.LEAVE_PAID] + (count[DayStatus.HOLIDAY] if s.get('holiday_paid') else 0)
        base = _r2(salary * paid_days)
    minute_rate = day_rate / sched if sched else Decimal('0')
    absence_mult = Decimal(str(s.get('absence_multiplier') or 1))
    line = PayrollLine(tenant=tenant, run=run, employee=emp, pay_type=emp.pay_type, salary=salary,
                       day_rate=day_rate.quantize(Decimal('0.0001')), minute_rate=minute_rate.quantize(Decimal('0.000001')), base=base)
    if emp.pay_type == PayType.DAILY:
        line.absence_deduction = _r2(count[DayStatus.ABSENT] * day_rate * max(Decimal('0'), absence_mult - 1))
    else:
        line.absence_deduction = _r2(count[DayStatus.ABSENT] * day_rate * absence_mult)
        line.unpaid_leave_deduction = _r2(count[DayStatus.LEAVE_UNPAID] * day_rate)
        if not s.get('holiday_paid'):
            line.unpaid_holiday_deduction = _r2(count[DayStatus.HOLIDAY] * day_rate)
    late = early = ot = hol = offx = Decimal('0')
    o_mult = Decimal(str(s.get('off_day_work_multiplier') or 1))
    worked_hol = worked_off = 0
    ot_on = s.get('overtime_mode') in ('AUTO', 'MANUAL')
    ot_mult = Decimal(str(s.get('overtime_multiplier') or 1))
    h_mult = Decimal(str(s.get('holiday_work_multiplier') or 1))
    for d, (st, rec) in days.items():
        if st != DayStatus.PRESENT or rec is None:
            continue
        if not (rec.is_off_day or rec.is_holiday):   # coming in on a day off or a holiday is never 'late' or 'early'
            late += _late_amount(rec.late_minutes, s, day_rate, minute_rate)
            if s.get('early_leave_mode') == 'SAME_AS_LATE':
                early += _late_amount(rec.early_minutes, s, day_rate, minute_rate)
        if ot_on:
            ot += Decimal(rec.overtime_minutes) * minute_rate * ot_mult
        if rec.is_holiday:
            worked_hol += 1
            mode = s.get('holiday_work_mode')
            if mode == 'EXTRA_DAY':
                hol += day_rate * h_mult
            elif mode == 'OVERTIME':
                hol += Decimal(rec.worked_minutes) * minute_rate * h_mult
        if rec.is_off_day:
            worked_off += 1
            if not rec.is_holiday:      # a holiday that falls on his day off is paid by the holiday rule only
                omode = s.get('off_day_work_mode')
                if omode == 'EXTRA_DAY':
                    offx += day_rate * o_mult
                elif omode == 'OVERTIME':
                    offx += Decimal(rec.worked_minutes) * minute_rate * o_mult
    line.late_deduction, line.early_deduction = _r2(late), _r2(early)
    line.overtime_amount, line.holiday_extra, line.off_day_extra = _r2(ot), _r2(hol), _r2(offx)
    pend = EmployeeLedgerEntry.objects.filter(employee=emp, cancelled=False, settled_run='', date__lte=run.period_end)
    line.bonuses = _r2(sum((e.amount for e in pend if e.kind == LedgerKind.BONUS), Decimal('0')))
    line.penalties = _r2(sum((e.amount for e in pend if e.kind == LedgerKind.DEDUCTION), Decimal('0')))
    line.recovery_due = _recovery_plan(emp, run.period_end, s.get('advance_mode'))
    line.days = {**{k: v for k, v in count.items()}, 'employed': employed, 'period': period_days,
                 'worked_on_holiday': worked_hol, 'worked_on_off_day': worked_off}
    return line, missing


def finish_line(line):
    """ Applies hand-typed overrides and works out recovery, net and shortfall. """
    for k, v in (line.overrides or {}).items():
        if k in EDITABLE:
            setattr(line, k, _r2(Decimal(str(v))))
    earnings = (line.base - line.absence_deduction - line.unpaid_leave_deduction - line.unpaid_holiday_deduction
                - line.late_deduction - line.early_deduction + line.overtime_amount + line.holiday_extra + line.off_day_extra + line.bonuses + line.manual_adjust)
    before_recovery = earnings - line.penalties
    line.recovered = _r2(max(Decimal('0'), min(line.recovery_due, before_recovery)))
    line.net = _r2(max(Decimal('0'), before_recovery - line.recovered))
    line.shortfall = _r2(max(Decimal('0'), -before_recovery))
    return line


def earnings_of(line):
    return (line.base - line.absence_deduction - line.unpaid_leave_deduction - line.unpaid_holiday_deduction
            - line.late_deduction - line.early_deduction + line.overtime_amount + line.holiday_extra + line.off_day_extra + line.bonuses + line.manual_adjust)


def _next_run_number(tenant):
    last = PayrollRun.objects.select_for_update().filter(tenant=tenant).order_by('-number').values_list('number', flat=True).first()
    n = int(last.split('-')[-1]) + 1 if last else 1
    return f"PR-{n:05d}"


def _cycle_employees(tenant, cycle, d_from, d_to):
    types = [PayType.MONTHLY] if cycle == PayrollCycle.MONTHLY else [PayType.WEEKLY, PayType.DAILY]
    emps = Employee.objects.filter(tenant=tenant, pay_type__in=types).order_by('name')
    out = []
    for e in emps:
        if e.hire_date and e.hire_date > d_to:
            continue
        if not e.is_active and not AttendanceDay.objects.filter(employee=e, date__gte=d_from, date__lte=d_to).exists():
            continue
        out.append(e)
    return out


@transaction.atomic
def create_payroll(tenant, cycle, d_from, d_to, notes='', user=None):
    if cycle not in PayrollCycle.values:
        raise ValidationError('اختار نوع المسير')
    if d_to < d_from:
        raise ValidationError('تاريخ النهاية قبل البداية')
    if d_to > datetime.date.today():
        raise ValidationError('الفترة لسه ماخلصتش. اختار فترة آخرها النهارده أو قبل كده')
    if (d_to - d_from).days > 40:
        raise ValidationError('الفترة طويلة أوي (أكتر من 40 يوم)')
    s = StaffSettings.for_tenant(tenant).merged()
    emps = _cycle_employees(tenant, cycle, d_from, d_to)
    if not emps:
        raise ValidationError('مفيش موظفين على النوع ده من المرتبات')
    busy = PayrollLine.objects.filter(employee__in=emps, run__period_start__lte=d_to, run__period_end__gte=d_from).select_related('employee', 'run')
    if busy:
        x = busy[0]
        raise ValidationError(f'{x.employee.name} ليه مسير ({x.run.number}) في نفس الفترة. الغي المسودة دي الأول أو غيّر الفترة')
    run = PayrollRun.objects.create(tenant=tenant, number=_next_run_number(tenant), cycle=cycle, period_start=d_from, period_end=d_to,
                                    notes=(notes or '')[:255], created_by=user, settings_used=s)
    missing = {}
    for e in emps:
        line, miss = _calc_line(tenant, e, run, s)
        if miss:
            missing[e.name] = miss
            continue
        finish_line(line).save()
    if missing:
        transaction.set_rollback(True)
        txt = '\n'.join(f"{n}: {', '.join(m[:10])}{' …' if len(m) > 10 else ''}" for n, m in missing.items())
        raise ValidationError(f'فيه أيام حضور لسه ماتسجلتش. كمّلها من تبويب الحضور الأول:\n{txt}')
    return run


@transaction.atomic
def recalc_payroll(tenant, run_id):
    run = PayrollRun.objects.select_for_update().get(tenant=tenant, pk=run_id)
    if run.status != PayrollStatus.DRAFT:
        raise ValidationError('المسير اتعمد، مينفعش يتحسب تاني')
    s = StaffSettings.for_tenant(tenant).merged()
    run.settings_used = s
    run.save(update_fields=['settings_used', 'updated_at'])
    for old in list(run.lines.select_related('employee')):
        line, miss = _calc_line(tenant, old.employee, run, s)
        if miss:
            raise ValidationError(f'{old.employee.name}: فيه أيام ماتسجلتش: {", ".join(miss[:10])}')
        line.pk, line.id, line.created_at = old.pk, old.id, old.created_at
        line._state.adding = False
        line.overrides, line.manual_adjust, line.manual_note = old.overrides, old.manual_adjust, old.manual_note
        finish_line(line).save()
    return run


@transaction.atomic
def edit_line(tenant, line_id, changes, note=''):
    line = PayrollLine.objects.select_for_update().select_related('run').get(tenant=tenant, pk=line_id)
    if line.run.status != PayrollStatus.DRAFT:
        raise ValidationError('المسير اتعمد، مينفعش يتعدل')
    ov = dict(line.overrides or {})
    for k, v in (changes or {}).items():
        if k == 'manual_adjust':
            line.manual_adjust = _money(v or 0, 'التسوية')
        elif k in EDITABLE:
            if v in (None, ''):
                ov.pop(k, None)
            else:
                d = _money(v)
                if d < 0:
                    raise ValidationError('المبالغ مينفعش تبقى بالسالب (استعمل التسوية)')
                ov[k] = str(d)
    if (line.manual_adjust != 0 or ov) and not (note or line.manual_note).strip():
        raise ValidationError('اكتب سبب التعديل')
    line.manual_note = (note or line.manual_note)[:255]
    line.overrides = ov
    # restore computed values before re-applying overrides
    fresh, _ = _calc_line(tenant, line.employee, line.run, line.run.settings_used or StaffSettings.for_tenant(tenant).merged())
    for k in EDITABLE:
        setattr(line, k, getattr(fresh, k))
    finish_line(line).save()
    return line


@transaction.atomic
def delete_draft(tenant, run_id):
    run = PayrollRun.objects.select_for_update().get(tenant=tenant, pk=run_id)
    if run.status != PayrollStatus.DRAFT:
        raise ValidationError('المسير اتعمد، مينفعش يتلغي')
    run.delete()


@transaction.atomic
def approve_payroll(tenant, run_id, user=None):
    """ Locks the attendance days, settles the bonuses/deductions, takes back advances/goods (RECOVERY),
    keeps any shortfall for next time (CARRY) and posts the payroll entry. """
    from django.utils import timezone
    from apps.accounting.auto_journals import post_payroll_journal
    run = PayrollRun.objects.select_for_update().get(tenant=tenant, pk=run_id)
    if run.status != PayrollStatus.DRAFT:
        raise ValidationError('المسير ده اتعمد قبل كده')
    lines = list(run.lines.select_related('employee'))
    if not lines:
        raise ValidationError('المسير فاضي')
    s = run.settings_used or StaffSettings.for_tenant(tenant).merged()
    for line in lines:
        emp = line.employee
        # numbers must still match the attendance and the account as they are now
        fresh, miss = _calc_line(tenant, emp, run, s)
        if miss:
            raise ValidationError(f'{emp.name}: فيه أيام ماتسجلتش')
        for k in EDITABLE:
            setattr(line, k, getattr(fresh, k))
        finish_line(line).save()
        AttendanceDay.objects.filter(employee=emp, date__gte=run.period_start, date__lte=run.period_end).update(locked=True)
        EmployeeLedgerEntry.objects.filter(employee=emp, cancelled=False, settled_run='', date__lte=run.period_end,
                                           kind__in=PENDING_KINDS).update(settled_run=str(run.id))
        if line.recovered > 0:
            EmployeeLedgerEntry.objects.create(tenant=tenant, number=_next_ledger_number(tenant, 'SREC'), employee=emp, kind=LedgerKind.RECOVERY,
                                               date=run.period_end, amount=line.recovered, reason=f'اتخصم من مرتب {run.number}',
                                               created_by=user, approved_by=user, settled_run=str(run.id))
        if line.shortfall > 0:
            EmployeeLedgerEntry.objects.create(tenant=tenant, number=_next_ledger_number(tenant, 'SCAR'), employee=emp, kind=LedgerKind.CARRY,
                                               date=run.period_end, amount=line.shortfall, reason=f'عجز مرتب {run.number} مرحّل للمسير الجاي',
                                               created_by=user, approved_by=user, settled_run=str(run.id))
    run.status, run.approved_by, run.approved_at = PayrollStatus.APPROVED, user, timezone.now()
    run.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
    post_payroll_journal(run)
    return run


@transaction.atomic
def pay_payroll(tenant, run_id, treasury, line_ids=None, user=None):
    """ Pays the net of the chosen lines (all unpaid when none given) from one treasury. """
    from django.utils import timezone
    from apps.treasury.models import TreasuryTransactionType
    from apps.treasury.services import record_treasury_transaction
    from apps.accounting.auto_journals import post_payroll_payment_journal
    run = PayrollRun.objects.select_for_update().get(tenant=tenant, pk=run_id)
    if run.status == PayrollStatus.DRAFT:
        raise ValidationError('اعتمد المسير الأول')
    if treasury is None or treasury.tenant_id != tenant.id:
        raise ValidationError('اختار الخزنة')
    qs = run.lines.select_for_update().select_related('employee').filter(paid_at__isnull=True, net__gt=0)
    if line_ids:
        qs = qs.filter(pk__in=line_ids)
    lines = list(qs)
    if not lines:
        raise ValidationError('مفيش مرتبات لسه ماتصرفتش')
    total = sum((l.net for l in lines), Decimal('0'))
    try:
        record_treasury_transaction(treasury_id=treasury.id, transaction_type=TreasuryTransactionType.WITHDRAWAL, amount=total,
                                    source_document_type='Payroll', source_document_id=run.number,
                                    description=f"صرف مرتبات {run.number} ({len(lines)} موظف)")
    except ValidationError as e:
        if 'Insufficient' in ' '.join(e.messages):
            raise ValidationError(f'الخزنة «{treasury.name}» مفيهاش فلوس كفاية: المطلوب {total} ورصيدها {treasury.current_balance}')
        raise
    now = timezone.now()
    for l in lines:
        l.paid_amount, l.paid_at, l.paid_treasury, l.paid_by = l.net, now, treasury, user
        l.save(update_fields=['paid_amount', 'paid_at', 'paid_treasury', 'paid_by', 'updated_at'])
    post_payroll_payment_journal(run, total, now.date(), f"{run.number}-{now.strftime('%H%M%S')}")
    if not run.lines.filter(paid_at__isnull=True, net__gt=0).exists():
        run.status = PayrollStatus.PAID
        run.save(update_fields=['status', 'updated_at'])
    return run, total


def _line_row(l):
    return {'id': str(l.id), 'employee_id': str(l.employee_id), 'name': l.employee.name, 'job_title': l.employee.job_title,
            'pay_type': l.pay_type, 'salary': str(l.salary), 'day_rate': str(_r2(l.day_rate)), 'days': l.days,
            **{k: str(getattr(l, k)) for k in ('base', 'absence_deduction', 'unpaid_leave_deduction', 'unpaid_holiday_deduction', 'late_deduction',
                                              'early_deduction', 'overtime_amount', 'holiday_extra', 'off_day_extra', 'bonuses', 'penalties', 'manual_adjust',
                                              'recovery_due', 'recovered', 'net', 'shortfall', 'paid_amount')},
            'earnings': str(_r2(earnings_of(l))), 'manual_note': l.manual_note, 'overrides': l.overrides,
            'paid': l.paid_at is not None, 'paid_at': l.paid_at.isoformat() if l.paid_at else '',
            'paid_treasury': getattr(l.paid_treasury, 'name', '') or ''}


def payroll_detail(tenant, run_id):
    run = PayrollRun.objects.get(tenant=tenant, pk=run_id)
    lines = list(run.lines.select_related('employee', 'paid_treasury'))
    tot = lambda k: str(_r2(sum((getattr(l, k) for l in lines), Decimal('0'))))
    return {'id': str(run.id), 'number': run.number, 'cycle': run.cycle, 'cycle_label': run.get_cycle_display(), 'status': run.status,
            'status_label': run.get_status_display(), 'period_start': run.period_start.isoformat(), 'period_end': run.period_end.isoformat(),
            'notes': run.notes, 'approved_by': getattr(run.approved_by, 'username', '') or '', 'approved_at': run.approved_at.isoformat() if run.approved_at else '',
            'lines': [_line_row(l) for l in lines],
            'totals': {k: tot(k) for k in ('base', 'bonuses', 'penalties', 'recovered', 'net', 'shortfall', 'paid_amount', 'overtime_amount',
                                           'absence_deduction', 'late_deduction', 'early_deduction')},
            'unpaid': str(_r2(sum((l.net for l in lines if l.paid_at is None), Decimal('0'))))}


def payroll_list(tenant):
    out = []
    for r in PayrollRun.objects.filter(tenant=tenant).order_by('-period_end', '-created_at')[:100]:
        agg = r.lines.aggregate(n=models_Sum('net'), c=models_Count('id'))
        out.append({'id': str(r.id), 'number': r.number, 'cycle_label': r.get_cycle_display(), 'status': r.status, 'status_label': r.get_status_display(),
                    'period_start': r.period_start.isoformat(), 'period_end': r.period_end.isoformat(), 'employees': agg['c'] or 0,
                    'net': str(agg['n'] or ZERO2)})
    return out


from django.db.models import Count as models_Count, Sum as models_Sum  # noqa: E402
