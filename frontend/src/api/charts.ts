import api from './axios'

export interface Chart {
  id: string
  spreadsheet: string
  spreadsheet_name: string
  user: string
  user_username: string
  chart_type: 'bar' | 'line' | 'histogram' | 'scatter' | 'pie'
  title: string
  x_axis_column: number
  y_axis_columns: number[]
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
  }>
}

export interface CreateChartData {
  spreadsheet: string
  chart_type: 'bar' | 'line' | 'histogram' | 'scatter' | 'pie'
  title: string
  x_axis_column: number
  y_axis_columns: number[]
  config?: Record<string, any>
}

export const chartsAPI = {
  list: async (): Promise<Chart[]> => {
    const response = await api.get<any>('/charts/')
    // Handle paginated response
    if (response.data && Array.isArray(response.data)) {
      return response.data
    } else if (response.data && response.data.results) {
      return response.data.results
    }
    return []
  },

  get: async (id: string): Promise<Chart> => {
    const response = await api.get<Chart>(`/charts/${id}/`)
    return response.data
  },

  create: async (data: CreateChartData): Promise<Chart> => {
    const response = await api.post<Chart>('/charts/', data)
    return response.data
  },

  update: async (id: string, data: Partial<Chart>): Promise<Chart> => {
    const response = await api.patch<Chart>(`/charts/${id}/`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/charts/${id}/`)
  },

  getData: async (id: string): Promise<ChartData> => {
    const response = await api.get<ChartData>(`/charts/${id}/data/`)
    return response.data
  },
}

