import api from './axios'

export interface Cell {
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
  cells?: Cell[]
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

export const spreadsheetsAPI = {
  list: async (): Promise<Spreadsheet[]> => {
    const response = await api.get<any>('/spreadsheets/')
    // Handle paginated response
    if (response.data && Array.isArray(response.data)) {
      return response.data
    } else if (response.data && response.data.results) {
      return response.data.results
    }
    return []
  },

  get: async (id: string): Promise<Spreadsheet> => {
    const response = await api.get<Spreadsheet>(`/spreadsheets/${id}/`)
    return response.data
  },

  create: async (data: CreateSpreadsheetData): Promise<Spreadsheet> => {
    const response = await api.post<Spreadsheet>('/spreadsheets/', data)
    return response.data
  },

  update: async (id: string, data: Partial<Spreadsheet>): Promise<Spreadsheet> => {
    const response = await api.patch<Spreadsheet>(`/spreadsheets/${id}/`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/spreadsheets/${id}/`)
  },

  getCells: async (id: string): Promise<Cell[]> => {
    const response = await api.get<Cell[]>(`/spreadsheets/${id}/cells/`)
    return response.data
  },

  updateCell: async (
    id: string,
    rowIndex: number,
    columnIndex: number,
    value: string | number | null,
    formula?: string,
    dataType?: Cell['data_type']
  ): Promise<Cell> => {
    const response = await api.post<Cell>(`/spreadsheets/${id}/update_cell/`, {
      row_index: rowIndex,
      column_index: columnIndex,
      value,
      formula,
      data_type: dataType || 'text',
    })
    return response.data
  },

  deleteCell: async (id: string, rowIndex: number, columnIndex: number): Promise<void> => {
    await api.delete(`/spreadsheets/${id}/delete_cell/`, {
      data: {
        row_index: rowIndex,
        column_index: columnIndex,
      },
    })
  },

  bulkUpdateCells: async (id: string, cells: Cell[]): Promise<void> => {
    await api.post(`/spreadsheets/${id}/update_cells/`, { cells })
  },

  importCSV: async (id: string, file: File): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/spreadsheets/${id}/import_csv/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  importExcel: async (id: string, file: File, sheetName?: string): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    if (sheetName) {
      formData.append('sheet_name', sheetName)
    }
    const response = await api.post(`/spreadsheets/${id}/import_excel/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  exportCSV: async (id: string, filename: string): Promise<Blob> => {
    const response = await api.get(`/spreadsheets/${id}/export_csv/`, {
      responseType: 'blob',
    })
    return response.data
  },

  exportExcel: async (id: string, filename: string): Promise<Blob> => {
    const response = await api.get(`/spreadsheets/${id}/export_excel/`, {
      responseType: 'blob',
    })
    return response.data
  },
}

