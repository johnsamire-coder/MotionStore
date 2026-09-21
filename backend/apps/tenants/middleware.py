from .context import set_current_tenant, clear_current_tenant
from .models import Tenant

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant_id = request.headers.get('X-Tenant-ID')
        tenant_slug = request.headers.get('X-Tenant-Slug')

        tenant = None
        if tenant_id:
            tenant = Tenant.objects.filter(id=tenant_id, is_active=True).first()
        elif tenant_slug:
            tenant = Tenant.objects.filter(slug=tenant_slug, is_active=True).first()
        elif hasattr(request, 'user') and request.user.is_authenticated:
            # User tenant link (handled when Users domain is active)
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
