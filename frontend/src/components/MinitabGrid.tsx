/**
 * Minitab-style Grid Component
 * Mimics Minitab's data grid with C1, C2, C3 column headers
 * Supports multiple worksheets with separate data
 */

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AgGridReact } from 'ag-grid-react'
import {
  ColDef,
  CellValueChangedEvent,
  GridReadyEvent,
  CellClickedEvent,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Cell, spreadsheetsAPI } from '../api/spreadsheets'
import toast from 'react-hot-toast'

interface MinitabGridProps {
  spreadsheetId: string
  rowCount: number
  columnCount: number
  cells: Cell[]
  onCellsUpdate: (cells: Cell[]) => void
  spreadsheetName?: string
  worksheetNames?: Record<string, string>
  onWorksheetNamesUpdate?: (names: Record<string, string>) => Promise<void>
}

interface WorksheetData {
  id: number
  name: string
  cells: Cell[]
}

const MinitabGrid = ({
  spreadsheetId,
  rowCount,
  columnCount,
  cells,
  onCellsUpdate,
  spreadsheetName = 'Worksheet 1',
  worksheetNames = {},
  onWorksheetNamesUpdate,
}: MinitabGridProps) => {
  const gridRef = useRef<AgGridReact>(null)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
  } | null>(null)
  
  // Store worksheets with their own data
  const [worksheets, setWorksheets] = useState<WorksheetData[]>([
    { id: 1, name: spreadsheetName, cells: [...cells] }
  ])
  const [activeTab, setActiveTab] = useState(1)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    worksheetId: number
  } | null>(null)
  
  // Rename modal state
  const [renameModal, setRenameModal] = useState<{
    visible: boolean
    worksheetId: number
    currentName: string
  } | null>(null)
  
  // Inline rename state (for double-click editing)
  const [editingTabId, setEditingTabId] = useState<number | null>(null)
  const [editingTabName, setEditingTabName] = useState<string>('')

  // Get current worksheet data
  const currentWorksheet = useMemo(() => {
    return worksheets.find(ws => ws.id === activeTab) || worksheets[0]
  }, [worksheets, activeTab])

  // Initialize first worksheet with cells from props
  useEffect(() => {
    if (cells.length > 0 && worksheets[0] && worksheets[0].cells.length === 0) {
      setWorksheets(prev => prev.map((ws, idx) => {
        if (idx === 0) {
          return { ...ws, cells: [...cells] }
        }
        return ws
      }))
    }
  }, [cells]) // Only when cells prop changes from parent

  // Load worksheet names from backend
  useEffect(() => {
    if (worksheetNames && Object.keys(worksheetNames).length > 0) {
      setWorksheets(prev => prev.map(ws => {
        const newName = worksheetNames[String(ws.id)]
        if (newName && newName !== ws.name) {
          return { ...ws, name: newName }
        }
        return ws
      }))
    }
  }, [worksheetNames])

  // Create column definitions with C1, C2, C3 format
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = []
    for (let i = 0; i < columnCount; i++) {
      cols.push({
        headerName: `C${i + 1}`,
        field: `col_${i}`,
        editable: true,
        sortable: true,
        filter: true,
        resizable: true,
        width: 100,
        cellStyle: { padding: '2px 4px', fontSize: '13px' },
        headerClass: 'minitab-header',
      })
    }
    return cols
  }, [columnCount])

  // Convert cells to row data for current worksheet
  const rowData = useMemo(() => {
    const rows: Record<string, any>[] = []
    const cellMap = new Map<string, string>()

    // Use current worksheet's cells
    const worksheetCells = currentWorksheet?.cells || []
    worksheetCells.forEach((cell) => {
      const key = `${cell.row_index}_${cell.column_index}`
      cellMap.set(key, cell.value?.toString() || '')
    })

    for (let row = 0; row < rowCount; row++) {
      const rowData: Record<string, any> = {}
      for (let col = 0; col < columnCount; col++) {
        const key = `${row}_${col}`
        rowData[`col_${col}`] = cellMap.get(key) || ''
      }
      rows.push(rowData)
    }

    return rows
  }, [currentWorksheet, rowCount, columnCount])

  // Handle cell click
  const onCellClicked = useCallback((params: CellClickedEvent) => {
    if (!params.colDef?.field || params.node?.rowIndex === undefined || params.node.rowIndex === null) return

    const columnIndex = parseInt(params.colDef.field.replace('col_', ''))
    const rowIndex = params.node.rowIndex ?? 0

    setSelectedCell({ row: rowIndex, col: columnIndex })
  }, [])

  // Handle cell value changes
  const onCellValueChanged = useCallback(
    async (params: CellValueChangedEvent) => {
      if (!params.data || !params.colDef?.field) return

      const columnIndex = parseInt(params.colDef.field.replace('col_', ''))
      const rowIndex = params.node?.rowIndex ?? 0
      const newValue = params.newValue?.toString() || ''

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

          // Update current worksheet's cells
          const updatedWorksheets = worksheets.map(ws => {
            if (ws.id === activeTab) {
              const updatedCells = [...ws.cells]
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

              return { ...ws, cells: updatedCells }
            }
            return ws
          })

          setWorksheets(updatedWorksheets)
          
          // Update parent component with current worksheet's cells
          const currentWs = updatedWorksheets.find(ws => ws.id === activeTab)
          if (currentWs) {
            onCellsUpdate(currentWs.cells)
          }
        } catch (error: any) {
          toast.error('Failed to update cell')
          console.error(error)
          if (params.colDef?.field) {
            params.node?.setDataValue(params.colDef.field, params.oldValue)
          }
        }
      }, 500)
    },
    [spreadsheetId, worksheets, activeTab, onCellsUpdate]
  )

  // Helper function to save current grid data
  const saveCurrentGridData = useCallback((): Cell[] => {
    const gridData: Cell[] = []
    if (gridRef.current) {
      const allRowData = gridRef.current.api.getModel().getRowCount()
      for (let row = 0; row < allRowData; row++) {
        const rowNode = gridRef.current.api.getRowNode(row.toString())
        if (rowNode && rowNode.data) {
          for (let col = 0; col < columnCount; col++) {
            const value = rowNode.data[`col_${col}`]
            if (value && value.toString().trim()) {
              gridData.push({
                row_index: row,
                column_index: col,
                value: value.toString(),
                data_type: 'text',
              })
            }
          }
        }
      }
    }
    return gridData
  }, [columnCount])

  // Handle worksheet tab change
  const handleTabChange = useCallback((tabId: number) => {
    if (tabId === activeTab) return // Already on this tab

    // Save current worksheet data before switching
    const gridData = saveCurrentGridData()
    
    // Update current worksheet with saved data
    setWorksheets(prev => prev.map(ws => {
      if (ws.id === activeTab) {
        return { ...ws, cells: gridData }
      }
      return ws
    }))

    // Switch to new tab (this will trigger rowData update via currentWorksheet)
    setActiveTab(tabId)
  }, [activeTab, saveCurrentGridData])

  // Handle adding new worksheet
  const handleAddWorksheet = useCallback(() => {
    // Save current worksheet data first
    const gridData = saveCurrentGridData()

    // Update current worksheet with saved data and add new worksheet
    setWorksheets(prev => {
      const updated = prev.map(ws => {
        if (ws.id === activeTab) {
          return { ...ws, cells: gridData }
        }
        return ws
      })

      // Add new worksheet
      const newTabId = Math.max(...prev.map(ws => ws.id), 0) + 1
      const newWorksheet: WorksheetData = {
        id: newTabId,
        name: `Worksheet ${newTabId}`,
        cells: [] // Empty cells for new worksheet
      }

      const result = [...updated, newWorksheet]
      
      // Save worksheet names to backend
      if (onWorksheetNamesUpdate) {
        const names: Record<string, string> = {}
        result.forEach(ws => {
          names[String(ws.id)] = ws.name
        })
        onWorksheetNamesUpdate(names).catch(() => {
          toast.error('Failed to save worksheet names')
        })
      }
      
      return result
    })

    // Switch to new tab
    const newTabId = Math.max(...worksheets.map(ws => ws.id), 0) + 1
    setActiveTab(newTabId)
  }, [worksheets, activeTab, saveCurrentGridData, onWorksheetNamesUpdate])

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit()
    params.api.setFocusedCell(0, 'col_0')
    setSelectedCell({ row: 0, col: 0 })
  }, [])

  // Update parent when worksheet changes
  useEffect(() => {
    if (currentWorksheet) {
      onCellsUpdate(currentWorksheet.cells)
    }
  }, [activeTab, currentWorksheet, onCellsUpdate])

  // Handle right-click on worksheet tab
  const handleTabRightClick = useCallback((e: React.MouseEvent, worksheetId: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Calculate menu position with viewport bounds
    const menuWidth = 200 // min-w-[200px]
    const menuHeight = 200 // approximate height
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let x = e.clientX
    let y = e.clientY
    
    // Adjust horizontal position if menu would go off-screen
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10 // 10px padding from edge
    }
    if (x < 10) {
      x = 10
    }
    
    // Adjust vertical position if menu would go off-screen
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10 // Show above cursor
    }
    if (y < 10) {
      y = 10
    }
    
    setContextMenu({
      visible: true,
      x,
      y,
      worksheetId,
    })
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Close context menu when clicking outside or window resizes
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        closeContextMenu()
      }
    }
    
    const handleResize = () => {
      if (contextMenu) {
        // Reposition menu if window is resized
        const menuWidth = 200
        const menuHeight = 250
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        let x = contextMenu.x
        let y = contextMenu.y
        
        // Adjust if menu goes off-screen after resize
        if (x + menuWidth > viewportWidth) {
          x = Math.max(10, viewportWidth - menuWidth - 10)
        }
        if (y + menuHeight > viewportHeight) {
          y = Math.max(10, viewportHeight - menuHeight - 10)
        }
        
        setContextMenu(prev => prev ? { ...prev, x, y } : null)
      }
    }
    
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      window.addEventListener('resize', handleResize)
      return () => {
        document.removeEventListener('click', handleClickOutside)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [contextMenu, closeContextMenu])

  // Handle delete worksheet
  const handleDeleteWorksheet = useCallback((worksheetId: number) => {
    // Don't allow deletion if it's the last worksheet
    if (worksheets.length <= 1) {
      toast.error('Cannot delete the last worksheet', {
        duration: 2000,
      })
      closeContextMenu()
      return
    }

    closeContextMenu() // Close menu first

    if (window.confirm('Are you sure you want to delete this worksheet?')) {
      setWorksheets(prev => {
        const filtered = prev.filter(ws => ws.id !== worksheetId)
        // If deleted worksheet was active, switch to first worksheet
        if (worksheetId === activeTab) {
          setActiveTab(filtered[0]?.id || 1)
        }
        return filtered
      })
      toast.success('Worksheet deleted successfully', {
        duration: 2000,
      })
    }
  }, [worksheets, activeTab, closeContextMenu])

  // Handle rename worksheet (from context menu)
  const handleRenameWorksheet = useCallback((worksheetId: number) => {
    const worksheet = worksheets.find(ws => ws.id === worksheetId)
    if (worksheet) {
      setRenameModal({
        visible: true,
        worksheetId,
        currentName: worksheet.name,
      })
      closeContextMenu()
    }
  }, [worksheets, closeContextMenu])

  // Handle double-click to start inline editing
  const handleTabDoubleClick = useCallback((e: React.MouseEvent, worksheetId: number) => {
    e.preventDefault()
    e.stopPropagation()
    const worksheet = worksheets.find(ws => ws.id === worksheetId)
    if (worksheet) {
      setEditingTabId(worksheetId)
      setEditingTabName(worksheet.name)
    }
  }, [worksheets])

  // Handle inline rename save
  const handleInlineRenameSave = useCallback((worksheetId: number) => {
    const newName = editingTabName.trim()
    if (!newName) {
      toast.error('Worksheet name cannot be empty')
      setEditingTabId(null)
      return
    }

    setWorksheets(prev => prev.map(ws => {
      if (ws.id === worksheetId) {
        return { ...ws, name: newName }
      }
      return ws
    }))
    
    setEditingTabId(null)
    toast.success('Worksheet renamed')
    
    // Save to backend
    if (onWorksheetNamesUpdate) {
      setWorksheets(prev => {
        const names: Record<string, string> = {}
        prev.forEach(ws => {
          names[String(ws.id)] = ws.name
        })
        onWorksheetNamesUpdate(names).catch(() => {
          toast.error('Failed to save worksheet names')
        })
        return prev
      })
    }
  }, [editingTabName, onWorksheetNamesUpdate])

  // Handle inline rename cancel
  const handleInlineRenameCancel = useCallback(() => {
    setEditingTabId(null)
    setEditingTabName('')
  }, [])

  // Save rename
  const handleSaveRename = useCallback(() => {
    if (!renameModal) return
    
    const newName = renameModal.currentName.trim()
    if (!newName) {
      toast.error('Worksheet name cannot be empty')
      return
    }

    setWorksheets(prev => prev.map(ws => {
      if (ws.id === renameModal.worksheetId) {
        return { ...ws, name: newName }
      }
      return ws
    }))
    
    setRenameModal(null)
    toast.success('Worksheet renamed')
    
    // Save to backend
    if (onWorksheetNamesUpdate) {
      setWorksheets(prev => {
        const names: Record<string, string> = {}
        prev.forEach(ws => {
          names[String(ws.id)] = ws.name
        })
        onWorksheetNamesUpdate(names).catch(() => {
          toast.error('Failed to save worksheet names')
        })
        return prev
      })
    }
  }, [renameModal, onWorksheetNamesUpdate])

  // Handle duplicate worksheet
  const handleDuplicateWorksheet = useCallback((worksheetId: number) => {
    const worksheet = worksheets.find(ws => ws.id === worksheetId)
    if (!worksheet) return

    const newTabId = Math.max(...worksheets.map(ws => ws.id), 0) + 1
    const duplicatedWorksheet: WorksheetData = {
      id: newTabId,
      name: `${worksheet.name} (Copy)`,
      cells: [...worksheet.cells], // Deep copy of cells
    }

    setWorksheets(prev => {
      const result = [...prev, duplicatedWorksheet]
      
      // Save worksheet names to backend
      if (onWorksheetNamesUpdate) {
        const names: Record<string, string> = {}
        result.forEach(ws => {
          names[String(ws.id)] = ws.name
        })
        onWorksheetNamesUpdate(names).catch(() => {
          toast.error('Failed to save worksheet names')
        })
      }
      
      return result
    })
    
    setActiveTab(newTabId)
    closeContextMenu()
    toast.success('Worksheet duplicated')
  }, [worksheets, closeContextMenu, onWorksheetNamesUpdate])

  // Handle export worksheet
  const handleExportWorksheet = useCallback(async (worksheetId: number) => {
    const worksheet = worksheets.find(ws => ws.id === worksheetId)
    if (!worksheet) return

    try {
      // Convert worksheet cells to CSV format
      const csvRows: string[] = []
      
      // Find max dimensions
      let maxRow = 0
      let maxCol = 0
      worksheet.cells.forEach(cell => {
        maxRow = Math.max(maxRow, cell.row_index)
        maxCol = Math.max(maxCol, cell.column_index)
      })

      // Build CSV
      for (let row = 0; row <= maxRow; row++) {
        const rowData: string[] = []
        for (let col = 0; col <= maxCol; col++) {
          const cell = worksheet.cells.find(
            c => c.row_index === row && c.column_index === col
          )
          const value = cell?.value || ''
          // Escape quotes and wrap in quotes if contains comma or quote
          const escapedValue = String(value).replace(/"/g, '""')
          rowData.push(value && (value.toString().includes(',') || value.toString().includes('"'))
            ? `"${escapedValue}"`
            : escapedValue)
        }
        csvRows.push(rowData.join(','))
      }

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', `${worksheet.name}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      closeContextMenu()
      toast.success('Worksheet exported')
    } catch (error) {
      toast.error('Failed to export worksheet')
      console.error(error)
    }
  }, [worksheets, closeContextMenu])

  return (
    <div className="minitab-grid-container flex flex-col h-full bg-white relative">
      {/* Grid Area with Watermark Background */}
      <div className="flex-1 overflow-auto relative bg-white">
        {/* Minitab Logo Watermark - Centered Background */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <div className="flex flex-col items-center justify-center" style={{ opacity: 0.08 }}>
            {/* Minitab Logo - Large Green Bars */}
            <div className="flex items-end gap-3 mb-6">
              <div className="w-10 h-20 bg-green-600 rounded-sm"></div>
              <div className="w-10 h-28 bg-green-600 rounded-sm"></div>
              <div className="w-10 h-36 bg-green-600 rounded-sm"></div>
            </div>
            {/* Minitab Text */}
            <div className="text-7xl font-bold text-gray-500 tracking-wider" style={{ fontFamily: 'Arial, sans-serif' }}>
              Minitab
            </div>
            {/* Play Triangle Icon */}
            <div className="mt-6">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-gray-500">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>

        {/* Grid Overlay - Above Watermark */}
        <div
          className="ag-theme-alpine minitab-grid relative z-10 bg-transparent"
          style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }}
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
            }}
            onCellValueChanged={onCellValueChanged}
            onCellClicked={onCellClicked}
            onGridReady={onGridReady}
            animateRows={false}
            rowSelection="single"
            suppressCellFocus={false}
            enableRangeSelection={true}
            enterNavigatesVertically={true}
            enterNavigatesVerticallyAfterEdit={true}
            rowHeight={22}
            headerHeight={25}
            key={activeTab} // Force re-render on tab change
          />
        </div>
      </div>

      {/* Worksheet Tabs */}
      <div className="border-t border-gray-300 bg-gray-50 px-2 py-1 flex items-center gap-1 relative">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {worksheets.map((tab) => (
            <div
              key={tab.id}
              className={`px-3 py-1 text-sm rounded-t ${
                activeTab === tab.id
                  ? 'bg-white border-t border-l border-r border-gray-300 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={() => handleInlineRenameSave(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleInlineRenameSave(tab.id)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      handleInlineRenameCancel()
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-none outline-none text-sm text-gray-900 min-w-[80px] max-w-[200px]"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => handleTabChange(tab.id)}
                  onDoubleClick={(e) => handleTabDoubleClick(e, tab.id)}
                  onContextMenu={(e) => handleTabRightClick(e, tab.id)}
                  className="w-full text-left"
                >
                  {tab.name}
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleAddWorksheet}
          className="px-2 py-1 text-gray-600 hover:text-gray-900 flex-shrink-0"
          title="Add Worksheet"
        >
          +
        </button>

        {/* Context Menu - Render in portal for proper z-index */}
        {contextMenu && contextMenu.visible && typeof document !== 'undefined' && createPortal(
          <>
            {/* Overlay to close menu on outside click */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={closeContextMenu}
              onContextMenu={(e) => {
                e.preventDefault()
                closeContextMenu()
              }}
            />
            {/* Menu */}
            <div
              className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] py-1 min-w-[200px] max-w-[90vw]"
              style={{
                left: `${Math.max(10, Math.min(contextMenu.x, window.innerWidth - 210))}px`,
                top: `${Math.max(10, Math.min(contextMenu.y, window.innerHeight - 250))}px`,
                position: 'fixed',
              }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
            <button
              onClick={() => handleExportWorksheet(contextMenu.worksheetId)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Export Worksheet
            </button>
            <button
              onClick={() => handleDeleteWorksheet(contextMenu.worksheetId)}
              disabled={worksheets.length <= 1}
              className={`w-full text-left px-4 py-2 text-sm ${
                worksheets.length <= 1
                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={worksheets.length <= 1 ? 'Cannot delete the last worksheet' : 'Delete this worksheet'}
            >
              Delete Worksheet
            </button>
            <button
              onClick={() => handleRenameWorksheet(contextMenu.worksheetId)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Rename Worksheet
            </button>
            <button
              onClick={() => handleDuplicateWorksheet(contextMenu.worksheetId)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Duplicate Worksheet
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={() => {
                const ws = worksheets.find(w => w.id === contextMenu.worksheetId)
                toast.success(`Worksheet: ${ws?.name}\nCells: ${ws?.cells.length || 0}`, {
                  duration: 3000,
                })
                closeContextMenu()
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Worksheet Information
            </button>
            </div>
          </>,
          document.body
        )}

        {/* Rename Modal */}
        {renameModal && renameModal.visible && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Rename Worksheet</h2>
              <input
                type="text"
                value={renameModal.currentName}
                onChange={(e) => setRenameModal({
                  ...renameModal,
                  currentName: e.target.value,
                })}
                className="input mb-4"
                placeholder="Worksheet name"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename()
                  } else if (e.key === 'Escape') {
                    setRenameModal(null)
                  }
                }}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setRenameModal(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRename}
                  className="btn btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MinitabGrid
