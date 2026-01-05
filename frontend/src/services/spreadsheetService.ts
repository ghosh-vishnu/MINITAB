/**
 * Spreadsheet Service - Production-ready API integration
 * Handles all backend communication for spreadsheet operations
 */

import api from '../api/axios'

export interface SpreadsheetCell {
  row_index: number
  column_index: number
  value: string | number | null
  formula?: string | null
  data_type: 'text' | 'number' | 'date' | 'formula'
}

export interface SpreadsheetData {
  id?: string
  name: string
  description?: string
  row_count: number
  column_count: number
  cells: SpreadsheetCell[]
}

export interface ImportResponse {
  success: boolean
  message: string
  data?: SpreadsheetData
  errors?: string[]
}

export interface ExportOptions {
  format: 'xlsx' | 'csv'
  includeHeaders?: boolean
  sheetName?: string
}

class SpreadsheetService {
  private baseUrl = '/spreadsheets'

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(data: Partial<SpreadsheetData>): Promise<SpreadsheetData> {
    const response = await api.post<SpreadsheetData>(this.baseUrl, data)
    return response.data
  }

  /**
   * Get spreadsheet by ID
   */
  async getSpreadsheet(id: string): Promise<SpreadsheetData> {
    const response = await api.get<SpreadsheetData>(`${this.baseUrl}/${id}/`)
    return response.data
  }

  /**
   * Update spreadsheet metadata
   */
  async updateSpreadsheet(
    id: string,
    data: Partial<SpreadsheetData>
  ): Promise<SpreadsheetData> {
    const response = await api.patch<SpreadsheetData>(`${this.baseUrl}/${id}/`, data)
    return response.data
  }

  /**
   * Delete spreadsheet
   */
  async deleteSpreadsheet(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}/`)
  }

  /**
   * Get all cells for a spreadsheet
   */
  async getCells(spreadsheetId: string): Promise<SpreadsheetCell[]> {
    const response = await api.get<SpreadsheetCell[]>(
      `${this.baseUrl}/${spreadsheetId}/cells/`
    )
    return response.data
  }

  /**
   * Update a single cell
   */
  async updateCell(
    spreadsheetId: string,
    cell: SpreadsheetCell
  ): Promise<SpreadsheetCell> {
    const response = await api.post<SpreadsheetCell>(
      `${this.baseUrl}/${spreadsheetId}/update_cell/`,
      {
        row_index: cell.row_index,
        column_index: cell.column_index,
        value: cell.value,
        formula: cell.formula,
        data_type: cell.data_type,
      }
    )
    return response.data
  }

  /**
   * Bulk update cells (for auto-save)
   */
  async bulkUpdateCells(
    spreadsheetId: string,
    cells: SpreadsheetCell[]
  ): Promise<void> {
    await api.post(`${this.baseUrl}/${spreadsheetId}/update_cells/`, { cells })
  }

  /**
   * Import Excel/CSV file
   */
  async importFile(
    spreadsheetId: string,
    file: File,
    fileType: 'excel' | 'csv'
  ): Promise<ImportResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const endpoint =
      fileType === 'excel'
        ? `${this.baseUrl}/${spreadsheetId}/import_excel/`
        : `${this.baseUrl}/${spreadsheetId}/import_csv/`

    const response = await api.post<ImportResponse>(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  }

  /**
   * Export spreadsheet to Excel/CSV
   */
  async exportSpreadsheet(
    spreadsheetId: string,
    options: ExportOptions
  ): Promise<Blob> {
    const endpoint =
      options.format === 'xlsx'
        ? `${this.baseUrl}/${spreadsheetId}/export_excel/`
        : `${this.baseUrl}/${spreadsheetId}/export_csv/`

    const response = await api.get(endpoint, {
      responseType: 'blob',
      params: {
        include_headers: options.includeHeaders ?? true,
        sheet_name: options.sheetName,
      },
    })

    return response.data
  }

  /**
   * Auto-save cells (debounced)
   */
  private saveTimeout: NodeJS.Timeout | null = null

  async autoSave(
    spreadsheetId: string,
    cells: SpreadsheetCell[],
    delay: number = 1000
  ): Promise<void> {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    // Set new timeout
    this.saveTimeout = setTimeout(async () => {
      try {
        await this.bulkUpdateCells(spreadsheetId, cells)
      } catch (error) {
        console.error('Auto-save failed:', error)
        throw error
      }
    }, delay)
  }

  /**
   * Cancel pending auto-save
   */
  cancelAutoSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
  }
}

export default new SpreadsheetService()



