import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { spreadsheetsAPI, Spreadsheet } from '../api/spreadsheets'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const Dashboard = () => {
  const { user } = useAuthStore()
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('')
  const [contentTab, setContentTab] = useState<'recent' | 'favorites' | 'connect' | 'onedrive' | 'sharepoint' | 'googledrive' | 'local'>('recent')
  const navigate = useNavigate()

  useEffect(() => {
    loadSpreadsheets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSpreadsheets = async () => {
    try {
      setLoading(true)
      const data = await spreadsheetsAPI.list()
      setSpreadsheets(Array.isArray(data) ? data : [])
    } catch (error: any) {
      toast.error('Failed to load spreadsheets')
      console.error('Error loading spreadsheets:', error)
      setSpreadsheets([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSpreadsheet = async () => {
    if (!newSpreadsheetName.trim()) {
      toast.error('Please enter a name')
      return
    }

    try {
      const spreadsheet = await spreadsheetsAPI.create({
        name: newSpreadsheetName,
        row_count: 100,
        column_count: 26,
      })
      toast.success('Spreadsheet created successfully')
      setShowCreateModal(false)
      setNewSpreadsheetName('')
      navigate(`/minitab/spreadsheet/${spreadsheet.id}`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create spreadsheet')
    }
  }

  const handleDeleteSpreadsheet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this spreadsheet?')) {
      return
    }

    try {
      await spreadsheetsAPI.delete(id)
      // Remove from local state immediately
      setSpreadsheets(prev => prev.filter(sheet => sheet.id !== id))
      toast.success('Spreadsheet deleted successfully')
    } catch (error: any) {
      toast.error('Failed to delete spreadsheet')
    }
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* New Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">New</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Analytics - Excel Statistical Software */}
            <button
              onClick={async () => {
                // Create a new spreadsheet and open it
                try {
                  const spreadsheet = await spreadsheetsAPI.create({
                    name: 'Untitled',
                    row_count: 100,
                    column_count: 26,
                  })
                  
                  // Validate response has id
                  if (!spreadsheet) {
                    toast.error('Failed to create spreadsheet: No response')
                    return
                  }
                  
                  if (!spreadsheet.id) {
                    toast.error('Failed to create spreadsheet: Missing ID in response')
                    console.error('Spreadsheet creation response:', spreadsheet)
                    return
                  }
                  
                  // Navigate to the new spreadsheet
                  navigate(`/minitab/spreadsheet/${spreadsheet.id}`)
                } catch (error: any) {
                  console.error('Error creating spreadsheet:', error)
                  const errorMessage = error.response?.data?.error || 
                                      error.response?.data?.message || 
                                      'Failed to create spreadsheet'
                  toast.error(errorMessage)
                }
              }}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow text-left group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Excel® Statistical Software</h3>
              <p className="text-sm text-gray-600">Analytics</p>
            </button>

            {/* Brainstorm */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Excel Brainstorm</h3>
              <p className="text-sm text-gray-600">Brainstorm</p>
            </div>

            {/* Data Prep */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Excel Data Center</h3>
              <p className="text-sm text-gray-600">Data Prep</p>
            </div>

            {/* Dashboard */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Excel Dashboards</h3>
              <p className="text-sm text-gray-600">Dashboard</p>
            </div>

            {/* Quality Project */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Excel Workspace®</h3>
              <p className="text-sm text-gray-600">Quality Project</p>
            </div>
          </div>
        </div>

        {/* My Content Section */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">My Content</h2>
          <div className="flex gap-6">
            {/* Left Sidebar Navigation */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                <button
                  onClick={() => setContentTab('recent')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'recent'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Recent</span>
                </button>
                <button
                  onClick={() => setContentTab('favorites')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'favorites'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>Favorites</span>
                </button>
                <button
                  onClick={() => setContentTab('connect')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'connect'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  </div>
                  <span>Excel Connect®</span>
                </button>
                <button
                  onClick={() => setContentTab('onedrive')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'onedrive'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-5 h-5 bg-blue-500 rounded"></div>
                  <span>Microsoft OneDrive®</span>
                </button>
                <button
                  onClick={() => setContentTab('sharepoint')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'sharepoint'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">S</div>
                  <span>Microsoft SharePoint®</span>
                </button>
                <button
                  onClick={() => setContentTab('googledrive')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'googledrive'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-5 h-5 bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 rounded"></div>
                  <span>Google Drive™</span>
                </button>
                <button
                  onClick={() => setContentTab('local')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    contentTab === 'local'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Open Local File</span>
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg">
              {/* Filters and Search */}
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center gap-4">
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Type</option>
                    <option>All Types</option>
                    <option>Spreadsheet</option>
                    <option>Project</option>
                  </select>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>All Repositories</option>
                  </select>
                </div>
              </div>

              {/* Table Headers */}
              <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-700">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Opened ^</div>
                  <div className="col-span-3">Repository</div>
                  <div className="col-span-3">Account & Actions</div>
                </div>
              </div>

              {/* Content List */}
              <div className="p-8">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 text-gray-300 mb-4">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">Loading...</p>
                  </div>
                ) : contentTab === 'recent' && spreadsheets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 text-gray-300 mb-4">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 mb-2">No recent files</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Create a new spreadsheet
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {spreadsheets.map((spreadsheet) => (
                      <Link
                        key={spreadsheet.id}
                        to={`/minitab/spreadsheet/${spreadsheet.id}`}
                        className="block px-4 py-3 hover:bg-gray-50 rounded-md transition-colors group"
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4 flex items-center gap-3">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-gray-900">{spreadsheet.name}</span>
                          </div>
                          <div className="col-span-2 text-sm text-gray-600">
                            {new Date(spreadsheet.updated_at).toLocaleDateString()}
                          </div>
                          <div className="col-span-3 text-sm text-gray-600">Local</div>
                          <div className="col-span-3 flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-600">{getUserInitials()}</span>
                            <button
                              onClick={(e) => handleDeleteSpreadsheet(spreadsheet.id, e)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded text-sm font-medium transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Spreadsheet</h2>
            <input
              type="text"
              value={newSpreadsheetName}
              onChange={(e) => setNewSpreadsheetName(e.target.value)}
              placeholder="Spreadsheet name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSpreadsheet()
                }
              }}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewSpreadsheetName('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSpreadsheet}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
