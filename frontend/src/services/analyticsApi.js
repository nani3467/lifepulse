import api from './api'

export const analyticsApi = {
  getAdvancedStats: (params) => api.get('/analytics/advanced', { params }),
  backfillData: () => api.post('/analytics/backfill'),
}
