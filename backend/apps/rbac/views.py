"""
Views for RBAC and Activity Logging.
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta

from .models import Role, Permission, RolePermission, UserRole, ActivityLog
from .serializers import (
    RoleSerializer, PermissionSerializer, RolePermissionSerializer,
    UserRoleSerializer, ActivityLogSerializer, UserSerializer, UserCreateSerializer
)
from .utils import (
    log_activity, get_user_permissions, has_permission, get_user_roles,
    is_super_admin, get_client_ip, get_user_agent
)

User = get_user_model()


class IsSuperAdminOrReadOnly:
    """
    Permission class that allows super admins full access, others read-only.
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return request.user and request.user.is_authenticated
        return is_super_admin(request.user)


class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing roles.
    Only super admins can create/update/delete roles.
    """
    queryset = Role.objects.filter(is_active=True)
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        log_activity(
            user=self.request.user,
            action_type='create',
            model_name='Role',
            description=f"Created role: {serializer.validated_data.get('name')}",
            object_id=serializer.instance.id if serializer.instance else None,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def perform_update(self, serializer):
        instance = serializer.instance
        serializer.save()
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='Role',
            description=f"Updated role: {instance.name}",
            object_id=instance.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
        log_activity(
            user=self.request.user,
            action_type='delete',
            model_name='Role',
            description=f"Deleted role: {instance.name}",
            object_id=instance.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing permissions (read-only).
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend, filters.OrderingFilter]
    search_fields = ['name', 'codename', 'description']
    filterset_fields = ['category']
    ordering_fields = ['name', 'category', 'created_at']
    ordering = ['category', 'name']


class UserRoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user roles.
    Only super admins can assign/remove roles.
    """
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['user', 'role', 'is_active']
    ordering_fields = ['assigned_at']
    ordering = ['-assigned_at']
    
    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)
        instance = serializer.instance
        log_activity(
            user=self.request.user,
            action_type='permission_change',
            model_name='UserRole',
            description=f"Assigned role '{instance.role.name}' to user '{instance.user.username}'",
            object_id=instance.id,
            related_object=instance.user,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def perform_update(self, serializer):
        instance = serializer.instance
        serializer.save()
        log_activity(
            user=self.request.user,
            action_type='permission_change',
            model_name='UserRole',
            description=f"Updated role assignment: '{instance.role.name}' for user '{instance.user.username}'",
            object_id=instance.id,
            related_object=instance.user,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )


class UserManagementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user management (only for super admins).
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend, filters.OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    filterset_fields = ['is_active', 'is_staff']
    ordering_fields = ['username', 'email', 'date_joined', 'last_login']
    ordering = ['-date_joined']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
    
    def get_queryset(self):
        # Super admins can see all users
        if is_super_admin(self.request.user):
            return User.objects.all()
        # Regular users can only see themselves
        return User.objects.filter(id=self.request.user.id)
    
    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(
            user=self.request.user,
            action_type='create',
            model_name='User',
            description=f"Created user: {user.username} ({user.email})",
            object_id=user.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def perform_update(self, serializer):
        instance = serializer.instance
        serializer.save()
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='User',
            description=f"Updated user: {instance.username}",
            object_id=instance.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def perform_destroy(self, instance):
        # Soft delete: deactivate user instead of deleting
        instance.is_active = False
        instance.save()
        log_activity(
            user=self.request.user,
            action_type='delete',
            model_name='User',
            description=f"Deactivated user: {instance.username}",
            object_id=instance.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    @action(detail=True, methods=['get'])
    def permissions(self, request, pk=None):
        """Get all permissions for a specific user."""
        user = self.get_object()
        permissions = get_user_permissions(user)
        serializer = PermissionSerializer(permissions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def roles(self, request, pk=None):
        """Get all roles for a specific user."""
        user = self.get_object()
        roles = get_user_roles(user)
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def set_password(self, request, pk=None):
        """Set password for a user (super admin only)."""
        if not is_super_admin(request.user):
            return Response(
                {'error': 'Only super admins can set passwords.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user = self.get_object()
        password = request.data.get('password')
        if not password:
            return Response(
                {'error': 'Password is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(password)
        user.save()
        
        log_activity(
            user=request.user,
            action_type='update',
            model_name='User',
            description=f"Changed password for user: {user.username}",
            object_id=user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        return Response({'message': 'Password updated successfully.'})


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing activity logs.
    """
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['user', 'action_type', 'model_name', 'object_id']
    search_fields = ['description', 'user__username', 'user__email']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = ActivityLog.objects.all()
        
        # Super admins can see all logs
        if is_super_admin(self.request.user):
            return queryset
        
        # Regular users can only see their own logs
        return queryset.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent activity logs (last 7 days)."""
        days = int(request.query_params.get('days', 7))
        since = timezone.now() - timedelta(days=days)
        
        queryset = self.get_queryset().filter(created_at__gte=since)
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_user(self, request):
        """Get activity logs for a specific user (super admin only)."""
        if not is_super_admin(request.user):
            return Response(
                {'error': 'Only super admins can view other users\' activity logs.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        queryset = self.get_queryset().filter(user=user)
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_object(self, request):
        """Get activity logs for a specific object."""
        model_name = request.query_params.get('model_name')
        object_id = request.query_params.get('object_id')
        
        if not model_name or not object_id:
            return Response(
                {'error': 'model_name and object_id parameters are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        queryset = self.get_queryset().filter(model_name=model_name, object_id=object_id)
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


