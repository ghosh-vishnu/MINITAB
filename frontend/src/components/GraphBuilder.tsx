import { useState, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Line, Scatter } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

interface GraphBuilderProps {
  isOpen: boolean
  onClose: () => void
  columns?: string[]
  cells?: Array<{ row_index: number; column_index: number; value: any }>
  spreadsheetId?: string
}

const GraphBuilder = ({ isOpen, onClose, columns = ['C1', 'C2'], cells = [], spreadsheetId }: GraphBuilderProps) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'histogram' | 'probability' | 'boxplot' | 'interval' | 'individual' | 'variability' | 'line'>('gallery')
  const [selectedVariables, setSelectedVariables] = useState<string[]>([])
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const variablesDropZoneRef = useRef<HTMLDivElement>(null)

  // Extract columns that have data from cells
  const availableColumns = useMemo(() => {
    if (!cells || cells.length === 0) return columns
    
    const columnMap = new Map<number, boolean>()
    cells.forEach(cell => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        columnMap.set(cell.column_index, true)
      }
    })
    
    const colsWithData: string[] = []
    for (let i = 0; i < 100; i++) { // Check up to 100 columns
      if (columnMap.has(i)) {
        colsWithData.push(`C${i + 1}`)
      }
    }
    
    return colsWithData.length > 0 ? colsWithData : columns
  }, [cells, columns])

  // Extract actual data for a column
  const getColumnData = (columnName: string): number[] => {
    if (!cells || cells.length === 0) return []
    
    const columnIndex = parseInt(columnName.replace('C', '')) - 1
    const columnValues: number[] = []
    
    cells.forEach(cell => {
      if (cell.column_index === columnIndex) {
        const value = cell.value
        if (value !== null && value !== undefined && value !== '') {
          const numValue = parseFloat(value.toString())
          if (!isNaN(numValue)) {
            columnValues.push(numValue)
          }
        }
      }
    })
    
    return columnValues
  }

  // Generate data for charts using actual spreadsheet data
  const generateData = (variable: string) => {
    const columnData = getColumnData(variable)
    
    // If we have actual data, use it; otherwise generate sample data
    if (columnData.length > 0) {
      return columnData
    }
    
    // Fallback to sample data if no actual data
    const dataPoints = 20
    const values: number[] = []
    for (let i = 0; i < dataPoints; i++) {
      values.push(Math.floor(Math.random() * 100) + 1)
    }
    return values
  }

  // Prepare chart data based on selected variables and active tab
  const getChartData = () => {
    if (selectedVariables.length === 0) return null

    if (activeTab === 'histogram') {
      const data = selectedVariables.map((variable, index) => {
        const values = generateData(variable)
        // Create bins for histogram
        const bins = 10
        const min = Math.min(...values)
        const max = Math.max(...values)
        const binWidth = (max - min) / bins
        const binCounts = new Array(bins).fill(0)
        
        values.forEach(val => {
          const binIndex = Math.min(Math.floor((val - min) / binWidth), bins - 1)
          binCounts[binIndex]++
        })

        const binLabels = Array.from({ length: bins }, (_, i) => {
          const binStart = min + i * binWidth
          return `${binStart.toFixed(1)}-${(binStart + binWidth).toFixed(1)}`
        })

        return {
          label: variable,
          data: binCounts,
          backgroundColor: `hsla(${(index * 137.5) % 360}, 70%, 50%, 0.6)`,
          borderColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
          borderWidth: 1,
        }
      })

      // Use actual data range for labels
      const allValues = selectedVariables.flatMap(v => generateData(v))
      const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0
      const dataMax = allValues.length > 0 ? Math.max(...allValues) : 100
      const binWidth = (dataMax - dataMin) / 10
      
      return {
        labels: Array.from({ length: 10 }, (_, i) => {
          const binStart = dataMin + i * binWidth
          return `${binStart.toFixed(1)}-${(binStart + binWidth).toFixed(1)}`
        }),
        datasets: data,
      }
    }

    if (activeTab === 'line') {
      const maxLength = Math.max(...selectedVariables.map(v => generateData(v).length), 20)
      const labels = Array.from({ length: maxLength }, (_, i) => `Point ${i + 1}`)
      const datasets = selectedVariables.map((variable, index) => ({
        label: variable,
        data: generateData(variable),
        borderColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        backgroundColor: `hsla(${(index * 137.5) % 360}, 70%, 50%, 0.1)`,
        borderWidth: 2,
        fill: false,
      }))

      return { labels, datasets }
    }

    // Default bar chart - use actual data
    const maxLength = Math.max(...selectedVariables.map(v => generateData(v).length), 10)
    const labels = Array.from({ length: maxLength }, (_, i) => `Row ${i + 1}`)
    const datasets = selectedVariables.map((variable, index) => {
      const values = generateData(variable)
      // Pad or truncate to match maxLength
      const paddedValues = Array.from({ length: maxLength }, (_, i) => values[i] || 0)
      return {
        label: variable,
        data: paddedValues,
        backgroundColor: `hsla(${(index * 137.5) % 360}, 70%, 50%, 0.6)`,
        borderColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
        borderWidth: 1,
      }
    })

    return { labels, datasets }
  }

  const chartData = getChartData()

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, column: string) => {
    setDraggedColumn(column)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (variablesDropZoneRef.current) {
      variablesDropZoneRef.current.classList.add('border-blue-400', 'bg-blue-50')
    }
  }

  const handleDragLeave = () => {
    if (variablesDropZoneRef.current) {
      variablesDropZoneRef.current.classList.remove('border-blue-400', 'bg-blue-50')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (variablesDropZoneRef.current) {
      variablesDropZoneRef.current.classList.remove('border-blue-400', 'bg-blue-50')
    }
    
    if (draggedColumn && !selectedVariables.includes(draggedColumn)) {
      setSelectedVariables([...selectedVariables, draggedColumn])
    }
    setDraggedColumn(null)
  }

  if (!isOpen) return null

  const graphTabs = [
    { id: 'gallery' as const, label: 'Gallery', icon: 'grid' },
    { id: 'histogram' as const, label: 'Histogram', icon: 'bar' },
    { id: 'probability' as const, label: 'Probability Plot', icon: 'scatter' },
    { id: 'boxplot' as const, label: 'Boxplot', icon: 'box' },
    { id: 'interval' as const, label: 'Interval Plot', icon: 'interval' },
    { id: 'individual' as const, label: 'Individual Value Plot', icon: 'dot' },
    { id: 'variability' as const, label: 'Variability Chart', icon: 'variability' },
    { id: 'line' as const, label: 'Line', icon: 'line' },
  ]

  const handleCreate = () => {
    if (selectedVariables.length === 0) {
      toast.error('Please select at least one variable')
      return
    }
    toast.success('Graph created successfully')
    onClose()
  }

  const handleReset = () => {
    setSelectedVariables([])
    toast.info('Graph builder reset')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-[90vw] h-[85vh] max-w-[1200px] max-h-[800px] flex flex-col">
        {/* Header */}
        <div className="bg-blue-800 text-white px-6 py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg font-semibold">Graph Builder</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-700 rounded"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-700 rounded"
              title="Maximize"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-red-600 rounded"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Variables */}
          <div className="w-64 border-r border-gray-300 bg-gray-50 flex flex-col">
            <div className="p-4 border-b border-gray-300">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Available Columns</h3>
              <div className="space-y-1">
                {availableColumns.map((col) => (
                  <div
                    key={col}
                    draggable
                    onDragStart={(e) => handleDragStart(e, col)}
                    onClick={() => {
                      if (selectedVariables.includes(col)) {
                        setSelectedVariables(selectedVariables.filter(v => v !== col))
                      } else {
                        setSelectedVariables([...selectedVariables, col])
                      }
                    }}
                    className={`p-2 text-sm rounded cursor-move transition-colors ${
                      selectedVariables.includes(col)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {col}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Variables</h3>
              <div
                ref={variablesDropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="bg-white border-2 border-dashed border-gray-300 rounded h-full flex items-center justify-center transition-colors min-h-[200px]"
              >
                {selectedVariables.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center px-4">
                    Drag columns here or click to add
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Panel - Graph Types and Gallery */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Variables Section */}
            {selectedVariables.length > 0 && (
              <div className="border-b border-gray-300 px-6 py-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">Variables:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedVariables.map((col) => (
                      <div
                        key={col}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                      >
                        <span>{col}</span>
                        <button
                          onClick={() => setSelectedVariables(selectedVariables.filter(v => v !== col))}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Graph Type Tabs */}
            <div className="border-b border-gray-300 bg-gray-50 px-4 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {graphTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-white'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {tab.icon === 'grid' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    )}
                    {tab.icon === 'bar' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )}
                    {tab.icon === 'scatter' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    )}
                    {tab.icon === 'box' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )}
                    {tab.icon === 'interval' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )}
                    {tab.icon === 'dot' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    {tab.icon === 'variability' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    )}
                    {tab.icon === 'line' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    )}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gallery Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'gallery' ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-600 text-lg">See all the different ways to visualize your data.</p>
                    <div className="relative">
                      <select className="px-3 py-1.5 border border-gray-300 rounded text-sm appearance-none bg-white pr-8">
                        <option>All</option>
                        <option>Distribution of data</option>
                        <option>Relationships between variables</option>
                        <option>Variables over time</option>
                      </select>
                      <svg className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {selectedVariables.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {/* Graph Icons Grid */}
                      <div className="grid grid-cols-3 gap-4 mb-6 w-full max-w-2xl">
                        {Array.from({ length: 9 }).map((_, index) => (
                          <div
                            key={index}
                            className="bg-gray-100 border-2 border-gray-300 rounded-lg p-6 flex items-center justify-center aspect-square opacity-50"
                          >
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-500 text-sm">Add columns to see the available graphs.</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Select a Visualization</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Histogram Preview */}
                        <div
                          onClick={() => setActiveTab('histogram')}
                          className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                        >
                          <div className="h-32 mb-2">
                            {chartData && (
                              <Bar
                                data={chartData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    title: { display: false },
                                  },
                                  scales: {
                                    y: { display: false },
                                    x: { display: false },
                                  },
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedVariables.length >= 2 ? `${selectedVariables[1]} by ${selectedVariables[0]}` : `${selectedVariables[0]}`}
                          </p>
                          <p className="text-xs text-gray-500">Histogram</p>
                        </div>

                        {/* Probability Plot Preview */}
                        <div
                          onClick={() => setActiveTab('probability')}
                          className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                        >
                          <div className="h-32 mb-2">
                            {chartData && (
                              <Line
                                data={chartData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    title: { display: false },
                                  },
                                  scales: {
                                    y: { display: false },
                                    x: { display: false },
                                  },
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedVariables.length >= 2 ? `${selectedVariables[1]} by ${selectedVariables[0]}` : `${selectedVariables[0]}`}
                          </p>
                          <p className="text-xs text-gray-500">Probability Plot</p>
                        </div>

                        {/* Boxplot Preview */}
                        <div
                          onClick={() => setActiveTab('boxplot')}
                          className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                        >
                          <div className="h-32 mb-2 flex items-center justify-center">
                            {chartData && (
                              <Bar
                                data={chartData}
                                options={{
                                  indexAxis: 'y' as const,
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    title: { display: false },
                                  },
                                  scales: {
                                    y: { display: false },
                                    x: { display: false },
                                  },
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedVariables.length >= 2 ? `${selectedVariables[1]} vs ${selectedVariables[0]}` : `${selectedVariables[0]}`}
                          </p>
                          <p className="text-xs text-gray-500">Boxplot</p>
                        </div>

                        {/* Interval Plot Preview */}
                        <div
                          onClick={() => setActiveTab('interval')}
                          className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                        >
                          <div className="h-32 mb-2">
                            {chartData && (
                              <Bar
                                data={chartData}
                                options={{
                                  indexAxis: 'y' as const,
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    title: { display: false },
                                  },
                                  scales: {
                                    y: { display: false },
                                    x: { display: false },
                                  },
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedVariables.length >= 2 ? `${selectedVariables[1]} vs ${selectedVariables[0]}` : `${selectedVariables[0]}`}
                          </p>
                          <p className="text-xs text-gray-500">Interval Plot</p>
                        </div>

                        {/* Individual Value Plot Preview */}
                        <div
                          onClick={() => setActiveTab('individual')}
                          className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                        >
                          <div className="h-32 mb-2">
                            {chartData && (
                              <Scatter
                                data={{
                                  datasets: chartData.datasets.map(ds => ({
                                    label: ds.label,
                                    data: ds.data.map((val, idx) => ({ x: idx, y: val })),
                                    backgroundColor: ds.backgroundColor,
                                  })),
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    title: { display: false },
                                  },
                                  scales: {
                                    y: { display: false },
                                    x: { display: false },
                                  },
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedVariables.length >= 2 ? `${selectedVariables[1]} vs ${selectedVariables[0]}` : `${selectedVariables[0]}`}
                          </p>
                          <p className="text-xs text-gray-500">Individual Value Plot</p>
                        </div>

                        {/* Variability Chart Preview */}
                        <div
                          onClick={() => setActiveTab('variability')}
                          className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                        >
                          <div className="h-32 mb-2">
                            {chartData && (
                              <Line
                                data={chartData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    title: { display: false },
                                  },
                                  scales: {
                                    y: { display: false },
                                    x: { display: false },
                                  },
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedVariables.length >= 2 ? `${selectedVariables[1]} by ${selectedVariables[0]}` : `${selectedVariables[0]}`}
                          </p>
                          <p className="text-xs text-gray-500">Variability Chart</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'histogram' && selectedVariables.length > 0 && chartData ? (
                <div className="h-full w-full">
                  <Bar
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                          display: true,
                        },
                        title: {
                          display: true,
                          text: 'Histogram',
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              ) : activeTab === 'line' && selectedVariables.length > 0 && chartData ? (
                <div className="h-full w-full">
                  <Line
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top' as const,
                          display: true,
                        },
                        title: {
                          display: true,
                          text: 'Line Chart',
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  {selectedVariables.length === 0 ? (
                    <p className="text-gray-500">{graphTabs.find(t => t.id === activeTab)?.label} options coming soon... Add variables to see the graph.</p>
                  ) : (
                    <p className="text-gray-500">Generating {graphTabs.find(t => t.id === activeTab)?.label}...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 px-6 py-3 flex items-center justify-between bg-gray-50 rounded-b-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast.info('Help documentation coming soon')}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            >
              Help
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            >
              Reset
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
            >
              Create
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GraphBuilder

