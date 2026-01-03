import api from './axios'

export interface LoginCredentials {
  username?: string
  email?: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  password_confirm: string
  first_name?: string
  last_name?: string
}

export interface AuthResponse {
  user: {
    id: string
    username: string
    email: string
    first_name?: string
    last_name?: string
    is_super_admin?: boolean
    is_superuser?: boolean
    roles?: Array<{ id: string; name: string; description?: string }>
    permissions?: Array<{ id: string; name: string; codename: string }>
  }
  access: string
  refresh: string
}

export const authAPI = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/', credentials)
    return response.data
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register/', data)
    return response.data
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post('/auth/logout/', { refresh: refreshToken })
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile/')
    return response.data
  },
}

