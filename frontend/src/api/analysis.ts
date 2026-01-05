import api from './axios'

export interface Analysis {
  id: string
  spreadsheet: string
  spreadsheet_name: string
  user: string
  user_username: string
  analysis_type: 'summary_stats' | 'correlation' | 'regression' | 'custom'
  selected_columns: number[]
  parameters: Record<string, any>
  results: Record<string, any>
  created_at: string
}

export interface PerformAnalysisData {
  spreadsheet_id: string
  analysis_type: 'summary_stats' | 'correlation' | 'regression' | 'custom'
  selected_columns: number[]
  parameters?: Record<string, any>
}

export const analysisAPI = {
  list: async (): Promise<Analysis[]> => {
    const response = await api.get<Analysis[]>('/analysis/')
    return response.data
  },

  get: async (id: string): Promise<Analysis> => {
    const response = await api.get<Analysis>(`/analysis/${id}/`)
    return response.data
  },

  performAnalysis: async (data: PerformAnalysisData): Promise<{ analysis: Analysis; results: any }> => {
    const response = await api.post('/analysis/perform_analysis/', data)
    return response.data
  },

  getResults: async (id: string): Promise<any> => {
    const response = await api.get(`/analysis/${id}/results/`)
    return response.data
  },
}



