/**
 * Minitab-style Spreadsheet View
 * Complete Minitab interface with grid, analysis, and charts
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { spreadsheetsAPI, Spreadsheet, Cell } from '../api/spreadsheets'
import MinitabGrid from '../components/MinitabGrid'
import AnalysisPanel from '../components/AnalysisPanel'
import ChartsPanel from '../components/ChartsPanel'
import toast from 'react-hot-toast'

const MinitabView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null)
  const [cells, setCells] = useState<Cell[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'data' | 'analysis' | 'charts'>('data')

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
      
      // Then load cells (might be empty, which is fine)
      try {
        const cellsData = await spreadsheetsAPI.getCells(id)
        setCells(cellsData || [])
      } catch (cellError: any) {
        // If cells endpoint fails (404), just use empty array
        console.warn('No cells found or cells endpoint not available:', cellError)
        setCells([])
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

  const handleCellsUpdate = (updatedCells: Cell[]) => {
    setCells(updatedCells)
  }

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
    </div>
  )
}

export default MinitabView

