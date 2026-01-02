import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { spreadsheetsAPI, Spreadsheet, Cell } from '../api/spreadsheets'
import { analysisAPI } from '../api/analysis'
import { chartsAPI, Chart } from '../api/charts'
import SpreadsheetGrid from '../components/SpreadsheetGrid'
import ExcelSpreadsheet from '../components/ExcelSpreadsheet'
import AnalysisPanel from '../components/AnalysisPanel'
import ChartsPanel from '../components/ChartsPanel'
import toast from 'react-hot-toast'

const SpreadsheetView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null)
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

  const loadSpreadsheet = async () => {
    if (!id) return

    try {
      setLoading(true)
      const [spreadsheetData, cellsData] = await Promise.all([
        spreadsheetsAPI.get(id),
        spreadsheetsAPI.getCells(id),
      ])
      setSpreadsheet(spreadsheetData)
      setCells(cellsData)
    } catch (error: any) {
      toast.error('Failed to load spreadsheet')
      console.error(error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleCellsUpdate = (updatedCells: Cell[]) => {
    setCells(updatedCells)
  }

  const handleFileImport = async (file: File, type: 'csv' | 'excel') => {
    if (!id) return

    try {
      if (type === 'csv') {
        await spreadsheetsAPI.importCSV(id, file)
      } else {
        await spreadsheetsAPI.importExcel(id, file)
      }
      toast.success('File imported successfully')
      setShowImportModal(false)
      loadSpreadsheet()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import file')
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
    <div>
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
        <div className="w-full">
          <SpreadsheetGrid
            spreadsheetId={spreadsheet.id}
            rowCount={spreadsheet.row_count}
            columnCount={spreadsheet.column_count}
            cells={cells}
            onCellsUpdate={handleCellsUpdate}
          />
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
  const [type, setType] = useState<'csv' | 'excel'>('csv')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = () => {
    if (file) {
      onImport(file, type)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Import File</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'csv' | 'excel')}
              className="input"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              accept={type === 'csv' ? '.csv' : '.xlsx,.xls'}
              className="input"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file}
            className="btn btn-primary"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}

export default SpreadsheetView

