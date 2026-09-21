from decimal import Decimal
from typing import Optional
from apps.pricing.models import PriceList, PriceListItem

def resolve_selling_price(tenant, product, grade: str, branch=None) -> Optional[PriceListItem]:
    """
    Price Resolution Engine:
    Resolves the active selling price for a product & grade, prioritizing branch-specific lists over default.
    """
    # 1. Check branch-specific price list
    if branch:
        branch_item = PriceListItem.objects.filter(
            price_list__tenant=tenant,
            price_list__branch=branch,
            price_list__is_active=True,
            product=product,
            grade=grade,
            is_active=True
        ).first()
        if branch_item:
            return branch_item

    # 2. Check tenant default price list
    default_item = PriceListItem.objects.filter(
        price_list__tenant=tenant,
        price_list__is_default=True,
        price_list__is_active=True,
        product=product,
        grade=grade,
        is_active=True
    ).first()

    return default_item
