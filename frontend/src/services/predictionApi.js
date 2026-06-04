import api from './api'

export const predictionApi = {
  predict: (data) => api.post('/predictions/predict', data),
  train: () => api.post('/predictions/train'),
  getMetrics: () => api.get('/predictions/metrics'),
  getHistory: (patientId) => api.get('/predictions/history', { params: { patient_id: patientId } }),
  getStats: () => api.get('/predictions/stats'),
}
