from django.db import models
from apps.tenants.models import TenantAwareModel

class SavedReportFilter(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="Report Name")
    report_type = models.CharField(max_length=50, db_index=True)
    filter_params = models.JSONField(default=dict)

    class Meta:
        db_table = "saved_report_filters"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.report_type})"
