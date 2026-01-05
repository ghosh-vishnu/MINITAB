"""
Utility functions for RBAC and Activity Logging.
"""
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from .models import Role, Permission, UserRole, RolePermission, ActivityLog

User = get_user_model()


def log_activity(
    user,
    action_type,
    model_name,
    description,
    object_id=None,
    related_object=None,
    ip_address=None,
    user_agent=None,
    metadata=None
):
    """
    Helper function to log user activities.
    
    Args:
        user: User instance or None
        action_type: One of ActivityLog.ACTION_TYPES
        model_name: Name of the model (e.g., 'Spreadsheet', 'Cell')
        description: Human-readable description
        object_id: UUID of the affected object
        related_object: Related object instance (e.g., Spreadsheet for Cell operations)
        ip_address: IP address of the request
        user_agent: User agent string
        metadata: Additional metadata as dict
    """
    related_content_type = None
    related_object_id = None
    
    if related_object:
        related_content_type = ContentType.objects.get_for_model(related_object)
        related_object_id = related_object.id if hasattr(related_object, 'id') else None
    
    ActivityLog.objects.create(
        user=user,
        action_type=action_type,
        model_name=model_name,
        object_id=object_id,
        description=description,
        related_content_type=related_content_type,
        related_object_id=related_object_id,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata or {}
    )


def get_user_permissions(user):
    """
    Get all permissions for a user based on their roles.
    
    Args:
        user: User instance
        
    Returns:
        QuerySet of Permission objects
    """
    if not user or not user.is_authenticated:
        return Permission.objects.none()
    
    # Superusers have all permissions
    if user.is_superuser:
        return Permission.objects.all()
    
    # Get active roles for the user
    user_roles = UserRole.objects.filter(user=user, is_active=True, role__is_active=True)
    role_ids = user_roles.values_list('role_id', flat=True)
    
    # Get permissions for those roles
    role_permissions = RolePermission.objects.filter(role_id__in=role_ids)
    permission_ids = role_permissions.values_list('permission_id', flat=True)
    
    return Permission.objects.filter(id__in=permission_ids).distinct()


def has_permission(user, permission_codename):
    """
    Check if a user has a specific permission.
    
    Args:
        user: User instance
        permission_codename: Codename of the permission
        
    Returns:
        Boolean
    """
    if not user or not user.is_authenticated:
        return False
    
    # Superusers have all permissions
    if user.is_superuser:
        return True
    
    user_permissions = get_user_permissions(user)
    return user_permissions.filter(codename=permission_codename).exists()


def get_user_roles(user):
    """
    Get all active roles for a user.
    
    Args:
        user: User instance
        
    Returns:
        QuerySet of Role objects
    """
    if not user or not user.is_authenticated:
        return Role.objects.none()
    
    if user.is_superuser:
        # Return a special "Super Admin" role if it exists, or all roles
        return Role.objects.filter(name='Super Admin') or Role.objects.all()
    
    user_roles = UserRole.objects.filter(user=user, is_active=True, role__is_active=True)
    return Role.objects.filter(id__in=user_roles.values_list('role_id', flat=True))


def is_super_admin(user):
    """
    Check if user is a super admin (either Django superuser or has Super Admin role).
    
    Args:
        user: User instance
        
    Returns:
        Boolean
    """
    if not user or not user.is_authenticated:
        return False
    
    if user.is_superuser:
        return True
    
    super_admin_role = Role.objects.filter(name='Super Admin', is_active=True).first()
    if super_admin_role:
        return UserRole.objects.filter(user=user, role=super_admin_role, is_active=True).exists()
    
    return False


def get_client_ip(request):
    """
    Get client IP address from request.
    
    Args:
        request: Django request object
        
    Returns:
        IP address string
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_user_agent(request):
    """
    Get user agent from request.
    
    Args:
        request: Django request object
        
    Returns:
        User agent string
    """
    return request.META.get('HTTP_USER_AGENT', '')


