import contextvars

_current_tenant = contextvars.ContextVar('current_tenant', default=None)

def get_current_tenant():
    return _current_tenant.get()

def set_current_tenant(tenant):
    _current_tenant.set(tenant)

def clear_current_tenant():
    _current_tenant.set(None)
