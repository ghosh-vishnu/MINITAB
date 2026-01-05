/**
 * Excel Utilities - Production-ready Excel/CSV import/export
 * Uses SheetJS (XLSX) for Excel parsing and generation
 */

import * as XLSX from 'xlsx'

export interface ExcelCell {
  row: number
  col: number
  value: string | number | null
  formula?: string
}

export interface ExcelData {
  sheetName: string
  data: ExcelCell[][]
  headers?: string[]
}

/**
 * Parse Excel file (.xlsx, .xls) to JSON
 */
export const parseExcelFile = async (file: File): Promise<ExcelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheets: ExcelData[] = []

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null,
            raw: false,
          })

          // Convert to ExcelCell format
          const cells: ExcelCell[][] = jsonData.map((row, rowIndex) =>
            row.map((cell, colIndex) => ({
              row: rowIndex,
              col: colIndex,
              value: cell === null || cell === undefined ? null : String(cell),
            }))
          )

          sheets.push({
            sheetName,
            data: cells,
            headers: cells[0]?.map((cell) => cell.value?.toString() || ''),
          })
        })

        resolve(sheets)
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse CSV file to JSON
 */
export const parseCSVFile = async (file: File): Promise<ExcelData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter((line) => line.trim())

        const cells: ExcelCell[][] = lines.map((line, rowIndex) => {
          // Handle CSV with quotes and commas
          const values = parseCSVLine(line)
          return values.map((value, colIndex) => ({
            row: rowIndex,
            col: colIndex,
            value: value.trim() || null,
          }))
        })

        resolve({
          sheetName: 'Sheet1',
          data: cells,
          headers: cells[0]?.map((cell) => cell.value?.toString() || ''),
        })
      } catch (error) {
        reject(new Error(`Failed to parse CSV file: ${error}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Parse CSV line handling quotes and commas
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Convert grid data to Excel format
 */
export const convertGridToExcel = (
  rowData: Record<string, any>[],
  columnDefs: { field: string; headerName?: string }[]
): ExcelCell[][] => {
  if (!rowData.length) return []

  // Create header row
  const headers: ExcelCell[] = columnDefs.map((col, index) => ({
    row: 0,
    col: index,
    value: col.headerName || col.field.replace('col_', ''),
  }))

  // Create data rows
  const rows: ExcelCell[][] = [headers]

  rowData.forEach((row, rowIndex) => {
    const cells: ExcelCell[] = columnDefs.map((col, colIndex) => ({
      row: rowIndex + 1,
      col: colIndex,
      value: row[col.field] || null,
    }))
    rows.push(cells)
  })

  return rows
}

/**
 * Export data to Excel file (.xlsx)
 */
export const exportToExcel = (
  data: ExcelCell[][],
  sheetName: string = 'Sheet1',
  filename: string = 'spreadsheet.xlsx'
): void => {
  // Convert to XLSX format
  const wsData: any[][] = []

  // Find max dimensions
  let maxRow = 0
  let maxCol = 0

  data.forEach((row) => {
    row.forEach((cell) => {
      maxRow = Math.max(maxRow, cell.row)
      maxCol = Math.max(maxCol, cell.col)
    })
  })

  // Initialize empty grid
  for (let r = 0; r <= maxRow; r++) {
    wsData[r] = []
    for (let c = 0; c <= maxCol; c++) {
      wsData[r][c] = null
    }
  }

  // Fill with data
  data.forEach((row) => {
    row.forEach((cell) => {
      wsData[cell.row][cell.col] = cell.value
    })
  })

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Generate file and download
  XLSX.writeFile(wb, filename)
}

/**
 * Export data to CSV file
 */
export const exportToCSV = (
  data: ExcelCell[][],
  filename: string = 'spreadsheet.csv'
): void => {
  // Convert to CSV format
  const csvRows: string[] = []

  // Find max dimensions
  let maxRow = 0
  let maxCol = 0

  data.forEach((row) => {
    row.forEach((cell) => {
      maxRow = Math.max(maxRow, cell.row)
      maxCol = Math.max(maxCol, cell.col)
    })
  })

  // Build CSV rows
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxCol; c++) {
      const cell = data
        .flat()
        .find((cell) => cell.row === r && cell.col === c)
      const value = cell?.value || ''
      // Escape quotes and wrap in quotes if contains comma or quote
      const escapedValue = String(value).replace(/"/g, '""')
      row.push(value && (value.toString().includes(',') || value.toString().includes('"'))
        ? `"${escapedValue}"`
        : escapedValue)
    }
    csvRows.push(row.join(','))
  }

  // Create blob and download
  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}



