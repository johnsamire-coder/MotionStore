import datetime

from django.core.exceptions import ValidationError
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.tenants.context import get_current_tenant
from apps.tenants.models import Tenant

from . import services
from .models import DEFAULT_SETTINGS, AttendanceDay, AttendanceEditLog, Employee, PublicHoliday, StaffSettings


def _tenant(request):
    t = getattr(request, 'tenant', None) or get_current_tenant()
    if not t and request.user.is_authenticated:
        t = getattr(request.user, 'tenant', None)
    return t or Tenant.objects.filter(is_active=True).first()


def _date(v, name='التاريخ'):
    try:
        return datetime.date.fromisoformat(str(v)[:10])
    except Exception:
        raise ValidationError(f'{name} مش مظبوط')


def _is_admin(user):
    return bool(user and (user.is_superuser or getattr(user, 'role', None) == 'ADMIN'))


def _err(e):
    return Response({'detail': '; '.join(getattr(e, 'messages', []) or [str(e)])}, status=400)


class EmployeeSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True, default='')

    class Meta:
        model = Employee
        fields = ['id', 'name', 'phone', 'job_title', 'hire_date', 'is_active', 'pay_type', 'salary', 'start_time',
                  'end_time', 'off_days_per_week', 'fixed_off_weekday', 'user', 'user_name', 'notes']

    def validate(self, attrs):
        if 'name' in attrs and not (attrs['name'] or '').strip():
            raise serializers.ValidationError({'name': 'اكتب اسم الموظف'})
        if attrs.get('salary') is not None and attrs['salary'] < 0:
            raise serializers.ValidationError({'salary': 'المرتب مينفعش يبقى بالسالب'})
        if attrs.get('off_days_per_week') is not None and attrs['off_days_per_week'] > 6:
            raise serializers.ValidationError({'off_days_per_week': 'أيام الإجازة في الأسبوع من 0 لـ 6'})
        w = attrs.get('fixed_off_weekday')
        if w is not None and not 0 <= w <= 6:
            raise serializers.ValidationError({'fixed_off_weekday': 'اليوم غلط'})
        st, en = attrs.get('start_time'), attrs.get('end_time')
        if st is not None and en is not None and st == en:
            raise serializers.ValidationError({'end_time': 'ميعاد الانصراف لازم يبقى غير ميعاد الحضور'})
        u = attrs.get('user')
        req = self.context.get('request')
        if u is not None and req is not None and getattr(u, 'tenant_id', None) != getattr(_tenant(req), 'id', None):
            raise serializers.ValidationError({'user': 'الحساب ده مش تبع الشركة'})
        return attrs


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicHoliday
        fields = ['id', 'date', 'name']


class _TenantModelViewSet(viewsets.ModelViewSet):
    model = None

    def get_queryset(self):
        return self.model.objects.filter(tenant=_tenant(self.request))

    def perform_create(self, serializer):
        serializer.save(tenant=_tenant(self.request))


class EmployeeViewSet(_TenantModelViewSet):
    model = Employee
    serializer_class = EmployeeSerializer
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('active') == '1':
            qs = qs.filter(is_active=True)
        return qs.order_by('-is_active', 'name')

    def destroy(self, request, *args, **kwargs):
        emp = self.get_object()
        if AttendanceDay.objects.filter(employee=emp).exists():
            emp.is_active = False
            emp.save(update_fields=['is_active', 'updated_at'])
            return Response({'ok': True, 'deactivated': True, 'detail': 'الموظف ليه حضور متسجل، فاتوقف بدل ما يتمسح'})
        emp.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class HolidayViewSet(_TenantModelViewSet):
    model = PublicHoliday
    serializer_class = HolidaySerializer
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        y = self.request.query_params.get('year')
        return qs.filter(date__year=int(y)) if y and y.isdigit() else qs

    def create(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            return Response({'detail': 'صاحب الشركة بس يقدر يضيف العطلات'}, status=403)
        try:
            d = _date(request.data.get('date'))
        except ValidationError as e:
            return _err(e)
        if PublicHoliday.objects.filter(tenant=_tenant(request), date=d).exists():
            return Response({'detail': 'اليوم ده متسجل عطلة قبل كده'}, status=400)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            return Response({'detail': 'صاحب الشركة بس يقدر يعدّل العطلات'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            return Response({'detail': 'صاحب الشركة بس يقدر يمسح العطلات'}, status=403)
        h = self.get_object()
        if AttendanceDay.objects.filter(tenant=h.tenant, date=h.date, locked=True).exists():
            return Response({'detail': 'اليوم ده اتحسب في مرتب اتعمد'}, status=400)
        return super().destroy(request, *args, **kwargs)


class StaffViewSet(viewsets.ViewSet):
    """ /api/v1/staff/... : settings, attendance sheet, weekly roster, report. """

    @action(detail=False, methods=['get', 'put'], url_path='settings')
    def settings_(self, request):
        obj = StaffSettings.for_tenant(_tenant(request))
        if request.method == 'GET':
            return Response({'settings': obj.merged(), 'defaults': DEFAULT_SETTINGS, 'can_edit': _is_admin(request.user)})
        if not _is_admin(request.user):
            return Response({'detail': 'صاحب الشركة بس يقدر يغيّر إعدادات المرتبات'}, status=403)
        incoming = request.data.get('settings') or {}
        allowed = {
            'late_mode': ('PER_MINUTE', 'TIERS', 'NONE'), 'early_leave_mode': ('SAME_AS_LATE', 'NONE'),
            'overtime_mode': ('OFF', 'AUTO', 'MANUAL'), 'month_days_basis': ('THIRTY', 'WORKING_DAYS'),
            'goods_price_mode': ('SALE', 'SALE_DISCOUNT', 'COST'), 'advance_mode': ('ALL', 'INSTALLMENT'),
            'holiday_work_mode': ('NORMAL', 'OVERTIME', 'EXTRA_DAY'),
        }
        data = dict(obj.data or {})
        for k, v in incoming.items():
            if k not in DEFAULT_SETTINGS:
                continue
            if k in allowed and v not in allowed[k]:
                return Response({'detail': f'قيمة غلط للإعداد {k}'}, status=400)
            if k in ('grace_minutes', 'overtime_min_minutes', 'week_start', 'weekly_pay_day'):
                try:
                    v = int(v)
                except Exception:
                    return Response({'detail': f'الإعداد {k} لازم يبقى رقم'}, status=400)
                if v < 0 or (k in ('week_start', 'weekly_pay_day') and v > 6):
                    return Response({'detail': f'الإعداد {k} برّه الحدود'}, status=400)
            if k in ('overtime_multiplier', 'absence_multiplier', 'goods_discount_pct', 'holiday_work_multiplier'):
                try:
                    f = float(v)
                except Exception:
                    return Response({'detail': f'الإعداد {k} لازم يبقى رقم'}, status=400)
                if f < 0 or (k == 'goods_discount_pct' and f > 100):
                    return Response({'detail': f'الإعداد {k} برّه الحدود'}, status=400)
                v = str(v)
            if k == 'holiday_paid':
                v = bool(v)
            if k == 'late_tiers':
                try:
                    v = sorted([{'up_to': int(t['up_to']), 'day_fraction': str(float(t['day_fraction']))} for t in v], key=lambda t: t['up_to'])
                except Exception:
                    return Response({'detail': 'الشرايح مش مظبوطة'}, status=400)
            data[k] = v
        obj.data = data
        obj.save(update_fields=['data', 'updated_at'])
        return Response({'settings': obj.merged()})

    @action(detail=False, methods=['get', 'post'], url_path='attendance')
    def attendance(self, request):
        t = _tenant(request)
        try:
            if request.method == 'GET':
                return Response(services.day_sheet(t, _date(request.query_params.get('date') or datetime.date.today())))
            d = _date(request.data.get('date'))
            n = services.save_day(t, d, request.data.get('rows') or [], request.user if request.user.is_authenticated else None)
            return Response({'ok': True, 'saved': n, **services.day_sheet(t, d)})
        except ValidationError as e:
            return _err(e)

    @action(detail=False, methods=['get', 'post'], url_path='roster')
    def roster(self, request):
        t = _tenant(request)
        try:
            if request.method == 'GET':
                start = _date(request.query_params.get('start') or datetime.date.today())
                return Response(services.week_roster(t, start))
            services.set_off_day(t, request.data.get('employee_id'), _date(request.data.get('date')), bool(request.data.get('off')))
            return Response({'ok': True})
        except Employee.DoesNotExist:
            return Response({'detail': 'الموظف مش موجود'}, status=400)
        except ValidationError as e:
            return _err(e)

    @action(detail=False, methods=['get'], url_path='report')
    def report(self, request):
        q = request.query_params
        try:
            return Response(services.attendance_report(_tenant(request), _date(q.get('from'), 'من تاريخ'),
                                                       _date(q.get('to'), 'إلى تاريخ'), q.get('employee') or None))
        except ValidationError as e:
            return _err(e)

    @action(detail=False, methods=['get'], url_path='edit-log')
    def edit_log(self, request):
        t = _tenant(request)
        qs = AttendanceEditLog.objects.filter(tenant=t).select_related('day__employee', 'user')[:200]
        return Response([{'at': x.created_at.isoformat(), 'user': getattr(x.user, 'username', ''), 'employee': x.day.employee.name,
                          'date': x.day.date.isoformat(), 'before': x.before, 'after': x.after} for x in qs])
