import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { spreadsheetsAPI, Spreadsheet } from '../api/spreadsheets'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

const Dashboard = () => {
  const { user } = useAuthStore()
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([])
  const [recentSheets, setRecentSheets] = useState<Spreadsheet[]>([])
  const [favoriteSheets, setFavoriteSheets] = useState<Spreadsheet[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('')
  const [contentTab, setContentTab] = useState<'recent' | 'favorites' | 'connect' | 'onedrive' | 'sharepoint' | 'googledrive' | 'local'>('recent')
  const navigate = useNavigate()

  useEffect(() => {
    loadAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [allData, recentData, favoriteData] = await Promise.all([
        spreadsheetsAPI.list(),
        spreadsheetsAPI.getRecent(),
        spreadsheetsAPI.getFavorites(),
      ])
      setSpreadsheets(Array.isArray(allData) ? allData : [])
      setRecentSheets(Array.isArray(recentData) ? recentData : [])
      setFavoriteSheets(Array.isArray(favoriteData) ? favoriteData : [])
    } catch (error: any) {
      toast.error('Failed to load data')
      console.error('Error loading data:', error)
      setSpreadsheets([])
      setRecentSheets([])
      setFavoriteSheets([])
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
      setRecentSheets(prev => prev.filter(sheet => sheet.id !== id))
      setFavoriteSheets(prev => prev.filter(sheet => sheet.id !== id))
      toast.success('Spreadsheet deleted successfully')
    } catch (error: any) {
      toast.error('Failed to delete spreadsheet')
    }
  }

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const updated = await spreadsheetsAPI.toggleFavorite(id)
      // Update all lists
      setSpreadsheets(prev => 
        prev.map(s => s.id === id ? { ...s, is_favorite: updated.is_favorite } : s)
      )
      setRecentSheets(prev =>
        prev.map(s => s.id === id ? { ...s, is_favorite: updated.is_favorite } : s)
      )
      setFavoriteSheets(prev => 
        updated.is_favorite
          ? [updated, ...prev]
          : prev.filter(s => s.id !== id)
      )
      toast.success(updated.is_favorite ? 'Added to favorites' : 'Removed from favorites')
    } catch (error: any) {
      toast.error('Failed to update favorite status')
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return

    // Validate file type
    const fileName = file.name.toLowerCase()
    const isValidFormat = fileName.endsWith('.csv') || 
                         fileName.endsWith('.xlsx') || 
                         fileName.endsWith('.xls')
    
    if (!isValidFormat) {
      toast.error('Unsupported file format. Please use CSV or Excel files (.csv, .xlsx, .xls)')
      return
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      toast.error('File size exceeds 50MB limit')
      return
    }

    try {
      toast.loading('Creating spreadsheet and importing file...', { id: 'upload' })
      
      // Create new spreadsheet with file name
      const spreadsheetName = file.name.replace(/\.[^/.]+$/, '')
      const spreadsheet = await spreadsheetsAPI.create({
        name: spreadsheetName,
        row_count: 100,
        column_count: 26,
      })

      // Import the file
      if (fileName.endsWith('.csv')) {
        await spreadsheetsAPI.importCSV(spreadsheet.id, file)
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        await spreadsheetsAPI.importExcel(spreadsheet.id, file)
      }

      toast.success('File imported successfully', { id: 'upload' })
      navigate(`/minitab/spreadsheet/${spreadsheet.id}`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Failed to import file'
      toast.error(errorMessage, { id: 'upload' })
      console.error('File upload error:', error)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset input to allow same file selection
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const SheetCard = ({ sheet, onDelete, onToggleFavorite }: { sheet: Spreadsheet; onDelete: (id: string, e: React.MouseEvent) => void; onToggleFavorite: (id: string, e: React.MouseEvent) => void }) => (
    <div
      onClick={() => navigate(`/minitab/spreadsheet/${sheet.id}`)}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <button
          onClick={(e) => onToggleFavorite(sheet.id, e)}
          className="p-2 rounded hover:bg-gray-100 transition-colors"
        >
          <svg
            className={`w-5 h-5 transition-colors ${
              sheet.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      </div>
      <h3 className="font-semibold text-gray-900 mb-1 truncate">{sheet.name}</h3>
      <p className="text-sm text-gray-600 mb-3">
        {new Date(sheet.updated_at).toLocaleDateString()}
      </p>
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/minitab/spreadsheet/${sheet.id}`)
          }}
          className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Open
        </button>
        <button
          onClick={(e) => onDelete(sheet.id, e)}
          className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )

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
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span>Favorites</span>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Open Local File</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1">
              {contentTab === 'recent' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Used</h3>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : recentSheets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No recent spreadsheets</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentSheets.map(sheet => (
                        <SheetCard
                          key={sheet.id}
                          sheet={sheet}
                          onDelete={handleDeleteSpreadsheet}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {contentTab === 'favorites' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Favorite Files</h3>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : favoriteSheets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No favorite spreadsheets</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {favoriteSheets.map(sheet => (
                        <SheetCard
                          key={sheet.id}
                          sheet={sheet}
                          onDelete={handleDeleteSpreadsheet}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {contentTab === 'local' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Local File</h3>
                  <div 
                    className="border-2 border-dashed border-blue-400 rounded-lg p-12 text-center hover:bg-blue-50 transition-colors cursor-pointer"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <label className="cursor-pointer block">
                      <svg className="w-16 h-16 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-gray-900 font-semibold mb-1 text-lg">Upload Excel or CSV File</p>
                      <p className="text-sm text-gray-600 mb-2">Click to browse or drag and drop your file here</p>
                      <p className="text-xs text-gray-500 mb-4">Supported formats: .xlsx, .xls, .csv (Max 50MB)</p>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          document.getElementById('file-upload-input')?.click()
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Select File
                      </button>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileInputChange}
                        className="hidden"
                        id="file-upload-input"
                      />
                    </label>
                  </div>
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">How to use:</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Click "Select File" or drag and drop your Excel/CSV file</li>
                      <li>• The file will be automatically imported into a new spreadsheet</li>
                      <li>• You can then edit, analyze, and save your data</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
