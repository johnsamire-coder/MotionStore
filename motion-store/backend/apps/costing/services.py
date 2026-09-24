from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from apps.sorting.models import SortingOrder, SortingStatus, ReconciliationStatus
from .models import CostingConfiguration, CostingParameter, CostingCalculationRecord, CostingMethod, WasteTreatment

def quantize_amount(amount: Decimal) -> Decimal:
    """ Helper to precisely round to 2 decimal places for financial calculations """
    return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

@transaction.atomic
def calculate_sorting_costs(sorting_order_id) -> CostingCalculationRecord:
    """
    Core Configurable Costing Engine.
    Executes financial cost allocation matrices over sorting outputs and waste.
    """
    # 1. Fetch Order and confirm state
    order = SortingOrder.objects.select_related('raw_lot').get(pk=sorting_order_id)
    if order.reconciliation_status != ReconciliationStatus.BALANCED:
        order.reconcile()
        if order.reconciliation_status != ReconciliationStatus.BALANCED:
            raise ValueError("Cannot calculate costs on unbalanced sorting weights.")

    # 2. Retrieve Active Costing Policy
    config = CostingConfiguration.objects.get(tenant=order.tenant, is_active=True)
    params = {p.grade: p for p in config.parameters.all()}

    # Raw values
    total_raw_cost = order.raw_lot.purchase_cost
    total_raw_weight = order.raw_lot.original_weight_kg
    
    # Outputs and Wastes
    output_lines = list(order.output_lines.all())
    waste_lines = list(order.waste_lines.all())

    total_good_weight = order.total_good_weight_kg
    total_waste_weight = order.total_waste_weight_kg

    # === STEP A: Waste Cost Treatment ===
    allocated_waste_cost = Decimal('0.00')
    cost_to_allocate_to_good_goods = total_raw_cost

    if config.waste_treatment == WasteTreatment.ABSORBED:
        # Good output absorbs all cost, waste receives 0 EGP cost
        allocated_waste_cost = Decimal('0.00')
        cost_to_allocate_to_good_goods = total_raw_cost

    elif config.waste_treatment == WasteTreatment.SEPARATE:
        # Waste recognized as separate proportional loss
        if total_raw_weight > 0:
            allocated_waste_cost = (total_waste_weight / total_raw_weight) * total_raw_cost
        cost_to_allocate_to_good_goods = total_raw_cost - allocated_waste_cost

    elif config.waste_treatment == WasteTreatment.SPLIT:
        # Split normal/abnormal waste
        normal_limit_pct = config.normal_waste_percentage / Decimal('100.00')
        normal_limit_weight = total_raw_weight * normal_limit_pct
        
        if total_waste_weight > normal_limit_weight:
            abnormal_weight = total_waste_weight - normal_limit_weight
            # Abnormal is separate loss, normal is absorbed
            abnormal_waste_cost = (abnormal_weight / total_raw_weight) * total_raw_cost
            allocated_waste_cost = abnormal_waste_cost
        else:
            allocated_waste_cost = Decimal('0.00')
            
        cost_to_allocate_to_good_goods = total_raw_cost - allocated_waste_cost

    # Distribute computed waste cost to waste lines
    if waste_lines and total_waste_weight > 0:
        for w_line in waste_lines:
            share = w_line.weight_kg / total_waste_weight
            w_line.allocated_cost = quantize_amount(allocated_waste_cost * share)
            w_line.save()

    # === STEP B: Good Output Cost Allocation ===
    total_allocated_good_cost = Decimal('0.00')
    variance_amount = Decimal('0.00')

    # Method A: EQUAL WEIGHT
    if config.method == CostingMethod.EQUAL_WEIGHT:
        if total_good_weight > 0:
            cost_per_kg = cost_to_allocate_to_good_goods / total_good_weight
            for line in output_lines:
                line.cost_per_kg = quantize_amount(cost_per_kg)
                line.allocated_cost = quantize_amount(line.weight_kg * cost_per_kg)
                line.save()
                total_allocated_good_cost += line.allocated_cost

    # Method B: WEIGHTED COEFFICIENTS
    elif config.method == CostingMethod.COEFFICIENTS:
        weighted_weight_sum = Decimal('0.00')
        line_weighted_weights = {}

        for line in output_lines:
            coef_val = Decimal('1.00')
            if line.grade in params:
                coef_val = params[line.grade].coefficient
            
            weighted_wt = line.weight_kg * coef_val
            line_weighted_weights[line.id] = weighted_wt
            weighted_weight_sum += weighted_wt

        if weighted_weight_sum > 0:
            cost_per_weighted_unit = cost_to_allocate_to_good_goods / weighted_weight_sum
            for line in output_lines:
                weighted_wt = line_weighted_weights[line.id]
                line.allocated_cost = quantize_amount(weighted_wt * cost_per_weighted_unit)
                if line.weight_kg > 0:
                    line.cost_per_kg = quantize_amount(line.allocated_cost / line.weight_kg)
                line.save()
                total_allocated_good_cost += line.allocated_cost

    # Method C: RELATIVE SALES VALUE
    elif config.method == CostingMethod.SALES_VALUE:
        total_expected_sales_value = Decimal('0.00')
        line_expected_sales = {}

        for line in output_lines:
            expected_price = Decimal('0.00')
            if line.grade in params:
                expected_price = params[line.grade].expected_selling_price
            
            sales_val = line.weight_kg * expected_price
            line_expected_sales[line.id] = sales_val
            total_expected_sales_value += sales_val

        if total_expected_sales_value > 0:
            for line in output_lines:
                sales_val = line_expected_sales[line.id]
                ratio = sales_val / total_expected_sales_value
                line.allocated_cost = quantize_amount(cost_to_allocate_to_good_goods * ratio)
                if line.weight_kg > 0:
                    line.cost_per_kg = quantize_amount(line.allocated_cost / line.weight_kg)
                line.save()
                total_allocated_good_cost += line.allocated_cost

    # Method D: STANDARD COSTING
    elif config.method == CostingMethod.STANDARD:
        for line in output_lines:
            std_cost = Decimal('0.00')
            if line.grade in params:
                std_cost = params[line.grade].standard_cost_per_kg
            
            line.cost_per_kg = std_cost
            line.allocated_cost = quantize_amount(line.weight_kg * std_cost)
            line.save()
            total_allocated_good_cost += line.allocated_cost
        
        # Variance = Actual cost to allocate - total standard cost allocated
        variance_amount = cost_to_allocate_to_good_goods - total_allocated_good_cost

    # 3. Create auditing Calculation Record
    param_audit = {}
    for g, p in params.items():
        param_audit[g] = {
            'coefficient': str(p.coefficient),
            'expected_selling_price': str(p.expected_selling_price),
            'standard_cost_per_kg': str(p.standard_cost_per_kg)
        }

    record = CostingCalculationRecord.objects.create(
        sorting_order=order,
        method_used=config.method,
        waste_treatment_used=config.waste_treatment,
        parameters_used=param_audit,
        variance_amount=quantize_amount(variance_amount),
        waste_loss_amount=quantize_amount(allocated_waste_cost),
        total_allocated_cost=quantize_amount(total_allocated_good_cost)
    )

    # 4. Turn Raw Lot status to sorted
    order.raw_lot.status = 'SORTED'
    order.raw_lot.save()

    return record
