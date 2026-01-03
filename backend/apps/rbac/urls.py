"""
URLs for RBAC and Activity Logging.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RoleViewSet, PermissionViewSet, UserRoleViewSet,
    UserManagementViewSet, ActivityLogViewSet
)

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'user-roles', UserRoleViewSet, basename='user-role')
router.register(r'users', UserManagementViewSet, basename='user-management')
router.register(r'activity-logs', ActivityLogViewSet, basename='activity-log')

urlpatterns = [
    path('', include(router.urls)),
]

