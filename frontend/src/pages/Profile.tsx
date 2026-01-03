import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { rbacAPI, User, Role, Permission } from '../api/rbac'
import toast from 'react-hot-toast'
import ActivityLogs from '../components/ActivityLogs'

const Profile = () => {
  const { user: currentUser, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'roles' | 'activity'>('profile')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    is_active: true,
    role_ids: [] as string[],
  })

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    is_active: true,
    permission_ids: [] as string[],
  })

  const isSuperAdmin = currentUser?.is_super_admin || currentUser?.is_superuser

  const loadCurrentUserData = async () => {
    if (!currentUser?.id) return
    try {
      // Fetch current user with full RBAC data
      const userData = await rbacAPI.getUser(currentUser.id)
      if (userData) {
        // Update auth store with full user data
        updateUser(userData)
      }
    } catch (error: any) {
      console.error('Failed to load user data:', error)
      // Don't show error toast for 404 or if user doesn't exist yet
      if (error.response?.status !== 404) {
        // Silently fail - user data from auth store is sufficient
      }
    }
  }

  useEffect(() => {
    // Load user data with RBAC info on mount
    if (currentUser?.id) {
      loadCurrentUserData()
    }
    // Load roles and permissions if super admin (needed for user modal)
    if (isSuperAdmin) {
      loadRoles()
      loadPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'users' && isSuperAdmin) {
      loadUsers()
    }
    if (activeTab === 'roles' && isSuperAdmin) {
      loadRoles()
      loadPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSuperAdmin])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await rbacAPI.getUsers()
      setUsers(data)
    } catch (error: any) {
      toast.error('Failed to load users')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      setLoading(true)
      const data = await rbacAPI.getRoles()
      setRoles(data)
    } catch (error: any) {
      toast.error('Failed to load roles')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async () => {
    try {
      const data = await rbacAPI.getPermissions()
      setPermissions(data)
    } catch (error: any) {
      toast.error('Failed to load permissions')
      console.error(error)
    }
  }

  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.email || !userForm.password) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      await rbacAPI.createUser(userForm)
      toast.success('User created successfully')
      setShowUserModal(false)
      setUserForm({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        is_active: true,
        role_ids: [],
      })
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create user')
      console.error(error)
    }
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return

    try {
      const { password, ...updateData } = userForm
      await rbacAPI.updateUser(selectedUser.id, updateData)
      toast.success('User updated successfully')
      setShowUserModal(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update user')
      console.error(error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return

    try {
      await rbacAPI.deleteUser(userId)
      toast.success('User deactivated successfully')
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deactivate user')
      console.error(error)
    }
  }

  const handleCreateRole = async () => {
    if (!roleForm.name) {
      toast.error('Please enter role name')
      return
    }

    try {
      await rbacAPI.createRole(roleForm)
      toast.success('Role created successfully')
      setShowRoleModal(false)
      setRoleForm({
        name: '',
        description: '',
        is_active: true,
        permission_ids: [],
      })
      loadRoles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create role')
      console.error(error)
    }
  }

  const handleUpdateRole = async () => {
    if (!selectedRole) return

    try {
      await rbacAPI.updateRole(selectedRole.id, roleForm)
      toast.success('Role updated successfully')
      setShowRoleModal(false)
      setSelectedRole(null)
      loadRoles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update role')
      console.error(error)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return

    try {
      await rbacAPI.deleteRole(roleId)
      toast.success('Role deleted successfully')
      loadRoles()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete role')
      console.error(error)
    }
  }

  const openEditUser = (user: User) => {
    setSelectedUser(user)
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_active: user.is_active,
      role_ids: user.roles?.map(r => r.id) || [],
    })
    setShowUserModal(true)
  }

  const openEditRole = (role: Role) => {
    setSelectedRole(role)
    setRoleForm({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
      permission_ids: role.permissions?.map(p => p.id) || [],
    })
    setShowRoleModal(true)
  }


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile & Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Profile
          </button>
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                User Management
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'roles'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Roles & Permissions
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Activity Logs
          </button>
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">My Profile</h2>
          {!currentUser ? (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p>Loading profile...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <p className="mt-1 text-sm text-gray-900">{currentUser?.username || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{currentUser?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">
                  {currentUser?.first_name || currentUser?.last_name
                    ? `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim()
                    : 'Not provided'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Roles</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {currentUser?.roles && currentUser.roles.length > 0 ? (
                    currentUser.roles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No roles assigned</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (currentUser?.is_super_admin || currentUser?.is_superuser) && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold">User Management</h2>
            <button
              onClick={() => {
                setSelectedUser(null)
                setUserForm({
                  username: '',
                  email: '',
                  password: '',
                  first_name: '',
                  last_name: '',
                  is_active: true,
                  role_ids: [],
                })
                setShowUserModal(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create User
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.map((role) => (
                            <span
                              key={role.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openEditUser(user)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (currentUser?.is_super_admin || currentUser?.is_superuser) && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Roles & Permissions</h2>
            <button
              onClick={() => {
                setSelectedRole(null)
                setRoleForm({
                  name: '',
                  description: '',
                  is_active: true,
                  permission_ids: [],
                })
                setShowRoleModal(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Role
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : (
            <div className="p-6 space-y-4">
              {roles.map((role) => (
                <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{role.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {role.permissions?.map((perm) => (
                          <span
                            key={perm.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {perm.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditRole(role)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'activity' && <ActivityLogs />}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {selectedUser ? 'Edit User' : 'Create User'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username *</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={!!selectedUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              {!selectedUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password *</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={userForm.first_name}
                  onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={userForm.last_name}
                  onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {roles.length === 0 ? (
                    <p className="text-sm text-gray-500">Loading roles...</p>
                  ) : (
                    roles.map((role) => (
                      <label key={role.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userForm.role_ids.includes(role.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserForm({ ...userForm, role_ids: [...userForm.role_ids, role.id] })
                            } else {
                              setUserForm({
                                ...userForm,
                                role_ids: userForm.role_ids.filter((id) => id !== role.id),
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{role.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={userForm.is_active}
                  onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setSelectedUser(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={selectedUser ? handleUpdateUser : handleCreateUser}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {selectedUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {selectedRole ? 'Edit Role' : 'Create Role'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Role Name *</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {permissions.length === 0 ? (
                    <p className="text-sm text-gray-500">Loading permissions...</p>
                  ) : (
                    Object.entries(
                      permissions.reduce((acc, perm) => {
                        if (!acc[perm.category]) acc[perm.category] = []
                        acc[perm.category].push(perm)
                        return acc
                      }, {} as Record<string, Permission[]>)
                    ).map(([category, perms]) => (
                      <div key={category} className="mb-4">
                        <h4 className="font-medium text-sm text-gray-700 mb-2 capitalize">{category}</h4>
                        <div className="space-y-1">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={roleForm.permission_ids.includes(perm.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRoleForm({
                                      ...roleForm,
                                      permission_ids: [...roleForm.permission_ids, perm.id],
                                    })
                                  } else {
                                    setRoleForm({
                                      ...roleForm,
                                      permission_ids: roleForm.permission_ids.filter(
                                        (id) => id !== perm.id
                                      ),
                                    })
                                  }
                                }}
                                className="mr-2"
                              />
                              <span className="text-sm">{perm.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRoleModal(false)
                  setSelectedRole(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={selectedRole ? handleUpdateRole : handleCreateRole}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {selectedRole ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default Profile

