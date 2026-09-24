from decimal import Decimal
from apps.sales.models import SaleInvoice
from apps.shifts.models import Shift
from apps.printing.models import PrintTemplate, PrintTemplateType

def format_pos_receipt_payload(sale_invoice_id, template=None) -> str:
    """
    Renders an 80mm ESC/POS compatible text receipt for a Sale Invoice.
    """
    invoice = SaleInvoice.objects.select_related('branch', 'pos_terminal', 'cashier').prefetch_related('lines', 'payments').get(pk=sale_invoice_id)
    
    width = 42  # standard 80mm column width in monospace chars
    sep = "-" * width
    dsep = "=" * width

    lines = []
    # Header
    lines.append(dsep)
    lines.append("MOTION STORE - THRIFT & BALES".center(width))
    lines.append(f"Branch: {invoice.branch.name}".center(width))
    lines.append(f"Terminal: {invoice.pos_terminal.code} | Cashier: {invoice.cashier.username}".center(width))
    lines.append(f"Date: {invoice.invoice_date_time.strftime('%Y-%m-%d %H:%M')}".center(width))
    lines.append(f"Invoice #: {invoice.invoice_number}".center(width))
    lines.append(sep)

    # Line Items Header
    lines.append(f"{'Item / Grade':<20}{'Wt(KG)':<8}{'Price':<6}{'Total':>8}")
    lines.append(sep)

    # Line Items
    for item in invoice.lines.all():
        grade_short = item.get_grade_display().split()[0]
        desc = f"{item.product.name[:12]} ({grade_short})"
        wt_str = f"{item.weight_kg:.2f}"
        price_str = f"{item.unit_price:.0f}"
        total_str = f"{item.total_price:.2f}"
        lines.append(f"{desc:<20}{wt_str:<8}{price_str:<6}{total_str:>8}")

    lines.append(sep)
    lines.append(f"{'SUBTOTAL:':<26}{invoice.subtotal:>16.2f} EGP")
    if invoice.discount_amount > 0:
        lines.append(f"{'DISCOUNT:':<26}{-invoice.discount_amount:>16.2f} EGP")
    lines.append(dsep)
    lines.append(f"{'NET TOTAL:':<26}{invoice.total_amount:>16.2f} EGP")
    lines.append(dsep)

    # Payments
    for p in invoice.payments.all():
        lines.append(f"Paid via {p.payment_method.name:<18}: {p.amount:>12.2f} EGP")

    # Footer
    lines.append(sep)
    lines.append("Thank you for shopping with us!".center(width))
    lines.append("Goods returnable within 14 days with receipt".center(width))
    lines.append(dsep)

    return "\n".join(lines)


def format_shift_summary_payload(shift_id) -> str:
    """
    Renders an ESC/POS shift closing summary slip.
    """
    shift = Shift.objects.select_related('terminal', 'cashier').get(pk=shift_id)
    width = 42
    sep = "-" * width
    dsep = "=" * width

    lines = []
    lines.append(dsep)
    lines.append("SHIFT CLOSING REPORT".center(width))
    lines.append(f"Shift Code: #{shift.shift_code}".center(width))
    lines.append(f"Terminal: {shift.terminal.code} | Cashier: {shift.cashier.username}".center(width))
    lines.append(f"Opened: {shift.opened_at.strftime('%Y-%m-%d %H:%M')}".center(width))
    if shift.closed_at:
        lines.append(f"Closed: {shift.closed_at.strftime('%Y-%m-%d %H:%M')}".center(width))
    lines.append(sep)
    lines.append(f"{'Opening Float:':<26}{shift.opening_cash:>16.2f} EGP")
    lines.append(f"{'Cash Sales Total:':<26}{shift.cash_sales_total:>16.2f} EGP")
    lines.append(sep)
    lines.append(f"{'Expected Cash in Drawer:':<26}{shift.expected_cash:>16.2f} EGP")
    if shift.actual_cash is not None:
        lines.append(f"{'Actual Counted Cash:':<26}{shift.actual_cash:>16.2f} EGP")
        lines.append(dsep)
        diff_label = "SURPLUS:" if shift.difference >= 0 else "SHORTAGE:"
        lines.append(f"{diff_label:<26}{shift.difference:>16.2f} EGP")
    lines.append(dsep)
    lines.append(f"Status: {shift.get_status_display()}".center(width))
    lines.append(dsep)

    return "\n".join(lines)
