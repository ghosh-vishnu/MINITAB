import api from './axios'

export interface Permission {
  id: string
  name: string
  codename: string
  description?: string
  category: 'spreadsheet' | 'user' | 'role' | 'analysis' | 'chart' | 'system'
  created_at: string
}

export interface Role {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  created_by_username?: string
  permissions?: Permission[]
  permission_ids?: string[]
}

export interface UserRole {
  id: string
  user: string
  user_username?: string
  user_email?: string
  role: string
  role_name?: string
  role_description?: string
  assigned_by?: string
  assigned_by_username?: string
  is_active: boolean
  assigned_at: string
}

export interface User {
  id: string
  username: string
  email: string
  first_name?: string
  last_name?: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login?: string
  roles?: Role[]
  role_ids?: string[]
  permissions?: Permission[]
  is_super_admin?: boolean
}

export interface ActivityLog {
  id: string
  user?: string
  user_username?: string
  user_email?: string
  action_type: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import' | 'share' | 'permission_change'
  action_type_display?: string
  model_name: string
  object_id?: string
  description: string
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, any>
  created_at: string
}

export interface CreateUserData {
  username: string
  email: string
  password: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  role_ids?: string[]
}

export interface UpdateUserData {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  role_ids?: string[]
}

export interface CreateRoleData {
  name: string
  description?: string
  is_active?: boolean
  permission_ids?: string[]
}

export interface UpdateRoleData {
  name?: string
  description?: string
  is_active?: boolean
  permission_ids?: string[]
}

export const rbacAPI = {
  // Roles
  getRoles: async (): Promise<Role[]> => {
    const response = await api.get<any>('/rbac/roles/')
    return response.data.results || response.data
  },

  getRole: async (id: string): Promise<Role> => {
    const response = await api.get<Role>(`/rbac/roles/${id}/`)
    return response.data
  },

  createRole: async (data: CreateRoleData): Promise<Role> => {
    const response = await api.post<Role>('/rbac/roles/', data)
    return response.data
  },

  updateRole: async (id: string, data: UpdateRoleData): Promise<Role> => {
    const response = await api.patch<Role>(`/rbac/roles/${id}/`, data)
    return response.data
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/rbac/roles/${id}/`)
  },

  // Permissions
  getPermissions: async (category?: string): Promise<Permission[]> => {
    const params = category ? { category } : {}
    const response = await api.get<any>('/rbac/permissions/', { params })
    return response.data.results || response.data
  },

  getPermission: async (id: string): Promise<Permission> => {
    const response = await api.get<Permission>(`/rbac/permissions/${id}/`)
    return response.data
  },

  // User Management
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<any>('/rbac/users/')
    return response.data.results || response.data
  },

  getUser: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/rbac/users/${id}/`)
    return response.data
  },

  createUser: async (data: CreateUserData): Promise<User> => {
    const response = await api.post<User>('/rbac/users/', data)
    return response.data
  },

  updateUser: async (id: string, data: UpdateUserData): Promise<User> => {
    const response = await api.patch<User>(`/rbac/users/${id}/`, data)
    return response.data
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/rbac/users/${id}/`)
  },

  setUserPassword: async (id: string, password: string): Promise<void> => {
    await api.post(`/rbac/users/${id}/set_password/`, { password })
  },

  getUserPermissions: async (id: string): Promise<Permission[]> => {
    const response = await api.get<Permission[]>(`/rbac/users/${id}/permissions/`)
    return response.data
  },

  getUserRoles: async (id: string): Promise<Role[]> => {
    const response = await api.get<Role[]>(`/rbac/users/${id}/roles/`)
    return response.data
  },

  // User Roles
  getUserRolesList: async (): Promise<UserRole[]> => {
    const response = await api.get<UserRole[]>('/rbac/user-roles/')
    return response.data
  },

  createUserRole: async (data: { user: string; role: string }): Promise<UserRole> => {
    const response = await api.post<UserRole>('/rbac/user-roles/', data)
    return response.data
  },

  updateUserRole: async (id: string, data: Partial<UserRole>): Promise<UserRole> => {
    const response = await api.patch<UserRole>(`/rbac/user-roles/${id}/`, data)
    return response.data
  },

  deleteUserRole: async (id: string): Promise<void> => {
    await api.delete(`/rbac/user-roles/${id}/`)
  },

  // Activity Logs
  getActivityLogs: async (params?: {
    user?: string
    action_type?: string
    model_name?: string
    object_id?: string
  }): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>('/rbac/activity-logs/', { params })
    return response.data
  },

  getActivityLog: async (id: string): Promise<ActivityLog> => {
    const response = await api.get<ActivityLog>(`/rbac/activity-logs/${id}/`)
    return response.data
  },

  getRecentActivityLogs: async (days: number = 7): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>('/rbac/activity-logs/recent/', { params: { days } })
    return response.data
  },

  getActivityLogsByUser: async (userId: string): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>('/rbac/activity-logs/by_user/', { params: { user_id: userId } })
    return response.data
  },

  getActivityLogsByObject: async (modelName: string, objectId: string): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[]>('/rbac/activity-logs/by_object/', {
      params: { model_name: modelName, object_id: objectId }
    })
    return response.data
  },
}  

