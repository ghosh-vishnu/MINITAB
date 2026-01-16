import { useState, useEffect, useMemo, useRef } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Bar, Line, Scatter, Pie } from 'react-chartjs-2'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { chartsAPI, Chart, ChartData, CreateChartData } from '../api/charts'
import { Cell } from '../api/spreadsheets'
import toast from 'react-hot-toast'
// Dynamic imports for PDF generation
// import jsPDF from 'jspdf'
// import html2canvas from 'html2canvas'

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
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({})

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

  const handleExportToPDF = async (chart: Chart) => {
    try {
      toast.loading('Generating PDF...', { id: 'export-pdf' })
      
      // Dynamic import to avoid build issues
      const [jsPDFModule, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ])
      
      const jsPDF = (jsPDFModule as any).default || jsPDFModule
      const html2canvas = html2canvasModule.default || html2canvasModule
      
      const chartElement = chartRefs.current[chart.id]
      if (!chartElement) {
        toast.error('Chart element not found', { id: 'export-pdf' })
        return
      }

      // Get chart data for PDF
      const chartData = generateChartDataFromCells(chart)
      if (!chartData || chartData.labels.length === 0) {
        toast.error('No data available for export', { id: 'export-pdf' })
        return
      }

      // Find the canvas element directly from the chart
      const chartCanvas = chartElement.querySelector('canvas') as HTMLCanvasElement
      if (!chartCanvas) {
        // Fallback: use html2canvas to capture the entire chart element
        console.log('Canvas not found, using html2canvas fallback')
        const canvas = await html2canvas(chartElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
        })
        
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          toast.error('Failed to capture chart image', { id: 'export-pdf' })
          return
        }
        
        // Continue with PDF creation using this canvas
        const imgData = canvas.toDataURL('image/png', 1.0)
        if (!imgData || imgData === 'data:,') {
          toast.error('Failed to generate chart image', { id: 'export-pdf' })
          return
        }
        
        // Create PDF and add image (will be done below)
        const pdf = new jsPDF('portrait', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const margin = 15
        
        // Add header, table, etc. (same as below)
        pdf.setFillColor(240, 240, 240)
        pdf.rect(0, 0, pdfWidth, 25, 'F')
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Excel® Statistical Software', margin, 12)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.text('Chart Analysis Report', margin, 18)

        const tableY = 35
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        const tableWidth = pdfWidth - (margin * 2)
        const rowHeight = 6
        const col1Width = 50
        const col2Width = tableWidth - col1Width
        
        pdf.setFillColor(220, 220, 220)
        pdf.rect(margin, tableY, tableWidth, rowHeight, 'F')
        pdf.setDrawColor(150, 150, 150)
        pdf.rect(margin, tableY, tableWidth, rowHeight, 'S')
        pdf.text('Field', margin + 2, tableY + 4)
        pdf.text('Value', margin + col1Width + 2, tableY + 4)
        
        const details = [
          ['Title', chart.title],
          ['Chart Type', chart.chart_type.charAt(0).toUpperCase() + chart.chart_type.slice(1) + ' Chart'],
          ['Created Date', new Date(chart.created_at).toLocaleDateString('en-GB')],
          ['Updated Date', new Date(chart.updated_at).toLocaleDateString('en-GB')],
          ['Generated Date', new Date().toLocaleDateString('en-GB')],
        ]
        
        let currentY = tableY + rowHeight
        details.forEach(([label, value]) => {
          pdf.setFillColor(255, 255, 255)
          pdf.rect(margin, currentY, tableWidth, rowHeight, 'F')
          pdf.setDrawColor(200, 200, 200)
          pdf.rect(margin, currentY, tableWidth, rowHeight, 'S')
          pdf.line(margin + col1Width, currentY, margin + col1Width, currentY + rowHeight)
          pdf.setFont('helvetica', 'bold')
          pdf.text(label, margin + 2, currentY + 4)
          pdf.setFont('helvetica', 'normal')
          const valueText = pdf.splitTextToSize(value, col2Width - 4)
          pdf.text(valueText, margin + col1Width + 2, currentY + 4)
          currentY += rowHeight
        })

        currentY += 10
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        const chartTypeName = chart.chart_type === 'pie' ? 'Pie Chart' : 
                             chart.chart_type === 'line' ? 'Line Chart' :
                             chart.chart_type === 'bar' ? 'Bar Chart' :
                             chart.chart_type === 'scatter' ? 'Scatter Plot' : 'Chart'
        pdf.text(`${chartTypeName} for ${chart.title}`, pdfWidth / 2, currentY, { align: 'center' })
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.text('Review Period', pdfWidth / 2, currentY + 6, { align: 'center' })

        const imgWidth = pdfWidth - (margin * 2)
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        const chartY = currentY + 15
        
        if (chartY + imgHeight > pdfHeight - margin) {
          pdf.addPage()
          currentY = margin + 10
        } else {
          currentY = chartY
        }

        try {
          pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, Math.min(imgHeight, pdfHeight - currentY - margin - 20))
        } catch (error) {
          console.error('Error adding image to PDF:', error)
          toast.error('Failed to add chart to PDF', { id: 'export-pdf' })
          return
        }

        const footerY = pdfHeight - margin
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'italic')
        pdf.text(`Generated on ${new Date().toLocaleString()}`, pdfWidth / 2, footerY, { align: 'center' })

        pdf.save(`${chart.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`)
        toast.success('PDF exported successfully', { id: 'export-pdf' })
        return
      }

      // Direct canvas approach - get image from Chart.js canvas
      let imgData = chartCanvas.toDataURL('image/png', 1.0)
      let imgWidth = chartCanvas.width
      let imgHeight = chartCanvas.height
      
      if (!imgData || imgData === 'data:,') {
        toast.error('Failed to get chart image from canvas', { id: 'export-pdf' })
        return
      }

      // Create PDF
      const pdf = new jsPDF('portrait', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      const topMargin = 20

      // Company Header Section (Top Left)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Venturing Digitally', margin, topMargin)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Software Services', margin, topMargin + 5)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'italic')
      pdf.text('We Build Solution.', margin, topMargin + 9)

      // Company Header Section (Top Right)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      const rightText = 'Venturing Digitally Pvt. Ltd'
      pdf.text(rightText, pdfWidth - margin, topMargin, { align: 'right' })
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Sakchi, Jamsedpur, Jharkhand', pdfWidth - margin, topMargin + 5, { align: 'right' })

      // Main Title
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Chart Analysis Flow Chart of Excel Software', pdfWidth / 2, topMargin + 20, { align: 'center' })

      // Document Details Table
      const tableY = topMargin + 30
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'normal')
      
      // Table structure - 3 columns, multiple rows
      const col1Width = 45
      const col2Width = 50
      const col3Width = 50
      const rowHeight = 5
      const tableWidth = col1Width + col2Width + col3Width
      const tableStartX = (pdfWidth - tableWidth) / 2
      
      // Draw table borders
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.1)
      
      // Table rows
      const tableData = [
        ['Title', '', ''],
        ['Reference Document No.', 'xxxxxxx', ''],
        ['Originated By', 'Phy', '13.01.26'],
        ['Annexure-4', '', ''],
        ['Page No.', '01 of 01', ''],
        ['Approved By', '', '13.01.26'],
        ['Issue Date', '13 Jan 2026', ''],
        ['Effective Date', '21 SEP 2025', ''],
        ['Review Date', '13 Jan 2025', ''],
      ]
      
      let currentY = tableY
      tableData.forEach((row) => {
        // Draw horizontal lines
        pdf.line(tableStartX, currentY, tableStartX + tableWidth, currentY)
        
        // Draw vertical lines
        pdf.line(tableStartX, currentY, tableStartX, currentY + rowHeight)
        pdf.line(tableStartX + col1Width, currentY, tableStartX + col1Width, currentY + rowHeight)
        pdf.line(tableStartX + col1Width + col2Width, currentY, tableStartX + col1Width + col2Width, currentY + rowHeight)
        pdf.line(tableStartX + tableWidth, currentY, tableStartX + tableWidth, currentY + rowHeight)
        
        // Add text
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[0] || '', tableStartX + 2, currentY + 3.5)
        pdf.text(row[1] || '', tableStartX + col1Width + 2, currentY + 3.5)
        pdf.text(row[2] || '', tableStartX + col1Width + col2Width + 2, currentY + 3.5)
        
        currentY += rowHeight
      })
      
      // Close bottom border
      pdf.line(tableStartX, currentY, tableStartX + tableWidth, currentY)

      // Chart Title Section
      currentY += 15
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      const chartTypeName = chart.chart_type === 'pie' ? 'Pie Chart' : 
                           chart.chart_type === 'line' ? 'Line Chart' :
                           chart.chart_type === 'bar' ? 'Bar Chart' :
                           chart.chart_type === 'scatter' ? 'Scatter Plot' : 'Chart'
      pdf.text(`${chartTypeName} for ${chart.title}`, pdfWidth / 2, currentY, { align: 'center' })
      
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Review Period', pdfWidth / 2, currentY + 6, { align: 'center' })

      // Add chart image
      // For pie charts, leave space on right for legend
      const legendSpace = (chart.chart_type === 'pie' && chartData.datasets[0]) ? 45 : 0
      const pdfImgWidth = pdfWidth - (margin * 2) - legendSpace
      const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth
      const chartY = currentY + 15
      
      // Check if chart fits on page
      if (chartY + pdfImgHeight > pdfHeight - margin - 30) {
        pdf.addPage()
        currentY = margin + 10
      } else {
        currentY = chartY
      }

      // Calculate image dimensions to fit on page
      const maxImgHeight = pdfHeight - currentY - margin - 30
      const finalImgHeight = Math.min(pdfImgHeight, maxImgHeight)
      
      // Add image to PDF
      try {
        pdf.addImage(imgData, 'PNG', margin, currentY, pdfImgWidth, finalImgHeight)
      } catch (error) {
        console.error('Error adding image to PDF:', error)
        toast.error('Failed to add chart to PDF', { id: 'export-pdf' })
        return
      }

      // Add legend/data table if pie chart (on the right side of chart)
      if (chart.chart_type === 'pie' && chartData.datasets[0]) {
        // Position legend on the right side of the chart
        const legendX = margin + pdfImgWidth + 5
        const legendY = currentY + 10
        
        if (legendX + 40 < pdfWidth - margin) {
          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Category', legendX, legendY)
          
          pdf.setFont('helvetica', 'normal')
          let legendCurrentY = legendY + 8
          
          const colors = [
            [173, 216, 230],   // Light Blue (Good) - rgba(173, 216, 230)
            [255, 99, 132],    // Red (Bad) - rgba(255, 99, 132)
            [255, 206, 86],    // Yellow (Reject) - rgba(255, 206, 86)
            [54, 162, 235],    // Blue
            [153, 102, 255],   // Purple
            [255, 159, 64],    // Orange
          ]
          
          chartData.labels.forEach((label, index) => {
            // Draw color box (square, larger)
            const color = colors[index % colors.length]
            pdf.setFillColor(color[0], color[1], color[2])
            pdf.rect(legendX, legendCurrentY - 2, 4, 4, 'F')
            pdf.setDrawColor(0, 0, 0)
            pdf.setLineWidth(0.1)
            pdf.rect(legendX, legendCurrentY - 2, 4, 4, 'S')
            
            pdf.setFontSize(7)
            pdf.text(`${label}`, legendX + 6, legendCurrentY)
            legendCurrentY += 5
          })
        }
      }

      // Watermarks
      pdf.setFontSize(10)
      pdf.setTextColor(128, 0, 128) // Purple
      pdf.setFont('helvetica', 'bold')
      pdf.text('MASTER COPY', 10, pdfHeight / 2, { angle: 90, align: 'center' })
      
      pdf.setTextColor(255, 0, 0) // Red
      pdf.text('', pdfWidth - 10, pdfHeight / 2, { angle: 90, align: 'center' })
      
      // Reset text color
      pdf.setTextColor(0, 0, 0)

      // Save PDF
      pdf.save(`${chart.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`)
      
      toast.success('PDF exported successfully', { id: 'export-pdf' })
    } catch (error: any) {
      console.error('Error exporting PDF:', error)
      toast.error('Failed to export PDF', { id: 'export-pdf' })
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
                      onClick={() => handleExportToPDF(chart)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                      title="Export to PDF"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </button>
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
                <div 
                  ref={(el) => {
                    chartRefs.current[chart.id] = el
                  }}
                  className="h-80 bg-white rounded border border-gray-200 p-4 relative"
                >
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
