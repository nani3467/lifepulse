import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCog, CalendarDays, FlaskConical,
  FileText, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  Activity, Stethoscope, Bed, ClipboardList, ShieldCheck,
  ListOrdered, BarChart2, Brain, ShieldAlert, Droplet, Sparkles
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'doctor', 'receptionist', 'patient'] },
    ]
  },
  {
    label: 'Patient Portal',
    items: [
      { path: '/patient/symptoms', icon: Brain, label: 'AI Symptom Checker', roles: ['patient'] },
      { path: '/patient/appointments', icon: CalendarDays, label: 'Book Appointment', roles: ['patient'] },
      { path: '/patient/video', icon: Activity, label: 'Video Consult', roles: ['patient'] },
      { path: '/patient/pharmacy', icon: Sparkles, label: 'Pharmacy Store', roles: ['patient'] },
      { path: '/patient/bloodbank', icon: Droplet, label: 'Blood Bank', roles: ['patient'] },
      { path: '/patient/prescriptions', icon: ClipboardList, label: 'Prescriptions', roles: ['patient'] },
      { path: '/patient/health-tracker', icon: Activity, label: 'Track Your Health', roles: ['patient'] },
    ]
  },
  {
    label: 'Doctor Portal',
    items: [
      { path: '/doctor/dashboard', icon: LayoutDashboard, label: 'Workspace Home', roles: ['doctor'] },
      { path: '/doctor/appointments', icon: CalendarDays, label: 'Consult Queue', roles: ['doctor'] },
      { path: '/doctor/video', icon: Activity, label: 'Video Consult Room', roles: ['doctor'] },
      { path: '/doctor/prescriptions', icon: FileText, label: 'Prescription Editor', roles: ['doctor'] },
      { path: '/doctor/patients', icon: Users, label: 'Patient EMR Logs', roles: ['doctor'] },
      { path: '/doctor/ai', icon: Brain, label: 'Clinical AI Assistant', roles: ['doctor'] },
    ]
  },
  {
    label: 'Patient Care',
    items: [
      { path: '/patients', icon: Users, label: 'Patients', roles: ['admin', 'doctor', 'receptionist'] },
      { path: '/admissions', icon: Bed, label: 'Admissions', roles: ['admin', 'doctor', 'receptionist'] },
      { path: '/appointments', icon: CalendarDays, label: 'Appointments', roles: ['admin', 'doctor', 'receptionist'], end: true },
      { path: '/appointments/queue', icon: ListOrdered, label: 'Queue', roles: ['admin', 'doctor', 'receptionist'] },
      { path: '/emergency', icon: ShieldAlert, label: 'Emergency Triage', roles: ['admin', 'doctor', 'receptionist'] },
    ]
  },
  {
    label: 'Clinical',
    items: [
      { path: '/medical-records', icon: ClipboardList, label: 'Medical Records', roles: ['admin', 'doctor'] },
      { path: '/lab-results', icon: FlaskConical, label: 'Lab Results', roles: ['admin', 'doctor'] },
      { path: '/reports', icon: FileText, label: 'Reports', roles: ['admin', 'doctor', 'receptionist'] },
      { path: '/bloodbank', icon: Droplet, label: 'Blood Bank', roles: ['admin', 'doctor', 'receptionist'] },
      { path: '/pharmacy', icon: Sparkles, label: 'Pharmacy Management', roles: ['admin', 'doctor', 'receptionist'] },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { path: '/analytics', icon: BarChart3, label: 'Patient Analytics', roles: ['admin'] },
      { path: '/analytics/advanced', icon: BarChart3, label: 'Executive Analytics', roles: ['admin'] },
      { path: '/appointments/analytics', icon: BarChart2, label: 'Appt. Analytics', roles: ['admin', 'doctor'] },
      { path: '/predictions', icon: Brain, label: 'AI Predictions', roles: ['admin', 'doctor'] },
      { path: '/disease-tracker', icon: Activity, label: 'Disease Tracker', roles: ['admin', 'doctor'] },
    ]
  },
  {
    label: 'Admin Panel',
    items: [
      { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin'] },
      { path: '/admin/doctor-requests', icon: UserCog, label: 'Doctor Requests', roles: ['admin'] },
      { path: '/admin/doctors', icon: Users, label: 'Doctors', roles: ['admin'] },
      { path: '/admin/patients', icon: Users, label: 'Patients', roles: ['admin'] },
      { path: '/admin/hospitals', icon: Bed, label: 'Hospitals', roles: ['admin'] },
      { path: '/admin/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin'] },
    ]
  },
  {
    label: 'Blood Bank Admin',
    items: [
      { path: '/admin/bloodbank/inventory', icon: Droplet, label: 'Inventory', roles: ['admin'] },
      { path: '/admin/bloodbank/donors', icon: Users, label: 'Donors', roles: ['admin'] },
      { path: '/admin/bloodbank/requests', icon: FileText, label: 'Requests', roles: ['admin'] },
      { path: '/admin/bloodbank/alerts', icon: ShieldAlert, label: 'Emergency Alerts', roles: ['admin'] },
    ]
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="flex items-center px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' }}>
            <Stethoscope size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-white text-base leading-none">LifePulse</div>
              <div className="text-xs text-blue-400 mt-0.5">HMS v1.0</div>
            </div>
          )}
        </div>
        <button
          id="sidebar-toggle"
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* User Badge */}
      {!collapsed && (
        <div className="mx-3 mt-4 mb-2 p-3 rounded-xl bg-white/5 border border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1">
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(user?.role)
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label} className="mb-1">
              {!collapsed && (
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-widest">
                  {section.label}
                </div>
              )}
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/5">
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="sidebar-link w-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
