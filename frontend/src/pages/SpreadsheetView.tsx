import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { spreadsheetsAPI, Spreadsheet, Cell, Worksheet } from '../api/spreadsheets'
import { analysisAPI } from '../api/analysis'
import { chartsAPI, Chart } from '../api/charts'
import SpreadsheetGrid from '../components/SpreadsheetGrid'
import ExcelSpreadsheet from '../components/ExcelSpreadsheet'
import AnalysisPanel from '../components/AnalysisPanel'
import ChartsPanel from '../components/ChartsPanel'
import SheetTabs from '../components/SheetTabs'
import toast from 'react-hot-toast'

const SpreadsheetView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null)
  const [worksheets, setWorksheets] = useState<Worksheet[]>([])
  const [activeWorksheet, setActiveWorksheet] = useState<Worksheet | null>(null)
  const [cells, setCells] = useState<Cell[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'analysis' | 'charts'>('spreadsheet')
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    if (id) {
      loadSpreadsheet()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load worksheet cells when active worksheet changes
  useEffect(() => {
    if (id && activeWorksheet) {
      loadWorksheetCells(activeWorksheet.id)
    }
  }, [activeWorksheet])

  const loadSpreadsheet = async () => {
    if (!id) return

    try {
      setLoading(true)
      console.log('[DEBUG] Loading spreadsheet with ID:', id)
      
      const spreadsheetData = await spreadsheetsAPI.get(id)
      console.log('[DEBUG] Spreadsheet data:', spreadsheetData)
      setSpreadsheet(spreadsheetData)

      // Load worksheets
      console.log('[DEBUG] Fetching worksheets...')
      const worksheetsData = await spreadsheetsAPI.getWorksheets(id)
      console.log('[DEBUG] Worksheets data:', worksheetsData)
      console.log('[DEBUG] Number of worksheets:', worksheetsData.length)
      setWorksheets(worksheetsData)

      // Set the first active worksheet or the marked active one
      const activeWs = worksheetsData.find((ws) => ws.is_active) || worksheetsData[0]
      console.log('[DEBUG] Active worksheet:', activeWs)
      if (activeWs) {
        setActiveWorksheet(activeWs)
        const worksheetCells = await spreadsheetsAPI.getWorksheetCells(id, activeWs.id)
        console.log('[DEBUG] Worksheet cells:', worksheetCells)
        setCells(worksheetCells)
      }
    } catch (error: any) {
      console.error('[ERROR] Failed to load spreadsheet:', error)
      toast.error('Failed to load spreadsheet: ' + (error.message || 'Unknown error'))
      console.error(error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadWorksheetCells = async (worksheetId: string) => {
    if (!id) return

    try {
      const worksheetCells = await spreadsheetsAPI.getWorksheetCells(id, worksheetId)
      setCells(worksheetCells)
    } catch (error: any) {
      toast.error('Failed to load worksheet cells')
      console.error(error)
    }
  }

  const handleSelectWorksheet = async (worksheet: Worksheet) => {
    if (!id) return

    try {
      await spreadsheetsAPI.setActiveWorksheet(id, worksheet.id)
      setActiveWorksheet(worksheet)
      
      // Update the worksheets list to reflect the active state
      const updatedWorksheets = worksheets.map((ws) => ({
        ...ws,
        is_active: ws.id === worksheet.id,
      }))
      setWorksheets(updatedWorksheets)
    } catch (error: any) {
      toast.error('Failed to switch worksheet')
      console.error(error)
    }
  }

  const handleAddWorksheet = async (name: string): Promise<Worksheet> => {
    if (!id) throw new Error('Spreadsheet ID is required')

    try {
      console.log('[DEBUG] Creating worksheet with name:', name)
      const newWorksheet = await spreadsheetsAPI.createWorksheet(id, name)
      console.log('[DEBUG] New worksheet created:', newWorksheet)
      
      // Activate the new worksheet on backend
      console.log('[DEBUG] Activating worksheet on backend...')
      await spreadsheetsAPI.setActiveWorksheet(id, newWorksheet.id)
      console.log('[DEBUG] Worksheet activated')
      
      // Fetch fresh worksheets list from server to ensure consistency
      console.log('[DEBUG] Refreshing worksheets list from server...')
      const refreshedWorksheets = await spreadsheetsAPI.getWorksheets(id)
      console.log('[DEBUG] Refreshed worksheets:', refreshedWorksheets)
      setWorksheets(refreshedWorksheets)
      
      // Set the newly created one as active
      const activeWs = refreshedWorksheets.find((ws) => ws.id === newWorksheet.id) || newWorksheet
      console.log('[DEBUG] Setting active worksheet:', activeWs)
      setActiveWorksheet({ ...activeWs, is_active: true })
      setCells([]) // Clear cells for the new empty worksheet
      
      toast.success(`Sheet '${name}' created`)
      console.log('[DEBUG] Sheet creation complete')
      return activeWs
    } catch (error: any) {
      console.error('[ERROR] Failed to create worksheet:', error)
      toast.error('Failed to create sheet: ' + (error.message || 'Unknown error'))
      throw error
    }
  }

  const handleRenameWorksheet = async (worksheetId: string, newName: string) => {
    if (!id) return

    await spreadsheetsAPI.renameWorksheet(id, worksheetId, newName)
    const updatedWorksheets = worksheets.map((ws) =>
      ws.id === worksheetId ? { ...ws, name: newName } : ws
    )
    setWorksheets(updatedWorksheets)
    
    // Update active worksheet if it's the renamed one
    if (activeWorksheet?.id === worksheetId) {
      setActiveWorksheet({ ...activeWorksheet, name: newName })
    }
  }

  const handleDeleteWorksheet = async (worksheetId: string) => {
    if (!id) return

    await spreadsheetsAPI.deleteWorksheet(id, worksheetId)
    const updatedWorksheets = worksheets.filter((ws) => ws.id !== worksheetId)
    setWorksheets(updatedWorksheets)

    // If deleted worksheet was active, switch to the first remaining one
    if (activeWorksheet?.id === worksheetId && updatedWorksheets.length > 0) {
      handleSelectWorksheet(updatedWorksheets[0])
    }
  }

  const handleCellsUpdate = async (updatedCells: Cell[]) => {
    setCells(updatedCells)
    
    // Save cells to backend immediately (with debounce via SpreadsheetGrid's setTimeout)
    if (id && activeWorksheet) {
      try {
        await spreadsheetsAPI.updateWorksheetCells(id, activeWorksheet.id, updatedCells)
        // Don't show success toast for every cell change to avoid spam
      } catch (error: any) {
        // Show error toast when save fails
        toast.error('Failed to save cell to database: ' + (error.response?.data?.error || error.message))
      }
    }
  }

  const handleFileImport = async (file: File, type: 'csv' | 'excel') => {
    if (!id) return

    try {
      toast.loading('Importing file...', { id: 'import' })
      
      if (type === 'csv') {
        await spreadsheetsAPI.importCSV(id, file)
      } else {
        await spreadsheetsAPI.importExcel(id, file)
      }
      
      toast.success('File imported successfully', { id: 'import' })
      setShowImportModal(false)
      
      // Reload spreadsheet to show imported data
      await loadSpreadsheet()
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'Failed to import file'
      toast.error(errorMessage, { id: 'import' })
      console.error('Import error:', error)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    if (!id || !spreadsheet) return

    try {
      let blob: Blob
      let filename: string
      let mimeType: string

      if (format === 'csv') {
        blob = await spreadsheetsAPI.exportCSV(id, spreadsheet.name)
        filename = `${spreadsheet.name}.csv`
        mimeType = 'text/csv'
      } else {
        blob = await spreadsheetsAPI.exportExcel(id, spreadsheet.name)
        filename = `${spreadsheet.name}.xlsx`
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('File exported successfully')
    } catch (error: any) {
      toast.error('Failed to export file')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading spreadsheet...</div>
      </div>
    )
  }

  if (!spreadsheet) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Spreadsheet not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{spreadsheet.name}</h1>
          {spreadsheet.description && (
            <p className="text-gray-600 mt-1">{spreadsheet.description}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary"
          >
            Import
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-secondary"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="btn btn-secondary"
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('spreadsheet')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'spreadsheet'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Spreadsheet
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analysis'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'charts'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Charts
          </button>
        </nav>
      </div>

      {activeTab === 'spreadsheet' && (
        <div className="w-full flex flex-col flex-1">
          {/* Sheet Tabs */}
          {worksheets.length > 0 && activeWorksheet && (
            <SheetTabs
              spreadsheetId={spreadsheet.id}
              worksheets={worksheets}
              activeWorksheet={activeWorksheet}
              onSelectWorksheet={handleSelectWorksheet}
              onAddWorksheet={handleAddWorksheet}
              onRenameWorksheet={handleRenameWorksheet}
              onDeleteWorksheet={handleDeleteWorksheet}
            />
          )}

          {/* Spreadsheet Grid */}
          <div className="w-full flex-1">
            <SpreadsheetGrid
              spreadsheetId={spreadsheet.id}
              worksheetId={activeWorksheet?.id}
              rowCount={spreadsheet.row_count}
              columnCount={spreadsheet.column_count}
              cells={cells}
              onCellsUpdate={handleCellsUpdate}
            />
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <AnalysisPanel spreadsheetId={spreadsheet.id} cells={cells} />
      )}

      {activeTab === 'charts' && (
        <ChartsPanel spreadsheetId={spreadsheet.id} cells={cells} />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleFileImport}
        />
      )}
    </div>
  )
}

interface ImportModalProps {
  onClose: () => void
  onImport: (file: File, type: 'csv' | 'excel') => void
}

const ImportModal = ({ onClose, onImport }: ImportModalProps) => {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const detectFileType = (fileName: string): 'csv' | 'excel' => {
    const lowerName = fileName.toLowerCase()
    if (lowerName.endsWith('.csv')) return 'csv'
    return 'excel'
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024
      if (selectedFile.size > maxSize) {
        toast.error('File size exceeds 50MB limit')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setIsProcessing(true)
    try {
      const type = detectFileType(file.name)
      await onImport(file, type)
    } catch (error) {
      // Error is handled by parent component
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const maxSize = 50 * 1024 * 1024
      if (droppedFile.size > maxSize) {
        toast.error('File size exceeds 50MB limit')
        return
      }
      setFile(droppedFile)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Import File</h2>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            {file ? (
              <div>
                <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600">
                  {isDragging ? 'Drop file here' : 'Click to select or drag and drop'}
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV, XLSX, XLS (Max 50MB)</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary" disabled={isProcessing}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || isProcessing}
            className="btn btn-primary"
          >
            {isProcessing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SpreadsheetView

