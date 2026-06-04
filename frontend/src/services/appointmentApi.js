import api from './api'

export const appointmentApi = {
  // Departments
  getDepartments: () => api.get('/appointments/departments'),
  createDepartment: (data) => api.post('/appointments/departments', data),
  updateDepartment: (id, data) => api.put(`/appointments/departments/${id}`, data),

  // Doctors
  getDoctors: (params) => api.get('/appointments/doctors', { params }),

  // Time Slots
  getSlots: (params) => api.get('/appointments/slots', { params }),
  generateSlots: (data) => api.post('/appointments/slots/generate', data),

  // Appointments
  list: (params) => api.get('/appointments', { params }),
  calendar: (params) => api.get('/appointments/calendar', { params }),
  get: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id) => api.delete(`/appointments/${id}`),

  // Actions
  approve: (id) => api.post(`/appointments/${id}/approve`),
  reject: (id, data) => api.post(`/appointments/${id}/reject`, data),
  cancel: (id, data) => api.post(`/appointments/${id}/cancel`, data),
  complete: (id) => api.post(`/appointments/${id}/complete`),
  checkin: (id) => api.post(`/appointments/${id}/checkin`),
  reschedule: (id, data) => api.post(`/appointments/${id}/reschedule`, data),

  // Queue
  getQueue: (params) => api.get('/appointments/queue', { params }),
  callPatient: (entryId) => api.post(`/appointments/queue/${entryId}/call`),
  skipPatient: (entryId) => api.post(`/appointments/queue/${entryId}/skip`),

  // Notifications
  getNotifications: (params) => api.get('/appointments/notifications', { params }),
  markAllRead: () => api.post('/appointments/notifications/read-all'),
  markRead: (id) => api.post(`/appointments/notifications/${id}/read`),

  // Analytics
  analytics: () => api.get('/appointments/analytics'),
}
