import re
from rest_framework.permissions import BasePermission

DEFAULTS = {
    'MANAGER': ['/', '/pos', '/invoices', '/customers', '/suppliers', '/expenses', '/coding', '/returns', '/sorting', '/inventory', '/purchasing', '/shifts', '/treasury', '/reports', '/settings'],
    'CASHIER': ['/pos', '/shifts', '/returns'],
    'WAREHOUSE_KEEPER': ['/inventory', '/sorting', '/purchasing'],
    'ACCOUNTANT': ['/', '/reports', '/treasury', '/expenses', '/invoices', '/customers', '/suppliers'],
    'SORTER': ['/sorting'],
}
W = {'POST', 'PUT', 'PATCH', 'DELETE'}
A = None
RULES = [
    (r'^/api/v1/role-permissions/', W, ['__ADMIN__']),
    (r'^/api/v1/tenants/(?!public_info)', W, ['__ADMIN__']),
    (r'^/api/v1/users/', A, ['/users']),
    (r'^/api/v1/expense', A, ['/expenses']),
    (r'^/api/v1/treasuries/(transfer|adjust|settle_custody|custodies|[^/]+/statement)', A, ['/treasury']),
    (r'^/api/v1/treasuries/', W, ['/treasury', '/settings']),
    (r'^/api/v1/reports-v2/', A, ['/reports']),
    (r'^/api/v1/suppliers/', A, ['/suppliers', '/purchasing']),
    (r'^/api/v1/purchases/', W, ['/purchasing']),
    (r'^/api/v1/(weight-prices|price-change-log)/', A, ['/coding']),
    (r'^/api/v1/(piece-items|offers|purchase-options)/', W, ['/coding', '/purchasing']),
    (r'^/api/v1/sorting-orders/', W, ['/sorting']),
    (r'^/api/v1/transfers/', W, ['/inventory']),
    (r'^/api/v1/(warehouses|branches|companies|pos-terminals|payments)/', W, ['/settings', '/inventory']),
    (r'^/api/v1/customers/[^/]+/collect', A, ['/customers']),
    (r'^/api/v1/customers/(summary|[^/]+/history)', A, ['/customers', '/pos']),
    (r'^/api/v1/sales/numbering', W, ['/invoices']),
    (r'^/api/v1/sales/?$', {'GET'}, ['/invoices', '/reports']),
    (r'^/api/v1/returns/', A, ['/returns']),
    (r'^/api/v1/(treasury-transactions|journal-entries)/', A, ['/treasury', '/expenses', '/reports']),
    (r'^/api/v1/(raw-lots|purchase-line-items)/', A, ['/sorting', '/purchasing', '/inventory']),
    (r'^/api/v1/inventory-ledger/', A, ['/inventory', '/reports']),
    (r'^/api/v1/customers/?$', {'GET'}, ['/customers', '/reports']),
]


def allowed_screens(user):
    from apps.users.models import RolePermission
    rp = RolePermission.objects.filter(tenant_id=getattr(user, 'tenant_id', None), role=user.role).first()
    if rp is not None:
        return rp.allowed_screens or []
    return DEFAULTS.get(user.role, [])


class ScreenPermission(BasePermission):
    message = 'مش مسموحلك تعمل ده - كلّم المدير يديك الصلاحية'

    def has_permission(self, request, view):
        u = request.user
        if not u or not u.is_authenticated or u.is_superuser or getattr(u, 'role', None) == 'ADMIN':
            return True
        path = request.path
        for _rx, _methods, _act in ACTION_RULES:
            if re.match(_rx, path) and request.method in _methods and not can(u, _act):
                return False
        for rx, methods, screens in RULES:
            if re.match(rx, path) and (methods is None or request.method in methods):
                if '__ADMIN__' in screens:
                    return False
                mine = allowed_screens(u)
                return '*' in mine or any(sc in mine for sc in screens)
        return True

ACTIONS = ['view_cost_profit', 'view_others_invoices', 'sell_credit', 'make_returns', 'cancel_deferred', 'approve',
           'cancel_expense', 'edit_prices', 'treasury_moves', 'settle_custody', 'export', 'view_stock_prices']
DEFAULT_ACTIONS = {
    'MANAGER': list(ACTIONS),
    'ACCOUNTANT': ['view_cost_profit', 'view_others_invoices', 'treasury_moves', 'settle_custody', 'export', 'view_stock_prices'],
    'CASHIER': ['make_returns', 'view_stock_prices'],
    'WAREHOUSE_KEEPER': ['view_stock_prices'],
    'SORTER': [],
}
ACTION_RULES = [
    (r'^/api/v1/returns/?$', {'POST'}, 'make_returns'),
    (r'^/api/v1/deferred-sales/[^/]+/cancel', {'POST'}, 'cancel_deferred'),
    (r'^/api/v1/expenses/[^/]+/cancel', {'POST'}, 'cancel_expense'),
    (r'^/api/v1/(weight-prices|piece-items|offers)/', {'POST', 'PUT', 'PATCH', 'DELETE'}, 'edit_prices'),
    (r'^/api/v1/treasuries/(transfer|adjust)', {'POST'}, 'treasury_moves'),
    (r'^/api/v1/treasuries/settle_custody', {'POST'}, 'settle_custody'),
]


def allowed_actions(user):
    if user.is_superuser or getattr(user, 'role', None) == 'ADMIN':
        return ['*']
    from apps.users.models import RolePermission
    rp = RolePermission.objects.filter(tenant_id=getattr(user, 'tenant_id', None), role=user.role).first()
    if rp is not None and rp.allowed_actions is not None:
        return rp.allowed_actions
    return DEFAULT_ACTIONS.get(user.role, [])


def can(user, action):
    a = allowed_actions(user)
    return '*' in a or action in a
