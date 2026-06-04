import api from './api'

export const patientApi = {
  // Patients
  list: (params) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),

  // Medical History
  getHistory: (id) => api.get(`/patients/${id}/history`),
  addHistory: (id, data) => api.post(`/patients/${id}/history`, data),
  updateHistory: (recordId, data) => api.put(`/patients/history/${recordId}`, data),
  deleteHistory: (recordId) => api.delete(`/patients/history/${recordId}`),

  // Admissions
  getAdmissions: (id) => api.get(`/patients/${id}/admissions`),
  admit: (id, data) => api.post(`/patients/${id}/admit`, data),
  discharge: (admissionId, data) => api.post(`/patients/admissions/${admissionId}/discharge`, data),
  listAllAdmissions: (params) => api.get('/patients/admissions', { params }),

  // Diseases
  getDiseases: (id) => api.get(`/patients/${id}/diseases`),
  addDisease: (id, data) => api.post(`/patients/${id}/diseases`, data),
  updateDisease: (recordId, data) => api.put(`/patients/diseases/${recordId}`, data),
  deleteDisease: (recordId) => api.delete(`/patients/diseases/${recordId}`),

  // Analytics
  analytics: () => api.get('/patients/analytics/overview'),

  // Reports & Lab Results
  listAllReports: (params) => api.get('/uploads/reports', { params }),
  uploadReport: (patientId, formData) =>
    api.post(`/uploads/patients/${patientId}/reports`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteReport: (reportId) => api.delete(`/uploads/${reportId}`),

  // Vitals Logs
  addVitalsLog: (patientId, data) => api.post(`/patients/${patientId}/vitals`, data),
  getVitalsLogs: (patientId) => api.get(`/patients/${patientId}/vitals`),

  // Health Scans
  addHealthScan: (patientId, data) => api.post(`/patients/${patientId}/health-scans`, data),
  getHealthScans: (patientId) => api.get(`/patients/${patientId}/health-scans`),
  listAllMedicalRecords: (params) => api.get('/patients/medical-records', { params }),
}

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const adminApi = {
  stats: () => api.get('/admin/dashboard/stats'),
  users: () => api.get('/admin/users'),
  
  // Doctors
  listDoctors: () => api.get('/admin/doctors'),
  createDoctor: (data) => api.post('/admin/doctors', data),
  updateDoctor: (id, data) => api.put(`/admin/doctors/${id}`, data),
  deleteDoctor: (id) => api.delete(`/admin/doctors/${id}`),

  // Patients
  listPatients: () => api.get('/admin/patients'),
  togglePatientStatus: (id, isActive) => api.put(`/admin/patients/${id}/status`, { is_active: isActive }),

  // Hospitals
  listHospitals: () => api.get('/admin/hospitals'),
  createHospital: (data) => api.post('/admin/hospitals', data),
  updateHospital: (id, data) => api.put(`/admin/hospitals/${id}`, data),
  deleteHospital: (id) => api.delete(`/admin/hospitals/${id}`),

  // Doctor Requests
  listDoctorRequests: () => api.get('/admin/doctor-requests'),
  approveDoctorRequest: (id) => api.post(`/admin/doctor-requests/${id}/approve`),
  rejectDoctorRequest: (id, reason) => api.post(`/admin/doctor-requests/${id}/reject`, { reason }),
}
