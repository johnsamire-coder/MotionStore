import datetime
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenants.models import Tenant
from apps.tenants.context import set_current_tenant
from apps.users.models import User
from apps.staff.models import AttendanceDay, AttendanceEditLog, Employee, OffDay, PublicHoliday, StaffSettings
from apps.staff import services

T = datetime.time
D = datetime.date
PWD = 'Pass2026Password'


class StaffAttendanceTest(TestCase):

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Staff Co", slug="staff-co")
        set_current_tenant(self.tenant)
        self.emp = Employee.objects.create(tenant=self.tenant, name="منى", pay_type='MONTHLY', salary=Decimal('3000'),
                                           start_time=T(10, 0), end_time=T(18, 0), off_days_per_week=1)
        self.night = Employee.objects.create(tenant=self.tenant, name="حارس", pay_type='DAILY', salary=Decimal('150'),
                                             start_time=T(22, 0), end_time=T(6, 0), off_days_per_week=1)
        self.admin = User.objects.create_user(username="owner", password=PWD, role="ADMIN", tenant=self.tenant)
        self.manager = User.objects.create_user(username="mgr", password=PWD, role="MANAGER", tenant=self.tenant)
        self.cashier = User.objects.create_user(username="csh", password=PWD, role="CASHIER", tenant=self.tenant)
        self.day = D.today() - datetime.timedelta(days=1)

    def _client(self, user):
        c = APIClient(); c.force_authenticate(user=user); c.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))
        return c

    def _s(self, **kw):
        s = StaffSettings.for_tenant(self.tenant).merged(); s.update(kw); return s

    # ---- minute math
    def test_late_early_and_worked_minutes(self):
        r = services.compute_day(self.emp, 'PRESENT', T(10, 40), T(17, 30), self._s())
        self.assertEqual((r['late_minutes'], r['early_minutes'], r['worked_minutes'], r['overtime_minutes']), (40, 30, 410, 0))

    def test_early_arrival_is_not_lateness(self):
        r = services.compute_day(self.emp, 'PRESENT', T(9, 30), T(18, 0), self._s())
        self.assertEqual((r['late_minutes'], r['early_minutes']), (0, 0))

    def test_overtime_auto_respects_minimum_and_manual_mode(self):
        self.assertEqual(services.compute_day(self.emp, 'PRESENT', T(10, 0), T(19, 15), self._s(overtime_mode='AUTO'))['overtime_minutes'], 75)
        self.assertEqual(services.compute_day(self.emp, 'PRESENT', T(10, 0), T(18, 20), self._s(overtime_mode='AUTO'))['overtime_minutes'], 0)  # under 30
        self.assertEqual(services.compute_day(self.emp, 'PRESENT', T(10, 0), T(19, 15), self._s(overtime_mode='OFF'))['overtime_minutes'], 0)
        self.assertEqual(services.compute_day(self.emp, 'PRESENT', T(10, 0), T(18, 0), self._s(overtime_mode='MANUAL'), 45)['overtime_minutes'], 45)

    def test_night_shift_past_midnight(self):
        r = services.compute_day(self.night, 'PRESENT', T(22, 20), T(6, 30), self._s(overtime_mode='AUTO', overtime_min_minutes=0))
        self.assertEqual((r['late_minutes'], r['early_minutes'], r['worked_minutes'], r['overtime_minutes']), (20, 0, 490, 30))

    def test_present_needs_both_times(self):
        with self.assertRaises(ValidationError):
            services.compute_day(self.emp, 'PRESENT', T(10, 0), None, self._s())

    # ---- day sheet defaults
    def test_sheet_defaults_off_day_and_holiday(self):
        OffDay.objects.create(tenant=self.tenant, employee=self.emp, date=self.day)
        rows = {r['name']: r for r in services.day_sheet(self.tenant, self.day)['rows']}
        self.assertEqual(rows['منى']['status'], 'OFF')
        self.assertEqual(rows['حارس']['status'], '')                      # nothing entered = blank, not absent
        PublicHoliday.objects.create(tenant=self.tenant, date=self.day, name='عيد')
        sheet = services.day_sheet(self.tenant, self.day)
        self.assertEqual(sheet['holiday'], 'عيد')
        self.assertTrue(all(r['status'] == 'HOLIDAY' for r in sheet['rows']))

    def test_fixed_weekday_off(self):
        self.emp.fixed_off_weekday = self.day.weekday(); self.emp.save()
        rows = {r['name']: r for r in services.day_sheet(self.tenant, self.day)['rows']}
        self.assertEqual(rows['منى']['status'], 'OFF')

    # ---- saving
    def test_save_skips_blank_logs_edits_and_respects_lock(self):
        rows = [{'employee_id': str(self.emp.id), 'status': 'PRESENT', 'check_in': '10:40', 'check_out': '18:00'},
                {'employee_id': str(self.night.id), 'status': ''}]
        self.assertEqual(services.save_day(self.tenant, self.day, rows, self.manager), 1)
        d = AttendanceDay.objects.get(employee=self.emp, date=self.day)
        self.assertEqual(d.late_minutes, 40)
        self.assertFalse(AttendanceDay.objects.filter(employee=self.night).exists())
        services.save_day(self.tenant, self.day, rows, self.manager)        # same values: no edit log
        self.assertEqual(AttendanceEditLog.objects.count(), 0)
        rows[0]['check_in'] = '10:05'
        services.save_day(self.tenant, self.day, rows, self.manager)
        log = AttendanceEditLog.objects.get()
        self.assertEqual((log.before['check_in'], log.after['check_in']), ('10:40', '10:05'))
        AttendanceDay.objects.filter(pk=d.pk).update(locked=True)
        rows[0]['check_in'] = '11:00'
        with self.assertRaises(ValidationError):
            services.save_day(self.tenant, self.day, rows, self.manager)

    def test_non_present_clears_times_and_future_is_refused(self):
        services.save_day(self.tenant, self.day, [{'employee_id': str(self.emp.id), 'status': 'ABSENT', 'check_in': '10:00', 'check_out': '18:00'}])
        d = AttendanceDay.objects.get(employee=self.emp)
        self.assertEqual((d.check_in, d.worked_minutes), (None, 0))
        with self.assertRaises(ValidationError):
            services.save_day(self.tenant, D.today() + datetime.timedelta(days=1), [])

    # ---- roster & report
    def test_roster_warnings(self):
        start = self.day
        r = services.week_roster(self.tenant, start)
        self.assertEqual(len(r['warnings']), 2)                           # both have 0 of 1 days off
        services.set_off_day(self.tenant, self.emp.id, start, True)
        services.set_off_day(self.tenant, self.night.id, start, True)
        r = services.week_roster(self.tenant, start)
        self.assertTrue(any('نفس اليوم' in w for w in r['warnings']))      # 2 of 2 off the same day
        self.assertEqual([w for w in r['warnings'] if 'المفروض' in w], [])

    def test_report_totals_and_missing_days(self):
        d1, d2 = self.day - datetime.timedelta(days=1), self.day
        services.save_day(self.tenant, d1, [{'employee_id': str(self.emp.id), 'status': 'PRESENT', 'check_in': '10:30', 'check_out': '18:00'}])
        services.save_day(self.tenant, d2, [{'employee_id': str(self.emp.id), 'status': 'ABSENT'}])
        rep = {r['name']: r for r in services.attendance_report(self.tenant, d1, d2)['rows']}
        m = rep['منى']
        self.assertEqual((m['present'], m['absent'], m['late_minutes'], m['late_beyond_grace'], m['missing_days']), (1, 1, 30, 15, []))
        self.assertEqual(rep['حارس']['missing_days'], [d1.isoformat(), d2.isoformat()])

    # ---- API and permissions
    def test_api_flow_and_permissions(self):
        mgr = self._client(self.manager)
        r = mgr.post('/api/v1/staff/employees/', {'name': 'سعيد', 'pay_type': 'WEEKLY', 'salary': '900', 'start_time': '09:00', 'end_time': '17:00'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        r = mgr.post('/api/v1/staff/attendance/', {'date': self.day.isoformat(), 'rows': [
            {'employee_id': r.data['id'], 'status': 'PRESENT', 'check_in': '09:10', 'check_out': '17:00'}]}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(next(x for x in r.data['rows'] if x['name'] == 'سعيد')['late_minutes'], 10)
        self.assertEqual(mgr.get(f'/api/v1/staff/report/?from={self.day}&to={self.day}').status_code, 200)
        self.assertEqual(mgr.put('/api/v1/staff/settings/', {'settings': {'grace_minutes': 5}}, format='json').status_code, 403)
        self.assertEqual(mgr.post('/api/v1/staff/holidays/', {'date': self.day.isoformat(), 'name': 'x'}, format='json').status_code, 403)
        self.assertEqual(self._client(self.cashier).get('/api/v1/staff/employees/').status_code, 403)   # no /staff screen
        owner = self._client(self.admin)
        r = owner.put('/api/v1/staff/settings/', {'settings': {'grace_minutes': 5, 'overtime_mode': 'AUTO', 'late_mode': 'BAD'}}, format='json')
        self.assertEqual(r.status_code, 400)
        r = owner.put('/api/v1/staff/settings/', {'settings': {'grace_minutes': 5, 'overtime_mode': 'AUTO'}}, format='json')
        self.assertEqual((r.status_code, r.data['settings']['grace_minutes'], r.data['settings']['overtime_mode']), (200, 5, 'AUTO'))
        r = owner.put('/api/v1/staff/settings/', {'settings': {'holiday_paid': False, 'late_mode': 'TIERS', 'late_tiers': [{'up_to': '120', 'day_fraction': '0.5'}, {'up_to': '60', 'day_fraction': '0.25'}]}}, format='json')
        self.assertIs(r.data['settings']['holiday_paid'], False)
        self.assertEqual([t['up_to'] for t in r.data['settings']['late_tiers']], [60, 120])
        self.assertEqual(owner.post('/api/v1/staff/holidays/', {'date': self.day.isoformat(), 'name': 'عيد'}, format='json').status_code, 201)
        self.assertEqual(owner.post('/api/v1/staff/holidays/', {'date': self.day.isoformat(), 'name': 'تاني'}, format='json').status_code, 400)

    def test_employee_with_attendance_is_deactivated_not_deleted(self):
        services.save_day(self.tenant, self.day, [{'employee_id': str(self.emp.id), 'status': 'ABSENT'}])
        r = self._client(self.manager).delete(f'/api/v1/staff/employees/{self.emp.id}/')
        self.assertEqual(r.status_code, 200)
        self.emp.refresh_from_db()
        self.assertFalse(self.emp.is_active)

    def test_other_tenant_cannot_see_employees(self):
        other = Tenant.objects.create(name="Other", slug="other")
        boss = User.objects.create_user(username="otherboss", password=PWD, role="ADMIN", tenant=other)
        c = APIClient(); c.force_authenticate(user=boss); c.credentials(HTTP_X_TENANT_ID=str(other.id))
        self.assertEqual(c.get('/api/v1/staff/employees/').data, [])
