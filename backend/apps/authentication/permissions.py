from rest_framework import permissions


class IsSuperUser(permissions.BasePermission):
    """Allow access only to superusers.

    This is intentionally simple: for now we trust Django's built-in
    `is_superuser` flag for authorization. Later this can be extended to
    check `user_type`, roles, or more advanced RBAC logic.
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)
