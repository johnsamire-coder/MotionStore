from django.db import models
from apps.tenants.models import TenantAwareModel

class PrintTemplateType(models.TextChoices):
    POS_RECEIPT = 'POS_RECEIPT', 'POS Sales Receipt (فاتورة بيع حرارية)'
    SHIFT_SUMMARY = 'SHIFT_SUMMARY', 'Shift Handover Slip (إيصال إغلاق الوردية)'
    BALE_TAG = 'BALE_TAG', 'Bale Sorting Tag (استيكر / كارت الفرز)'


class PrinterWidth(models.TextChoices):
    WIDTH_80MM = '80MM', '80mm Standard Thermal (طابعة 80 مم)'
    WIDTH_58MM = '58MM', '58mm Compact Thermal (طابعة 58 مم)'


class PrintTemplate(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Template Name")
    template_type = models.CharField(max_length=30, choices=PrintTemplateType.choices, default=PrintTemplateType.POS_RECEIPT)
    width = models.CharField(max_length=10, choices=PrinterWidth.choices, default=PrinterWidth.WIDTH_80MM)
    header_text = models.TextField(blank=True, null=True, help_text="Store name, slogan, branch info")
    footer_text = models.TextField(blank=True, null=True, help_text="Return policy, thank you message")
    show_logo = models.BooleanField(default=False)
    show_barcode = models.BooleanField(default=True)
    is_default = models.BooleanField(default=True)

    class Meta:
        db_table = "print_templates"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_template_type_display()} - {self.width})"
