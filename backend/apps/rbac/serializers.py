"""
Serializers for RBAC and Activity Logging.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Role, Permission, RolePermission, UserRole, ActivityLog
from .utils import get_user_roles, get_user_permissions

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""
    
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'description', 'category', 'created_at']
        read_only_fields = ['id', 'created_at']


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    permissions = serializers.SerializerMethodField()
    permission_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'description', 'is_active', 'created_at', 'updated_at',
            'created_by', 'created_by_username', 'permissions', 'permission_ids'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        role = Role.objects.create(**validated_data)
        
        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            for permission in permissions:
                RolePermission.objects.create(role=role, permission=permission)
        
        return role
    
    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permission_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if permission_ids is not None:
            # Clear existing permissions
            RolePermission.objects.filter(role=instance).delete()
            # Add new permissions
            if permission_ids:
                permissions = Permission.objects.filter(id__in=permission_ids)
                for permission in permissions:
                    RolePermission.objects.create(role=instance, permission=permission)
        
        return instance


class RolePermissionSerializer(serializers.ModelSerializer):
    """Serializer for RolePermission model."""
    role_name = serializers.CharField(source='role.name', read_only=True)
    permission_name = serializers.CharField(source='permission.name', read_only=True)
    
    class Meta:
        model = RolePermission
        fields = ['id', 'role', 'role_name', 'permission', 'permission_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserRoleSerializer(serializers.ModelSerializer):
    """Serializer for UserRole model."""
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_description = serializers.CharField(source='role.description', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    assigned_by_username = serializers.CharField(source='assigned_by.username', read_only=True)
    
    class Meta:
        model = UserRole
        fields = [
            'id', 'user', 'user_username', 'user_email', 'role', 'role_name',
            'role_description', 'assigned_by', 'assigned_by_username',
            'is_active', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at']


class UserSerializer(serializers.ModelSerializer):
    """Extended User serializer with roles and permissions."""
    roles = serializers.SerializerMethodField()
    role_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    permissions = serializers.SerializerMethodField()
    is_super_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login',
            'roles', 'role_ids', 'permissions', 'is_super_admin'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'is_superuser']
    
    def get_roles(self, obj):
        """Get user roles."""
        user_roles = get_user_roles(obj)
        return RoleSerializer(user_roles, many=True).data
    
    def get_permissions(self, obj):
        """Get user permissions."""
        user_permissions = get_user_permissions(obj)
        return PermissionSerializer(user_permissions, many=True).data
    
    def get_roles(self, obj):
        """Get user roles."""
        user_roles = get_user_roles(obj)
        return RoleSerializer(user_roles, many=True).data
    
    def get_permissions(self, obj):
        """Get user permissions."""
        user_permissions = get_user_permissions(obj)
        return PermissionSerializer(user_permissions, many=True).data
    
    def get_is_super_admin(self, obj):
        from .utils import is_super_admin
        return is_super_admin(obj)
    
    def create(self, validated_data):
        role_ids = validated_data.pop('role_ids', [])
        password = validated_data.pop('password', None)
        
        user = User.objects.create_user(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        
        if role_ids:
            roles = Role.objects.filter(id__in=role_ids, is_active=True)
            for role in roles:
                UserRole.objects.create(
                    user=user,
                    role=role,
                    assigned_by=self.context['request'].user if self.context.get('request') else None
                )
        
        return user
    
    def update(self, instance, validated_data):
        role_ids = validated_data.pop('role_ids', None)
        password = validated_data.pop('password', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        
        if role_ids is not None:
            # Clear existing active roles
            UserRole.objects.filter(user=instance).update(is_active=False)
            # Add new roles
            if role_ids:
                roles = Role.objects.filter(id__in=role_ids, is_active=True)
                for role in roles:
                    UserRole.objects.update_or_create(
                        user=instance,
                        role=role,
                        defaults={
                            'is_active': True,
                            'assigned_by': self.context['request'].user if self.context.get('request') else None
                        }
                    )
        
        return instance


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivityLog model."""
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'user_username', 'user_email', 'action_type',
            'action_type_display', 'model_name', 'object_id', 'description',
            'ip_address', 'user_agent', 'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users (used by super admin)."""
    password = serializers.CharField(write_only=True, required=True)
    role_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'first_name', 'last_name',
            'is_active', 'role_ids'
        ]
        read_only_fields = ['id']
    
    def create(self, validated_data):
        role_ids = validated_data.pop('role_ids', [])
        password = validated_data.pop('password')
        
        user = User.objects.create_user(
            username=validated_data.get('username'),
            email=validated_data.get('email'),
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            is_active=validated_data.get('is_active', True)
        )
        
        if role_ids:
            roles = Role.objects.filter(id__in=role_ids, is_active=True)
            assigned_by = self.context['request'].user if self.context.get('request') else None
            for role in roles:
                UserRole.objects.create(
                    user=user,
                    role=role,
                    assigned_by=assigned_by
                )
        
        return user

