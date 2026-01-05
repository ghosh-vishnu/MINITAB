import { useState, useEffect, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Line, Scatter, Pie } from 'react-chartjs-2'
import ChartDataLabels from 'chartjs-plugin-datalabels'
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
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
)

interface ChartsPanelProps {
  spreadsheetId: string
  cells: Cell[]
}

const ChartsPanel = ({ spreadsheetId, cells }: ChartsPanelProps) => {
  const [charts, setCharts] = useState<Chart[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingChart, setEditingChart] = useState<Chart | null>(null)

  // Extract available columns from cells with data
  const availableColumns = useMemo(() => {
    if (!cells || cells.length === 0) return []
    
    const columnMap = new Map<number, { hasData: boolean; isText: boolean; name: string }>()
    
    cells.forEach(cell => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        const colIndex = cell.column_index
        const existing = columnMap.get(colIndex) || { hasData: false, isText: false, name: `C${colIndex + 1}` }
        existing.hasData = true
        
        // Get column name from header row (row_index 0)
        if (cell.row_index === 0) {
          existing.name = cell.value.toString().trim() || `C${colIndex + 1}`
        }
        
        // Check if value is numeric
        const strValue = cell.value.toString().trim()
        if (strValue && cell.row_index > 0) {
          const numValue = parseFloat(strValue)
          const isNumeric = !isNaN(numValue) && isFinite(numValue) && 
                           (strValue === numValue.toString() || 
                            strValue === String(Number(strValue)) ||
                            /^-?\d+\.?\d*$/.test(strValue))
          if (!isNumeric) {
            existing.isText = true
          }
        }
        
        columnMap.set(colIndex, existing)
      }
    })
    
    return Array.from(columnMap.entries())
      .filter(([_, info]) => info.hasData)
      .map(([colIndex, info]) => ({
        index: colIndex,
        name: info.name,
        isText: info.isText,
      }))
      .sort((a, b) => a.index - b.index)
  }, [cells])

  useEffect(() => {
    loadCharts()
  }, [spreadsheetId])

  // Refresh charts when cells change
  useEffect(() => {
    if (charts.length > 0) {
      // Reload chart data when cells change
      loadChartData()
    }
  }, [cells])

  const loadCharts = async () => {
    try {
      setLoading(true)
      const response = await chartsAPI.list()
      const data = Array.isArray(response) ? response : []
      const userCharts = data.filter((chart: Chart) => chart.spreadsheet === spreadsheetId)
      setCharts(userCharts)
    } catch (error: any) {
      console.error('Failed to load charts:', error)
      if (error.response?.status !== 404) {
        toast.error('Failed to load charts')
      }
      setCharts([])
    } finally {
      setLoading(false)
    }
  }

  const loadChartData = async () => {
    // Chart data will be generated from cells directly
    // No need to call API for data
  }

  // Generate chart data directly from cells
  const generateChartDataFromCells = (chart: Chart): ChartData | null => {
    if (!cells || cells.length === 0) return null

    // Extract data for X-axis column
    const xColumnIndex = chart.x_axis_column
    const xColumnCells = cells
      .filter(cell => cell.column_index === xColumnIndex && cell.row_index > 0)
      .sort((a, b) => a.row_index - b.row_index)
    
    const labels = xColumnCells
      .map(cell => cell.value?.toString().trim() || '')
      .filter(label => label !== '')

    // Extract data for Y-axis columns
    const datasets = chart.y_axis_columns.map((yColIndex, datasetIndex) => {
      const yColumnCells = cells
        .filter(cell => cell.column_index === yColIndex && cell.row_index > 0)
        .sort((a, b) => a.row_index - b.row_index)
      
      const data = yColumnCells
        .map(cell => {
          const value = cell.value
          if (value === null || value === undefined) return 0
          const numValue = parseFloat(value.toString())
          return isNaN(numValue) ? 0 : numValue
        })
        .slice(0, labels.length) // Match length with labels

      // Get column name
      const columnName = availableColumns.find(col => col.index === yColIndex)?.name || `Column ${yColIndex + 1}`

      return {
        label: columnName,
        data: data,
        backgroundColor: getColorForDataset(datasetIndex, chart.chart_type),
        borderColor: getBorderColorForDataset(datasetIndex, chart.chart_type),
        borderWidth: chart.chart_type === 'line' ? 2 : 1,
      }
    })

    return { labels, datasets }
  }

  const getColorForDataset = (index: number, chartType: string): string => {
    const colors = [
      'rgba(54, 162, 235, 0.6)',   // Blue
      'rgba(255, 99, 132, 0.6)',   // Red
      'rgba(75, 192, 192, 0.6)',   // Teal
      'rgba(255, 206, 86, 0.6)',   // Yellow
      'rgba(153, 102, 255, 0.6)',  // Purple
      'rgba(255, 159, 64, 0.6)',   // Orange
    ]
    
    if (chartType === 'line') {
      return colors[index % colors.length].replace('0.6', '0.1')
    }
    return colors[index % colors.length]
  }

  const getBorderColorForDataset = (index: number, _chartType: string): string => {
    const colors = [
      'rgba(54, 162, 235, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)',
    ]
    return colors[index % colors.length]
  }

  const handleCreateChart = async (data: CreateChartData) => {
    try {
      setLoading(true)
      const chart = await chartsAPI.create(data)
      setCharts([...charts, chart])
      setShowCreateModal(false)
      toast.success('Chart created successfully')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create chart')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateChart = async (id: string, data: Partial<Chart>) => {
    try {
      const updatedChart = await chartsAPI.update(id, data)
      setCharts(charts.map(c => c.id === id ? updatedChart : c))
      setEditingChart(null)
      toast.success('Chart updated successfully')
    } catch (error: any) {
      toast.error('Failed to update chart')
    }
  }

  const handleDeleteChart = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this chart?')) {
      return
    }

    try {
      await chartsAPI.delete(id)
      setCharts(charts.filter((c) => c.id !== id))
      toast.success('Chart deleted successfully')
    } catch (error: any) {
      toast.error('Failed to delete chart')
    }
  }

  const renderChart = (chart: Chart) => {
    const chartData = generateChartDataFromCells(chart)
    if (!chartData || chartData.labels.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p>No data available for this chart</p>
            <p className="text-sm mt-2">Add data to the selected columns</p>
          </div>
        </div>
      )
    }

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          display: chartData.datasets.length > 0,
        },
        title: {
          display: true,
          text: chart.title,
          font: {
            size: 16,
            weight: 'bold' as const,
          },
        },
        tooltip: {
          enabled: true,
          mode: 'index' as const,
        },
      },
      scales: chart.chart_type === 'line' || chart.chart_type === 'bar' ? {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
      } : undefined,
    }

    switch (chart.chart_type) {
      case 'bar':
        return (
          <Bar
            data={chartData}
            options={commonOptions}
          />
        )
      
      case 'line':
        return (
          <Line
            plugins={[ChartDataLabels]}
            data={{
              ...chartData,
              datasets: chartData.datasets.map((ds) => ({
                ...ds,
                fill: false,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: ds.borderColor,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
              })),
            }}
            options={{
              ...commonOptions,
              plugins: {
                ...commonOptions.plugins,
                datalabels: {
                  display: true,
                  color: '#000',
                  font: {
                    size: 11,
                    weight: 'bold',
                  },
                  formatter: (value: number) => value.toString(),
                  anchor: 'end' as const,
                  align: 'top' as const,
                  offset: 5,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  padding: 4,
                  borderRadius: 4,
                },
                tooltip: {
                  ...commonOptions.plugins?.tooltip,
                  callbacks: {
                    label: (context: any) => {
                      const label = context.dataset.label || ''
                      const value = context.parsed.y
                      return `${label}: ${value}`
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                  },
                  ticks: {
                    stepSize: 100,
                  },
                },
                x: {
                  grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                  },
                },
              },
            }}
          />
        )
      
      case 'scatter':
        return (
          <Scatter
            data={{
              datasets: chartData.datasets.map(ds => ({
                label: ds.label,
                data: ds.data.map((val, idx) => ({
                  x: idx,
                  y: val,
                })),
                backgroundColor: ds.backgroundColor,
                borderColor: ds.borderColor,
                pointRadius: 5,
                pointHoverRadius: 7,
              })),
            }}
            options={{
              ...commonOptions,
              scales: {
                y: {
                  beginAtZero: true,
                  grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                  },
                },
                x: {
                  grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                  },
                },
              },
            }}
          />
        )
      
      case 'histogram':
        // Create histogram bins
        const allValues = chartData.datasets[0]?.data || []
        if (allValues.length === 0) return <div>No data</div>
        
        const min = Math.min(...allValues)
        const max = Math.max(...allValues)
        const bins = 10
        const binWidth = (max - min) / bins
        const binCounts = new Array(bins).fill(0)
        
        allValues.forEach(val => {
          const binIndex = Math.min(Math.floor((val - min) / binWidth), bins - 1)
          binCounts[binIndex]++
        })
        
        const binLabels = Array.from({ length: bins }, (_, i) => {
          const binStart = min + i * binWidth
          return `${binStart.toFixed(1)}`
        })
        
        return (
          <Bar
            data={{
              labels: binLabels,
              datasets: [{
                label: chartData.datasets[0]?.label || 'Frequency',
                data: binCounts,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
              }],
            }}
            options={commonOptions}
          />
        )
      
      case 'pie':
        // Pie chart - use first dataset only
        const pieData = chartData.datasets[0]
        if (!pieData || pieData.data.length === 0) return <div>No data</div>
        
        const total = pieData.data.reduce((sum, val) => sum + val, 0)
        const colors = [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 159, 64, 0.8)',
        ]
        
        return (
          <Pie
            plugins={[ChartDataLabels]}
            data={{
              labels: chartData.labels,
              datasets: [{
                label: pieData.label,
                data: pieData.data,
                backgroundColor: colors.slice(0, chartData.labels.length),
                borderColor: '#ffffff',
                borderWidth: 2,
              }],
            }}
            options={{
              ...commonOptions,
              plugins: {
                ...commonOptions.plugins,
                datalabels: {
                  display: true,
                  color: '#000',
                  font: {
                    size: 11,
                    weight: 'bold',
                  },
                  formatter: (value: number) => {
                    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
                    return `${value} (${percent}%)`
                  },
                },
              },
            }}
          />
        )
      
      default:
        return <div>Chart type {chart.chart_type} not supported</div>
    }
  }

  if (loading && charts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading charts...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="text-2xl font-bold text-gray-800">Charts</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
        >
          + Create Chart
        </button>
      </div>

      {/* Charts Grid */}
      {!charts || charts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4 text-lg">No charts yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Create Your First Chart
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            {charts.map((chart) => (
              <div key={chart.id} className="bg-white border border-gray-300 rounded-lg shadow-sm p-6">
                {/* Chart Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">{chart.title}</h3>
                    <p className="text-xs text-gray-500">
                      {chart.chart_type.charAt(0).toUpperCase() + chart.chart_type.slice(1)} Chart
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingChart(chart)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      title="Edit Chart"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteChart(chart.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                      title="Delete Chart"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Chart Container */}
                <div className="h-80 bg-white rounded border border-gray-200 p-4 relative">
                  {renderChart(chart)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Chart Modal */}
      {(showCreateModal || editingChart) && (
        <CreateChartModal
          spreadsheetId={spreadsheetId}
          availableColumns={availableColumns}
          onClose={() => {
            setShowCreateModal(false)
            setEditingChart(null)
          }}
          onCreate={handleCreateChart}
          onUpdate={editingChart ? (data) => handleUpdateChart(editingChart.id, data) : undefined}
          editingChart={editingChart}
          loading={loading}
        />
      )}
    </div>
  )
}

interface CreateChartModalProps {
  spreadsheetId: string
  availableColumns: Array<{ index: number; name: string; isText: boolean }>
  onClose: () => void
  onCreate: (data: CreateChartData) => void
  onUpdate?: (data: Partial<Chart>) => void
  editingChart?: Chart | null
  loading: boolean
}

const CreateChartModal = ({
  spreadsheetId,
  availableColumns,
  onClose,
  onCreate,
  onUpdate,
  editingChart,
  loading,
}: CreateChartModalProps) => {
  const [title, setTitle] = useState(editingChart?.title || '')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'histogram' | 'scatter' | 'pie'>(editingChart?.chart_type as any || 'line')
  const [xAxisColumn, setXAxisColumn] = useState<number | ''>(editingChart?.x_axis_column ?? '')
  const [yAxisColumns, setYAxisColumns] = useState<number[]>(editingChart?.y_axis_columns || [])

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

    if (editingChart && onUpdate) {
      onUpdate({
        title,
        chart_type: chartType,
        x_axis_column: xAxisColumn as number,
        y_axis_columns: yAxisColumns,
      })
    } else {
      onCreate({
        spreadsheet: spreadsheetId,
        chart_type: chartType,
        title,
        x_axis_column: xAxisColumn as number,
        y_axis_columns: yAxisColumns,
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {editingChart ? 'Edit Chart' : 'Create Chart'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter chart title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Type *
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="scatter">Scatter Plot</option>
              <option value="histogram">Histogram</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              X-Axis Column (Labels) *
            </label>
            <select
              value={xAxisColumn}
              onChange={(e) => setXAxisColumn(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select column</option>
              {availableColumns.map((col) => (
                <option key={col.index} value={col.index}>
                  {col.name} (C{col.index + 1})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">This column will be used for X-axis labels</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Y-Axis Columns (Data) *
            </label>
            <div className="border border-gray-300 rounded-md p-3 min-h-[100px] max-h-[200px] overflow-y-auto">
              {availableColumns.length === 0 ? (
                <p className="text-gray-400 text-sm">No columns with data available</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableColumns.map((col) => (
                    <button
                      key={col.index}
                      type="button"
                      onClick={() => toggleYColumn(col.index)}
                      disabled={col.index === xAxisColumn}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        yAxisColumns.includes(col.index)
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : col.index === xAxisColumn
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {col.name} (C{col.index + 1})
                    </button>
                  ))}
                </div>
              )}
            </div>
            {yAxisColumns.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {yAxisColumns.map(idx => {
                  const col = availableColumns.find(c => c.index === idx)
                  return col ? col.name : `C${idx + 1}`
                }).join(', ')}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">Select one or more columns for Y-axis data</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : editingChart ? 'Update Chart' : 'Create Chart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChartsPanel
