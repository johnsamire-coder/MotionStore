from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from apps.sorting.models import SortingOrder, SortingStatus
from .models import CostingConfiguration, CostingCalculationRecord, CostingMethod, WasteTreatment

def quantize_amount(amount: Decimal) -> Decimal:
    """ تقريب دقيق لأقرب قرشين (0.01) للحسابات المالية """
    if amount is None:
        return Decimal('0.00')
    return Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

@transaction.atomic
def calculate_sorting_costs(sorting_order_id) -> CostingCalculationRecord:
    """
    محرك حساب التكلفة الذكي وفق ملف التصميم:
    1. بالقطعة (PIECE)
    2. بالوزن (WEIGHT)
    3. بنسب ثابتة لكل درجة (PERCENTAGE)
    مع حساب وتوزيع نصيب الهالك كخسارة منفصلة (خسارة هالك الفرز).
    """
    order = SortingOrder.objects.select_related('raw_lot').get(pk=sorting_order_id)
    tenant = order.tenant

    # جلب سياسة التكلفة الفعالة للشركة
    config = CostingConfiguration.objects.filter(tenant=tenant, is_active=True).first()
    if not config:
        config = CostingConfiguration.objects.create(
            tenant=tenant,
            name="سياسة التكلفة الافتراضية",
            method=CostingMethod.WEIGHT,
            is_active=True
        )

    total_purchase_cost = quantize_amount(order.raw_lot.purchase_cost)
    output_lines = list(order.output_lines.all())
    waste_lines = list(order.waste_lines.all())

    # حساب إجمالي الأوزان والقطع للمخرجات الصالحة والهالك
    good_weight = sum((line.weight_kg or Decimal('0.000')) for line in output_lines)
    waste_weight = sum((line.weight_kg or Decimal('0.000')) for line in waste_lines)
    total_weight = good_weight + waste_weight

    good_pieces = sum((line.quantity_pieces or 0) for line in output_lines)
    waste_pieces = sum((line.quantity_pieces or 0) for line in waste_lines)
    total_pieces = good_pieces + waste_pieces

    waste_loss_amount = Decimal('0.00')
    method_used = config.method

    # ==========================================
    # 1. طريقة التوزيع بالوزن (WEIGHT)
    # ==========================================
    if method_used in [CostingMethod.WEIGHT, CostingMethod.EQUAL_WEIGHT]:
        cost_per_kg = (total_purchase_cost / total_weight) if total_weight > 0 else Decimal('0.00')
        
        # توزيع التكلفة على سطور المخرجات الصالحة
        for line in output_lines:
            line_wt = line.weight_kg or Decimal('0.000')
            line.allocated_cost = quantize_amount(line_wt * cost_per_kg)
            line.cost_per_kg = quantize_amount(cost_per_kg)
            line.save(update_fields=['allocated_cost', 'cost_per_kg'])

        # توزيع التكلفة على سطور الهالك
        for w_line in waste_lines:
            w_wt = w_line.weight_kg or Decimal('0.000')
            w_cost = quantize_amount(w_wt * cost_per_kg)
            w_line.allocated_cost = w_cost
            w_line.save(update_fields=['allocated_cost'])
            waste_loss_amount += w_cost

    # ==========================================
    # 2. طريقة التوزيع بالقطعة (PIECE)
    # ==========================================
    elif method_used == CostingMethod.PIECE:
        cost_per_piece = (total_purchase_cost / Decimal(str(total_pieces))) if total_pieces > 0 else Decimal('0.00')
        
        for line in output_lines:
            line_pcs = Decimal(str(line.quantity_pieces or 0))
            line.allocated_cost = quantize_amount(line_pcs * cost_per_piece)
            line.cost_per_kg = quantize_amount(line.allocated_cost / line.weight_kg) if (line.weight_kg and line.weight_kg > 0) else Decimal('0.00')
            line.save(update_fields=['allocated_cost', 'cost_per_kg'])

        for w_line in waste_lines:
            w_pcs = Decimal(str(w_line.quantity_pieces or 0))
            w_cost = quantize_amount(w_pcs * cost_per_piece) if total_pieces > 0 else quantize_amount((w_line.weight_kg / total_weight) * total_purchase_cost) if total_weight > 0 else Decimal('0.00')
            w_line.allocated_cost = w_cost
            w_line.save(update_fields=['allocated_cost'])
            waste_loss_amount += w_cost

    # ==========================================
    # 3. طريقة التوزيع بنسب الدرجات (PERCENTAGE)
    # ==========================================
    elif method_used == CostingMethod.PERCENTAGE:
        # النسب المحددة في الإعدادات
        pct_high = (config.high_grade_pct or Decimal('55.00')) / Decimal('100.00')
        pct_mid = (config.mid_grade_pct or Decimal('30.00')) / Decimal('100.00')
        pct_liq = (config.liquidation_grade_pct or Decimal('10.00')) / Decimal('100.00')
        pct_waste = (config.waste_grade_pct or Decimal('5.00')) / Decimal('100.00')

        high_cost_pool = total_purchase_cost * pct_high
        mid_cost_pool = total_purchase_cost * pct_mid
        liq_cost_pool = total_purchase_cost * pct_liq
        waste_loss_amount = quantize_amount(total_purchase_cost * pct_waste)

        # تجميع أوزان كل درجة لتوزيع حوض التكلفة الخاص بها
        high_lines = [l for l in output_lines if str(l.grade).upper() in ['HIGH', 'GRADE_A', 'عالي', 'سوبر كريم', 'كريم']]
        mid_lines = [l for l in output_lines if str(l.grade).upper() in ['MID', 'GRADE_B', 'وسط', 'درجة أولى']]
        liq_lines = [l for l in output_lines if str(l.grade).upper() in ['LIQUIDATION', 'CLEARANCE', 'GRADE_C', 'تصفيات', 'درجة ثانية']]

        def allocate_pool(lines, pool_amount):
            pool_wt = sum((l.weight_kg or Decimal('0.000')) for l in lines)
            for l in lines:
                l_wt = l.weight_kg or Decimal('0.000')
                l.allocated_cost = quantize_amount((l_wt / pool_wt) * pool_amount) if pool_wt > 0 else quantize_amount(pool_amount / len(lines)) if lines else Decimal('0.00')
                l.cost_per_kg = quantize_amount(l.allocated_cost / l_wt) if l_wt > 0 else Decimal('0.00')
                l.save(update_fields=['allocated_cost', 'cost_per_kg'])

        allocate_pool(high_lines, high_cost_pool)
        allocate_pool(mid_lines, mid_cost_pool)
        allocate_pool(liq_lines, liq_cost_pool)

        # توزيع تكلفة الهالك
        if waste_lines:
            for w_line in waste_lines:
                w_wt = w_line.weight_kg or Decimal('0.000')
                w_line.allocated_cost = quantize_amount((w_wt / waste_weight) * waste_loss_amount) if waste_weight > 0 else quantize_amount(waste_loss_amount / len(waste_lines))
                w_line.save(update_fields=['allocated_cost'])

    # تسجيل سجل التكلفة المعتمد
    costing_record, _ = CostingCalculationRecord.objects.update_or_create(
        sorting_order=order,
        defaults={
            'tenant': tenant,
            'method_used': str(method_used),
            'waste_treatment_used': WasteTreatment.SEPARATE,
            'waste_loss_amount': quantize_amount(waste_loss_amount),
            'total_allocated_cost': total_purchase_cost,
            'parameters_used': {
                'total_purchase_cost': float(total_purchase_cost),
                'total_weight_kg': float(total_weight),
                'total_pieces': total_pieces,
                'method': str(method_used),
                'high_pct': float(config.high_grade_pct),
                'mid_pct': float(config.mid_grade_pct),
                'liq_pct': float(config.liquidation_grade_pct),
                'waste_pct': float(config.waste_grade_pct)
            }
        }
    )

    return costing_record