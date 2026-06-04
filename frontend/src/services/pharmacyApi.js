import api from './api'

export const pharmacyApi = {
  getInventory: () => api.get('/pharmacy/inventory'),
  submitPrescription: (data) => api.post('/pharmacy/prescriptions', data),
  getPrescriptions: (status) => api.get('/pharmacy/prescriptions', { params: { status } }),
  verifyPrescription: (id, action, notes) => api.post(`/pharmacy/prescriptions/${id}/verify`, { action, notes }),
  getAnalytics: () => api.get('/pharmacy/analytics'),
  seed: () => api.post('/pharmacy/seed'),
  placeOrder: (data) => api.post('/pharmacy/orders', data),
  getOrders: () => api.get('/pharmacy/orders'),
}
