import { useState, useRef, useMemo, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Line, Scatter, Pie } from 'react-chartjs-2'
import ChartDataLabels from 'chartjs-plugin-datalabels'

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

interface GraphBuilderProps {
  isOpen: boolean
  onClose: () => void
  columns?: string[]
  cells?: Array<{ row_index: number; column_index: number; value: any }>
  spreadsheetId?: string
}

const GraphBuilder = ({ isOpen, onClose, columns = ['C1', 'C2'], cells = [] }: GraphBuilderProps) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'histogram' | 'probability' | 'boxplot' | 'interval' | 'individual' | 'variability' | 'line' | 'pareto' | 'pie' | 'bar' | 'heatmap' | 'scatter'>('gallery')
  const [selectedVariables, setSelectedVariables] = useState<string[]>([])
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('All')
  const variablesDropZoneRef = useRef<HTMLDivElement>(null)
  
  // Force re-render when cells change to update charts dynamically
  const cellsHash = useMemo(() => {
    // Create a hash of cells data to detect changes
    if (!cells || cells.length === 0) return 'empty'
    return cells
      .filter(cell => cell.value !== null && cell.value !== undefined && cell.value !== '')
      .map(cell => `${cell.row_index}-${cell.column_index}-${cell.value}`)
      .sort()
      .join('|')
  }, [cells])
  
  // Reset selected variables when cells change significantly
  useEffect(() => {
    // Only reset if we have new cells and old selection might be invalid
    if (cells && cells.length > 0 && selectedVariables.length > 0) {
      // Recalculate available columns inline to avoid circular dependency
      const columnMap = new Map<number, { hasData: boolean; textCount: number; numericCount: number; totalCount: number }>()
      
      cells.forEach(cell => {
        if (cell.row_index === 0) return
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          const colIndex = cell.column_index
          const existing = columnMap.get(colIndex) || { hasData: false, textCount: 0, numericCount: 0, totalCount: 0 }
          existing.hasData = true
          existing.totalCount++
          
          const strValue = cell.value.toString().trim()
          if (strValue === '') return
          
          const numValue = parseFloat(strValue)
          const isNumeric = !isNaN(numValue) && isFinite(numValue) && 
                           (strValue === numValue.toString() || 
                            strValue === String(Number(strValue)) ||
                            /^-?\d+\.?\d*$/.test(strValue))
          
          if (isNumeric) {
            existing.numericCount++
          } else {
            existing.textCount++
          }
          
          columnMap.set(colIndex, existing)
        }
      })
      
      const currentAvailable: string[] = []
      for (let i = 0; i < 100; i++) {
        if (columnMap.has(i)) {
          const colInfo = columnMap.get(i)!
          const isTextColumn = colInfo.numericCount === 0 && colInfo.textCount > 0
          currentAvailable.push(isTextColumn ? `C${i + 1}-T` : `C${i + 1}`)
        }
      }
      
      const validSelection = selectedVariables.filter(v => currentAvailable.includes(v))
      if (validSelection.length !== selectedVariables.length) {
        setSelectedVariables(validSelection)
      }
    }
  }, [cells, cellsHash, selectedVariables])

  // Extract columns that have data from cells and determine if they're text or numeric
  const availableColumns = useMemo(() => {
    // Debug: Log cells data
    console.log('GraphBuilder - Cells data:', cells?.length || 0, 'cells')
    
    if (!cells || cells.length === 0) {
      console.log('GraphBuilder - No cells, returning default columns:', columns)
      return columns
    }
    
    // Include cellsHash in dependency to force recalculation when data changes
    void cellsHash // Force recalculation when cells change
    
    const columnMap = new Map<number, { hasData: boolean; textCount: number; numericCount: number; totalCount: number }>()
    
    cells.forEach(cell => {
      // Check all rows including header (row_index 0) for column detection
      // But prefer data rows (row_index > 0) for type determination
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        const colIndex = cell.column_index
        const existing = columnMap.get(colIndex) || { hasData: false, textCount: 0, numericCount: 0, totalCount: 0 }
        
        // Only count data rows (skip header for type determination)
        if (cell.row_index > 0) {
          existing.hasData = true
          existing.totalCount++
          
          // Check if value is numeric
          const strValue = cell.value.toString().trim()
          if (strValue === '') {
            // Skip empty values
            return
          }
          
          // Try to parse as number
          const numValue = parseFloat(strValue)
          // Check if it's a valid number
          const isNumeric = !isNaN(numValue) && isFinite(numValue) && 
                           (strValue === numValue.toString() || 
                            strValue === String(Number(strValue)) ||
                            /^-?\d+\.?\d*$/.test(strValue))
          
          if (isNumeric) {
            existing.numericCount++
          } else {
            existing.textCount++
          }
        } else {
          // Header row - just mark that column exists
          existing.hasData = true
        }
        
        columnMap.set(colIndex, existing)
      }
    })
    
    const colsWithData: string[] = []
    for (let i = 0; i < 100; i++) { // Check up to 100 columns
      if (columnMap.has(i)) {
        const colInfo = columnMap.get(i)!
        // If column has ONLY text values (no numeric), mark as text column with -T suffix
        // If it has any numeric values, show as regular column (C1, C2, etc.)
        const isTextColumn = colInfo.numericCount === 0 && colInfo.textCount > 0
        const colName = isTextColumn ? `C${i + 1}-T` : `C${i + 1}`
        colsWithData.push(colName)
      }
    }
    
    console.log('GraphBuilder - Available columns:', colsWithData)
    return colsWithData.length > 0 ? colsWithData : columns
  }, [cells, columns, cellsHash])

  // Extract actual data for a column (returns both numeric and text values)
  // Use useMemo to memoize but allow cells changes to trigger recalculation
  const getColumnData = useMemo(() => {
    // Force recalculation when cells change
    void cellsHash
    
    return (columnName: string): { numeric: number[], text: string[], labels: string[] } => {
      if (!cells || cells.length === 0) return { numeric: [], text: [], labels: [] }
    
      // Handle both C1 and C1-T formats
      const colMatch = columnName.match(/C(\d+)(-T)?/)
      if (!colMatch) return { numeric: [], text: [], labels: [] }
      
      const columnIndex = parseInt(colMatch[1]) - 1
      const numericValues: number[] = []
      const textValues: string[] = []
      const labels: string[] = []
      
      // Get all values for this column, sorted by row index, skip header row
      const columnCells = cells
        .filter(cell => cell.column_index === columnIndex && cell.row_index > 0)
        .sort((a, b) => a.row_index - b.row_index)
      
      columnCells.forEach(cell => {
        const value = cell.value
        if (value !== null && value !== undefined && value !== '') {
          const strValue = value.toString().trim()
          if (strValue === '') return
          
          labels.push(strValue)
          
          const numValue = parseFloat(strValue)
          if (!isNaN(numValue) && isFinite(numValue)) {
            numericValues.push(numValue)
          } else {
            textValues.push(strValue)
          }
        }
      })
      
      return { numeric: numericValues, text: textValues, labels }
    }
  }, [cells, cellsHash])
  
  // Get column data as simple array (for backward compatibility)
  const getColumnDataSimple = (columnName: string): number[] => {
    return getColumnData(columnName).numeric
  }

  // Generate data for charts using actual spreadsheet data
  const generateData = (variable: string) => {
    const columnData = getColumnDataSimple(variable)
    
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
  
  // Get visualization types based on selected variables and filter
  const getAvailableVisualizations = () => {
    const visualizations: Array<{ id: string; name: string; category: string; requiresNumeric: boolean; minVars: number; maxVars: number }> = []
    
    if (selectedVariables.length === 0) return []
    
    const hasNumeric = selectedVariables.some(v => {
      const data = getColumnDataSimple(v)
      return data.length > 0
    })
    const hasText = selectedVariables.some(v => {
      const data = getColumnData(v)
      return data.text.length > 0 || data.labels.length > 0
    })
    
    // Distribution of data
    if (filterCategory === 'All' || filterCategory === 'Distribution of data') {
      if (hasNumeric) {
        visualizations.push({ id: 'histogram', name: 'Histogram', category: 'Distribution of data', requiresNumeric: true, minVars: 1, maxVars: 1 })
        visualizations.push({ id: 'probability', name: 'Probability Plot', category: 'Distribution of data', requiresNumeric: true, minVars: 1, maxVars: 1 })
        visualizations.push({ id: 'boxplot', name: 'Boxplot', category: 'Distribution of data', requiresNumeric: true, minVars: 1, maxVars: 10 })
      }
      if (hasText || hasNumeric) {
        visualizations.push({ id: 'pie', name: 'Pie Chart', category: 'Distribution of data', requiresNumeric: false, minVars: 1, maxVars: 1 })
        visualizations.push({ id: 'bar', name: 'Bar Chart', category: 'Distribution of data', requiresNumeric: false, minVars: 1, maxVars: 1 })
        visualizations.push({ id: 'pareto', name: 'Pareto Chart', category: 'Distribution of data', requiresNumeric: false, minVars: 1, maxVars: 1 })
      }
    }
    
    // Relationships between variables
    if (filterCategory === 'All' || filterCategory === 'Relationships between variables') {
      if (selectedVariables.length >= 2) {
        // Check if both variables have numeric data
        const firstNumeric = getColumnDataSimple(selectedVariables[0]).length > 0
        const secondNumeric = selectedVariables[1] ? getColumnDataSimple(selectedVariables[1]).length > 0 : false
        
        if (firstNumeric && secondNumeric) {
          visualizations.push({ id: 'line', name: 'Line Plot', category: 'Relationships between variables', requiresNumeric: true, minVars: 2, maxVars: 10 })
          visualizations.push({ id: 'scatter', name: 'Scatterplot', category: 'Relationships between variables', requiresNumeric: true, minVars: 2, maxVars: 2 })
        }
      }
      if (selectedVariables.length >= 1) {
        visualizations.push({ id: 'heatmap', name: 'Heatmap', category: 'Relationships between variables', requiresNumeric: false, minVars: 1, maxVars: 10 })
      }
    }
    
    // Variables over time
    if (filterCategory === 'All' || filterCategory === 'Variables over time') {
      if (hasNumeric) {
        visualizations.push({ id: 'line', name: 'Line Plot', category: 'Variables over time', requiresNumeric: true, minVars: 1, maxVars: 10 })
      }
    }
    
    // Filter by variable count
    return visualizations.filter(viz => 
      selectedVariables.length >= viz.minVars && selectedVariables.length <= viz.maxVars
    )
  }

  // Prepare chart data for different visualization types
  const getChartDataForViz = (vizType: string) => {
    if (selectedVariables.length === 0) return null
    
    const firstVar = selectedVariables[0]
    const secondVar = selectedVariables[1]
    const firstData = getColumnData(firstVar)
    const secondData = secondVar ? getColumnData(secondVar) : null
    
    if (vizType === 'pie' || vizType === 'bar' || vizType === 'pareto') {
      // For categorical data - prefer text labels, fallback to numeric
      let labels: string[] = []
      let values: number[] = []
      
      // If we have text data, count occurrences
      if (firstData.text.length > 0 || firstData.labels.some(l => isNaN(parseFloat(l)))) {
        const counts = new Map<string, number>()
        firstData.labels.forEach(label => {
          const trimmed = label.trim()
          if (trimmed) {
            counts.set(trimmed, (counts.get(trimmed) || 0) + 1)
          }
        })
        
        // Sort by count descending for Pareto, but keep original order for pie
        const sortedEntries = vizType === 'pareto' 
          ? Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
          : Array.from(counts.entries())
        labels = sortedEntries.map(([label]) => label)
        values = sortedEntries.map(([, count]) => count)
      } else if (firstData.numeric.length > 0) {
        // Use numeric data - create bins or use direct values
        labels = firstData.numeric.map((_, i) => `Value ${i + 1}`)
        values = firstData.numeric
      } else {
        return null
      }
      
      // Limit to reasonable number of items
      const maxItems = vizType === 'pie' ? 8 : 10
      labels = labels.slice(0, maxItems)
      values = values.slice(0, maxItems)
      
      // Calculate total for percentages
      const total = values.reduce((sum, val) => sum + val, 0)
      
      // Generate colors - use Minitab-like colors
      const colors = [
        'rgba(135, 206, 250, 0.8)',  // Light blue (like Good)
        'rgba(255, 99, 132, 0.8)',    // Red (like Bad)
        'rgba(255, 206, 86, 0.8)',    // Yellow (like Reject)
        'rgba(75, 192, 192, 0.8)',    // Teal
        'rgba(153, 102, 255, 0.8)',   // Purple
        'rgba(255, 159, 64, 0.8)',    // Orange
        'rgba(199, 199, 199, 0.8)',   // Gray
        'rgba(83, 102, 255, 0.8)',    // Blue
      ]
      
      // For pie chart, add percentage labels
      if (vizType === 'pie') {
        const labelsWithPercent = labels.map((label, idx) => {
          const count = values[idx]
          const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
          return `${label} ${count}, ${percent}%`
        })
        
        return {
          labels: labelsWithPercent,
          originalLabels: labels,
          values: values,
          total: total,
          datasets: [{
            label: firstVar,
            data: values,
            backgroundColor: colors.slice(0, labels.length),
            borderColor: '#ffffff',
            borderWidth: 2,
          }]
        }
      }
      
      return {
        labels: labels,
        datasets: [{
          label: firstVar,
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: colors.slice(0, labels.length).map(c => c.replace('0.6', '1')),
          borderWidth: 1,
        }]
      }
    }
    
    if (vizType === 'line') {
      // Line plot - can work with one or two variables
      if (secondVar && secondData) {
        // Two variables: firstVar on x-axis, secondVar on y-axis
        // If firstVar is text, use labels as x-axis, otherwise use numeric values
        let xLabels: string[] = []
        let xValues: number[] = []
        
        if (firstData.text.length > 0 || firstData.labels.some(l => isNaN(parseFloat(l)))) {
          // Text column - use labels as x-axis
          xLabels = firstData.labels.filter(l => l.trim() !== '')
          xValues = xLabels.map((_, i) => i + 1)
        } else if (firstData.numeric.length > 0) {
          // Numeric column - use numeric values
          xValues = firstData.numeric
          xLabels = xValues.map(v => v.toString())
        } else {
          return null
        }
        
        const yData = secondData.numeric.length > 0 ? secondData.numeric : []
        if (yData.length === 0) return null
        
        const minLength = Math.min(xValues.length, yData.length)
        return {
          labels: xLabels.slice(0, minLength),
          datasets: [{
            label: `${secondVar} vs ${firstVar}`,
            data: yData.slice(0, minLength),
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            tension: 0.1,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
          }]
        }
      } else {
        // Single variable: index on x-axis, values on y-axis
        const yData = firstData.numeric.length > 0 ? firstData.numeric : []
        if (yData.length === 0) return null
        
        return {
          labels: yData.map((_, i) => (i + 1).toString()),
          datasets: [{
            label: firstVar,
            data: yData,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            tension: 0.1,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6,
          }]
        }
      }
    }
    
    if (vizType === 'scatter') {
      // Scatterplot - requires two numeric variables
      if (!secondVar || !secondData) return null
      
      const xData = firstData.numeric.length > 0 ? firstData.numeric : []
      const yData = secondData.numeric.length > 0 ? secondData.numeric : []
      
      if (xData.length === 0 || yData.length === 0) return null
      
      const minLength = Math.min(xData.length, yData.length)
      return {
        datasets: [{
          label: `${secondVar} vs ${firstVar}`,
          data: xData.slice(0, minLength).map((xVal, idx) => ({
            x: xVal,
            y: yData[idx]
          })),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          pointRadius: 5,
          pointHoverRadius: 7,
        }]
      }
    }
    
    if (vizType === 'boxplot') {
      // Boxplot - show distribution of numeric data
      const data = firstData.numeric.length > 0 ? firstData.numeric : []
      if (data.length === 0) return null
      
      // For boxplot, we'll show it as a bar chart representation
      // In a real implementation, you'd use a specialized boxplot library
      const sorted = [...data].sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const median = sorted[Math.floor(sorted.length * 0.5)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const min = Math.min(...data)
      const max = Math.max(...data)
      
      // Represent as grouped bars
      return {
        labels: [firstVar],
        datasets: [
          {
            label: 'Min',
            data: [min],
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
          },
          {
            label: 'Q1',
            data: [q1],
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
          },
          {
            label: 'Median',
            data: [median],
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
          },
          {
            label: 'Q3',
            data: [q3],
            backgroundColor: 'rgba(255, 206, 86, 0.6)',
          },
          {
            label: 'Max',
            data: [max],
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
          },
        ]
      }
    }
    
    if (vizType === 'heatmap') {
      // Heatmap - create a matrix from selected variables
      const allVars = selectedVariables
      if (allVars.length === 0) return null
      
      // Get data for all variables
      const varData = allVars.map(v => getColumnData(v))
      
      // Create labels (use first variable's labels or indices)
      const rowLabels = varData[0].labels.length > 0 
        ? varData[0].labels 
        : varData[0].numeric.map((_, i) => `Row ${i + 1}`)
      
      // Create heatmap data matrix
      const heatmapData: number[][] = []
      const maxRows = Math.max(...varData.map(d => Math.max(d.numeric.length, d.labels.length)))
      
      for (let row = 0; row < maxRows; row++) {
        const rowData: number[] = []
        for (let col = 0; col < varData.length; col++) {
          const numVal = varData[col].numeric[row] || 0
          const textVal = varData[col].text[row] ? 1 : 0
          rowData.push(numVal || textVal)
        }
        heatmapData.push(rowData)
      }
      
      // Return data structure for heatmap visualization
      return {
        labels: allVars,
        rowLabels: rowLabels.slice(0, 10),
        data: heatmapData.slice(0, 10),
      }
    }
    
    // Default: histogram/bar chart for numeric data
    const data = firstData.numeric.length > 0 ? firstData.numeric : []
    if (data.length === 0) {
      // If no numeric data, try to use text data as categories
      if (firstData.labels.length > 0) {
        const counts = new Map<string, number>()
        firstData.labels.forEach(label => {
          const trimmed = label.trim()
          if (trimmed) {
            counts.set(trimmed, (counts.get(trimmed) || 0) + 1)
          }
        })
        const sortedEntries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
        return {
          labels: sortedEntries.map(([label]) => label),
          datasets: [{
            label: firstVar,
            data: sortedEntries.map(([, count]) => count),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
          }]
        }
      }
      return null
    }
    
    const bins = Math.min(10, Math.max(5, Math.floor(Math.sqrt(data.length))))
    const min = Math.min(...data)
    const max = Math.max(...data)
    if (min === max) {
      // All values are the same
      return {
        labels: [min.toString()],
        datasets: [{
          label: firstVar,
          data: [data.length],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }]
      }
    }
    
    const binWidth = (max - min) / bins
    const binCounts = new Array(bins).fill(0)
    
    data.forEach(val => {
      const binIndex = Math.min(Math.floor((val - min) / binWidth), bins - 1)
      binCounts[binIndex]++
        })
    
        // Generate bin labels for histogram
        const binLabels = Array.from({ length: bins }, (_, i) => {
          const binStart = min + i * binWidth
          return `${binStart.toFixed(1)}`
        })
    
    return {
      labels: binLabels,
      datasets: [{
        label: firstVar,
        data: binCounts,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      }]
    }
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
          labels: binLabels,
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
    { id: 'line' as const, label: 'Line Plot', icon: 'line' },
    { id: 'pareto' as const, label: 'Pareto Chart', icon: 'bar' },
    { id: 'bar' as const, label: 'Bar Plot', icon: 'bar' },
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
    toast.success('Graph builder reset')
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
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availableColumns.length > 0 ? (
                  availableColumns.map((col) => (
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
                  ))
                ) : (
                  <div className="p-2">
                    <p className="text-gray-400 text-xs mb-2">No columns with data</p>
                    <p className="text-gray-300 text-xs">Add data to spreadsheet first</p>
                    {cells && cells.length > 0 && (
                      <p className="text-gray-300 text-xs mt-1">Cells found: {cells.length}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Variables</h3>
              <div
                ref={variablesDropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="bg-white border-2 border-dashed border-gray-300 rounded h-full transition-colors min-h-[200px] p-2"
              >
                {selectedVariables.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-gray-400 text-sm text-center px-4">
                      Drag columns here or click to add
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedVariables.map((col) => (
                      <div
                        key={col}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
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
                )}
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
                      <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm appearance-none bg-white pr-8"
                      >
                        <option value="All">All</option>
                        <option value="Distribution of data">Distribution of data</option>
                        <option value="Relationships between variables">Relationships between variables</option>
                        <option value="Variables over time">Variables over time</option>
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
                        {getAvailableVisualizations().map((viz) => {
                          const vizData = getChartDataForViz(viz.id)
                          const title = selectedVariables.length >= 2 
                            ? `${selectedVariables[1]} vs ${selectedVariables[0]}`
                            : selectedVariables.length === 1
                            ? selectedVariables[0]
                            : `${selectedVariables.join(', ')}`
                          
                          return (
                            <div
                              key={viz.id}
                              onClick={() => {
                                if (['histogram', 'probability', 'boxplot', 'interval', 'individual', 'variability', 'line'].includes(viz.id)) {
                                  setActiveTab(viz.id as any)
                                } else {
                                  setActiveTab(viz.id as any)
                                }
                              }}
                              className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                            >
                              <div className="h-32 mb-2 flex items-center justify-center relative">
                                {vizData ? (
                                  <>
                                    {viz.id === 'pie' && vizData && 'datasets' in vizData && (
                                      <div className="w-full h-full">
                                        <Pie
                                          data={vizData as any}
                                          options={{
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                              legend: { display: false },
                                              title: { display: false },
                                              tooltip: { enabled: false },
                                            },
                                          }}
                                        />
                                      </div>
                                    )}
                                    {viz.id === 'bar' && vizData && 'datasets' in vizData && (
                                      <div className="w-full h-full">
                                        <Bar
                                          data={vizData as any}
                                          options={{
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                              legend: { display: false },
                                              title: { display: false },
                                              tooltip: { enabled: false },
                                            },
                                            scales: {
                                              y: { display: false, beginAtZero: true },
                                              x: { display: false },
                                            },
                                          }}
                                        />
                                      </div>
                                    )}
                                    {viz.id === 'line' && vizData && 'datasets' in vizData && (
                                      <div className="w-full h-full">
                                        <Line
                                          data={vizData as any}
                                          options={{
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                              legend: { display: false },
                                              title: { display: false },
                                              tooltip: { enabled: false },
                                            },
                                            scales: {
                                              y: { display: false },
                                              x: { display: false },
                                            },
                                            elements: {
                                              point: { radius: 3, hoverRadius: 5 },
                                              line: { tension: 0.1 },
                                            },
                                          }}
                                        />
                                      </div>
                                    )}
                                    {viz.id === 'pareto' && vizData && 'datasets' in vizData && (
                                      <div className="w-full h-full">
                                        <Bar
                                          data={vizData as any}
                                          options={{
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                              legend: { display: false },
                                              title: { display: false },
                                              tooltip: { enabled: false },
                                            },
                                            scales: {
                                              y: { display: false, beginAtZero: true },
                                              x: { display: false },
                                            },
                                          }}
                                        />
                                      </div>
                                    )}
                                    {viz.id === 'scatter' && vizData && 'datasets' in vizData && (
                                      <div className="w-full h-full">
                                        <Scatter
                                          data={vizData as any}
                                          options={{
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                              legend: { display: false },
                                              title: { display: false },
                                              tooltip: { enabled: false },
                                            },
                                            scales: {
                                              y: { display: false },
                                              x: { display: false },
                                            },
                                          }}
                                        />
                                      </div>
                                    )}
                                    {viz.id === 'heatmap' && (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded">
                                        <div className="text-center">
                                          <div className="w-16 h-16 mx-auto mb-2 bg-gradient-to-br from-blue-200 via-blue-300 to-blue-400 rounded"></div>
                                          <p className="text-gray-400 text-xs">Heatmap</p>
                                        </div>
                                      </div>
                                    )}
                                    {!['pie', 'bar', 'line', 'pareto', 'heatmap', 'scatter'].includes(viz.id) && vizData && 'datasets' in vizData && (
                                      <div className="w-full h-full">
                                        <Bar
                                          data={vizData as any}
                                          options={{
                                            responsive: true,
                                            maintainAspectRatio: true,
                                            plugins: {
                                              legend: { display: false },
                                              title: { display: false },
                                              tooltip: { enabled: false },
                                            },
                                            scales: {
                                              y: { display: false, beginAtZero: true },
                                              x: { display: false },
                                            },
                                          }}
                                        />
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-gray-400 text-xs">No data available</div>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-700">
                                {selectedVariables.length === 1 
                                  ? `${selectedVariables[0]} ${viz.name}`
                                  : title
                                }
                              </p>
                              <p className="text-xs text-gray-500">{viz.name}</p>
                            </div>
                          )
                        })}
                        
                        {/* Tabulated Statistics - Always show if variables selected */}
                        {selectedVariables.length > 0 && (
                          <div
                            className="border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white"
                          >
                            <div className="h-32 mb-2 flex items-center justify-center bg-gray-50 rounded">
                              <div className="text-center">
                                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <p className="text-xs text-gray-500">Table</p>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                              {selectedVariables.join(', ')}
                            </p>
                            <p className="text-xs text-gray-500">Tabulated Statistics</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedVariables.length > 0 ? (
                <div className="h-full w-full p-4">
                  {activeTab === 'histogram' && chartData && (
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
                  )}
                  {activeTab === 'line' && (() => {
                    const lineData = getChartDataForViz('line')
                    return lineData && 'datasets' in lineData ? (
                      <Line
                        data={lineData as any}
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
                              text: selectedVariables.length >= 2 
                                ? `${selectedVariables[1]} vs ${selectedVariables[0]}`
                                : `Line Plot - ${selectedVariables[0]}`,
                            },
                          },
                          scales: {
                            x: {
                              display: true,
                              title: {
                                display: true,
                                text: selectedVariables[0],
                              },
                            },
                            y: {
                              display: true,
                              title: {
                                display: true,
                                text: selectedVariables.length >= 2 ? selectedVariables[1] : 'Value',
                              },
                            },
                          },
                        }}
                      />
                    ) : null
                  })()}
                  {activeTab === 'scatter' && (() => {
                    const scatterData = getChartDataForViz('scatter')
                    return scatterData && 'datasets' in scatterData ? (
                      <Scatter
                        data={scatterData as any}
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
                              text: selectedVariables.length >= 2 
                                ? `${selectedVariables[1]} vs ${selectedVariables[0]}`
                                : 'Scatterplot',
                            },
                          },
                          scales: {
                            x: {
                              display: true,
                              title: {
                                display: true,
                                text: selectedVariables[0],
                              },
                            },
                            y: {
                              display: true,
                              title: {
                                display: true,
                                text: selectedVariables.length >= 2 ? selectedVariables[1] : 'Value',
                              },
                            },
                          },
                        }}
                      />
                    ) : null
                  })()}
                  {activeTab === 'pie' && (() => {
                    const pieData = getChartDataForViz('pie')
                    if (!pieData || !('datasets' in pieData)) return null
                    
                    const pieDataTyped = pieData as any
                    const originalLabels = pieDataTyped.originalLabels || pieDataTyped.labels
                    const values = pieDataTyped.values || pieDataTyped.datasets[0].data
                    const total = pieDataTyped.total || values.reduce((sum: number, val: number) => sum + val, 0)
                    
                    return (
                      <div className="h-full w-full flex flex-col p-6">
                        {/* Title Section */}
                        <div className="mb-6 text-center">
                          <h3 className="text-xl font-semibold text-gray-800 mb-1">
                            Pie Chart of {originalLabels?.[0] || 'Category'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Pie Chart for {selectedVariables[0]}
                          </p>
                        </div>
                        
                        {/* Chart Container */}
                        <div className="flex-1 flex items-center justify-center">
                          <div className="w-full max-w-3xl h-full">
                            <Pie
                              data={{
                                labels: originalLabels || pieDataTyped.labels,
                                datasets: pieDataTyped.datasets,
                              }}
                              plugins={[ChartDataLabels]}
                              options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                layout: {
                                  padding: {
                                    top: 40,
                                    bottom: 40,
                                    left: 40,
                                    right: 200, // Space for legend
                                  },
                                },
                                plugins: {
                                  legend: {
                                    position: 'right' as const,
                                    display: true,
                                    align: 'start' as const,
                                    labels: {
                                      usePointStyle: true,
                                      pointStyle: 'circle',
                                      padding: 12,
                                      font: {
                                        size: 12,
                                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                      },
                                      generateLabels: (chart: any) => {
                                        const data = chart.data
                                        if (data.labels.length && data.datasets.length) {
                                          return data.labels.map((label: string, i: number) => {
                                            return {
                                              text: label,
                                              fillStyle: data.datasets[0].backgroundColor[i],
                                              strokeStyle: data.datasets[0].borderColor || '#ffffff',
                                              lineWidth: data.datasets[0].borderWidth || 2,
                                              hidden: false,
                                              index: i,
                                            }
                                          })
                                        }
                                        return []
                                      },
                                    },
                                    title: {
                                      display: true,
                                      text: 'Category',
                                      font: {
                                        size: 14,
                                        weight: 'bold',
                                        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                      },
                                      padding: {
                                        top: 10,
                                        bottom: 15,
                                      },
                                      color: '#000',
                                    },
                                  },
                                  tooltip: {
                                    enabled: true,
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    padding: 12,
                                    titleFont: {
                                      size: 14,
                                      weight: 'bold',
                                    },
                                    bodyFont: {
                                      size: 12,
                                    },
                                    callbacks: {
                                      label: (context: any) => {
                                        const label = context.label || ''
                                        const value = context.parsed || 0
                                        const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
                                        return `${label}: ${value} (${percent}%)`
                                      },
                                    },
                                  },
                                  datalabels: {
                                    display: true,
                                    color: '#000',
                                    font: {
                                      size: 11,
                                      weight: 'bold',
                                      family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                    },
                                    formatter: (value: number, context: any) => {
                                      const label = context.chart.data.labels[context.dataIndex]
                                      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
                                      return `${label} ${value}, ${percent}%`
                                    },
                                    anchor: 'end' as const,
                                    align: 'end' as const,
                                    offset: 15,
                                    textStrokeColor: '#fff',
                                    textStrokeWidth: 2,
                                    textShadowBlur: 4,
                                    textShadowColor: 'rgba(255, 255, 255, 0.8)',
                                  },
                                },
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  {activeTab === 'bar' && (() => {
                    const barData = getChartDataForViz('bar')
                    return barData && 'datasets' in barData ? (
                      <Bar
                        data={barData as any}
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
                              text: `Bar Chart - ${selectedVariables[0]}`,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                            },
                          },
                        }}
                      />
                    ) : null
                  })()}
                  {activeTab === 'pareto' && (() => {
                    const paretoData = getChartDataForViz('pareto')
                    return paretoData && 'datasets' in paretoData ? (
                      <div>
                        <Bar
                          data={paretoData as any}
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
                                text: `Pareto Chart - ${selectedVariables[0]}`,
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
                    ) : null
                  })()}
                  {activeTab === 'boxplot' && (() => {
                    const boxplotData = getChartDataForViz('boxplot')
                    return boxplotData && 'datasets' in boxplotData ? (
                      <Bar
                        data={boxplotData as any}
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
                              text: `Boxplot - ${selectedVariables[0]}`,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Value',
                              },
                            },
                          },
                        }}
                      />
                    ) : null
                  })()}
                  {['probability', 'interval', 'individual', 'variability'].includes(activeTab) && chartData && (
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
                            text: graphTabs.find(t => t.id === activeTab)?.label || 'Chart',
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                      }}
                    />
                  )}
                  {activeTab === 'heatmap' && (() => {
                    const heatmapData = getChartDataForViz('heatmap')
                    return heatmapData ? (
                      <div className="h-full p-4">
                        <h3 className="text-lg font-semibold mb-4">Heatmap</h3>
                        <div className="overflow-auto">
                          <table className="min-w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="border p-2 bg-gray-100"></th>
                                {heatmapData.labels?.map((label, idx) => (
                                  <th key={idx} className="border p-2 bg-gray-100 text-sm">{label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {heatmapData.rowLabels?.map((rowLabel, rowIdx) => (
                                <tr key={rowIdx}>
                                  <td className="border p-2 bg-gray-50 text-sm font-medium">{rowLabel}</td>
                                  {heatmapData.data?.[rowIdx]?.map((val, colIdx) => {
                                    const intensity = Math.min(1, Math.max(0, (val - 0) / (Math.max(...heatmapData.data.flat()) || 1)))
                                    const bgColor = `rgba(54, 162, 235, ${0.3 + intensity * 0.7})`
                                    return (
                                      <td key={colIdx} className="border p-2 text-center" style={{ backgroundColor: bgColor }}>
                                        {val.toFixed(1)}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-gray-500">Heatmap requires data in selected variables</p>
                      </div>
                    )
                  })()}
                  {!['histogram', 'line', 'pie', 'bar', 'pareto', 'probability', 'boxplot', 'interval', 'individual', 'variability', 'heatmap', 'scatter'].includes(activeTab) && (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-500">Generating {graphTabs.find(t => t.id === activeTab)?.label}...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500">{graphTabs.find(t => t.id === activeTab)?.label} options coming soon... Add variables to see the graph.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 px-6 py-3 flex items-center justify-between bg-gray-50 rounded-b-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast.success('Help documentation coming soon')}
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

