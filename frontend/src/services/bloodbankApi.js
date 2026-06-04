import api from './api'

export const bloodbankApi = {
  getInventory: () => api.get('/bloodbank/inventory'),
  registerDonor: (data) => api.post('/bloodbank/donors', data),
  submitRequest: (data) => api.post('/bloodbank/requests', data),
  getAnalytics: () => api.get('/bloodbank/analytics'),
  seed: () => api.post('/bloodbank/seed'),
  getRequests: () => api.get('/bloodbank/requests'),
  updateRequestStatus: (id, status) => api.put(`/bloodbank/requests/${id}`, { status }),
  getDonors: () => api.get('/bloodbank/donors'),
  updateInventory: (bloodGroup, units) => api.post('/bloodbank/inventory', { blood_group: bloodGroup, units }),
}
