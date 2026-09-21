from .models import AuditLog
from apps.tenants.context import get_current_tenant

def record_audit(
    action: str,
    domain: str,
    entity_type: str,
    entity_id: str,
    old_values: dict = None,
    new_values: dict = None,
    actor_id: str = None,
    actor_email: str = None,
    ip_address: str = None,
    tenant = None
) -> AuditLog:
    """
    Standard service to emit audit trail records across any domain.
    """
    resolved_tenant = tenant or get_current_tenant()
    return AuditLog.objects.create(
        tenant=resolved_tenant,
        actor_id=str(actor_id) if actor_id else None,
        actor_email=actor_email,
        action=action,
        domain=domain,
        entity_type=entity_type,
        entity_id=str(entity_id),
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address
    )
