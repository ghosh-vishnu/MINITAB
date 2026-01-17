import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, CellValueChangedEvent, GridReadyEvent, CellClickedEvent, SelectionChangedEvent } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Cell, spreadsheetsAPI } from '../api/spreadsheets'
import toast from 'react-hot-toast'

interface SpreadsheetGridProps {
  spreadsheetId: string
  worksheetId?: string
  rowCount: number
  columnCount: number
  cells: Cell[]
  onCellsUpdate: (cells: Cell[]) => void
}

const SpreadsheetGrid = ({
  spreadsheetId,
  worksheetId,
  rowCount,
  columnCount,
  cells,
  onCellsUpdate,
}: SpreadsheetGridProps) => {
  const gridRef = useRef<AgGridReact>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout>()
  const formulaBarRef = useRef<HTMLInputElement>(null)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number; address: string } | null>(null)
  const [formulaValue, setFormulaValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)

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

    // Map cells by row and column
    cells.forEach((cell) => {
      const key = `${cell.row_index}_${cell.column_index}`
      cellMap.set(key, {
        value: cell.value?.toString() || '',
        formula: cell.formula || undefined,
      })
    })

    // Create rows
    for (let row = 0; row < rowCount; row++) {
      const rowData: Record<string, any> = {}
      for (let col = 0; col < columnCount; col++) {
        const key = `${row}_${col}`
        const cellData = cellMap.get(key)
        // Show formula if exists, otherwise show value
        rowData[`col_${col}`] = cellData?.formula || cellData?.value || ''
      }
      rows.push(rowData)
    }

    return rows
  }, [cells, rowCount, columnCount])

  // Handle cell click - update formula bar
  const onCellClicked = useCallback((params: CellClickedEvent) => {
    if (!params.colDef?.field || params.node?.rowIndex === undefined) return

    const columnIndex = parseInt(params.colDef.field.replace('col_', ''))
    const rowIndex = params.node.rowIndex
    const address = getCellAddress(rowIndex, columnIndex)

    // Find cell data
    const cell = cells.find(
      (c) => c.row_index === rowIndex && c.column_index === columnIndex
    )

    setSelectedCell({ row: rowIndex, col: columnIndex, address })
    // Show formula if exists, otherwise show value
    setFormulaValue(cell?.formula || cell?.value?.toString() || '')
    setIsEditing(false)
  }, [cells])

  // Handle cell selection change
  const onSelectionChanged = useCallback((params: SelectionChangedEvent) => {
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
  }, [columnDefs])

  // Handle cell value changes
  const onCellValueChanged = useCallback(
    async (params: CellValueChangedEvent) => {
      if (!params.data || !params.colDef?.field) return

      const columnIndex = parseInt(params.colDef.field.replace('col_', ''))
      const rowIndex = params.node?.rowIndex ?? 0
      const newValue = params.newValue?.toString() || ''

      // Update formula bar
      setFormulaValue(newValue)

      // Clear previous timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      // Debounce API calls
      updateTimeoutRef.current = setTimeout(async () => {
        try {
          // Check if it's a formula (starts with =)
          const isFormula = newValue.trim().startsWith('=')
          const dataType = isFormula ? 'formula' : 'text'

          // Update local state immediately for UI responsiveness
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
          console.error('Failed to update cell', error)
          // Revert cell value
          params.node?.setDataValue(params.colDef.field, params.oldValue)
        }
      }, 500) // 500ms debounce
    },
    [spreadsheetId, cells, onCellsUpdate]
  )

  // Handle formula bar input
  const handleFormulaBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaValue(e.target.value)
  }

  // Handle formula bar submit (Enter key)
  const handleFormulaBarSubmit = useCallback(async () => {
    if (!selectedCell || !gridRef.current) return

    const { row, col } = selectedCell
    const field = `col_${col}`

    // Get the row node
    const rowNode = gridRef.current.api.getRowNode(row.toString())
    if (!rowNode) return

    // Update cell value
    rowNode.setDataValue(field, formulaValue)
    
    // Trigger cell value changed event
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 to edit cell
      if (e.key === 'F2' && selectedCell && !isEditing) {
        e.preventDefault()
        setIsEditing(true)
        setTimeout(() => {
          formulaBarRef.current?.focus()
          formulaBarRef.current?.select()
        }, 0)
      }

      // Escape to cancel editing
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
  }, [selectedCell, isEditing, cells])

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit()
    // Select first cell by default
    params.api.setFocusedCell(0, 'col_0')
    setSelectedCell({ row: 0, col: 0, address: 'A1' })
    setFormulaValue('')
  }, [])

  // Handle double click to edit
  const onCellDoubleClicked = useCallback((params: CellClickedEvent) => {
    setIsEditing(true)
    setTimeout(() => {
      formulaBarRef.current?.focus()
      formulaBarRef.current?.select()
    }, 0)
  }, [])

  return (
    <div className="excel-spreadsheet">
      {/* Formula Bar - Excel style */}
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
          onBlur={() => {
            // Don't blur if clicking on grid
            setTimeout(() => setIsEditing(false), 200)
          }}
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
      <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 300px)', width: '100%' }}>
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
          suppressKeyboardEvent={(params) => {
            // Allow F2 to work
            if (params.event.key === 'F2') {
              return false
            }
            return false
          }}
        />
      </div>
    </div>
  )
}

export default SpreadsheetGrid
