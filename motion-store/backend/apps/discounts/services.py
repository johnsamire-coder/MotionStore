from decimal import Decimal, ROUND_HALF_UP
from django.core.exceptions import ValidationError
from apps.discounts.models import DiscountRule, DiscountType

# Role authority hierarchy weight
ROLE_HIERARCHY = {
    'CASHIER': 1,
    'WAREHOUSE_KEEPER': 1,
    'SORTER': 1,
    'ACCOUNTANT': 2,
    'MANAGER': 3,
    'ADMIN': 4,
}

def evaluate_discount(
    rule: DiscountRule,
    subtotal: Decimal,
    user_role: str = 'CASHIER'
) -> Decimal:
    """
    Evaluates and calculates the discount amount, validating role permissions and caps.
    """
    if not rule.is_active:
        raise ValidationError(f"Discount rule '{rule.name}' is inactive.")

    # 1. Role Authority check
    user_power = ROLE_HIERARCHY.get(user_role, 1)
    required_power = ROLE_HIERARCHY.get(rule.required_role, 1)
    if user_power < required_power:
        raise ValidationError(
            f"User role '{user_role}' is not authorized for discount '{rule.name}'. Requires '{rule.required_role}'."
        )

    # 2. Minimum Order check
    if subtotal < rule.minimum_order_amount:
        raise ValidationError(
            f"Subtotal {subtotal} EGP is below the minimum required ({rule.minimum_order_amount} EGP)."
        )

    # 3. Calculate Amount
    discount_amount = Decimal('0.00')
    if rule.discount_type == DiscountType.PERCENTAGE:
        discount_amount = (subtotal * (rule.value / Decimal('100.00'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        discount_amount = rule.value

    # 4. Cap check
    if rule.max_discount_amount and discount_amount > rule.max_discount_amount:
        discount_amount = rule.max_discount_amount

    # Cannot exceed subtotal
    if discount_amount > subtotal:
        discount_amount = subtotal

    return discount_amount
