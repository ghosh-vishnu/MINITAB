/**
 * SheetTabs Component - Excel-like sheet tabs navigation
 * Features: Add sheet, rename sheet, delete sheet, switch sheets
 */

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

export interface Worksheet {
  id: string
  name: string
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SheetTabsProps {
  spreadsheetId: string
  worksheets: Worksheet[]
  activeWorksheet: Worksheet | null
  onSelectWorksheet: (worksheet: Worksheet) => void
  onAddWorksheet: (name: string) => Promise<Worksheet>
  onRenameWorksheet: (worksheetId: string, newName: string) => Promise<void>
  onDeleteWorksheet: (worksheetId: string) => Promise<void>
}

const SheetTabs = ({
  spreadsheetId,
  worksheets,
  activeWorksheet,
  onSelectWorksheet,
  onAddWorksheet,
  onRenameWorksheet,
  onDeleteWorksheet,
}: SheetTabsProps) => {
  const [isRenaming, setIsRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [showContextMenu, setShowContextMenu] = useState<{ worksheetId: string; x: number; y: number } | null>(null)

  const handleAddSheet = async () => {
    const sheetNumber = worksheets.length + 1
    const defaultName = `Sheet${sheetNumber}`
    
    try {
      await onAddWorksheet(defaultName)
      // onAddWorksheet already handles the toast and selection
    } catch (error) {
      toast.error('Failed to create sheet')
      console.error(error)
    }
  }

  const handleRename = useCallback(
    async (worksheetId: string) => {
      if (!newName.trim()) {
        setIsRenaming(null)
        return
      }

      try {
        await onRenameWorksheet(worksheetId, newName.trim())
        setIsRenaming(null)
        setNewName('')
        toast.success('Sheet renamed successfully')
      } catch (error: any) {
        if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
          toast.error('Sheet name already exists')
        } else {
          toast.error('Failed to rename sheet')
        }
        console.error(error)
      }
    },
    [newName, onRenameWorksheet]
  )

  const handleDelete = useCallback(
    async (worksheetId: string) => {
      if (worksheets.length <= 1) {
        toast.error('Cannot delete the last sheet')
        return
      }

      if (!confirm('Are you sure you want to delete this sheet?')) {
        return
      }

      try {
        await onDeleteWorksheet(worksheetId)
        setShowContextMenu(null)
        toast.success('Sheet deleted successfully')
      } catch (error) {
        toast.error('Failed to delete sheet')
        console.error(error)
      }
    },
    [worksheets.length, onDeleteWorksheet]
  )

  const handleRightClick = (e: React.MouseEvent<HTMLDivElement>, worksheetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setShowContextMenu({
      worksheetId,
      x: e.clientX,
      y: e.clientY,
    })
  }

  return (
    <div className="flex items-center gap-1 bg-white border-b border-gray-300 px-2 py-1 overflow-x-auto">
      {/* Sheet Tabs */}
      <div className="flex items-center gap-1 flex-1">
        {worksheets.map((worksheet) => (
          <div key={worksheet.id} className="flex items-center">
            {isRenaming === worksheet.id ? (
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename(worksheet.id)
                  } else if (e.key === 'Escape') {
                    setIsRenaming(null)
                    setNewName('')
                  }
                }}
                onBlur={() => handleRename(worksheet.id)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[80px]"
                placeholder="Sheet name"
              />
            ) : (
              <button
                onClick={() => onSelectWorksheet(worksheet)}
                onContextMenu={(e) => handleRightClick(e, worksheet.id)}
                onDoubleClick={() => {
                  setIsRenaming(worksheet.id)
                  setNewName(worksheet.name)
                }}
                className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-t border-b-2 transition-colors ${
                  activeWorksheet?.id === worksheet.id
                    ? 'bg-white border-b-blue-500 text-gray-900'
                    : 'bg-gray-50 border-b-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {worksheet.name}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Sheet Button */}
      <button
        onClick={handleAddSheet}
        className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-t border-b-2 border-b-transparent text-sm font-medium ml-2"
        title="Add new sheet"
      >
        +
      </button>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0"
            onClick={() => setShowContextMenu(null)}
            style={{ zIndex: 40 }}
          />
          <div
            className="fixed bg-white border border-gray-300 rounded shadow-lg z-50"
            style={{
              top: `${showContextMenu.y}px`,
              left: `${showContextMenu.x}px`,
            }}
          >
            <button
              onClick={() => {
                setIsRenaming(showContextMenu.worksheetId)
                const ws = worksheets.find((w) => w.id === showContextMenu.worksheetId)
                setNewName(ws?.name || '')
                setShowContextMenu(null)
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-200"
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(showContextMenu.worksheetId)}
              className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default SheetTabs
