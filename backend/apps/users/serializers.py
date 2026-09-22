from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.users.models import User

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

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': str(self.user.id),
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
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
