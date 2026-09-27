from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.users.models import User, RolePermission

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = user.role
        token['tenant_id'] = str(user.tenant.id) if user.tenant else None
        token['tenant_slug'] = user.tenant.slug if user.tenant else None
        return token

    def _pin_login(self, attrs, err):
        from django.contrib.auth.hashers import check_password
        from django.contrib.auth.models import update_last_login
        from django.core.cache import cache
        uname = attrs.get('username') or ''
        pin = str(attrs.get('password') or '')
        key = f'pinfail:{uname}'
        if not (pin.isdigit() and 4 <= len(pin) <= 6) or cache.get(key, 0) >= 5:
            raise err
        u = User.objects.filter(username=uname, is_active=True).first()
        if not u or not u.pin_hash or not check_password(pin, u.pin_hash):
            cache.set(key, cache.get(key, 0) + 1, 300)
            raise err
        cache.delete(key)
        self.user = u
        refresh = self.get_token(u)
        update_last_login(None, u)
        return {'refresh': str(refresh), 'access': str(refresh.access_token)}
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception as _login_err:
            data = self._pin_login(attrs, _login_err)
        data['user'] = {
            'id': str(self.user.id),
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'pos_terminal': str(self.user.pos_terminal_id) if self.user.pos_terminal_id else None,
            'tenant': {
                'id': str(self.user.tenant.id) if self.user.tenant else None,
                'name': self.user.tenant.name if self.user.tenant else None,
                'slug': self.user.tenant.slug if self.user.tenant else None,
            } if self.user.tenant else None,
            'assigned_branches': [
                {'id': str(b.id), 'name': b.name} for b in self.user.assigned_branches.all()
            ]
        }
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    tenant_name = serializers.ReadOnlyField(source='tenant.name')
    tenant_slug = serializers.ReadOnlyField(source='tenant.slug')
    assigned_branches = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'tenant', 'tenant_name', 'tenant_slug', 'assigned_branches', 'is_active']
        read_only_fields = ['id', 'tenant', 'role']

    def get_assigned_branches(self, obj):
        return [{'id': str(b.id), 'name': b.name} for b in obj.assigned_branches.all()]

class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = '__all__'
