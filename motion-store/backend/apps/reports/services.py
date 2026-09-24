from decimal import Decimal
from django.db.models import Sum, Count, Avg
from apps.sales.models import SaleInvoice, SaleLineItem
from apps.inventory.models import StockItem
from apps.raw_lots.models import RawLot
from apps.waste.models import WasteRecord
from apps.costing.models import CostingCalculationRecord

def get_sales_performance_summary(tenant, start_date=None, end_date=None, branch=None) -> dict:
    """ Aggregates Sales, COGS, Gross Profit, and Margins for a given period """
    qs = SaleInvoice.objects.filter(tenant=tenant, status='COMPLETED')
    if start_date:
        qs = qs.filter(invoice_date_time__date__gte=start_date)
    if end_date:
        qs = qs.filter(invoice_date_time__date__lte=end_date)
    if branch:
        qs = qs.filter(branch=branch)

    aggregates = qs.aggregate(
        total_invoices=Count('id'),
        total_revenue=Sum('total_amount'),
        total_cogs=Sum('total_cogs'),
        total_profit=Sum('gross_profit')
    )

    rev = aggregates['total_revenue'] or Decimal('0.00')
    cogs = aggregates['total_cogs'] or Decimal('0.00')
    profit = aggregates['total_profit'] or Decimal('0.00')
    margin_pct = (profit / rev * Decimal('100.00')) if rev > 0 else Decimal('0.00')

    return {
        'total_invoices': aggregates['total_invoices'],
        'total_revenue': rev,
        'total_cogs': cogs,
        'gross_profit': profit,
        'gross_margin_percentage': round(margin_pct, 2)
    }


def get_bale_profitability_summary(tenant, raw_lot_id) -> dict:
    """
    End-to-End Bale Traceability & ROI Report:
    Original Cost -> Sorting Yield -> Sold Revenue & COGS -> Remaining Inventory Value
    """
    lot = RawLot.objects.select_related('supplier', 'warehouse').get(tenant=tenant, pk=raw_lot_id)
    
    # 1. Sales from this bale
    sales_qs = SaleLineItem.objects.filter(stock_item__source_lot=lot, sale_invoice__status='COMPLETED')
    sales_agg = sales_qs.aggregate(
        sold_weight=Sum('weight_kg'),
        sold_revenue=Sum('total_price'),
        realized_cogs=Sum('total_cost'),
        realized_profit=Sum('gross_profit')
    )

    # 2. Remaining stock in warehouses
    stock_qs = StockItem.objects.filter(source_lot=lot)
    stock_agg = stock_qs.aggregate(
        remaining_weight=Sum('total_weight_kg'),
        remaining_valuation=Sum('current_total_value')
    )

    # 3. Waste summary
    waste_qs = WasteRecord.objects.filter(raw_lot=lot)
    waste_agg = waste_qs.aggregate(
        waste_weight=Sum('weight_kg'),
        waste_loss_cost=Sum('allocated_cost')
    )

    return {
        'bale_code': lot.lot_code,
        'supplier': lot.supplier.name,
        'original_weight_kg': lot.original_weight_kg,
        'purchase_cost': lot.purchase_cost,
        'sold_weight_kg': sales_agg['sold_weight'] or Decimal('0.000'),
        'sold_revenue': sales_agg['sold_revenue'] or Decimal('0.00'),
        'realized_cogs': sales_agg['realized_cogs'] or Decimal('0.00'),
        'realized_profit': sales_agg['realized_profit'] or Decimal('0.00'),
        'remaining_stock_weight_kg': stock_agg['remaining_weight'] or Decimal('0.000'),
        'remaining_stock_valuation': stock_agg['remaining_valuation'] or Decimal('0.00'),
        'waste_weight_kg': waste_agg['waste_weight'] or Decimal('0.000'),
        'waste_loss_cost': waste_agg['waste_loss_cost'] or Decimal('0.00'),
    }


def get_inventory_valuation_summary(tenant, warehouse=None) -> dict:
    """ Computes current inventory weight, piece count and valuation by grade """
    qs = StockItem.objects.filter(tenant=tenant, total_weight_kg__gt=0)
    if warehouse:
        qs = qs.filter(warehouse=warehouse)

    by_grade = {}
    total_wt = Decimal('0.000')
    total_val = Decimal('0.00')

    for item in qs:
        g = item.grade
        if g not in by_grade:
            by_grade[g] = {'weight_kg': Decimal('0.000'), 'valuation': Decimal('0.00'), 'pieces': 0}
        by_grade[g]['weight_kg'] += item.total_weight_kg
        by_grade[g]['valuation'] += item.current_total_value
        by_grade[g]['pieces'] += item.total_quantity_pieces
        total_wt += item.total_weight_kg
        total_val += item.current_total_value

    return {
        'total_weight_kg': total_wt,
        'total_valuation': total_val,
        'by_grade': by_grade
    }


def get_income_statement_summary(tenant, start_date=None, end_date=None) -> dict:
    """ High-level Income Statement: Revenue - COGS - Separate Waste Losses = Net Profit """
    sales = get_sales_performance_summary(tenant, start_date, end_date)
    
    waste_qs = WasteRecord.objects.filter(tenant=tenant)
    if start_date:
        waste_qs = waste_qs.filter(created_at__date__gte=start_date)
    if end_date:
        waste_qs = waste_qs.filter(created_at__date__lte=end_date)
    
    total_waste_loss = waste_qs.aggregate(Sum('allocated_cost'))['allocated_cost__sum'] or Decimal('0.00')
    
    net_operating_profit = sales['gross_profit'] - total_waste_loss

    return {
        'sales_revenue': sales['total_revenue'],
        'cogs': sales['total_cogs'],
        'gross_profit': sales['gross_profit'],
        'sorting_waste_losses': total_waste_loss,
        'net_operating_profit': net_operating_profit
    }
