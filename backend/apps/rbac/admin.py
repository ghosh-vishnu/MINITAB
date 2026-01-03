from django.contrib import admin
from .models import Role, Permission, RolePermission, UserRole, ActivityLog


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'is_active', 'created_at', 'created_by')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'codename', 'category', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('name', 'codename', 'description')
    readonly_fields = ('id', 'created_at')


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'created_at')
    list_filter = ('role', 'permission', 'created_at')
    search_fields = ('role__name', 'permission__name')
    readonly_fields = ('id', 'created_at')


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'assigned_by', 'is_active', 'assigned_at')
    list_filter = ('role', 'is_active', 'assigned_at')
    search_fields = ('user__username', 'user__email', 'role__name')
    readonly_fields = ('id', 'assigned_at')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action_type', 'model_name', 'description', 'ip_address', 'created_at')
    list_filter = ('action_type', 'model_name', 'created_at')
    search_fields = ('user__username', 'user__email', 'description', 'ip_address')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'created_at'

