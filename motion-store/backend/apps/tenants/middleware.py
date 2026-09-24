import uuid
from django.core.exceptions import ValidationError
from .context import set_current_tenant, clear_current_tenant
from .models import Tenant

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant_id = request.headers.get('X-Tenant-ID')
        tenant_slug = request.headers.get('X-Tenant-Slug')

        tenant = None
        if tenant_id and str(tenant_id).lower() not in ('undefined', 'null', 'none', ''):
            try:
                uuid.UUID(str(tenant_id))
                tenant = Tenant.objects.filter(id=tenant_id, is_active=True).first()
            except (ValidationError, ValueError):
                tenant = None

        if not tenant and tenant_slug and str(tenant_slug).lower() not in ('undefined', 'null', 'none', ''):
            tenant = Tenant.objects.filter(slug=tenant_slug, is_active=True).first()

        if not tenant and hasattr(request, 'user') and request.user.is_authenticated:
            tenant = getattr(request.user, 'tenant', None)

        if tenant:
            set_current_tenant(tenant)
            request.tenant = tenant
        else:
            clear_current_tenant()
            request.tenant = None

        try:
            response = self.get_response(request)
        finally:
            clear_current_tenant()

        return response
