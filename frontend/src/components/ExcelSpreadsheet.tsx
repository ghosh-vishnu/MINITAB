/**
 * ExcelSpreadsheet Component - Production-ready Excel-like spreadsheet
 * Features: Copy/paste, keyboard navigation, import/export, auto-save
 */

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  ColDef,
  CellValueChangedEvent,
  GridReadyEvent,
  CellClickedEvent,
  SelectionChangedEvent,
  RangeSelectionChangedEvent,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Cell, spreadsheetsAPI } from '../api/spreadsheets'
import { convertGridToExcel, exportToExcel, exportToCSV } from '../utils/excelUtils'
import ExcelUpload from './ExcelUpload'
import { ExcelData } from '../utils/excelUtils'
import toast from 'react-hot-toast'

interface ExcelSpreadsheetProps {
  spreadsheetId: string
  rowCount: number
  columnCount: number
  cells: Cell[]
  onCellsUpdate: (cells: Cell[]) => void
  enableImport?: boolean
  enableExport?: boolean
  autoSaveDelay?: number // milliseconds
}

const ExcelSpreadsheet = ({
  spreadsheetId,
  rowCount,
  columnCount,
  cells,
  onCellsUpdate,
  enableImport = true,
  enableExport = true,
  autoSaveDelay = 1000,
}: ExcelSpreadsheetProps) => {
  const gridRef = useRef<AgGridReact>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout>()
  const formulaBarRef = useRef<HTMLInputElement>(null)
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
    address: string
  } | null>(null)
  const [formulaValue, setFormulaValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [clipboard, setClipboard] = useState<string[][]>([])

  // Convert column index to Excel-style column name (A, B, C, ..., Z, AA, AB, ...)
  const getColumnName = (index: number): string => {
    let result = ''
    let num = index
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
    }
    return result
  }

  // Get cell address (A1, B2, etc.)
  const getCellAddress = (row: number, col: number): string => {
    return `${getColumnName(col)}${row + 1}`
  }

  // Create column definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = []
    for (let i = 0; i < columnCount; i++) {
      cols.push({
        headerName: getColumnName(i),
        field: `col_${i}`,
        editable: true,
        sortable: true,
        filter: true,
        resizable: true,
        width: 120,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          useFormatter: false,
        },
      })
    }
    return cols
  }, [columnCount])

  // Convert cells to row data
  const rowData = useMemo(() => {
    const rows: Record<string, any>[] = []
    const cellMap = new Map<string, { value: string; formula?: string }>()

    cells.forEach((cell) => {
      const key = `${cell.row_index}_${cell.column_index}`
      cellMap.set(key, {
        value: cell.value?.toString() || '',
        formula: cell.formula || undefined,
      })
    })

    for (let row = 0; row < rowCount; row++) {
      const rowData: Record<string, any> = {}
      for (let col = 0; col < columnCount; col++) {
        const key = `${row}_${col}`
        const cellData = cellMap.get(key)
        rowData[`col_${col}`] = cellData?.formula || cellData?.value || ''
      }
      rows.push(rowData)
    }

    return rows
  }, [cells, rowCount, columnCount])

  // Handle cell click - update formula bar
  const onCellClicked = useCallback(
    (params: CellClickedEvent) => {
      if (!params.colDef?.field || params.node?.rowIndex === undefined) return

      const columnIndex = parseInt(params.colDef.field.replace('col_', ''))
      const rowIndex = params.node.rowIndex
      const address = getCellAddress(rowIndex, columnIndex)

      const cell = cells.find(
        (c) => c.row_index === rowIndex && c.column_index === columnIndex
      )

      setSelectedCell({ row: rowIndex, col: columnIndex, address })
      setFormulaValue(cell?.formula || cell?.value?.toString() || '')
      setIsEditing(false)
    },
    [cells]
  )

  // Handle cell selection change
  const onSelectionChanged = useCallback(
    (params: SelectionChangedEvent) => {
      const selectedRows = params.api.getSelectedRows()
      if (selectedRows.length > 0) {
        const firstRow = selectedRows[0]
        const firstCol = columnDefs[0]
        if (firstCol?.field) {
          const colIndex = parseInt(firstCol.field.replace('col_', ''))
          const rowIndex = params.api.getRowNode(firstRow)?.rowIndex ?? 0
          const address = getCellAddress(rowIndex, colIndex)
          setSelectedCell({ row: rowIndex, col: colIndex, address })
        }
      }
    },
    [columnDefs]
  )

  // Handle cell value changes with auto-save
  const onCellValueChanged = useCallback(
    async (params: CellValueChangedEvent) => {
      if (!params.data || !params.colDef?.field) return

      const columnIndex = parseInt(params.colDef.field.replace('col_', ''))
      const rowIndex = params.node?.rowIndex ?? 0
      const newValue = params.newValue?.toString() || ''

      setFormulaValue(newValue)

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          const isFormula = newValue.trim().startsWith('=')
          const dataType = isFormula ? 'formula' : 'text'

          await spreadsheetsAPI.updateCell(
            spreadsheetId,
            rowIndex,
            columnIndex,
            newValue,
            isFormula ? newValue : undefined,
            dataType
          )

          const updatedCells = [...cells]
          const cellIndex = updatedCells.findIndex(
            (c) => c.row_index === rowIndex && c.column_index === columnIndex
          )

          if (cellIndex >= 0) {
            updatedCells[cellIndex] = {
              ...updatedCells[cellIndex],
              value: newValue,
              formula: isFormula ? newValue : undefined,
              data_type: dataType,
            }
          } else {
            updatedCells.push({
              row_index: rowIndex,
              column_index: columnIndex,
              value: newValue,
              formula: isFormula ? newValue : undefined,
              data_type: dataType,
            })
          }

          onCellsUpdate(updatedCells)
        } catch (error: any) {
          toast.error('Failed to update cell')
          console.error(error)
          params.node?.setDataValue(params.colDef.field, params.oldValue)
        }
      }, autoSaveDelay)
    },
    [spreadsheetId, cells, onCellsUpdate, autoSaveDelay]
  )

  // Handle copy (Ctrl+C)
  const handleCopy = useCallback(() => {
    if (!gridRef.current) return

    const selectedRanges = gridRef.current.api.getCellRanges()
    if (!selectedRanges || selectedRanges.length === 0) {
      const focusedCell = gridRef.current.api.getFocusedCell()
      if (focusedCell) {
        const value = focusedCell.rowIndex !== null
          ? rowData[focusedCell.rowIndex]?.[focusedCell.column?.getColId() || ''] || ''
          : ''
        navigator.clipboard.writeText(String(value))
        toast.success('Cell copied')
      }
      return
    }

    const range = selectedRanges[0]
    const startRow = range.startRow?.rowIndex ?? 0
    const endRow = range.endRow?.rowIndex ?? 0
    const startCol = range.startColumn?.getColId() || ''
    const endCol = range.endColumn?.getColId() || ''

    const startColIndex = parseInt(startCol.replace('col_', ''))
    const endColIndex = parseInt(endCol.replace('col_', ''))

    const copiedData: string[][] = []

    for (let r = startRow; r <= endRow; r++) {
      const row: string[] = []
      for (let c = startColIndex; c <= endColIndex; c++) {
        const value = rowData[r]?.[`col_${c}`] || ''
        row.push(String(value))
      }
      copiedData.push(row)
    }

    // Convert to tab-separated string for clipboard
    const clipboardText = copiedData.map((row) => row.join('\t')).join('\n')
    navigator.clipboard.writeText(clipboardText)
    setClipboard(copiedData)
    toast.success(`Copied ${copiedData.length} row(s)`)
  }, [rowData])

  // Handle paste (Ctrl+V)
  const handlePaste = useCallback(
    async (e?: ClipboardEvent) => {
      if (!gridRef.current || !selectedCell) return

      let pasteData: string[][]

      if (e?.clipboardData) {
        const text = e.clipboardData.getData('text')
        pasteData = text.split('\n').map((row) => row.split('\t'))
      } else if (clipboard.length > 0) {
        pasteData = clipboard
      } else {
        try {
          const text = await navigator.clipboard.readText()
          pasteData = text.split('\n').map((row) => row.split('\t'))
        } catch (error) {
          toast.error('Failed to read clipboard')
          return
        }
      }

      const { row: startRow, col: startCol } = selectedCell
      const updatedCells = [...cells]

      pasteData.forEach((row, rowOffset) => {
        row.forEach((cell, colOffset) => {
          const targetRow = startRow + rowOffset
          const targetCol = startCol + colOffset

          if (targetRow < rowCount && targetCol < columnCount) {
            const field = `col_${targetCol}`
            const rowNode = gridRef.current?.api.getRowNode(targetRow.toString())
            if (rowNode) {
              rowNode.setDataValue(field, cell.trim())

              const cellIndex = updatedCells.findIndex(
                (c) => c.row_index === targetRow && c.column_index === targetCol
              )

              if (cellIndex >= 0) {
                updatedCells[cellIndex] = {
                  ...updatedCells[cellIndex],
                  value: cell.trim(),
                }
              } else {
                updatedCells.push({
                  row_index: targetRow,
                  column_index: targetCol,
                  value: cell.trim(),
                  data_type: 'text',
                })
              }
            }
          }
        })
      })

      onCellsUpdate(updatedCells)
      toast.success('Pasted successfully')
    },
    [selectedCell, clipboard, cells, rowCount, columnCount, onCellsUpdate]
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C - Copy
      if (e.ctrlKey && e.key === 'c' && !isEditing) {
        e.preventDefault()
        handleCopy()
      }

      // Ctrl+V - Paste
      if (e.ctrlKey && e.key === 'v' && !isEditing) {
        e.preventDefault()
        handlePaste()
      }

      // F2 - Edit cell
      if (e.key === 'F2' && selectedCell && !isEditing) {
        e.preventDefault()
        setIsEditing(true)
        setTimeout(() => {
          formulaBarRef.current?.focus()
          formulaBarRef.current?.select()
        }, 0)
      }

      // Escape - Cancel editing
      if (e.key === 'Escape' && isEditing) {
        setIsEditing(false)
        if (selectedCell) {
          const cell = cells.find(
            (c) => c.row_index === selectedCell.row && c.column_index === selectedCell.col
          )
          setFormulaValue(cell?.formula || cell?.value?.toString() || '')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell, isEditing, cells, handleCopy, handlePaste])

  // Handle formula bar
  const handleFormulaBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaValue(e.target.value)
  }

  const handleFormulaBarSubmit = useCallback(async () => {
    if (!selectedCell || !gridRef.current) return

    const { row, col } = selectedCell
    const field = `col_${col}`
    const rowNode = gridRef.current.api.getRowNode(row.toString())
    if (!rowNode) return

    rowNode.setDataValue(field, formulaValue)

    const params: any = {
      data: rowNode.data,
      colDef: columnDefs[col],
      newValue: formulaValue,
      oldValue: rowNode.data[field],
      node: rowNode,
    }

    await onCellValueChanged(params)
    setIsEditing(false)
  }, [selectedCell, formulaValue, columnDefs, onCellValueChanged])

  // Handle import
  const handleImport = useCallback(
    async (data: ExcelData | ExcelData[]) => {
      try {
        const excelData = Array.isArray(data) ? data[0] : data

        if (!excelData.data || excelData.data.length === 0) {
          toast.error('No data found in file')
          return
        }

        const updatedCells: Cell[] = []

        excelData.data.forEach((row) => {
          row.forEach((cell) => {
            if (cell.value !== null && cell.row < rowCount && cell.col < columnCount) {
              updatedCells.push({
                row_index: cell.row,
                column_index: cell.col,
                value: cell.value,
                data_type: 'text',
              })
            }
          })
        })

        // Bulk update cells
        await spreadsheetsAPI.bulkUpdateCells(spreadsheetId, updatedCells)
        onCellsUpdate(updatedCells)
        setShowImportModal(false)
        toast.success('File imported successfully')
      } catch (error: any) {
        toast.error(error.message || 'Failed to import file')
      }
    },
    [spreadsheetId, rowCount, columnCount, onCellsUpdate]
  )

  // Handle export
  const handleExport = useCallback(
    async (format: 'xlsx' | 'csv') => {
      try {
        if (!gridRef.current) return

        const excelData = convertGridToExcel(rowData, columnDefs)
        const filename = `spreadsheet_${spreadsheetId}.${format}`

        if (format === 'xlsx') {
          exportToExcel(excelData, 'Sheet1', filename)
        } else {
          exportToCSV(excelData, filename)
        }

        toast.success(`Exported to ${format.toUpperCase()}`)
      } catch (error: any) {
        toast.error('Failed to export file')
        console.error(error)
      }
    },
    [rowData, columnDefs, spreadsheetId]
  )

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit()
    params.api.setFocusedCell(0, 'col_0')
    setSelectedCell({ row: 0, col: 0, address: 'A1' })
    setFormulaValue('')
  }, [])

  const onCellDoubleClicked = useCallback(() => {
    setIsEditing(true)
    setTimeout(() => {
      formulaBarRef.current?.focus()
      formulaBarRef.current?.select()
    }, 0)
  }, [])

  return (
    <div className="excel-spreadsheet w-full">
      {/* Toolbar */}
      <div className="toolbar bg-white border-b border-gray-300 p-2 flex items-center gap-2 flex-wrap">
        {enableImport && (
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary text-sm"
            title="Import Excel/CSV (Ctrl+I)"
          >
            📥 Import
          </button>
        )}
        {enableExport && (
          <>
            <button
              onClick={() => handleExport('xlsx')}
              className="btn btn-secondary text-sm"
              title="Export to Excel"
            >
              📤 Export Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="btn btn-secondary text-sm"
              title="Export to CSV"
            >
              📤 Export CSV
            </button>
          </>
        )}
        <div className="flex-1"></div>
        <div className="text-xs text-gray-500">
          Ctrl+C: Copy | Ctrl+V: Paste | F2: Edit | Esc: Cancel
        </div>
      </div>

      {/* Formula Bar */}
      <div className="formula-bar bg-white border-b border-gray-300 p-2 flex items-center gap-2">
        <div className="cell-address bg-gray-100 px-3 py-1.5 min-w-[60px] text-center font-mono text-sm border border-gray-300">
          {selectedCell?.address || 'A1'}
        </div>
        <div className="fx-icon text-gray-600 font-semibold px-2">fx</div>
        <input
          ref={formulaBarRef}
          type="text"
          value={formulaValue}
          onChange={handleFormulaBarChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleFormulaBarSubmit()
            } else if (e.key === 'Escape') {
              setIsEditing(false)
            }
          }}
          onBlur={() => setTimeout(() => setIsEditing(false), 200)}
          className="formula-input flex-1 px-3 py-1.5 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="Enter formula or value"
        />
        <button
          onClick={handleFormulaBarSubmit}
          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          title="Enter (Apply)"
        >
          ✓
        </button>
        <button
          onClick={() => {
            setIsEditing(false)
            if (selectedCell) {
              const cell = cells.find(
                (c) => c.row_index === selectedCell.row && c.column_index === selectedCell.col
              )
              setFormulaValue(cell?.formula || cell?.value?.toString() || '')
            }
          }}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          title="Cancel (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Grid */}
      <div
        className="ag-theme-alpine"
        style={{ height: 'calc(100vh - 300px)', width: '100%' }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            editable: true,
            sortable: true,
            filter: true,
            resizable: true,
            cellStyle: { padding: '4px' },
          }}
          onCellValueChanged={onCellValueChanged}
          onCellClicked={onCellClicked}
          onCellDoubleClicked={onCellDoubleClicked}
          onSelectionChanged={onSelectionChanged}
          onGridReady={onGridReady}
          animateRows={true}
          rowSelection="single"
          suppressCellFocus={false}
          enableRangeSelection={true}
          enableFillHandle={true}
          enableRangeHandle={true}
          suppressRowClickSelection={false}
          enterNavigatesVertically={true}
          enterNavigatesVerticallyAfterEdit={true}
          suppressClipboardPaste={false}
        />
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Import Excel/CSV File</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ExcelUpload onFileParsed={handleImport} />
          </div>
        </div>
      )}
    </div>
  )
}

export default ExcelSpreadsheet

