import datetime
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenants.models import Tenant
from apps.tenants.context import set_current_tenant
from apps.users.models import User
from apps.companies.models import Company
from apps.branches.models import Branch
from apps.treasury.models import Treasury, TreasuryType, TreasuryTransaction
from apps.accounting.models import JournalEntry, JournalEntryLine
from apps.accounting.services import init_standard_chart_of_accounts
from apps.staff.models import Employee, EmployeeLedgerEntry

PWD = 'Pass2026Password'
D = datetime.date


class StaffLedgerTest(TestCase):

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Ledger Co", slug="ledger-co")
        set_current_tenant(self.tenant)
        init_standard_chart_of_accounts(self.tenant)
        company = Company.objects.create(tenant=self.tenant, name="Co", currency="EGP")
        branch = Branch.objects.create(tenant=self.tenant, company=company, name="Main")
        self.safe = Treasury.objects.create(tenant=self.tenant, name="الخزنة", branch=branch, treasury_type=TreasuryType.MAIN_SAFE,
                                            current_balance=Decimal('5000'))
        self.emp = Employee.objects.create(tenant=self.tenant, name="منى", salary=Decimal('3000'), start_time=datetime.time(10),
                                           end_time=datetime.time(22))
        self.manager = User.objects.create_user(username="mgr", password=PWD, role="MANAGER", tenant=self.tenant)
        self.accountant = User.objects.create_user(username="acc", password='AccPass2026x', role="ACCOUNTANT", tenant=self.tenant)
        self.today = D.today()

    def _c(self, user):
        c = APIClient(); c.force_authenticate(user=user); c.credentials(HTTP_X_TENANT_ID=str(self.tenant.id)); return c

    def _post(self, user, **d):
        body = {'employee_id': str(self.emp.id), 'date': self.today.isoformat(), **d}
        return self._c(user).post('/api/v1/staff-ledger/entries/', body, format='json')

    def _net(self, code):
        a = JournalEntryLine.objects.filter(tenant=self.tenant, account__code=code).aggregate(d=Sum('debit'), c=Sum('credit'))
        return (a['d'] or Decimal('0')) - (a['c'] or Decimal('0'))

    def _balanced(self):
        for je in JournalEntry.objects.filter(tenant=self.tenant):
            a = JournalEntryLine.objects.filter(journal_entry=je).aggregate(d=Sum('debit'), c=Sum('credit'))
            self.assertEqual(a['d'], a['c'], je.entry_number)

    def test_advance_leaves_treasury_and_posts_entry(self):
        r = self._post(self.manager, kind='ADVANCE', amount='1000', treasury_id=str(self.safe.id), installment='250')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['number'], 'SADV-00001')
        self.assertEqual(r.data['owed'], '1000.00')
        self.safe.refresh_from_db(); self.assertEqual(self.safe.current_balance, Decimal('4000'))
        self.assertEqual((self._net('1060'), self._net('1030')), (Decimal('1000'), Decimal('-1000')))
        self._balanced()

    def test_advance_validations(self):
        self.assertEqual(self._post(self.manager, kind='ADVANCE', amount='9000', treasury_id=str(self.safe.id)).status_code, 400)  # no money
        self.assertEqual(self._post(self.manager, kind='ADVANCE', amount='500').status_code, 400)                                # no treasury
        self.assertEqual(self._post(self.manager, kind='ADVANCE', amount='500', treasury_id=str(self.safe.id), installment='600').status_code, 400)
        self.assertEqual(self._post(self.manager, kind='ADVANCE', amount='0', treasury_id=str(self.safe.id)).status_code, 400)
        tomorrow = (self.today + datetime.timedelta(days=1)).isoformat()
        self.assertEqual(self._post(self.manager, kind='ADVANCE', amount='5', treasury_id=str(self.safe.id), date=tomorrow).status_code, 400)
        self.safe.refresh_from_db(); self.assertEqual(self.safe.current_balance, Decimal('5000'))
        self.assertFalse(EmployeeLedgerEntry.objects.exists())

    def test_deduction_and_bonus_wait_for_payroll(self):
        self.assertEqual(self._post(self.manager, kind='DEDUCTION', amount='100').status_code, 400)                # reason needed
        self._post(self.manager, kind='DEDUCTION', amount='100', reason='كسر شماعة')
        r = self._post(self.manager, kind='BONUS', amount='250', reason='تارجت')
        self.assertEqual((r.data['owed'], r.data['pending_deductions'], r.data['pending_bonuses']), ('0.00', '100.00', '250.00'))
        self.assertFalse(JournalEntry.objects.exists())                                                          # booked at payroll
        self.safe.refresh_from_db(); self.assertEqual(self.safe.current_balance, Decimal('5000'))

    def test_repayment_limits_and_entries(self):
        self._post(self.manager, kind='ADVANCE', amount='1000', treasury_id=str(self.safe.id))
        self.assertEqual(self._post(self.accountant, kind='REPAYMENT', amount='1500', treasury_id=str(self.safe.id)).status_code, 400)
        r = self._post(self.accountant, kind='REPAYMENT', amount='400', treasury_id=str(self.safe.id))       # no password needed
        self.assertEqual((r.status_code, r.data['owed']), (201, '600.00'))
        self.assertEqual([x['balance'] for x in r.data['rows']], ['1000.00', '600.00'])
        self.safe.refresh_from_db(); self.assertEqual(self.safe.current_balance, Decimal('4400'))
        self.assertEqual(self._net('1060'), Decimal('600'))
        self._balanced()

    def test_approval_rules(self):
        acc = self._c(self.accountant)
        body = {'employee_id': str(self.emp.id), 'kind': 'BONUS', 'amount': '50', 'reason': 'x', 'date': self.today.isoformat()}
        self.assertEqual(acc.post('/api/v1/staff-ledger/entries/', body, format='json').status_code, 403)
        self.assertEqual(acc.post('/api/v1/staff-ledger/entries/', {**body, 'manager_password': 'wrong'}, format='json').status_code, 403)
        r = acc.post('/api/v1/staff-ledger/entries/', {**body, 'manager_password': PWD}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(EmployeeLedgerEntry.objects.get().approved_by, self.manager)

    def test_cancel_advance_and_repayment_rules(self):
        a = self._post(self.manager, kind='ADVANCE', amount='1000', treasury_id=str(self.safe.id))
        adv_id = a.data['rows'][0]['id']
        rp = self._post(self.manager, kind='REPAYMENT', amount='300', treasury_id=str(self.safe.id))
        rep_id = rp.data['rows'][1]['id']
        mgr = self._c(self.manager)
        self.assertEqual(mgr.post('/api/v1/staff-ledger/cancel/', {'id': adv_id, 'reason': 'غلط'}, format='json').status_code, 400)  # repaid part
        self.assertEqual(mgr.post('/api/v1/staff-ledger/cancel/', {'id': rep_id}, format='json').status_code, 400)                    # no reason
        self.assertEqual(mgr.post('/api/v1/staff-ledger/cancel/', {'id': rep_id, 'reason': 'غلط'}, format='json').status_code, 200)
        r = mgr.post('/api/v1/staff-ledger/cancel/', {'id': adv_id, 'reason': 'غلط'}, format='json')
        self.assertEqual((r.status_code, r.data['owed']), (200, '0.00'))
        self.safe.refresh_from_db(); self.assertEqual(self.safe.current_balance, Decimal('5000'))
        self.assertEqual((self._net('1060'), self._net('1030')), (Decimal('0'), Decimal('0')))
        self.assertEqual(TreasuryTransaction.objects.filter(source_document_type__startswith='Staff').count(), 4)
        self.assertEqual(mgr.post('/api/v1/staff-ledger/cancel/', {'id': adv_id, 'reason': 'تاني'}, format='json').status_code, 400)
        self._balanced()

    def test_statement_opening_balance_and_balances_list(self):
        old = (self.today - datetime.timedelta(days=10)).isoformat()
        self._post(self.manager, kind='ADVANCE', amount='700', treasury_id=str(self.safe.id), date=old)
        self._post(self.manager, kind='ADVANCE', amount='300', treasury_id=str(self.safe.id))
        r = self._c(self.manager).get(f'/api/v1/staff-ledger/entries/?employee={self.emp.id}&from={(self.today - datetime.timedelta(days=2)).isoformat()}')
        self.assertEqual((r.data['opening'], len(r.data['rows']), r.data['rows'][0]['balance']), ('700.00', 1, '1000.00'))
        b = self._c(self.manager).get('/api/v1/staff-ledger/balances/').data
        self.assertEqual((b[0]['name'], b[0]['owed']), ('منى', '1000.00'))

    def test_failed_journal_never_blocks_and_backfill_posts_it(self):
        with mock.patch('apps.accounting.services.create_balanced_journal_entry', side_effect=RuntimeError('boom')):
            r = self._post(self.manager, kind='ADVANCE', amount='200', treasury_id=str(self.safe.id))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self._net('1060'), Decimal('0'))
        call_command('post_missing_journals', '--apply', stdout=StringIO())
        call_command('post_missing_journals', '--apply', stdout=StringIO())
        self.assertEqual(self._net('1060'), Decimal('200'))
        self.assertEqual(JournalEntry.objects.filter(source_document_type='StaffLedger').count(), 1)

    def test_cashier_and_other_tenant_blocked(self):
        cashier = User.objects.create_user(username="c1", password=PWD, role="CASHIER", tenant=self.tenant)
        self.assertEqual(self._c(cashier).get('/api/v1/staff-ledger/balances/').status_code, 403)
        other = Tenant.objects.create(name="O", slug="o")
        boss = User.objects.create_user(username="ob", password=PWD, role="ADMIN", tenant=other)
        c = APIClient(); c.force_authenticate(user=boss); c.credentials(HTTP_X_TENANT_ID=str(other.id))
        r = c.post('/api/v1/staff-ledger/entries/', {'employee_id': str(self.emp.id), 'kind': 'BONUS', 'amount': '5', 'reason': 'x'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(c.get('/api/v1/staff-ledger/balances/').data, [])
