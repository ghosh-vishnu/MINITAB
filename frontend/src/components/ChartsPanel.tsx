import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { chartsAPI, Chart, ChartData, CreateChartData } from '../api/charts'
import { Cell } from '../api/spreadsheets'
import toast from 'react-hot-toast'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface ChartsPanelProps {
  spreadsheetId: string
  cells: Cell[]
}

const ChartsPanel = ({ spreadsheetId, cells }: ChartsPanelProps) => {
  const [charts, setCharts] = useState<Chart[]>([])
  const [chartData, setChartData] = useState<Record<string, ChartData>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Get available columns from cells
  const availableColumns = Array.from(
    new Set(cells.map((cell) => cell.column_index))
  ).sort((a, b) => a - b)

  useEffect(() => {
    loadCharts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadsheetId])

  const loadCharts = async () => {
    try {
      setLoading(true)
      const response = await chartsAPI.list()
      
      // Handle paginated response or direct array
      const data = Array.isArray(response) ? response : (response.results || response.data || [])
      
      // Filter charts by spreadsheet ID
      const userCharts = data.filter((chart: Chart) => chart.spreadsheet === spreadsheetId)
      setCharts(userCharts)

      // Load chart data for each chart
      for (const chart of userCharts) {
        try {
          const chartDataResponse = await chartsAPI.getData(chart.id)
          setChartData((prev) => ({ ...prev, [chart.id]: chartDataResponse }))
        } catch (error) {
          console.error(`Failed to load data for chart ${chart.id}:`, error)
          // Set empty data instead of failing completely
          setChartData((prev) => ({
            ...prev,
            [chart.id]: { labels: [], datasets: [] },
          }))
        }
      }
    } catch (error: any) {
      console.error('Failed to load charts:', error)
      // Don't show error toast for 404 or empty responses (no charts yet is normal)
      const status = error.response?.status
      if (status && status !== 404 && status !== 200) {
        toast.error('Failed to load charts')
      }
      setCharts([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleCreateChart = async (data: CreateChartData) => {
    try {
      setLoading(true)
      const chart = await chartsAPI.create(data)
      setCharts([...charts, chart])
      
      // Load chart data
      const chartDataResponse = await chartsAPI.getData(chart.id)
      setChartData((prev) => ({ ...prev, [chart.id]: chartDataResponse }))
      
      setShowCreateModal(false)
      toast.success('Chart created successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create chart')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteChart = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this chart?')) {
      return
    }

    try {
      await chartsAPI.delete(id)
      setCharts(charts.filter((c) => c.id !== id))
      const newChartData = { ...chartData }
      delete newChartData[id]
      setChartData(newChartData)
      toast.success('Chart deleted successfully')
    } catch (error: any) {
      toast.error('Failed to delete chart')
    }
  }

  const renderChart = (chart: Chart) => {
    const data = chartData[chart.id]
    if (!data) {
      return <div className="text-gray-500">Loading chart data...</div>
    }

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: chart.title,
        },
      },
    }

    if (chart.chart_type === 'bar') {
      return (
        <Bar
          data={{
            labels: data.labels,
            datasets: data.datasets.map((dataset, index) => ({
              ...dataset,
              backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
              borderColor: `hsl(${(index * 137.5) % 360}, 70%, 40%)`,
              borderWidth: 1,
            })),
          }}
          options={chartOptions}
        />
      )
    }

    if (chart.chart_type === 'line') {
      return (
        <Line
          data={{
            labels: data.labels,
            datasets: data.datasets.map((dataset, index) => ({
              ...dataset,
              borderColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
              backgroundColor: `hsla(${(index * 137.5) % 360}, 70%, 50%, 0.1)`,
              borderWidth: 2,
              fill: false,
            })),
          }}
          options={chartOptions}
        />
      )
    }

    return <div>Chart type {chart.chart_type} not yet implemented</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading charts...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Charts</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Create Chart
        </button>
      </div>

      {!charts || charts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No charts yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create Your First Chart
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.isArray(charts) && charts.map((chart) => (
            <div key={chart.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{chart.title}</h3>
                <button
                  onClick={() => handleDeleteChart(chart.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
              <div className="h-64">
                {renderChart(chart)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateChartModal
          spreadsheetId={spreadsheetId}
          availableColumns={availableColumns}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateChart}
          loading={loading}
        />
      )}
    </div>
  )
}

interface CreateChartModalProps {
  spreadsheetId: string
  availableColumns: number[]
  onClose: () => void
  onCreate: (data: CreateChartData) => void
  loading: boolean
}

const CreateChartModal = ({
  spreadsheetId,
  availableColumns,
  onClose,
  onCreate,
  loading,
}: CreateChartModalProps) => {
  const [title, setTitle] = useState('')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'histogram' | 'scatter'>('bar')
  const [xAxisColumn, setXAxisColumn] = useState<number | ''>('')
  const [yAxisColumns, setYAxisColumns] = useState<number[]>([])

  const toggleYColumn = (colIndex: number) => {
    if (yAxisColumns.includes(colIndex)) {
      setYAxisColumns(yAxisColumns.filter((c) => c !== colIndex))
    } else {
      setYAxisColumns([...yAxisColumns, colIndex])
    }
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter a chart title')
      return
    }

    if (xAxisColumn === '') {
      toast.error('Please select an X-axis column')
      return
    }

    if (yAxisColumns.length === 0) {
      toast.error('Please select at least one Y-axis column')
      return
    }

    onCreate({
      spreadsheet: spreadsheetId,
      chart_type: chartType,
      title,
      x_axis_column: xAxisColumn as number,
      y_axis_columns: yAxisColumns,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Create Chart</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Enter chart title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Type
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
              className="input"
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="histogram">Histogram</option>
              <option value="scatter">Scatter Plot</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              X-Axis Column
            </label>
            <select
              value={xAxisColumn}
              onChange={(e) => setXAxisColumn(e.target.value ? parseInt(e.target.value) : '')}
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
              Y-Axis Columns
            </label>
            <div className="flex flex-wrap gap-2">
              {availableColumns.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggleYColumn(col)}
                  className={`px-3 py-1 rounded ${
                    yAxisColumns.includes(col)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Col {col}
                </button>
              ))}
            </div>
            {yAxisColumns.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {yAxisColumns.join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Creating...' : 'Create Chart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChartsPanel

