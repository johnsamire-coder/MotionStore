"""
Payroll (phase 3) and goods on the employee account (phase 4), with numbers worked out by hand.

Monthly employee: 3000 / month, 10:00-18:00 (480 min), day rate 3000/30 = 100, minute rate 100/480.
"""
import calendar
import datetime
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db.models import Sum
from rest_framework.test import APIClient

from apps.users.models import User
from apps.treasury.models import Treasury, TreasuryType
from apps.payments.models import PaymentMethod
from apps.accounting.models import JournalEntry, JournalEntryLine
from apps.staff.models import (AttendanceDay, Employee, EmployeeLedgerEntry, PayrollRun, PublicHoliday, StaffSettings)
from apps.staff import services
from apps.shifts.services import open_shift
from apps.sales.services import process_pos_sale
from apps.returns.services import process_sales_return_v2
from tests.test_stock_bands_refresh import StockBandsFollowSalesTest

T = datetime.time
D = Decimal
PWD = 'Pass2026Password'


def last_month():
    first_this = datetime.date.today().replace(day=1)
    end = first_this - datetime.timedelta(days=1)
    return end.replace(day=1), end


class PayrollTest(StockBandsFollowSalesTest):

    def setUp(self):
        super().setUp()
        self.safe = Treasury.objects.create(tenant=self.tenant, name="الخزنة", branch=self.branch, treasury_type=TreasuryType.MAIN_SAFE,
                                            current_balance=D('20000'))
        self.emp = Employee.objects.create(tenant=self.tenant, name="منى", pay_type='MONTHLY', salary=D('3000'),
                                           start_time=T(10), end_time=T(18), off_days_per_week=1)
        self.boss = User.objects.create_user(username="boss9", password=PWD, role="ADMIN", tenant=self.tenant)
        self.acc = User.objects.create_user(username="acc9", password='AccPass2026x', role="ACCOUNTANT", tenant=self.tenant)
        self.start, self.end = last_month()

    # ---- helpers
    def _settings(self, **kw):
        s = StaffSettings.for_tenant(self.tenant); s.data = {**(s.data or {}), **kw}; s.save()

    def _fill(self, emp, start, end, special=None):
        """ Every day present on schedule, except the special ones {date: row}. """
        special = special or {}
        d = start
        while d <= end:
            row = special.get(d) or {'status': 'PRESENT', 'check_in': emp.start_time.strftime('%H:%M'), 'check_out': emp.end_time.strftime('%H:%M')}
            services.save_day(self.tenant, d, [{'employee_id': str(emp.id), **row}])
            d += datetime.timedelta(days=1)

    def _d(self, n):
        return self.start + datetime.timedelta(days=n)

    def _net(self, code):
        a = JournalEntryLine.objects.filter(tenant=self.tenant, account__code=code).aggregate(d=Sum('debit'), c=Sum('credit'))
        return (a['d'] or D('0')) - (a['c'] or D('0'))

    def _balanced(self):
        for je in JournalEntry.objects.filter(tenant=self.tenant):
            a = JournalEntryLine.objects.filter(journal_entry=je).aggregate(d=Sum('debit'), c=Sum('credit'))
            self.assertEqual(a['d'], a['c'], je.entry_number)

    def _c(self, user, unlock=True):
        c = APIClient(); c.force_authenticate(user=user); c.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))
        if unlock:  # SALARY_LOCK: open the salaries with the manager password, like the screen does
            r = c.post('/api/v1/staff-payroll/unlock/', {'password': PWD}, format='json')
            if r.status_code == 200:
                c.credentials(HTTP_X_TENANT_ID=str(self.tenant.id), HTTP_X_SALARY_TOKEN=r.data['token'])
        return c

    # ---- the main monthly story
    def test_monthly_payroll_end_to_end(self):
        self._fill(self.emp, self.start, self.end, {
            self._d(1): {'status': 'PRESENT', 'check_in': '10:45', 'check_out': '18:00'},   # 45 late -> 30 after grace -> 6.25
            self._d(2): {'status': 'ABSENT'},                                                # -100
            self._d(3): {'status': 'OFF'},
            self._d(4): {'status': 'LEAVE_UNPAID'},                                          # -100
        })
        services.add_ledger_entry(self.tenant, self.emp, 'ADVANCE', '600', self._d(5), '', self.safe, '200', self.boss, self.boss)
        services.add_ledger_entry(self.tenant, self.emp, 'BONUS', '150', self._d(6), 'تارجت', None, None, self.boss, self.boss)
        services.add_ledger_entry(self.tenant, self.emp, 'DEDUCTION', '50', self._d(6), 'كسر', None, None, self.boss, self.boss)

        r = self._c(self.boss).post('/api/v1/staff-payroll/', {'cycle': 'MONTHLY', 'from': self.start.isoformat(), 'to': self.end.isoformat()}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        line = r.data['lines'][0]
        expect = {'base': '3000.00', 'absence_deduction': '100.00', 'unpaid_leave_deduction': '100.00', 'late_deduction': '6.25',
                  'bonuses': '150.00', 'penalties': '50.00', 'recovery_due': '200.00', 'recovered': '200.00', 'earnings': '2943.75', 'net': '2693.75'}
        self.assertEqual({k: line[k] for k in expect}, expect)
        run_id = r.data['id']

        # accountant cannot approve without a manager password
        self.assertEqual(self._c(self.acc).post(f'/api/v1/staff-payroll/{run_id}/approve/', {}, format='json').status_code, 403)
        r = self._c(self.boss).post(f'/api/v1/staff-payroll/{run_id}/approve/', {}, format='json')
        self.assertEqual((r.status_code, r.data['status']), (200, 'APPROVED'))
        owed, pd, pb = services.employee_balance(self.emp)
        self.assertEqual((owed, pd, pb), (D('400.00'), D('0'), D('0')))
        self.assertTrue(AttendanceDay.objects.filter(employee=self.emp, locked=False).count() == 0)
        with self.assertRaises(ValidationError):
            services.save_day(self.tenant, self._d(1), [{'employee_id': str(self.emp.id), 'status': 'ABSENT'}])
        self.assertEqual(self._c(self.boss).delete(f'/api/v1/staff-payroll/{run_id}/').status_code, 400)
        # books: Dr 5110 2943.75 / Cr 4030 50, Cr 1060 200, Cr 2030 2693.75 (advance earlier: Dr 1060 600 / Cr 1030 600)
        self.assertEqual((self._net('5110'), self._net('4030'), self._net('2030'), self._net('1060')),
                         (D('2943.75'), D('-50.00'), D('-2693.75'), D('400.00')))

        r = self._c(self.boss).post(f'/api/v1/staff-payroll/{run_id}/pay/', {'treasury_id': str(self.safe.id)}, format='json')
        self.assertEqual((r.status_code, r.data['paid_now'], r.data['status']), (200, '2693.75', 'PAID'))
        self.safe.refresh_from_db()
        self.assertEqual(self.safe.current_balance, D('20000') - D('600') - D('2693.75'))
        self.assertEqual((self._net('2030'), self._net('1030')), (D('0'), D('-3293.75')))
        self.assertEqual(self._c(self.boss).post(f'/api/v1/staff-payroll/{run_id}/pay/', {'treasury_id': str(self.safe.id)}, format='json').status_code, 400)
        self._balanced()

    def test_missing_days_and_overlap_block_the_run(self):
        self._fill(self.emp, self.start, self._d(9))       # the rest of the month never entered
        with self.assertRaises(ValidationError) as cm:
            services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end)
        self.assertIn('منى', cm.exception.messages[0])
        self.assertFalse(PayrollRun.objects.exists())
        self._fill(self.emp, self._d(10), self.end)
        services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end)
        with self.assertRaises(ValidationError):
            services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end)

    def test_off_days_and_holidays_count_without_typing(self):
        PublicHoliday.objects.create(tenant=self.tenant, date=self._d(0), name='عيد')
        self.emp.fixed_off_weekday = self._d(1).weekday(); self.emp.save()
        d = self.start
        while d <= self.end:
            if d != self._d(0) and d.weekday() != self.emp.fixed_off_weekday:
                services.save_day(self.tenant, d, [{'employee_id': str(self.emp.id), 'status': 'PRESENT', 'check_in': '10:00', 'check_out': '18:00'}])
            d += datetime.timedelta(days=1)
        run = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end)
        self.assertEqual(run.lines.get().net, D('3000.00'))

    def test_tiers_overtime_and_holiday_work(self):
        self._settings(late_mode='TIERS', late_tiers=[{'up_to': 60, 'day_fraction': '0.25'}, {'up_to': 100000, 'day_fraction': '1'}],
                       overtime_mode='AUTO', overtime_multiplier='1.5', holiday_work_mode='EXTRA_DAY')
        PublicHoliday.objects.create(tenant=self.tenant, date=self._d(5), name='عيد')
        self._fill(self.emp, self.start, self.end, {
            self._d(1): {'status': 'PRESENT', 'check_in': '10:45', 'check_out': '18:00'},   # tier 0.25 day = 25
            self._d(2): {'status': 'PRESENT', 'check_in': '10:00', 'check_out': '19:00'},   # 60 min x 100/480 x 1.5 = 18.75
            self._d(5): {'status': 'PRESENT', 'check_in': '10:00', 'check_out': '18:00'},   # worked on holiday: +1 day = 100
        })
        line = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end).lines.get()
        self.assertEqual((line.late_deduction, line.overtime_amount, line.holiday_extra, line.net),
                         (D('25.00'), D('18.75'), D('100.00'), D('3093.75')))

    def test_daily_worker_weekly_run(self):
        w = Employee.objects.create(tenant=self.tenant, name="سعيد", pay_type='DAILY', salary=D('150'), start_time=T(9), end_time=T(17))
        s = self.start
        self._fill(w, s, s + datetime.timedelta(days=6), {s + datetime.timedelta(days=2): {'status': 'ABSENT'}, s + datetime.timedelta(days=3): {'status': 'OFF'}})
        line = services.create_payroll(self.tenant, 'WEEKLY', s, s + datetime.timedelta(days=6)).lines.get()
        self.assertEqual((line.base, line.absence_deduction, line.net), (D('750.00'), D('0.00'), D('750.00')))

    def test_shortfall_is_carried_to_next_payroll(self):
        self._fill(self.emp, self.start, self.end)
        services.add_ledger_entry(self.tenant, self.emp, 'DEDUCTION', '3500', self._d(3), 'عجز بضاعة', None, None, self.boss, self.boss)
        run = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end)
        line = run.lines.get()
        self.assertEqual((line.net, line.shortfall), (D('0.00'), D('500.00')))
        services.approve_payroll(self.tenant, run.id, self.boss)
        self.assertEqual(services.employee_balance(self.emp)[0], D('500.00'))
        self.assertEqual(self._net('1060'), D('500.00'))
        self._balanced()
        # next month the 500 is taken back first
        nxt_s = self.end + datetime.timedelta(days=1)
        nxt_e = min(datetime.date.today(), nxt_s + datetime.timedelta(days=6))
        self._fill(self.emp, nxt_s, nxt_e)
        line2 = services.create_payroll(self.tenant, 'MONTHLY', nxt_s, nxt_e).lines.get()
        self.assertEqual(line2.recovery_due, D('500.00'))

    def test_edit_line_needs_reason_and_keeps_overrides(self):
        self._fill(self.emp, self.start, self.end, {self._d(1): {'status': 'ABSENT'}})
        run = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end)
        line = run.lines.get()
        with self.assertRaises(ValidationError):
            services.edit_line(self.tenant, line.id, {'absence_deduction': '0'})
        services.edit_line(self.tenant, line.id, {'absence_deduction': '0', 'manual_adjust': '-25'}, 'سامحناه في الغياب')
        line.refresh_from_db()
        self.assertEqual((line.absence_deduction, line.manual_adjust, line.net), (D('0.00'), D('-25.00'), D('2975.00')))
        services.recalc_payroll(self.tenant, run.id)
        line.refresh_from_db()
        self.assertEqual(line.net, D('2975.00'))

    # ---- phase 4: goods on the employee account
    def _employee_sale(self, mode, pct='20'):
        self._settings(goods_price_mode=mode, goods_discount_pct=pct)
        si = self._stock(self.shop, 10, 5)                     # avg cost 10 / kg
        pm = PaymentMethod.objects.create(tenant=self.tenant, name='على حساب موظف', method_type='EMPLOYEE')
        shift = open_shift(self.terminal.id, self.user, D('500.00'))
        inv = process_pos_sale(shift_id=shift.id, cashier=self.user, employee=self.emp,
                               items_data=[{'stock_item_id': si.id, 'weight_kg': '1.000', 'quantity_pieces': 2, 'unit_price': D('100.00'), 'price_mode': 'KG'}],
                               payments_data=[{'payment_method_id': pm.id, 'amount': '100.00'}])
        return inv, shift, pm

    def test_goods_price_modes(self):
        inv, shift, _ = self._employee_sale('SALE_DISCOUNT', '20')
        self.assertEqual((inv.subtotal, inv.discount_amount, inv.total_amount), (D('100.00'), D('20.00'), D('80.00')))
        g = EmployeeLedgerEntry.objects.get(kind='GOODS')
        self.assertEqual((g.employee, g.amount), (self.emp, D('80.00')))
        self.drawer.refresh_from_db()
        self.assertEqual(self.drawer.current_balance, D('500.00'))          # nothing went into the drawer
        self.assertEqual(self._net('1060'), D('80.00'))
        self._balanced()

    def test_goods_at_cost_then_payroll_takes_it_back_and_return_gives_it_back(self):
        inv, shift, pm = self._employee_sale('COST')
        self.assertEqual(inv.total_amount, D('10.00'))
        ret = process_sales_return_v2(inv.id, shift.id, self.user, [{'sale_line_id': inv.lines.first().id, 'weight_kg': '0.5', 'quantity_pieces': 1}])
        self.assertEqual(ret.total_refund_amount, D('5.00'))
        self.assertEqual(services.employee_balance(self.emp)[0], D('5.00'))
        self.assertEqual(self._net('1060'), D('5.00'))
        self.drawer.refresh_from_db(); self.assertEqual(self.drawer.current_balance, D('500.00'))
        self._balanced()

    def test_goods_stay_out_of_the_shift_sales(self):
        from apps.api.views import ShiftViewSet
        inv, shift, pm = self._employee_sale('SALE')
        process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=[{'stock_item_id': inv.lines.first().stock_item_id, 'weight_kg': '1.000', 'quantity_pieces': 1,
                         'unit_price': D('100.00'), 'price_mode': 'KG'}], payments_data=[{'payment_method': self.pm_cash, 'amount': '100.00'}])
        process_sales_return_v2(inv.id, shift.id, self.user, [{'sale_line_id': inv.lines.first().id, 'weight_kg': '0.5', 'quantity_pieces': 1}])
        s = ShiftViewSet()._summary(shift)
        self.assertEqual((s['invoices'], D(s['sales_total'])), (1, D('100.00')))
        self.assertEqual([m['method'] for m in s['by_method']], [self.pm_cash.name])
        self.assertEqual(s['returns_by_method'], [])
        self.assertEqual((s['employee_count'], D(s['employee_total']), D(s['employee_returns_total'])), (1, D('100.00'), D('50.00')))
        self.assertEqual(s['employee_orders'][0]['name'], self.emp.name)
        self.assertEqual(D(s['expected']), D('600.00'))

    def test_goods_rules(self):
        self._settings(goods_price_mode='SALE')
        si = self._stock(self.shop, 10, 5)
        pm = PaymentMethod.objects.create(tenant=self.tenant, name='على حساب موظف', method_type='EMPLOYEE')
        shift = open_shift(self.terminal.id, self.user, D('500.00'))
        item = [{'stock_item_id': si.id, 'weight_kg': '1.000', 'quantity_pieces': 1, 'unit_price': D('100.00'), 'price_mode': 'KG'}]
        with self.assertRaises(ValidationError):   # no employee chosen
            process_pos_sale(shift_id=shift.id, cashier=self.user, items_data=item, payments_data=[{'payment_method_id': pm.id, 'amount': '100'}])
        with self.assertRaises(ValidationError):   # mixed with cash
            process_pos_sale(shift_id=shift.id, cashier=self.user, employee=self.emp, items_data=item,
                             payments_data=[{'payment_method_id': pm.id, 'amount': '50'}, {'payment_method': self.pm_cash, 'amount': '50'}])
        inv = process_pos_sale(shift_id=shift.id, cashier=self.user, employee=self.emp, items_data=item, payments_data=[{'payment_method_id': pm.id, 'amount': '100'}])
        self.assertEqual(inv.total_amount, D('100.00'))
        r = self._c(self.boss).post(f'/api/v1/sales/{inv.id}/delete_sale/', {'manager_password': PWD}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cashier_gets_goods_setup(self):
        r = self._c(self.user).get('/api/v1/staff-goods/setup/')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['employees'][0]['name'], 'منى')
        self.assertTrue(PaymentMethod.objects.filter(tenant=self.tenant, method_type='EMPLOYEE').exists())
        self.assertEqual(self._c(self.user).get('/api/v1/staff-payroll/').status_code, 403)

    def test_checkout_api_with_employee(self):
        from apps.pricing.models import WeightPrice
        self._settings(goods_price_mode='SALE_DISCOUNT', goods_discount_pct='20')
        si = self._stock(self.shop, 10, 5)
        WeightPrice.objects.create(tenant=self.tenant, kind='BALE', key='', grade=si.grade, price_per_kg=D('100'))
        setup = self._c(self.user).get('/api/v1/staff-goods/setup/').data
        shift = open_shift(self.terminal.id, self.user, D('500.00'))
        body = {'shift_id': str(shift.id), 'employee_id': setup['employees'][0]['id'],
                'items': [{'stock_item_id': str(si.id), 'weight_kg': '1.000000', 'quantity_pieces': 0, 'unit_price': '100.00', 'price_mode': 'KG'}],
                'payments': [{'payment_method_id': setup['payment_method_id'], 'amount': '100.00'}], 'discount_amount': '0.00',
                'delivery_fee': '0.00', 'previous_balance': '0.00', 'applied_offers': [], 'coupon_code': ''}
        r = self._c(self.user).post('/api/v1/sales/checkout/', body, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((D(r.data['total_amount']), D(r.data['discount_amount'])), (D('80.00'), D('20.00')))
        self.assertEqual(services.employee_balance(self.emp)[0], D('80.00'))
        r = self._c(self.user).post('/api/v1/sales/checkout/', {**body, 'employee_id': '00000000-0000-0000-0000-000000000000'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_work_on_day_off_option(self):
        from apps.staff.models import OffDay
        OffDay.objects.create(tenant=self.tenant, employee=self.emp, date=self._d(4))
        self._fill(self.emp, self.start, self.end, {self._d(4): {'status': 'PRESENT', 'check_in': '10:00', 'check_out': '14:00'}})  # 4h on his day off
        line = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end).lines.get()
        self.assertEqual((line.off_day_extra, line.net, line.days['worked_on_off_day']), (D('0.00'), D('3000.00'), 1))   # default: normal day
        PayrollRun.objects.all().delete()
        self._settings(off_day_work_mode='EXTRA_DAY', off_day_work_multiplier='1.5')
        line = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end).lines.get()
        self.assertEqual((line.off_day_extra, line.net), (D('150.00'), D('3150.00')))          # 100 x 1.5
        PayrollRun.objects.all().delete()
        self._settings(off_day_work_mode='OVERTIME', off_day_work_multiplier='2')
        line = services.create_payroll(self.tenant, 'MONTHLY', self.start, self.end).lines.get()
        self.assertEqual(line.off_day_extra, D('100.00'))                                        # 240 min x 100/480 x 2
        r = self._c(self.boss).put('/api/v1/staff/settings/', {'settings': {'off_day_work_mode': 'BAD'}}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_salaries_are_locked_until_a_manager_password(self):
        from django.core import signing
        from apps.staff.views import SALARY_SALT
        locked = self._c(self.boss, unlock=False)
        r = locked.get('/api/v1/staff-payroll/')
        self.assertEqual((r.status_code, r.data.get('salary_locked')), (403, True))
        self.assertIsNone(locked.get('/api/v1/staff/employees/').data[0]['salary'])           # hidden in the employees list
        self.assertEqual(locked.post('/api/v1/staff-payroll/unlock/', {'password': 'wrong'}, format='json').status_code, 403)
        self.assertEqual(locked.post('/api/v1/staff-payroll/unlock/', {'password': 'AccPass2026x'}, format='json').status_code, 403)  # not a manager
        # an edit while locked keeps the salary; creating with a salary while locked is refused
        r = locked.patch(f'/api/v1/staff/employees/{self.emp.id}/', {'salary': '1', 'job_title': 'كاشير'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.emp.refresh_from_db(); self.assertEqual((self.emp.salary, self.emp.job_title), (D('3000.00'), 'كاشير'))
        r = locked.post('/api/v1/staff/employees/', {'name': 'جديد', 'salary': '2000', 'start_time': '09:00', 'end_time': '17:00'}, format='json')
        self.assertEqual(r.status_code, 400)
        # unlocked: everything shows, and the token only works for the user who unlocked
        acc = self._c(self.acc)                                  # accountant + manager password
        self.assertEqual(acc.get('/api/v1/staff-payroll/').status_code, 200)
        self.assertEqual(acc.get('/api/v1/staff/employees/').data[0]['salary'], '3000.00')
        tok = signing.dumps({'u': str(self.acc.pk), 't': str(self.tenant.pk)}, salt=SALARY_SALT)
        other = APIClient(); other.force_authenticate(user=self.boss)
        other.credentials(HTTP_X_TENANT_ID=str(self.tenant.id), HTTP_X_SALARY_TOKEN=tok)
        self.assertEqual(other.get('/api/v1/staff-payroll/').status_code, 403)
        other.credentials(HTTP_X_TENANT_ID=str(self.tenant.id), HTTP_X_SALARY_TOKEN='forged')
        self.assertEqual(other.get('/api/v1/staff-payroll/').status_code, 403)
