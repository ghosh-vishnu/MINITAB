/**
 * TypeScript Types for Spreadsheet Components
 * Production-ready type definitions
 */

export interface SpreadsheetCell {
  id?: string
  row_index: number
  column_index: number
  value: string | number | null
  formula?: string | null
  data_type: 'text' | 'number' | 'date' | 'formula'
  style?: Record<string, any>
}

export interface Spreadsheet {
  id: string
  name: string
  description?: string
  row_count: number
  column_count: number
  is_public: boolean
  user: string
  cells?: SpreadsheetCell[]
  created_at: string
  updated_at: string
}

export interface CreateSpreadsheetData {
  name: string
  description?: string
  row_count?: number
  column_count?: number
  is_public?: boolean
}

export interface ExcelImportOptions {
  sheetName?: string
  startRow?: number
  startCol?: number
  headerRow?: number
}

export interface ExcelExportOptions {
  format: 'xlsx' | 'csv'
  filename?: string
  sheetName?: string
  includeHeaders?: boolean
}



