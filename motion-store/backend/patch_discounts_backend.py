import os

# 1. Check & Update apps/discounts/models.py
models_path = r'apps\discounts\models.py'
if os.path.exists(models_path):
    with open(models_path, 'r', encoding='utf-8') as f:
        m_code = f.read()
else:
    os.makedirs(r'apps\discounts', exist_ok=True)
    m_code = ''

discount_model = '''from decimal import Decimal
from django.db import models
from apps.tenants.models import TenantAwareModel
from apps.products.models import GradeChoice

class DiscountType(models.TextChoices):
    GRADE_PERCENTAGE = 'GRADE_PERCENTAGE', 'خصم نسبة % على درجة معينة'
    WEIGHT_TIER = 'WEIGHT_TIER', 'خصم نسبة % على إجمالي وزن الفاتورة'
    FIXED_AMOUNT = 'FIXED_AMOUNT', 'خصم مبلغ ثابت ج.م'

class DiscountRule(TenantAwareModel):
    name = models.CharField(max_length=255, verbose_name="اسم العرض")
    discount_type = models.CharField(max_length=50, choices=DiscountType.choices)
    value = models.DecimalField(max_digits=10, decimal_places=2, help_text="قيمة الخصم (نسبة أو مبلغ)")
    
    # Conditions
    target_grade = models.CharField(max_length=30, choices=GradeChoice.choices, null=True, blank=True)
    min_weight_kg = models.DecimalField(max_digits=10, decimal_places=3, default=Decimal('0.000'))
    
    # Validity
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "discount_rules"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} ({self.value})"
'''

if 'DiscountRule' not in m_code:
    with open(models_path, 'w', encoding='utf-8') as f:
        f.write(discount_model)
    print("✅ تم تجهيز موديل الخصومات")

# 2. Update api/serializers.py
ser_path = r'apps\api\serializers.py'
with open(ser_path, 'r', encoding='utf-8') as f:
    ser_code = f.read()

if 'DiscountRuleSerializer' not in ser_code:
    ser_code = ser_code.replace(
        'from apps.discounts.models import DiscountRule',
        '' # remove if exists to avoid duplicates
    )
    ser_code = 'from apps.discounts.models import DiscountRule\n' + ser_code
    
    ser_extra = '''
class DiscountRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountRule
        fields = '__all__'
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']
'''
    ser_code += ser_extra
    with open(ser_path, 'w', encoding='utf-8') as f:
        f.write(ser_code)
    print("✅ تم تحديث serializers.py")

# 3. Update api/views.py
views_path = r'apps\api\views.py'
with open(views_path, 'r', encoding='utf-8') as f:
    views_code = f.read()

if 'DiscountRuleViewSet' not in views_code:
    views_code = 'from apps.discounts.models import DiscountRule\n' + views_code
    
    views_extra = '''
class DiscountRuleViewSet(BaseTenantViewSet):
    model = DiscountRule
    serializer_class = DiscountRuleSerializer
'''
    views_code += views_extra
    with open(views_path, 'w', encoding='utf-8') as f:
        f.write(views_code)
    print("✅ تم تحديث views.py")

# 4. Update api/urls.py
urls_path = r'apps\api\urls.py'
with open(urls_path, 'r', encoding='utf-8') as f:
    urls_code = f.read()

if 'discount-rules' not in urls_code:
    urls_code = urls_code.replace(
        'router.register(r"price-history", PriceHistoryViewSet, basename="price-history")',
        'router.register(r"price-history", PriceHistoryViewSet, basename="price-history")\nrouter.register(r"discount-rules", DiscountRuleViewSet, basename="discount-rules")'
    )
    with open(urls_path, 'w', encoding='utf-8') as f:
        f.write(urls_code)
    print("✅ تم تحديث urls.py")

