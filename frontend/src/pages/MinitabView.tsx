/**
 * Minitab-style Spreadsheet View
 * Complete Minitab interface with grid, analysis, and charts
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { spreadsheetsAPI, Spreadsheet, Cell, Worksheet } from '../api/spreadsheets'
import MinitabGrid from '../components/MinitabGrid'
import AnalysisPanel from '../components/AnalysisPanel'
import ChartsPanel from '../components/ChartsPanel'
import toast from 'react-hot-toast'

const MinitabView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null)
  const [worksheets, setWorksheets] = useState<Worksheet[]>([])
  const [activeWorksheet, setActiveWorksheet] = useState<Worksheet | null>(null)
  const [cells, setCells] = useState<Cell[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'data' | 'analysis' | 'charts'>('data')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')

  useEffect(() => {
    if (id && id !== 'undefined') {
      loadSpreadsheet()
    } else {
      setLoading(false)
      toast.error('Invalid spreadsheet ID')
      navigate('/dashboard')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load worksheet cells when active worksheet changes
  useEffect(() => {
    if (id && activeWorksheet) {
      loadWorksheetCells(activeWorksheet.id)
    }
  }, [activeWorksheet, id])

  const loadSpreadsheet = async () => {
    if (!id || id === 'undefined') {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      // Load spreadsheet first
      const spreadsheetData = await spreadsheetsAPI.get(id)
      setSpreadsheet(spreadsheetData)
      
      // Load worksheets
      const worksheetsData = await spreadsheetsAPI.getWorksheets(id)
      setWorksheets(worksheetsData)
      
      // Set the first active worksheet or the marked active one
      const activeWs = worksheetsData.find((ws) => ws.is_active) || worksheetsData[0]
      if (activeWs) {
        setActiveWorksheet(activeWs)
        // Cells will be loaded by the useEffect hook above
      } else {
        // No worksheets found, try loading cells directly from spreadsheet (legacy support)
        try {
          const cellsData = await spreadsheetsAPI.getCells(id)
          setCells(cellsData || [])
        } catch (cellError: any) {
          console.warn('No cells found:', cellError)
          setCells([])
        }
      }
    } catch (error: any) {
      console.error('Error loading spreadsheet:', error)
      if (error.response?.status === 404) {
        toast.error('Spreadsheet not found')
        navigate('/dashboard')
      } else {
        toast.error('Failed to load spreadsheet')
      }
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const loadWorksheetCells = async (worksheetId: string) => {
    if (!id) return

    try {
      console.log(`[MinitabView] Loading cells for worksheet: ${worksheetId}`)
      const worksheetCells = await spreadsheetsAPI.getWorksheetCells(id, worksheetId)
      console.log(`[MinitabView] Loaded ${worksheetCells?.length || 0} cells from worksheet`)
      setCells(worksheetCells || [])
      
      // Log sample cells for debugging
      if (worksheetCells && worksheetCells.length > 0) {
        console.log(`[MinitabView] Sample cells:`, worksheetCells.slice(0, 5))
      }
    } catch (error: any) {
      console.error('[MinitabView] Failed to load worksheet cells:', error)
      // Fallback to spreadsheet cells if worksheet cells fail
      try {
        console.log('[MinitabView] Falling back to spreadsheet cells')
        const cellsData = await spreadsheetsAPI.getCells(id)
        console.log(`[MinitabView] Loaded ${cellsData?.length || 0} cells from spreadsheet`)
        setCells(cellsData || [])
      } catch (cellError: any) {
        console.warn('[MinitabView] No cells found:', cellError)
        setCells([])
      }
    }
  }

  const handleCellsUpdate = (updatedCells: Cell[]) => {
    setCells(updatedCells)
    setHasUnsavedChanges(true)
  }

  const handleSaveSpreadsheet = useCallback(async () => {
    if (!id || !spreadsheet) return

    // If file is still "Untitled", ask for a proper name first
    if (spreadsheet.name === 'Untitled' || spreadsheet.name === '') {
      setNewFileName(spreadsheet.name)
      setShowRenameModal(true)
      return
    }

    try {
      setIsSaving(true)
      
      // Save all cells to backend - use worksheet if available
      if (cells.length > 0) {
        if (activeWorksheet) {
          await spreadsheetsAPI.updateWorksheetCells(id, activeWorksheet.id, cells)
        } else {
          // Fallback to bulk update for legacy support
          await spreadsheetsAPI.bulkUpdateCells(id, cells)
        }
      }
      
      // Update spreadsheet metadata
      await spreadsheetsAPI.update(id, {
        name: spreadsheet.name,
      })
      
      // Reload fresh data from backend to ensure sync
      await loadSpreadsheet()
      
      setHasUnsavedChanges(false)
      toast.success('Spreadsheet saved successfully')
    } catch (error: any) {
      console.error('Error saving spreadsheet:', error)
      toast.error('Failed to save spreadsheet')
    } finally {
      setIsSaving(false)
    }
  }, [id, spreadsheet, cells, activeWorksheet])

  const handleSaveWithNewName = useCallback(async () => {
    if (!id || !spreadsheet || !newFileName.trim()) {
      toast.error('Please enter a file name')
      return
    }

    try {
      setIsSaving(true)
      
      // Update spreadsheet name first
      const updatedSpreadsheet = await spreadsheetsAPI.update(id, {
        name: newFileName.trim(),
      })

      // Save all cells to backend - use worksheet if available
      if (cells.length > 0) {
        if (activeWorksheet) {
          await spreadsheetsAPI.updateWorksheetCells(id, activeWorksheet.id, cells)
        } else {
          // Fallback to bulk update for legacy support
          await spreadsheetsAPI.bulkUpdateCells(id, cells)
        }
      }
      
      // Reload fresh data from backend to ensure sync
      await loadSpreadsheet()
      
      setShowRenameModal(false)
      setNewFileName('')
      setHasUnsavedChanges(false)
      toast.success('Spreadsheet saved successfully')
    } catch (error: any) {
      console.error('Error saving spreadsheet:', error)
      toast.error('Failed to save spreadsheet')
    } finally {
      setIsSaving(false)
    }
  }, [id, spreadsheet, cells, newFileName, activeWorksheet])

  // Update document title when spreadsheet name or save status changes
  useEffect(() => {
    if (spreadsheet) {
      const title = hasUnsavedChanges 
        ? `${spreadsheet.name} - Not currently saved`
        : spreadsheet.name
      document.title = title
    }
  }, [spreadsheet, hasUnsavedChanges])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveSpreadsheet()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveSpreadsheet])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading spreadsheet...</div>
      </div>
    )
  }

  if (!spreadsheet) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Spreadsheet not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="minitab-view h-full flex flex-col">
      {/* Header with Save Button */}
      <div className="border-b border-gray-300 bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{spreadsheet.name}</h1>
        </div>
        <button
          onClick={handleSaveSpreadsheet}
          disabled={isSaving || !hasUnsavedChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            hasUnsavedChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          <svg
            className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-300 bg-white">
        <div className="flex items-center px-4">
          <button
            onClick={() => setActiveView('data')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeView === 'data'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Data
          </button>
          <button
            onClick={() => setActiveView('analysis')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeView === 'analysis'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveView('charts')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeView === 'charts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Charts
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'data' && (
          <MinitabGrid
            spreadsheetId={spreadsheet.id}
            rowCount={spreadsheet.row_count}
            columnCount={spreadsheet.column_count}
            cells={cells}
            onCellsUpdate={handleCellsUpdate}
            spreadsheetName={spreadsheet.name}
            worksheetNames={spreadsheet.worksheet_names || {}}
            onWorksheetNamesUpdate={async (names) => {
              await spreadsheetsAPI.saveWorksheetNames(spreadsheet.id, names)
            }}
          />
        )}

        {activeView === 'analysis' && (
          <div className="h-full overflow-auto p-4">
            <AnalysisPanel spreadsheetId={spreadsheet.id} cells={cells} />
          </div>
        )}

        {activeView === 'charts' && (
          <div className="h-full overflow-auto p-4">
            <ChartsPanel spreadsheetId={spreadsheet.id} cells={cells} />
          </div>
        )}
      </div>

      {/* Save As Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Save As</h2>
            <p className="text-sm text-gray-600 mb-4">Please enter a name for your spreadsheet:</p>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g., Sales Report, Budget 2026"
              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveWithNewName()
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRenameModal(false)
                  setNewFileName('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWithNewName}
                disabled={isSaving}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors disabled:bg-gray-400"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MinitabView

