import { useState } from 'react'
import { analysisAPI, PerformAnalysisData } from '../api/analysis'
import { Cell } from '../api/spreadsheets'
import toast from 'react-hot-toast'

interface AnalysisPanelProps {
  spreadsheetId: string
  cells: Cell[]
}

const AnalysisPanel = ({ spreadsheetId, cells }: AnalysisPanelProps) => {
  const [analysisType, setAnalysisType] = useState<'summary_stats' | 'correlation' | 'regression' | 'custom'>('summary_stats')
  const [selectedColumns, setSelectedColumns] = useState<number[]>([])
  const [xColumn, setXColumn] = useState<number | ''>('')
  const [yColumn, setYColumn] = useState<number | ''>('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Get available columns from cells
  const availableColumns = Array.from(
    new Set(cells.map((cell) => cell.column_index))
  ).sort((a, b) => a - b)

  const handlePerformAnalysis = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column')
      return
    }

    if (analysisType === 'regression') {
      if (xColumn === '' || yColumn === '') {
        toast.error('Please select both X and Y columns for regression')
        return
      }
    }

    if (analysisType === 'correlation' && selectedColumns.length < 2) {
      toast.error('Correlation requires at least 2 columns')
      return
    }

    setLoading(true)
    try {
      const data: PerformAnalysisData = {
        spreadsheet_id: spreadsheetId,
        analysis_type: analysisType,
        selected_columns: selectedColumns,
        parameters:
          analysisType === 'regression'
            ? { x_column: xColumn, y_column: yColumn }
            : {},
      }

      const response = await analysisAPI.performAnalysis(data)
      setResults(response.results)
      toast.success('Analysis completed successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleColumn = (colIndex: number) => {
    if (selectedColumns.includes(colIndex)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== colIndex))
    } else {
      setSelectedColumns([...selectedColumns, colIndex])
    }
  }

  const renderResults = () => {
    if (!results) return null

    if (analysisType === 'summary_stats') {
      return (
        <div className="space-y-4">
          {Object.entries(results).map(([colIndex, stats]: [string, any]) => (
            <div key={colIndex} className="card">
              <h3 className="font-semibold mb-2">Column {colIndex}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Count</div>
                  <div className="text-lg font-semibold">{stats.count}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Mean</div>
                  <div className="text-lg font-semibold">{stats.mean?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Median</div>
                  <div className="text-lg font-semibold">{stats.median?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Std Dev</div>
                  <div className="text-lg font-semibold">{stats.std_dev?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Min</div>
                  <div className="text-lg font-semibold">{stats.min?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Max</div>
                  <div className="text-lg font-semibold">{stats.max?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Range</div>
                  <div className="text-lg font-semibold">{stats.range?.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Mode</div>
                  <div className="text-lg font-semibold">{stats.mode?.toFixed(2) || 'N/A'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (analysisType === 'correlation') {
      return (
        <div className="card">
          <h3 className="font-semibold mb-4">Correlation Matrix</h3>
          {results.pairs && results.pairs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Column 1
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Column 2
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Correlation
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.pairs.map((pair: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">Column {pair.column1}</td>
                      <td className="px-4 py-2 text-sm">Column {pair.column2}</td>
                      <td className="px-4 py-2 text-sm font-semibold">
                        {pair.correlation.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No correlation data available</p>
          )}
        </div>
      )
    }

    if (analysisType === 'regression') {
      return (
        <div className="card">
          <h3 className="font-semibold mb-4">Linear Regression Results</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Equation: </span>
              <span className="font-semibold">{results.equation}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">R-squared: </span>
              <span className="font-semibold">{results.r_squared?.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Slope: </span>
              <span className="font-semibold">{results.slope?.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Intercept: </span>
              <span className="font-semibold">{results.intercept?.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">P-value: </span>
              <span className="font-semibold">{results.p_value?.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Sample Size: </span>
              <span className="font-semibold">{results.n}</span>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Statistical Analysis</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Type
            </label>
            <select
              value={analysisType}
              onChange={(e) => {
                setAnalysisType(e.target.value as any)
                setSelectedColumns([])
                setResults(null)
              }}
              className="input"
            >
              <option value="summary_stats">Summary Statistics</option>
              <option value="correlation">Correlation</option>
              <option value="regression">Linear Regression</option>
              <option value="custom">Custom Analysis</option>
            </select>
          </div>

          {analysisType === 'regression' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  X Column (Independent)
                </label>
                <select
                  value={xColumn}
                  onChange={(e) => setXColumn(e.target.value ? parseInt(e.target.value) : '')}
                  className="input"
                >
                  <option value="">Select column</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      Column {col}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Y Column (Dependent)
                </label>
                <select
                  value={yColumn}
                  onChange={(e) => setYColumn(e.target.value ? parseInt(e.target.value) : '')}
                  className="input"
                >
                  <option value="">Select column</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      Column {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Columns
              </label>
              <div className="flex flex-wrap gap-2">
                {availableColumns.map((col) => (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col)}
                    className={`px-3 py-1 rounded ${
                      selectedColumns.includes(col)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Col {col}
                  </button>
                ))}
              </div>
              {selectedColumns.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedColumns.join(', ')}
                </p>
              )}
            </div>
          )}

          <button
            onClick={handlePerformAnalysis}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Analyzing...' : 'Perform Analysis'}
          </button>
        </div>
      </div>

      {results && renderResults()}
    </div>
  )
}

export default AnalysisPanel



