import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/utils/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import Login from '@/pages/Login'
import AdminDashboard from '@/pages/admin/Dashboard'
import PatientsPage from '@/pages/patients/PatientsPage'
import PatientDetailPage from '@/pages/patients/PatientDetailPage'
import PatientAnalytics from '@/pages/patients/PatientAnalytics'
import AppointmentsPage from '@/pages/appointments/AppointmentsPage'
import QueuePage from '@/pages/appointments/QueuePage'
import AppointmentAnalytics from '@/pages/appointments/AppointmentAnalytics'
import PredictionDashboard from '@/pages/predictions/PredictionDashboard'
import EmergencyDashboard from '@/pages/emergency/EmergencyDashboard'
import AdvancedAnalytics from '@/pages/analytics/AdvancedAnalytics'
import BloodBankDashboard from '@/pages/clinical/BloodBankDashboard'
import PharmacyDashboard from '@/pages/clinical/PharmacyDashboard'
import AdmissionsPage from '@/pages/clinical/AdmissionsPage'
import MedicalRecordsPage from '@/pages/clinical/MedicalRecordsPage'
import LabResultsPage from '@/pages/clinical/LabResultsPage'
import ReportsPage from '@/pages/clinical/ReportsPage'

// Doctor Portal Imports
import DoctorDashboard from '@/pages/doctor/DoctorDashboard'

// Patient Portal Imports
import PatientDashboard from '@/pages/patient/PatientDashboard'
import PatientSymptomChecker from '@/pages/patient/PatientSymptomChecker'
import PatientAppointments from '@/pages/patient/PatientAppointments'
import PatientVideoConsult from '@/pages/patient/PatientVideoConsult'
import PatientPharmacy from '@/pages/patient/PatientPharmacy'
import PatientBloodBank from '@/pages/patient/PatientBloodBank'
import PatientPrescriptions from '@/pages/patient/PatientPrescriptions'
import PatientHealthTracker from '@/pages/patient/PatientHealthTracker'
import DoctorRegister from '@/pages/DoctorRegister'




function PlaceholderPage({ title }) {
  return (
    <div className="glass-card p-12 text-center">
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 text-sm">This module is coming soon.</p>
    </div>
  )
}

function DashboardRedirect() {
  const { user } = useAuth()
  if (user?.role === 'patient') {
    return <PatientDashboard />
  }
  if (user?.role === 'doctor') {
    return <DoctorDashboard initialTab="home" />
  }
  return <AdminDashboard />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
              error: { iconTheme: { primary: '#f43f5e', secondary: '#1e293b' } },
            }}
          />

          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/doctor-register" element={<DoctorRegister />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/unauthorized" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="glass-card p-12 text-center max-w-md">
                  <div className="text-6xl mb-4">🔒</div>
                  <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                  <p className="text-slate-400">You don't have permission to view this page.</p>
                </div>
              </div>
            } />

            {/* Protected layout */}
            <Route element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<DashboardRedirect />} />

              {/* Patients module */}
              <Route path="/patients" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <PatientsPage />
                </ProtectedRoute>
              } />
              <Route path="/patients/:id" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <PatientDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute roles={['admin', 'doctor']}>
                  <PatientAnalytics />
                </ProtectedRoute>
              } />
              <Route path="/analytics/advanced" element={
                <ProtectedRoute roles={['admin']}>
                  <AdvancedAnalytics />
                </ProtectedRoute>
              } />

              {/* Admissions module */}
              <Route path="/admissions" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <AdmissionsPage />
                </ProtectedRoute>
              } />
              {/* Appointments module */}
              <Route path="/appointments" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <AppointmentsPage />
                </ProtectedRoute>
              } />
              <Route path="/appointments/queue" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <QueuePage />
                </ProtectedRoute>
              } />
              <Route path="/appointments/analytics" element={
                <ProtectedRoute roles={['admin', 'doctor']}>
                  <AppointmentAnalytics />
                </ProtectedRoute>
              } />
              <Route path="/medical-records" element={
                <ProtectedRoute roles={['admin', 'doctor']}>
                  <MedicalRecordsPage />
                </ProtectedRoute>
              } />
              <Route path="/lab-results" element={
                <ProtectedRoute roles={['admin', 'doctor']}>
                  <LabResultsPage />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <ReportsPage />
                </ProtectedRoute>
              } />
              <Route path="/predictions" element={
                <ProtectedRoute roles={['admin', 'doctor']}>
                  <PredictionDashboard />
                </ProtectedRoute>
              } />
              <Route path="/emergency" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <EmergencyDashboard />
                </ProtectedRoute>
              } />
              <Route path="/bloodbank" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <BloodBankDashboard />
                </ProtectedRoute>
              } />
              <Route path="/pharmacy" element={
                <ProtectedRoute roles={['admin', 'doctor', 'receptionist']}>
                  <PharmacyDashboard />
                </ProtectedRoute>
              } />
              <Route path="/staff" element={<PlaceholderPage title="Staff Management" />} />
              <Route path="/roles" element={<PlaceholderPage title="Roles & Access" />} />
              <Route path="/settings" element={<PlaceholderPage title="Settings" />} />

              {/* Patient portal sub-routes */}
              <Route path="/patient/symptoms" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientSymptomChecker />
                </ProtectedRoute>
              } />
              <Route path="/patient/appointments" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientAppointments />
                </ProtectedRoute>
              } />
              <Route path="/patient/video" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientVideoConsult />
                </ProtectedRoute>
              } />
              <Route path="/patient/pharmacy" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientPharmacy />
                </ProtectedRoute>
              } />
              <Route path="/patient/bloodbank" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientBloodBank />
                </ProtectedRoute>
              } />
              <Route path="/patient/prescriptions" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientPrescriptions />
                </ProtectedRoute>
              } />
              <Route path="/patient/health-tracker" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientHealthTracker />
                </ProtectedRoute>
              } />
              <Route path="/patient/track-health" element={
                <ProtectedRoute roles={['patient']}>
                  <PatientHealthTracker />
                </ProtectedRoute>
              } />

              {/* Doctor portal sub-routes */}
              <Route path="/doctor/dashboard" element={
                <ProtectedRoute roles={['doctor']}>
                  <DoctorDashboard initialTab="home" />
                </ProtectedRoute>
              } />
              <Route path="/doctor/appointments" element={
                <ProtectedRoute roles={['doctor']}>
                  <DoctorDashboard initialTab="appointments" />
                </ProtectedRoute>
              } />
              <Route path="/doctor/video" element={
                <ProtectedRoute roles={['doctor']}>
                  <DoctorDashboard initialTab="video" />
                </ProtectedRoute>
              } />
              <Route path="/doctor/prescriptions" element={
                <ProtectedRoute roles={['doctor']}>
                  <DoctorDashboard initialTab="prescriptions" />
                </ProtectedRoute>
              } />
              <Route path="/doctor/patients" element={
                <ProtectedRoute roles={['doctor']}>
                  <DoctorDashboard initialTab="history" />
                </ProtectedRoute>
              } />
              <Route path="/doctor/ai" element={
                <ProtectedRoute roles={['doctor']}>
                  <DoctorDashboard initialTab="ai" />
                </ProtectedRoute>
              } />

              {/* Admin workstation sub-routes */}
              <Route path="/admin/dashboard" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="dashboard" />
                </ProtectedRoute>
              } />
              <Route path="/admin/doctor-requests" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="doctor-requests" />
                </ProtectedRoute>
              } />
              <Route path="/admin/doctors" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="doctors" />
                </ProtectedRoute>
              } />
              <Route path="/admin/patients" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="patients" />
                </ProtectedRoute>
              } />
              <Route path="/admin/hospitals" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="hospitals" />
                </ProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="analytics" />
                </ProtectedRoute>
              } />
              <Route path="/admin/bloodbank/inventory" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="bb-inventory" />
                </ProtectedRoute>
              } />
              <Route path="/admin/bloodbank/donors" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="bb-donors" />
                </ProtectedRoute>
              } />
              <Route path="/admin/bloodbank/requests" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="bb-requests" />
                </ProtectedRoute>
              } />
              <Route path="/admin/bloodbank/alerts" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard initialTab="bb-alerts" />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
