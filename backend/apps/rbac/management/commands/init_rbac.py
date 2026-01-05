"""
Management command to initialize RBAC system with default roles and permissions.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.rbac.models import Role, Permission, RolePermission, UserRole

User = get_user_model()


class Command(BaseCommand):
    help = 'Initialize RBAC system with default roles and permissions'

    def handle(self, *args, **options):
        self.stdout.write('Initializing RBAC system...')
        
        # Create default permissions
        permissions_data = [
            # Spreadsheet permissions
            {'name': 'Create Spreadsheet', 'codename': 'create_spreadsheet', 'category': 'spreadsheet'},
            {'name': 'View Spreadsheet', 'codename': 'view_spreadsheet', 'category': 'spreadsheet'},
            {'name': 'Edit Spreadsheet', 'codename': 'edit_spreadsheet', 'category': 'spreadsheet'},
            {'name': 'Delete Spreadsheet', 'codename': 'delete_spreadsheet', 'category': 'spreadsheet'},
            {'name': 'Import Spreadsheet', 'codename': 'import_spreadsheet', 'category': 'spreadsheet'},
            {'name': 'Export Spreadsheet', 'codename': 'export_spreadsheet', 'category': 'spreadsheet'},
            
            # User management permissions
            {'name': 'Create User', 'codename': 'create_user', 'category': 'user'},
            {'name': 'View User', 'codename': 'view_user', 'category': 'user'},
            {'name': 'Edit User', 'codename': 'edit_user', 'category': 'user'},
            {'name': 'Delete User', 'codename': 'delete_user', 'category': 'user'},
            
            # Role management permissions
            {'name': 'Create Role', 'codename': 'create_role', 'category': 'role'},
            {'name': 'View Role', 'codename': 'view_role', 'category': 'role'},
            {'name': 'Edit Role', 'codename': 'edit_role', 'category': 'role'},
            {'name': 'Delete Role', 'codename': 'delete_role', 'category': 'role'},
            {'name': 'Assign Role', 'codename': 'assign_role', 'category': 'role'},
            
            # Analysis permissions
            {'name': 'Run Analysis', 'codename': 'run_analysis', 'category': 'analysis'},
            {'name': 'View Analysis', 'codename': 'view_analysis', 'category': 'analysis'},
            
            # Chart permissions
            {'name': 'Create Chart', 'codename': 'create_chart', 'category': 'chart'},
            {'name': 'View Chart', 'codename': 'view_chart', 'category': 'chart'},
            {'name': 'Delete Chart', 'codename': 'delete_chart', 'category': 'chart'},
            
            # System permissions
            {'name': 'View Activity Logs', 'codename': 'view_activity_logs', 'category': 'system'},
            {'name': 'Manage System', 'codename': 'manage_system', 'category': 'system'},
        ]
        
        created_permissions = []
        for perm_data in permissions_data:
            permission, created = Permission.objects.get_or_create(
                codename=perm_data['codename'],
                defaults=perm_data
            )
            if created:
                created_permissions.append(permission.name)
                self.stdout.write(self.style.SUCCESS(f'Created permission: {permission.name}'))
            else:
                self.stdout.write(f'Permission already exists: {permission.name}')
        
        # Create default roles
        roles_data = [
            {
                'name': 'Super Admin',
                'description': 'Full system access with all permissions',
                'permissions': [p['codename'] for p in permissions_data]
            },
            {
                'name': 'Admin',
                'description': 'Administrative access with user and role management',
                'permissions': [
                    'create_spreadsheet', 'view_spreadsheet', 'edit_spreadsheet', 'delete_spreadsheet',
                    'import_spreadsheet', 'export_spreadsheet',
                    'create_user', 'view_user', 'edit_user', 'delete_user',
                    'view_role', 'assign_role',
                    'run_analysis', 'view_analysis',
                    'create_chart', 'view_chart', 'delete_chart',
                    'view_activity_logs'
                ]
            },
            {
                'name': 'Editor',
                'description': 'Can create, edit, and view spreadsheets',
                'permissions': [
                    'create_spreadsheet', 'view_spreadsheet', 'edit_spreadsheet',
                    'import_spreadsheet', 'export_spreadsheet',
                    'run_analysis', 'view_analysis',
                    'create_chart', 'view_chart', 'delete_chart'
                ]
            },
            {
                'name': 'Viewer',
                'description': 'Can only view spreadsheets and analysis',
                'permissions': [
                    'view_spreadsheet', 'export_spreadsheet',
                    'view_analysis', 'view_chart'
                ]
            },
        ]
        
        for role_data in roles_data:
            permissions = role_data.pop('permissions')
            role, created = Role.objects.get_or_create(
                name=role_data['name'],
                defaults=role_data
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created role: {role.name}'))
                # Assign permissions to role
                for perm_codename in permissions:
                    try:
                        permission = Permission.objects.get(codename=perm_codename)
                        RolePermission.objects.get_or_create(role=role, permission=permission)
                    except Permission.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Permission not found: {perm_codename}'))
            else:
                self.stdout.write(f'Role already exists: {role.name}')
        
        # Assign Super Admin role to all existing superusers
        super_admin_role = Role.objects.filter(name='Super Admin').first()
        if super_admin_role:
            superusers = User.objects.filter(is_superuser=True)
            for user in superusers:
                UserRole.objects.get_or_create(
                    user=user,
                    role=super_admin_role,
                    defaults={'is_active': True}
                )
                self.stdout.write(self.style.SUCCESS(f'Assigned Super Admin role to: {user.username}'))
        
        self.stdout.write(self.style.SUCCESS('\nRBAC system initialized successfully!'))


