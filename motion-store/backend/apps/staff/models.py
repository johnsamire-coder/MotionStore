"""
Staff attendance (phase 1 of the staff & payroll plan, docs/STAFF_PAYROLL_PLAN.md).

The owner types each employee's in/out times by hand; late, early-leave and overtime minutes are
computed by services.compute_day(). Shops work 7 days with rotating days off (OffDay), and official
holidays (PublicHoliday) follow the tenant's StaffSettings. Only new tables: nothing existing changes.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.tenants.models import TenantAwareModel

# Every option the owner can choose (plan section 1). Stored as JSON so new options need no migration.
DEFAULT_SETTINGS = {
    'late_mode': 'PER_MINUTE',          # PER_MINUTE | TIERS | NONE
    'grace_minutes': 15,
    'late_tiers': [                     # used when late_mode == TIERS: up to N minutes -> fraction of a day
        {'up_to': 60, 'day_fraction': '0.25'},
        {'up_to': 120, 'day_fraction': '0.5'},
        {'up_to': 100000, 'day_fraction': '1'},
    ],
    'early_leave_mode': 'SAME_AS_LATE',  # SAME_AS_LATE | NONE
    'overtime_mode': 'OFF',             # OFF | AUTO | MANUAL
    'overtime_multiplier': '1',
    'overtime_min_minutes': 30,
    'absence_multiplier': '1',
    'month_days_basis': 'THIRTY',       # THIRTY | WORKING_DAYS
    'goods_price_mode': 'SALE_DISCOUNT',  # SALE | SALE_DISCOUNT | COST
    'goods_discount_pct': '20',
    'advance_mode': 'INSTALLMENT',      # ALL | INSTALLMENT
    'week_start': 5,                    # 0=Monday ... 5=Saturday
    'weekly_pay_day': 3,                # Thursday
    'holiday_paid': True,
    'holiday_work_mode': 'EXTRA_DAY',   # NORMAL | OVERTIME | EXTRA_DAY
    'holiday_work_multiplier': '1',
}


class StaffSettings(TenantAwareModel):
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "staff_settings"
        constraints = [models.UniqueConstraint(fields=["tenant"], name="unique_staff_settings_per_tenant")]

    def merged(self):
        out = dict(DEFAULT_SETTINGS)
        out.update({k: v for k, v in (self.data or {}).items() if k in DEFAULT_SETTINGS})
        return out

    @classmethod
    def for_tenant(cls, tenant):
        obj, _ = cls.objects.get_or_create(tenant=tenant, defaults={'data': {}})
        return obj


class PayType(models.TextChoices):
    MONTHLY = 'MONTHLY', 'شهري ثابت'
    WEEKLY = 'WEEKLY', 'أسبوعي ثابت'
    DAILY = 'DAILY', 'يومية'


class Employee(TenantAwareModel):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True, default='')
    job_title = models.CharField(max_length=100, blank=True, default='')
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    pay_type = models.CharField(max_length=10, choices=PayType.choices, default=PayType.MONTHLY)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'),
                                 help_text="Per month (MONTHLY), per week (WEEKLY) or per day (DAILY)")
    start_time = models.TimeField(help_text="Usual check-in time")
    end_time = models.TimeField(help_text="Usual check-out time (earlier than start = next day)")
    off_days_per_week = models.PositiveSmallIntegerField(default=1)
    fixed_off_weekday = models.PositiveSmallIntegerField(null=True, blank=True, help_text="0=Monday ... 6=Sunday; empty = rotating")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_profiles')
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = "staff_employees"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PublicHoliday(TenantAwareModel):
    date = models.DateField()
    name = models.CharField(max_length=150)

    class Meta:
        db_table = "staff_public_holidays"
        ordering = ["date"]
        constraints = [models.UniqueConstraint(fields=["tenant", "date"], name="unique_public_holiday_per_tenant")]


class OffDay(TenantAwareModel):
    """ One rotating day off of one employee (the weekly roster). """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='off_days')
    date = models.DateField()

    class Meta:
        db_table = "staff_off_days"
        constraints = [models.UniqueConstraint(fields=["employee", "date"], name="unique_off_day")]


class DayStatus(models.TextChoices):
    PRESENT = 'PRESENT', 'حاضر'
    ABSENT = 'ABSENT', 'غياب'
    LEAVE_PAID = 'LEAVE_PAID', 'إجازة بأجر'
    LEAVE_UNPAID = 'LEAVE_UNPAID', 'إجازة من غير أجر'
    OFF = 'OFF', 'إجازته'
    HOLIDAY = 'HOLIDAY', 'عطلة رسمية'


class AttendanceDay(TenantAwareModel):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='attendance_days')
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=15, choices=DayStatus.choices)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    late_minutes = models.PositiveIntegerField(default=0)
    early_minutes = models.PositiveIntegerField(default=0)
    overtime_minutes = models.PositiveIntegerField(default=0)
    worked_minutes = models.PositiveIntegerField(default=0)
    is_holiday = models.BooleanField(default=False)
    is_off_day = models.BooleanField(default=False)
    notes = models.CharField(max_length=255, blank=True, default='')
    locked = models.BooleanField(default=False, help_text="Set when an approved payroll used this day")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        db_table = "staff_attendance_days"
        ordering = ["date", "employee__name"]
        constraints = [models.UniqueConstraint(fields=["employee", "date"], name="unique_attendance_day")]


class AttendanceEditLog(TenantAwareModel):
    day = models.ForeignKey(AttendanceDay, on_delete=models.CASCADE, related_name='edit_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)

    class Meta:
        db_table = "staff_attendance_edit_logs"
        ordering = ["-created_at"]
