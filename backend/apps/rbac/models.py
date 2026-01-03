"""
RBAC (Role-Based Access Control) and Activity Logging Models.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

User = get_user_model()


class Role(models.Model):
    """
    Role model for defining user roles (e.g., Super Admin, Admin, Editor, Viewer).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_roles'
    )

    class Meta:
        db_table = 'roles'
        ordering = ['name']
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.name


class Permission(models.Model):
    """
    Permission model for defining specific permissions (e.g., create_spreadsheet, edit_cell, delete_user).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, db_index=True)
    codename = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(
        max_length=50,
        choices=[
            ('spreadsheet', 'Spreadsheet'),
            ('user', 'User Management'),
            ('role', 'Role Management'),
            ('analysis', 'Analysis'),
            ('chart', 'Chart'),
            ('system', 'System'),
        ],
        default='system'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'permissions'
        ordering = ['category', 'name']
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'

    def __str__(self):
        return f"{self.name} ({self.codename})"


class RolePermission(models.Model):
    """
    Many-to-many relationship between Role and Permission.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'role_permissions'
        unique_together = [['role', 'permission']]
        verbose_name = 'Role Permission'
        verbose_name_plural = 'Role Permissions'

    def __str__(self):
        return f"{self.role.name} - {self.permission.name}"


class UserRole(models.Model):
    """
    Many-to-many relationship between User and Role.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_user_roles'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'user_roles'
        unique_together = [['user', 'role']]
        ordering = ['-assigned_at']
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'

    def __str__(self):
        return f"{self.user.username} - {self.role.name}"


class ActivityLog(models.Model):
    """
    Activity Log model for tracking all user actions.
    """
    ACTION_TYPES = [
        ('create', 'Create'),
        ('read', 'Read'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('export', 'Export'),
        ('import', 'Import'),
        ('share', 'Share'),
        ('permission_change', 'Permission Change'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
        db_index=True
    )
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)  # e.g., 'Spreadsheet', 'Cell', 'User'
    object_id = models.UUIDField(null=True, blank=True, db_index=True)  # ID of the affected object
    description = models.TextField()  # Human-readable description
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    
    # For tracking related objects (e.g., which spreadsheet was edited)
    related_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='related_activity_logs'
    )
    related_object_id = models.UUIDField(null=True, blank=True)
    related_object = GenericForeignKey('related_content_type', 'related_object_id')
    
    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True)  # Store additional context
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['model_name', '-created_at']),
            models.Index(fields=['action_type', '-created_at']),
            models.Index(fields=['object_id', '-created_at']),
        ]
        verbose_name = 'Activity Log'
        verbose_name_plural = 'Activity Logs'

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action_type} - {self.model_name} - {self.created_at}"

