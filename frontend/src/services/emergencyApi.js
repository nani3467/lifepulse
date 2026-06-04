import api from './api'

export const emergencyApi = {
  evaluate: (data) => api.post('/emergency/evaluate', data),
  getAlerts: (status) => api.get('/emergency/alerts', { params: { status } }),
  updateAlert: (id, data) => api.put(`/emergency/alerts/${id}`, data),
  getStats: () => api.get('/emergency/stats'),
}
