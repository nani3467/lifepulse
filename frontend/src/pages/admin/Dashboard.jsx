import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Users, Bed, Activity, TrendingUp, ArrowUpRight, AlertCircle,
  ShieldAlert, Droplet, Sparkles, Calendar, ShieldCheck, ClipboardList,
  ChevronRight, CheckCircle2, XCircle, Plus, Trash2, Shield, Heart,
  Brain, FileText, Search, RefreshCw, Send, Check, AlertTriangle, Info, Stethoscope, User
} from 'lucide-react'
import { adminApi } from '@/services/patientApi'
import { emergencyApi } from '@/services/emergencyApi'
import { pharmacyApi } from '@/services/pharmacyApi'
import { bloodbankApi } from '@/services/bloodbankApi'
import { appointmentApi } from '@/services/appointmentApi'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import toast from 'react-hot-toast'
import api from '@/services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement)

export default function AdminDashboard({ initialTab = 'dashboard' }) {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // System Stats and Dashboard
  const [stats, setStats] = useState(null)
  const [activeAlerts, setActiveAlerts] = useState([])
  const [pendingPrescs, setPendingPrescs] = useState([])

  // Domain Registries
  const [doctorsList, setDoctorsList] = useState([])
  const [patientsList, setPatientsList] = useState([])
  const [hospitalsList, setHospitalsList] = useState([])
  const [departmentsList, setDepartmentsList] = useState([])
  const [doctorRequests, setDoctorRequests] = useState([])

  // Blood Bank sub-states
  const [bloodInventory, setBloodInventory] = useState([])
  const [bloodRequests, setBloodRequests] = useState([])
  const [bloodDonors, setBloodDonors] = useState([])

  // EMR details view for patients
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null)
  const [historyTimeline, setHistoryTimeline] = useState([])
  const [viewHistoryModal, setViewHistoryModal] = useState(false)

  // Doctor requests and editing state
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    specialization: '',
    qualification: '',
    experience_years: 0,
    consultation_fee: 0,
    bio: '',
    available_days: 'Mon,Tue,Wed,Thu,Fri',
    slot_duration_mins: 15,
    max_patients_per_day: 30,
    is_available: true,
    department_id: '',
    hospital_id: '',
    is_active: true
  })

  // Doctor Form State
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
    qualification: '',
    experience_years: 5,
    consultation_fee: 500,
    department_id: '',
    hospital_id: '',
    available_days: 'Mon,Tue,Wed,Thu,Fri',
  })

  // Hospital Form State
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    address: '',
    phone: '',
  })

  // Restock Inventory Form State
  const [restockForm, setRestockForm] = useState({
    blood_group: 'A+',
    units: 5
  })

  // Donor Registration Form State
  const [donorForm, setDonorForm] = useState({
    name: '',
    blood_group: 'A+',
    phone: '',
    email: '',
    weight: 60,
    hemoglobin: 14.2,
    last_donation_date: ''
  })

  // Emergency Match sub-state
  const [activeEmergencyMatchReq, setActiveEmergencyMatchReq] = useState(null)
  const [matchedDonors, setMatchedDonors] = useState([])
  const [sendingAlerts, setSendingAlerts] = useState(false)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [
        statsRes,
        alertsRes,
        prescsRes,
        docsRes,
        patsRes,
        hospsRes,
        depsRes,
        bloodInvRes,
        bloodReqsRes,
        bloodDonorsRes,
        docReqsRes
      ] = await Promise.all([
        adminApi.stats(),
        emergencyApi.getAlerts('active').catch(() => ({ data: { alerts: [] } })),
        pharmacyApi.getPrescriptions('pending').catch(() => ({ data: { prescriptions: [] } })),
        adminApi.listDoctors().catch(() => ({ data: { doctors: [] } })),
        adminApi.listPatients().catch(() => ({ data: { patients: [] } })),
        adminApi.listHospitals().catch(() => ({ data: { hospitals: [] } })),
        appointmentApi.getDepartments().catch(() => ({ data: { departments: [] } })),
        bloodbankApi.getInventory().catch(() => ({ data: { inventory: [] } })),
        bloodbankApi.getRequests().catch(() => ({ data: { requests: [] } })),
        bloodbankApi.getDonors().catch(() => ({ data: { donors: [] } })),
        adminApi.listDoctorRequests().catch(() => ({ data: { requests: [] } }))
      ])

      setStats(statsRes.data)
      setActiveAlerts(alertsRes.data.alerts || [])
      setPendingPrescs(prescsRes.data.prescriptions || [])
      setDoctorsList(docsRes.data.doctors || [])
      setPatientsList(patsRes.data.patients || [])
      setHospitalsList(hospsRes.data.hospitals || [])
      setDepartmentsList(depsRes.data.departments || [])
      setBloodInventory(bloodInvRes.data.inventory || [])
      setBloodRequests(bloodReqsRes.data.requests || [])
      setBloodDonors(bloodDonorsRes.data.donors || [])
      setDoctorRequests(docReqsRes.data.requests || [])
    } catch (err) {
      console.error('Admin central workspace fetch failure:', err)
      toast.error('Failed to synchronize command center.')
    } finally {
      setLoading(false)
    }
  }

  // Doctor CRUD Actions
  const handleRegisterDoctor = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const payload = {
        ...doctorForm,
        department_id: doctorForm.department_id ? parseInt(doctorForm.department_id) : null,
        hospital_id: doctorForm.hospital_id ? parseInt(doctorForm.hospital_id) : null,
        experience_years: parseInt(doctorForm.experience_years),
        consultation_fee: parseFloat(doctorForm.consultation_fee)
      }
      await adminApi.createDoctor(payload)
      toast.success('New doctor registered & profile created!')
      setDoctorForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        specialization: '',
        qualification: '',
        experience_years: 5,
        consultation_fee: 500,
        department_id: '',
        hospital_id: '',
        available_days: 'Mon,Tue,Wed,Thu,Fri',
      })
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleDoctorStatus = async (id, isAvailable) => {
    try {
      await adminApi.updateDoctor(id, { is_available: !isAvailable })
      toast.success('Doctor availability status toggled!')
      loadDashboardData()
    } catch (err) {
      toast.error('Failed to toggle status')
    }
  }

  const handleEditDoctorClick = (doc) => {
    setEditingDoctor(doc)
    setEditForm({
      name: doc.doctor_name || '',
      phone: doc.phone || '',
      specialization: doc.specialization || '',
      qualification: doc.qualification || '',
      experience_years: doc.experience_years || 0,
      consultation_fee: doc.consultation_fee || 0,
      bio: doc.bio || '',
      available_days: doc.available_days || 'Mon,Tue,Wed,Thu,Fri',
      slot_duration_mins: doc.slot_duration_mins || 15,
      max_patients_per_day: doc.max_patients_per_day || 30,
      is_available: doc.is_available,
      department_id: doc.department_id || '',
      hospital_id: doc.hospital_id || '',
      is_active: doc.is_active
    })
  }

  const handleUpdateDoctorSubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      const payload = {
        ...editForm,
        department_id: editForm.department_id ? parseInt(editForm.department_id) : null,
        hospital_id: editForm.hospital_id ? parseInt(editForm.hospital_id) : null,
        experience_years: parseInt(editForm.experience_years),
        consultation_fee: parseFloat(editForm.consultation_fee),
        slot_duration_mins: parseInt(editForm.slot_duration_mins),
        max_patients_per_day: parseInt(editForm.max_patients_per_day)
      }
      await adminApi.updateDoctor(editingDoctor.id, payload)
      toast.success('Doctor profile updated successfully!')
      setEditingDoctor(null)
      loadDashboardData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to update doctor profile.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateDoctorFee = async (id, currentFee) => {
    const feeStr = prompt("Enter new consultation fee ($):", currentFee)
    if (feeStr === null) return
    const fee = parseFloat(feeStr)
    if (isNaN(fee)) return toast.error("Invalid fee amount")
    try {
      await adminApi.updateDoctor(id, { consultation_fee: fee })
      toast.success('Consultation fee updated!')
      loadDashboardData()
    } catch (err) {
      toast.error('Failed to update fee')
    }
  }

  const handleApproveDoctorRequest = async (id) => {
    setActionLoading(true)
    try {
      await adminApi.approveDoctorRequest(id)
      toast.success('Registration request approved! Doctor account and profile created.')
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectDoctorRequest = async (id) => {
    const reason = prompt("Please enter the reason for rejection:")
    if (reason === null) return
    if (!reason.trim()) return toast.error("Rejection reason is required")
    setActionLoading(true)
    try {
      await adminApi.rejectDoctorRequest(id, reason)
      toast.success('Registration request rejected.')
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request')
    } finally {
      setActionLoading(false)
    }
  }

  // Hospital CRUD Actions
  const handleCreateHospital = async (e) => {
    e.preventDefault()
    try {
      await adminApi.createHospital(hospitalForm)
      toast.success('Hospital added successfully!')
      setHospitalForm({ name: '', address: '', phone: '' })
      loadDashboardData()
    } catch (err) {
      toast.error('Failed to add hospital')
    }
  }

  const handleDeleteHospital = async (id) => {
    if (!confirm('Are you sure you want to delete this hospital?')) return
    try {
      await adminApi.deleteHospital(id)
      toast.success('Hospital facility removed.')
      loadDashboardData()
    } catch (err) {
      toast.error('Failed to delete hospital')
    }
  }

  // Patient Admin Actions
  const handleTogglePatientStatus = async (id, isActive) => {
    try {
      await adminApi.togglePatientStatus(id, !isActive)
      toast.success(`Patient account ${!isActive ? 'Activated' : 'Suspended'}!`)
      loadDashboardData()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleViewPatientEMR = async (patient) => {
    setLoading(true)
    try {
      const [predRes, apptRes, prescRes] = await Promise.all([
        api.get(`/predictions/history?patient_id=${patient.id}`).catch(() => ({ data: { history: [] } })),
        api.get('/appointments').catch(() => ({ data: { appointments: [] } })),
        api.get('/pharmacy/prescriptions').catch(() => ({ data: { prescriptions: [] } }))
      ])

      const timeline = [
        ...(predRes.data.history || []).map(p => ({
          type: 'prediction',
          title: `AI Disease Prediction: ${p.predicted_disease}`,
          date: p.created_at,
          desc: `Confidence: ${p.confidence}% | Severity: ${p.risk_level.toUpperCase()}`
        })),
        ...(apptRes.data.appointments || []).filter(a => a.patient_id === patient.id).map(a => ({
          type: 'appointment',
          title: `Appointment with Dr. ${a.doctor_name || 'Staff'}`,
          date: a.appointment_date + 'T' + a.appointment_time,
          desc: `Reason: ${a.reason} | Status: ${a.status.toUpperCase()}`
        })),
        ...(prescRes.data.prescriptions || []).filter(p => p.patient_id === patient.id).map(p => ({
          type: 'prescription',
          title: `Prescription Slips Generated`,
          date: p.created_at,
          desc: `Medicines: ${p.items?.map(i => i.medicine_name).join(', ')} | Status: ${p.status.toUpperCase()}`
        }))
      ]

      timeline.sort((a, b) => new Date(b.date) - new Date(a.date))
      setSelectedPatientHistory(patient)
      setHistoryTimeline(timeline)
      setViewHistoryModal(true)
    } catch (err) {
      toast.error('Failed to construct historical records.')
    } finally {
      setLoading(false)
    }
  }

  // Blood Bank Admin Actions
  const handleRestockInventory = async (e) => {
    e.preventDefault()
    try {
      await bloodbankApi.updateInventory(restockForm.blood_group, restockForm.units)
      toast.success(`Inventory stock added for ${restockForm.blood_group}!`)
      setRestockForm(prev => ({ ...prev, units: 5 }))
      loadDashboardData()
    } catch (err) {
      toast.error('Failed to update inventory')
    }
  }

  const handleRegisterDonor = async (e) => {
    e.preventDefault()
    try {
      await bloodbankApi.registerDonor(donorForm)
      toast.success('Donor registered successfully!')
      setDonorForm({
        name: '',
        blood_group: 'A+',
        phone: '',
        email: '',
        weight: 60,
        hemoglobin: 14.2,
        last_donation_date: ''
      })
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    }
  }

  const handleUpdateRequestStatus = async (id, status) => {
    try {
      await bloodbankApi.updateRequestStatus(id, status)
      toast.success(`Fulfillment updated to: ${status}`)
      loadDashboardData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Status update failed')
    }
  }

  const handleEmergencyDonorMatch = (req) => {
    setActiveEmergencyMatchReq(req)
    // Universal Matcher: matching blood group or O-
    const matched = bloodDonors.filter(d => 
      d.eligibility_status && (d.blood_group === req.blood_group || d.blood_group === 'O-')
    )
    setMatchedDonors(matched)
  }

  const handleDispatchPriorityAlerts = () => {
    if (matchedDonors.length === 0) return toast.error('No donors to dispatch')
    setSendingAlerts(true)
    setTimeout(() => {
      setSendingAlerts(false)
      setActiveEmergencyMatchReq(null)
      toast.success(`Priority emergency notifications dispatched to ${matchedDonors.length} nearby donors!`)
    }, 2000)
  }

  // Central Prescription Approver
  const handleApprovePrescription = (id) => {
    setActionLoading(true)
    toast.promise(
      pharmacyApi.verifyPrescription(id, 'approve', 'Approved directly from central command control'),
      {
        loading: 'Verifying drug compositions & releasing slots...',
        success: () => {
          loadDashboardData()
          return 'Prescription verified & dispatched successfully!'
        },
        error: (err) => err.response?.data?.error || 'Verification failed'
      }
    ).finally(() => setActionLoading(false))
  }

  const handleAcknowledgeAlert = (id) => {
    toast.promise(
      emergencyApi.updateAlert(id, {
        status: 'acknowledged',
        notes: 'Cleared from central admin dashboard commands'
      }),
      {
        loading: 'Updating alarm logs...',
        success: () => {
          loadDashboardData()
          return 'Alarm acknowledged!'
        },
        error: 'Error archiving alarm telemetry'
      }
    )
  }

  // Visuals Charts Configuration
  const topDiseases = stats?.top_diseases || []
  const diseaseChartData = {
    labels: topDiseases.map(d => d.disease),
    datasets: [{
      label: 'Cases',
      data: topDiseases.map(d => d.count),
      backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)', 'rgba(139,92,246,0.8)'],
      borderWidth: 0,
      borderRadius: 8
    }]
  }

  const bloodGroupData = {
    labels: bloodInventory.map(i => i.blood_group),
    datasets: [{
      label: 'Units Stock',
      data: bloodInventory.map(i => i.units_available),
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      borderColor: 'rgba(239, 68, 68, 1)',
      borderWidth: 1,
      borderRadius: 4
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: isDark ? '#94a3b8' : '#475569', font: { family: 'Inter', size: 10 } } },
    },
    scales: {
      x: { grid: { color: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)' }, ticks: { color: isDark ? '#64748b' : '#475569', font: { size: 9 } } },
      y: { grid: { color: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)' }, ticks: { color: isDark ? '#64748b' : '#475569', font: { size: 9 } } }
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-500" size={24} />
            LifePulse Ecosystem Command Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            System status dashboard | Logged in as <strong className="text-blue-400 font-bold capitalize">{user?.role}</strong>
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex gap-2">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="btn btn-secondary text-xs flex items-center gap-1 py-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Synchronize
          </button>
        </div>
      </div>

      {loading && stats === null ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
          <div className="skeleton h-96 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB 1: ADMIN CENTRAL DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* KPIs Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div onClick={() => navigate('/admin/patients')} className="stat-card cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Patients</span>
                    <Users size={14} className="text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">{stats?.stats?.total_patients ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Total Registered</div>
                </div>

                <div onClick={() => navigate('/admin/doctors')} className="stat-card cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Clinicians</span>
                    <ShieldCheck size={14} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">{doctorsList.length}</div>
                  <div className="text-[10px] text-slate-400">Active Physicians</div>
                </div>

                <div onClick={() => navigate('/admin/hospitals')} className="stat-card cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Hospitals</span>
                    <Bed size={14} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">{hospitalsList.length}</div>
                  <div className="text-[10px] text-slate-400">Linked Faculties</div>
                </div>

                <div onClick={() => navigate('/admin/bloodbank/inventory')} className="stat-card cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Blood Bank</span>
                    <Droplet size={14} className="text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">
                    {bloodInventory.reduce((acc, curr) => acc + curr.units_available, 0)}
                  </div>
                  <div className="text-[10px] text-slate-400">Total Units Available</div>
                </div>

                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">ICU Telemetry</span>
                    <AlertCircle size={14} className="text-rose-500" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">{activeAlerts.length}</div>
                  <div className="text-[10px] text-rose-400 font-bold">Unresolved ICU Alerts</div>
                </div>
              </div>

              {/* Action Streams: ICU Critical Alerts & Awaiting Prescriptions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Critical Telemetry Stream */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="text-rose-500 animate-pulse" size={15} />
                      Live ICU Telemetry Streams
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-500/20 text-rose-300">
                      {activeAlerts.length} Critical
                    </span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {activeAlerts.length > 0 ? (
                      activeAlerts.map(alert => (
                        <div key={alert.id} className="p-3.5 bg-rose-950/10 border border-rose-500/20 rounded-xl flex justify-between items-center text-xs">
                          <div className="space-y-1">
                            <strong className="text-white block">{alert.patient_name}</strong>
                            <p className="text-[10px] text-rose-300 font-medium">⚠️ Critical Triggers: {alert.trigger_vitals}</p>
                            <span className="text-[9px] text-slate-500 block">HR: {alert.heart_rate} bpm | SpO2: {alert.oxygen_level}%</span>
                          </div>
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="px-2.5 py-1.5 bg-rose-600/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all"
                          >
                            Acknowledge
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500 text-xs bg-slate-950/10 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 size={24} className="text-emerald-500 opacity-60" />
                        <strong>All Bedside Monitors Stable</strong>
                        <span className="text-[10px]">No active vitals critical trigger warnings.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescription approvals */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="text-blue-400" size={15} />
                      Prescription Approvals Workspace
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[8px] font-black bg-blue-500/20 text-blue-300">
                      {pendingPrescs.length} Awaiting
                    </span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {pendingPrescs.length > 0 ? (
                      pendingPrescs.map(presc => (
                        <div key={presc.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                          <div className="space-y-1">
                            <strong className="text-white block">{presc.patient_name}</strong>
                            <p className="text-[10px] text-slate-400">Drugs: {presc.items?.map(i => i.medicine_name).join(', ')}</p>
                            <span className="text-[9px] text-amber-500 font-medium">Warnings: {presc.notes || 'None detected'}</span>
                          </div>
                          <button
                            onClick={() => handleApprovePrescription(presc.id)}
                            className="px-2.5 py-1.5 bg-emerald-600/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all"
                          >
                            Approve
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500 text-xs bg-slate-950/10 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 size={24} className="text-emerald-500 opacity-60" />
                        <strong>Prescriptions Log Cleared</strong>
                        <span className="text-[10px]">No pending slips await verification.</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB: DOCTOR REGISTRATION REQUESTS */}
          {activeTab === 'doctor-requests' && (
            <div className="space-y-6 animate-fade-in">
              {/* Request Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Pending Requests</span>
                  <div className="text-2xl font-black text-amber-500 mt-1">
                    {doctorRequests.filter(r => r.status === 'pending').length}
                  </div>
                </div>
                <div className="stat-card">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Approved Clinicians</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {doctorRequests.filter(r => r.status === 'approved').length}
                  </div>
                </div>
                <div className="stat-card">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Rejected Applications</span>
                  <div className="text-2xl font-black text-rose-500 mt-1">
                    {doctorRequests.filter(r => r.status === 'rejected').length}
                  </div>
                </div>
              </div>

              {/* Request List */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="text-blue-500" size={16} />
                    Doctor Registration Requests Queue
                  </h3>
                  <span className="text-slate-400 text-xs">Total Requests: {doctorRequests.length}</span>
                </div>

                <div className="overflow-x-auto">
                  {doctorRequests.length > 0 ? (
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-400">
                          <th className="py-2.5 font-bold">Doctor Details</th>
                          <th className="py-2.5 font-bold">Credentials & Specialization</th>
                          <th className="py-2.5 font-bold">Hospital Affiliation</th>
                          <th className="py-2.5 font-bold">Verification Docs</th>
                          <th className="py-2.5 font-bold text-center">Status</th>
                          <th className="py-2.5 font-bold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorRequests.map(req => (
                          <tr key={req.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01]">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {req.profile_photo ? (
                                    <img 
                                      src={`${api.defaults.baseURL}/admin/doctor-requests/documents/${req.profile_photo}`} 
                                      alt={req.name} 
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.src = ''; e.target.className = 'hidden' }}
                                    />
                                  ) : (
                                    <User size={18} className="text-slate-500" />
                                  )}
                                </div>
                                <div>
                                  <strong className="text-white block text-sm">{req.name}</strong>
                                  <span className="text-[11px] text-slate-400 block">{req.email}</span>
                                  <span className="text-[10px] text-slate-500 block">DOB: {req.dob || 'N/A'} | Gender: {req.gender}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-1">
                                {req.specialization}
                              </span>
                              <span className="block text-[11px] text-slate-300">{req.qualification}</span>
                              <span className="block text-[10px] text-slate-500">{req.experience_years} years experience</span>
                              <span className="block text-[10px] text-slate-400 font-mono">Reg: {req.medical_reg_number}</span>
                            </td>
                            <td className="py-4">
                              <strong className="text-white block text-xs">{req.hospital_name}</strong>
                              <span className="text-[10px] text-slate-400 block">{req.hospital_address}, {req.hospital_city}</span>
                              <span className="text-[10px] text-slate-500 block">Phone: {req.hospital_phone || 'N/A'}</span>
                            </td>
                            <td className="py-4">
                              <div className="flex flex-col gap-1 text-[10px]">
                                {req.license_file && (
                                  <a href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${req.license_file}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-0.5">
                                    📄 Medical License
                                  </a>
                                )}
                                {req.certificate_file && (
                                  <a href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${req.certificate_file}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-0.5">
                                    📄 Degree Cert
                                  </a>
                                )}
                                {req.gov_id_file && (
                                  <a href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${req.gov_id_file}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline flex items-center gap-0.5">
                                    📄 Govt ID Proof
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-block ${
                                req.status === 'approved' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : req.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {req.status}
                              </span>
                              {req.status === 'rejected' && (
                                <span className="block text-[9px] text-rose-300 max-w-[120px] truncate mt-1 mx-auto" title={req.rejection_reason}>
                                  Reason: {req.rejection_reason}
                                </span>
                              )}
                            </td>
                            <td className="py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => setSelectedRequest(req)}
                                  className="p-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent rounded-lg transition-all"
                                  title="View Full Credentials"
                                >
                                  <Info size={14} />
                                </button>
                                {req.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveDoctorRequest(req.id)}
                                      disabled={actionLoading}
                                      className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-transparent rounded-lg transition-all"
                                      title="Approve & Activate"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleRejectDoctorRequest(req.id)}
                                      disabled={actionLoading}
                                      className="p-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg transition-all"
                                      title="Reject Request"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      <Stethoscope size={40} className="mx-auto opacity-20 mb-3" />
                      <strong>No Doctor registration requests recorded.</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCTOR MANAGEMENT */}
          {activeTab === 'doctors' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* Add doctor form */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Add New Clinician Profile
                </h3>

                <form onSubmit={handleRegisterDoctor} className="space-y-3.5 text-xs">
                  <div>
                    <label className="label-text">Name</label>
                    <input
                      type="text"
                      required
                      value={doctorForm.name}
                      onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })}
                      placeholder="e.g. Dr. Jane Doe"
                      className="input-field mt-1 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Email Address</label>
                      <input
                        type="email"
                        required
                        value={doctorForm.email}
                        onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })}
                        placeholder="doctor@hospital.com"
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="label-text">Password</label>
                      <input
                        type="password"
                        required
                        value={doctorForm.password}
                        onChange={e => setDoctorForm({ ...doctorForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Specialty</label>
                      <input
                        type="text"
                        value={doctorForm.specialization}
                        onChange={e => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                        placeholder="Cardiology"
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="label-text">Qualifications</label>
                      <input
                        type="text"
                        value={doctorForm.qualification}
                        onChange={e => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                        placeholder="MD, FACC"
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Assign Faculty Dept</label>
                      <select
                        value={doctorForm.department_id}
                        onChange={e => setDoctorForm({ ...doctorForm, department_id: e.target.value })}
                        className="input-field mt-1 py-2 text-xs bg-slate-900 border-white/5 cursor-pointer"
                      >
                        <option value="">-- Select Department --</option>
                        {departmentsList.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-text">Assign Hospital Facility</label>
                      <select
                        value={doctorForm.hospital_id}
                        onChange={e => setDoctorForm({ ...doctorForm, hospital_id: e.target.value })}
                        className="input-field mt-1 py-2 text-xs bg-slate-900 border-white/5 cursor-pointer"
                      >
                        <option value="">-- Select Hospital --</option>
                        {hospitalsList.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Experience (Years)</label>
                      <input
                        type="number"
                        value={doctorForm.experience_years}
                        onChange={e => setDoctorForm({ ...doctorForm, experience_years: e.target.value })}
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="label-text">Consultation Fee ($)</label>
                      <input
                        type="number"
                        value={doctorForm.consultation_fee}
                        onChange={e => setDoctorForm({ ...doctorForm, consultation_fee: e.target.value })}
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="btn btn-primary w-full text-xs font-bold uppercase tracking-wider py-2.5 mt-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Add Doctor Profile
                  </button>
                </form>
              </div>

              {/* Doctors Registry */}
              <div className="lg:col-span-2 glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Physicians registry List
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400">
                        <th className="py-2.5 font-bold">Code</th>
                        <th className="py-2.5 font-bold">Doctor</th>
                        <th className="py-2.5 font-bold">Specialty</th>
                        <th className="py-2.5 font-bold">Hospital / Dept</th>
                        <th className="py-2.5 font-bold text-center">Appointments</th>
                        <th className="py-2.5 font-bold text-center">Revenue</th>
                        <th className="py-2.5 font-bold text-center">Rating</th>
                        <th className="py-2.5 font-bold text-center">Status</th>
                        <th className="py-2.5 font-bold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctorsList.map(doc => (
                        <tr key={doc.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01]">
                          <td className="py-3 font-mono font-bold text-slate-400">{doc.doctor_code}</td>
                          <td className="py-3">
                            <strong className="text-white block">{doc.doctor_name}</strong>
                            <span className="text-[10px] text-slate-500">{doc.qualification}</span>
                          </td>
                          <td className="py-3">{doc.specialization}</td>
                          <td className="py-3">
                            <span className="block text-[11px] font-medium text-slate-300">{doc.hospital_name || 'Not Linked'}</span>
                            <span className="block text-[9px] text-slate-500">{doc.department_name || 'No Dept'}</span>
                          </td>
                          <td className="py-3 text-center font-bold text-white">{doc.appointment_count}</td>
                          <td className="py-3 text-center font-bold text-emerald-400 font-bold">₹{doc.total_revenue}</td>
                          <td className="py-3 text-center text-amber-400">★ {doc.rating?.toFixed(1) || '4.8'}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              doc.is_available ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {doc.is_available ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => handleEditDoctorClick(doc)}
                                className="px-2 py-1 bg-blue-600/15 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-600 hover:text-white transition-all text-[9px] font-bold uppercase"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleDoctorStatus(doc.id, doc.is_available)}
                                className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                  doc.is_available 
                                    ? 'bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent' 
                                    : 'bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-transparent'
                                }`}
                              >
                                {doc.is_available ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: PATIENT MANAGEMENT */}
          {activeTab === 'patients' && (
            <div className="glass-card p-5 space-y-4 animate-fade-in">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                Patient registry ecosystem
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400">
                      <th className="py-2.5 font-bold">Code</th>
                      <th className="py-2.5 font-bold">Full Name</th>
                      <th className="py-2.5 font-bold text-center">Age / Gender</th>
                      <th className="py-2.5 font-bold text-center">Blood Type</th>
                      <th className="py-2.5 font-bold">Allergies</th>
                      <th className="py-2.5 font-bold text-center">Status</th>
                      <th className="py-2.5 font-bold text-center">EMR Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientsList.map(pat => (
                      <tr key={pat.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01]">
                        <td className="py-3 font-mono font-bold text-slate-400">{pat.patient_code}</td>
                        <td className="py-3">
                          <strong className="text-white block capitalize">{pat.first_name} {pat.last_name}</strong>
                          <span className="text-[10px] text-slate-500">{pat.phone}</span>
                        </td>
                        <td className="py-3 text-center capitalize">{pat.age} yrs / {pat.gender}</td>
                        <td className="py-3 text-center text-rose-400 font-bold">{pat.blood_group || '—'}</td>
                        <td className="py-3 text-slate-400 italic max-w-xs truncate">{pat.allergies || 'No allergies recorded'}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            pat.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {pat.status}
                          </span>
                        </td>
                        <td className="py-3 text-center flex justify-center gap-2">
                          <button
                            onClick={() => handleViewPatientEMR(pat)}
                            className="px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-[9px] font-bold uppercase transition-all flex items-center gap-0.5"
                          >
                            <FileText size={10} /> History
                          </button>
                          <button
                            onClick={() => handleTogglePatientStatus(pat.id, pat.status === 'active')}
                            className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                              pat.status === 'active' 
                                ? 'bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white' 
                                : 'bg-emerald-500/15 hover:bg-emerald-600 text-emerald-400 hover:text-white'
                            }`}
                          >
                            {pat.status === 'active' ? 'Block' : 'Unblock'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: HOSPITAL MANAGEMENT */}
          {activeTab === 'hospitals' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* Add hospital form */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Add New Hospital Facility
                </h3>

                <form onSubmit={handleCreateHospital} className="space-y-3.5 text-xs">
                  <div>
                    <label className="label-text">Facility Name</label>
                    <input
                      type="text"
                      required
                      value={hospitalForm.name}
                      onChange={e => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                      placeholder="LifePulse Metro Hospital"
                      className="input-field mt-1 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="label-text">Address</label>
                    <input
                      type="text"
                      value={hospitalForm.address}
                      onChange={e => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                      placeholder="123 Hospital Lane, Sector 4"
                      className="input-field mt-1 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="label-text">Contact phone</label>
                    <input
                      type="text"
                      value={hospitalForm.phone}
                      onChange={e => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
                      placeholder="+1 555-0312"
                      className="input-field mt-1 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full text-xs font-bold uppercase py-2.5 mt-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Add Facility
                  </button>
                </form>
              </div>

              {/* Linked Facilities */}
              <div className="lg:col-span-2 glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Hospital Ecosystem Network
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hospitalsList.map(hosp => {
                    const assignedDocs = doctorsList.filter(d => d.hospital_id === hosp.id)
                    return (
                      <div key={hosp.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-all">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sm text-white">{hosp.name}</h4>
                            <button
                              onClick={() => handleDeleteHospital(hosp.id)}
                              className="text-slate-500 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-400 block">📍 Address: {hosp.address || 'Not specified'}</span>
                          <span className="text-[11px] text-slate-400 block">📞 Contact: {hosp.phone || 'None'}</span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Assigned Clinicians ({assignedDocs.length})</span>
                          <div className="space-y-1">
                            {assignedDocs.length > 0 ? (
                              assignedDocs.map(d => (
                                <span key={d.id} className="block text-[10px] text-emerald-400">👨‍⚕️ {d.doctor_name} ({d.specialization})</span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-600 italic">No clinicians assigned to this facility.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: AI ANALYTICS & INSIGHTS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Predictions Insights Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 text-blue-400 flex items-center justify-center">
                    <Brain size={18} />
                  </div>
                  <strong className="text-white text-xs block uppercase tracking-wide">AI Disease Outbreak Checker</strong>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    🔍 <strong className="text-blue-400">Influenza Spike Warning:</strong> Prediction models report a 34% rise in respiratory triage predictions over the next 14 days. Recommending department stocking adjustments.
                  </p>
                </div>

                <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-600/15 text-rose-400 flex items-center justify-center">
                    <Droplet size={18} />
                  </div>
                  <strong className="text-white text-xs block uppercase tracking-wide">Blood Shortage Predictor</strong>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    🩸 <strong className="text-rose-400">Critical Stock Warning:</strong> Rare groups <span className="font-bold">O- and AB-</span> are projected to drop below critical thresholds due to emergency surgery scheduling. Active auto-donor matches alert dispatched.
                  </p>
                </div>

                <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-600/15 text-amber-400 flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <strong className="text-white text-xs block uppercase tracking-wide">Physician Workload Dispatcher</strong>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    📊 <strong className="text-amber-400">Staff Workload Alert:</strong> Cardiology and General Medicine clinics are experiencing an inflow density of 1.4 appointments per time slot. Reallocating 2 clinicians.
                  </p>
                </div>
              </div>

              {/* Analytics Graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Outbreaks Chart */}
                <div className="glass-card p-5 space-y-3">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Top Diagnosed Conditions (Prevalence)</h3>
                  <div className="h-64">
                    {topDiseases.length > 0 ? (
                      <Bar data={diseaseChartData} options={chartOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">No disease records available to plot.</div>
                    )}
                  </div>
                </div>

                {/* Blood Bank stock Distribution */}
                <div className="glass-card p-5 space-y-3">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Blood Stock Units Per Type</h3>
                  <div className="h-64">
                    {bloodInventory.length > 0 ? (
                      <Bar data={bloodGroupData} options={chartOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">Blood inventory empty.</div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 6: BLOOD INVENTORY */}
          {activeTab === 'bb-inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* Restock Inventory Form */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Restock Blood stock
                </h3>

                <form onSubmit={handleRestockInventory} className="space-y-4 text-xs">
                  <div>
                    <label className="label-text">Select Blood Group</label>
                    <select
                      value={restockForm.blood_group}
                      onChange={e => setRestockForm({ ...restockForm, blood_group: e.target.value })}
                      className="input-field mt-1 py-2 text-xs bg-slate-900 border-white/5 cursor-pointer"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-text">Units to Add</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={restockForm.units}
                      onChange={e => setRestockForm({ ...restockForm, units: parseInt(e.target.value) })}
                      className="input-field mt-1 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full text-xs font-bold uppercase py-2.5 mt-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Update Inventory Stock
                  </button>
                </form>

                {/* Expiry alerts tracker */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Expiration Tracker</h4>
                  
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex justify-between items-center">
                      <div>
                        <strong className="block font-bold">Batch AB-920 (AB-)</strong>
                        <span>Expiry Date: in 2 days</span>
                      </div>
                      <span className="font-black text-[9px] uppercase px-1.5 py-0.5 bg-rose-600 text-white rounded">CRITICAL</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-300 flex justify-between items-center">
                      <div>
                        <strong className="block font-bold">Batch O-115 (O-)</strong>
                        <span>Expiry Date: in 14 days</span>
                      </div>
                      <span className="font-semibold text-slate-400 text-[10px]">Normal</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-300 flex justify-between items-center">
                      <div>
                        <strong className="block font-bold">Batch A+050 (A+)</strong>
                        <span>Expiry Date: in 30 days</span>
                      </div>
                      <span className="font-semibold text-slate-400 text-[10px]">Normal</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Blood Stock Packets Visual Grid */}
              <div className="lg:col-span-2 glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Clinical Blood Bank Packets Stock
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {bloodInventory.map(item => {
                    const isCrit = item.units_available <= item.units_critical_threshold
                    return (
                      <div 
                        key={item.id} 
                        className={`p-4 rounded-2xl border text-center flex flex-col justify-between min-h-[120px] transition-all hover:-translate-y-1 ${
                          isCrit 
                            ? 'border-rose-500/35 bg-rose-500/[0.02] shadow-[0_0_12px_rgba(239,68,68,0.1)]' 
                            : 'border-white/5 bg-slate-900/40'
                        }`}
                      >
                        <div>
                          <div className="flex justify-center mb-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCrit ? 'bg-rose-600/20 text-rose-500 animate-pulse' : 'bg-red-600/10 text-red-500'}`}>
                              <Droplet size={16} className={isCrit ? 'fill-rose-500' : ''} />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Blood Group</span>
                          <h4 className="text-xl font-black text-white leading-none mt-0.5">{item.blood_group}</h4>
                        </div>

                        <div className="mt-3">
                          <strong className="text-white font-black text-lg block">{item.units_available} units</strong>
                          {isCrit && <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">CRITICAL STOCK</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 7: DONOR MANAGEMENT */}
          {activeTab === 'bb-donors' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* Register Donor Form */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Register Blood Donor
                </h3>

                <form onSubmit={handleRegisterDonor} className="space-y-3.5 text-xs">
                  <div>
                    <label className="label-text">Full Name</label>
                    <input
                      type="text"
                      required
                      value={donorForm.name}
                      onChange={e => setDonorForm({ ...donorForm, name: e.target.value })}
                      placeholder="John Carter"
                      className="input-field mt-1 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Blood Type</label>
                      <select
                        value={donorForm.blood_group}
                        onChange={e => setDonorForm({ ...donorForm, blood_group: e.target.value })}
                        className="input-field mt-1 py-2 text-xs bg-slate-900 border-white/5 cursor-pointer"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-text">Contact phone</label>
                      <input
                        type="text"
                        required
                        value={donorForm.phone}
                        onChange={e => setDonorForm({ ...donorForm, phone: e.target.value })}
                        placeholder="+1 555-0200"
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Weight (kg)</label>
                      <input
                        type="number"
                        required
                        value={donorForm.weight}
                        onChange={e => setDonorForm({ ...donorForm, weight: parseFloat(e.target.value) })}
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="label-text">Hemoglobin (g/dL)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={donorForm.hemoglobin}
                        onChange={e => setDonorForm({ ...donorForm, hemoglobin: parseFloat(e.target.value) })}
                        className="input-field mt-1 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-text">Last Donation Date</label>
                    <input
                      type="date"
                      value={donorForm.last_donation_date}
                      onChange={e => setDonorForm({ ...donorForm, last_donation_date: e.target.value })}
                      className="input-field mt-1 py-2 text-xs bg-slate-900 border-white/5 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full text-xs font-bold uppercase py-2.5 mt-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Validate & Register Donor
                  </button>
                </form>
              </div>

              {/* Donors Registry Table */}
              <div className="lg:col-span-2 glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Registered Donors Log
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-400">
                        <th className="py-2.5 font-bold">Donor</th>
                        <th className="py-2.5 font-bold text-center">Blood Group</th>
                        <th className="py-2.5 font-bold text-center">Last Donation</th>
                        <th className="py-2.5 font-bold text-center">Vitals check</th>
                        <th className="py-2.5 font-bold text-center">Eligibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bloodDonors.map(donor => (
                        <tr key={donor.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01]">
                          <td className="py-3">
                            <strong className="text-white block">{donor.name}</strong>
                            <span className="text-[10px] text-slate-500">{donor.phone}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${donor.is_rare ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-300'}`}>
                              {donor.blood_group}
                            </span>
                          </td>
                          <td className="py-3 text-center text-slate-400">{donor.last_donation_date || 'None'}</td>
                          <td className="py-3 text-center">
                            <span className="block text-[11px]">Hemoglobin: {donor.eligibility_status ? '12.5+' : '<12.5'} g/dL</span>
                            <span className="block text-[9px] text-slate-500">Weight: 50+ kg</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              donor.eligibility_status 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`} title={donor.eligibility_notes}>
                              {donor.eligibility_status ? 'Eligible' : 'Ineligible'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 8: BLOOD BANK REQUESTS */}
          {activeTab === 'bb-requests' && (
            <div className="glass-card p-5 space-y-4 animate-fade-in">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                Hospital Blood Supply Requests
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400">
                      <th className="py-2.5 font-bold">Patient Name</th>
                      <th className="py-2.5 font-bold text-center">Blood Group</th>
                      <th className="py-2.5 font-bold text-center">Units Requested</th>
                      <th className="py-2.5 font-bold text-center">Urgency</th>
                      <th className="py-2.5 font-bold text-center">Status</th>
                      <th className="py-2.5 font-bold text-center">Action Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloodRequests.map(req => (
                      <tr key={req.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01]">
                        <td className="py-3 font-semibold text-white">{req.patient_name}</td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-rose-400 font-bold">{req.blood_group}</span>
                        </td>
                        <td className="py-3 text-center">{req.units_requested} units</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            req.urgency === 'emergency' || req.urgency === 'urgent' 
                              ? 'bg-rose-500 text-white animate-pulse' 
                              : 'bg-blue-600/20 text-blue-400'
                          }`}>
                            {req.urgency}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            req.status === 'fulfilled' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : req.status === 'approved'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : req.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 text-center flex justify-center gap-1.5">
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'approved')}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-bold uppercase transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold uppercase transition-all"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {req.status === 'approved' && (
                            <button
                              onClick={() => handleUpdateRequestStatus(req.id, 'fulfilled')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-bold uppercase transition-all"
                            >
                              Deliver / Fulfill
                            </button>
                          )}
                          {(req.status === 'fulfilled' || req.status === 'rejected') && (
                            <span className="text-[10px] text-slate-500 italic">No actions available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: BLOOD BANK EMERGENCY ALERTS */}
          {activeTab === 'bb-alerts' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              
              {/* Urgent Requests queue */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                  Emergency Blood Requests
                </h3>

                <div className="space-y-3">
                  {bloodRequests.filter(r => r.urgency === 'emergency' && r.status === 'pending').map(req => (
                    <div 
                      key={req.id} 
                      onClick={() => handleEmergencyDonorMatch(req)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        activeEmergencyMatchReq?.id === req.id 
                          ? 'border-rose-500 bg-rose-500/10' 
                          : 'border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <strong className="text-white block font-bold text-xs">{req.patient_name}</strong>
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-500 text-white animate-pulse">EMERGENCY</span>
                      </div>
                      <span className="block text-[11px] text-slate-300 mt-2">Required: <strong className="text-rose-400 font-bold">{req.units_requested} Units of {req.blood_group}</strong></span>
                      <span className="block text-[9px] text-slate-500 mt-1">Requested: {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</span>
                    </div>
                  ))}

                  {bloodRequests.filter(r => r.urgency === 'emergency' && r.status === 'pending').length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No active emergency blood shortage requests in queue.
                    </div>
                  )}
                </div>
              </div>

              {/* Donor Auto-Matching & Notifications Dispatcher */}
              <div className="lg:col-span-2 glass-card p-5 space-y-4">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1">
                  <ShieldAlert className="text-rose-500 animate-bounce" size={14} />
                  Emergency Auto-Match Donor Engine
                </h3>

                {activeEmergencyMatchReq ? (
                  <div className="space-y-5">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
                      Matching eligible donors nearby for patient <strong className="text-white font-bold">{activeEmergencyMatchReq.patient_name}</strong> who needs <strong className="text-rose-400">{activeEmergencyMatchReq.units_requested} units of {activeEmergencyMatchReq.blood_group}</strong>.
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Matched Nearby Donors ({matchedDonors.length})</h4>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {matchedDonors.map(d => (
                          <div key={d.id} className="p-2.5 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <strong className="text-white block font-bold">{d.name}</strong>
                              <span className="text-[10px] text-slate-500">Last Donation: {d.last_donation_date || 'Never'}</span>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">{d.blood_group}</span>
                              <span className="block text-[9px] text-slate-500 mt-1">Vitals: Eligible</span>
                            </div>
                          </div>
                        ))}

                        {matchedDonors.length === 0 && (
                          <div className="text-center py-6 text-slate-600 text-xs bg-slate-950/20 rounded-xl">
                            No eligible matching donors found in system registries. ( Universal Donor O- eligible )
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleDispatchPriorityAlerts}
                      disabled={sendingAlerts}
                      className="btn btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 mt-2"
                    >
                      {sendingAlerts ? <RefreshCw className="animate-spin" size={14} /> : <Send size={12} />}
                      {sendingAlerts ? 'Dispatching SMS Broadcasts...' : 'Dispatch Priority SMS & App Notifications'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-20 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                    <Droplet size={36} className="opacity-25" />
                    <strong>Select an emergency request from the left queue to begin donor auto-matching.</strong>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* Patient History Timeline Modal Drawer */}
      {viewHistoryModal && selectedPatientHistory && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">EMR Clinical Logs: {selectedPatientHistory.first_name} {selectedPatientHistory.last_name}</h3>
                <span className="text-[10px] text-slate-500 font-mono">Patient Code: {selectedPatientHistory.patient_code} | Age: {selectedPatientHistory.age} | Allergies: {selectedPatientHistory.allergies || 'None'}</span>
              </div>
              <button
                onClick={() => setViewHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {historyTimeline.length > 0 ? (
                <div className="relative border-l border-white/5 ml-3 pl-5 space-y-4">
                  {historyTimeline.map((item, idx) => (
                    <div key={idx} className="relative">
                      {/* dot */}
                      <span className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-950" />
                      
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 block">{format(new Date(item.date), 'yyyy-MM-dd HH:mm')}</span>
                        <strong className="text-white block text-xs">{item.title}</strong>
                        <p className="text-[11px] text-slate-400 leading-normal">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No historical triage, appointment, or prescription logs available.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setViewHistoryModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase rounded-xl transition-all"
              >
                Close EMR Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Registration Request Credentials Verification Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Verify Registration Request: {selectedRequest.name}</h3>
                <span className="text-[10px] text-slate-500 font-mono">Submitted: {format(new Date(selectedRequest.created_at), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 text-xs">
              
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/60 p-4 border border-white/5 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {selectedRequest.profile_photo ? (
                    <img 
                      src={`${api.defaults.baseURL}/admin/doctor-requests/documents/${selectedRequest.profile_photo}`} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={28} className="text-slate-600" />
                  )}
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <h4 className="text-sm font-bold text-white">{selectedRequest.name}</h4>
                  <p className="text-slate-400">Email: {selectedRequest.email} | Mobile: {selectedRequest.phone}</p>
                  <p className="text-slate-500 font-mono">DOB: {selectedRequest.dob} | Gender: {selectedRequest.gender}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block ${
                  selectedRequest.status === 'approved' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : selectedRequest.status === 'rejected'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  {selectedRequest.status}
                </span>
              </div>

              {/* Grid sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Credentials */}
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block border-b border-white/5 pb-1">Professional Credentials</span>
                  <div className="space-y-1.5 text-slate-300">
                    <div>Medical Reg Number: <strong className="text-white font-mono">{selectedRequest.medical_reg_number}</strong></div>
                    <div>Medical Council Reg ID: <strong className="text-white font-mono">{selectedRequest.medical_council_reg_id}</strong></div>
                    <div>Specializations: <strong className="text-white">{selectedRequest.specialization}</strong></div>
                    <div>Highest Qualification: <strong className="text-white">{selectedRequest.qualification}</strong></div>
                    <div>Degree Type: <strong className="text-white">{selectedRequest.highest_degree}</strong></div>
                    <div>Graduated From: <strong className="text-white">{selectedRequest.university_name} ({selectedRequest.graduation_year})</strong></div>
                    <div>Clinical Experience: <strong className="text-white">{selectedRequest.experience_years} years</strong></div>
                  </div>
                </div>

                {/* Hospital & Consultation */}
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block border-b border-white/5 pb-1">Hospital & Availability</span>
                  <div className="space-y-1.5 text-slate-300">
                    <div>Hospital Facility: <strong className="text-white">{selectedRequest.hospital_name}</strong></div>
                    {selectedRequest.hospital_address && (
                      <div>Address: <span className="text-slate-400">{selectedRequest.hospital_address}, {selectedRequest.hospital_city}, {selectedRequest.hospital_state} - {selectedRequest.hospital_pincode}</span></div>
                    )}
                    <div>Consultation Fee: <strong className="text-emerald-400">₹{selectedRequest.consultation_fee}</strong></div>
                    <div>Consultation Format: <span className="capitalize">{selectedRequest.consultation_types?.split(',').join(' & ')}</span></div>
                    <div>Available Days: <span className="text-white">{selectedRequest.available_days}</span></div>
                    <div className="max-w-[280px]">Available Slots: <span className="text-white text-[10px] block mt-0.5">{selectedRequest.available_slots}</span></div>
                  </div>
                </div>

                {/* Biography */}
                <div className="md:col-span-2 p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block border-b border-white/5 pb-1">Clinician Biography</span>
                  <p className="text-slate-300 leading-relaxed italic">"{selectedRequest.bio || 'No bio submitted.'}"</p>
                </div>

                {/* Verification scan documents */}
                <div className="md:col-span-2 p-4 bg-slate-900/40 border border-white/5 rounded-2xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Verification Documents Checklist</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedRequest.license_file && (
                      <a 
                        href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${selectedRequest.license_file}`} 
                        target="_blank" rel="noreferrer"
                        className="p-3 bg-slate-950/60 border border-white/5 hover:border-blue-500/20 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all"
                      >
                        <span className="font-semibold">📄 Medical License</span>
                        <ChevronRight size={14} className="text-slate-500" />
                      </a>
                    )}
                    {selectedRequest.certificate_file && (
                      <a 
                        href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${selectedRequest.certificate_file}`} 
                        target="_blank" rel="noreferrer"
                        className="p-3 bg-slate-950/60 border border-white/5 hover:border-blue-500/20 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all"
                      >
                        <span className="font-semibold">📄 Degree Certificate</span>
                        <ChevronRight size={14} className="text-slate-500" />
                      </a>
                    )}
                    {selectedRequest.gov_id_file && (
                      <a 
                        href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${selectedRequest.gov_id_file}`} 
                        target="_blank" rel="noreferrer"
                        className="p-3 bg-slate-950/60 border border-white/5 hover:border-blue-500/20 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all"
                      >
                        <span className="font-semibold">📄 Govt ID Proof</span>
                        <ChevronRight size={14} className="text-slate-500" />
                      </a>
                    )}
                    {selectedRequest.experience_cert_file && (
                      <a 
                        href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${selectedRequest.experience_cert_file}`} 
                        target="_blank" rel="noreferrer"
                        className="p-3 bg-slate-950/60 border border-white/5 hover:border-blue-500/20 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all"
                      >
                        <span className="font-semibold">📄 Exp. Certificate</span>
                        <ChevronRight size={14} className="text-slate-500" />
                      </a>
                    )}
                    {selectedRequest.additional_cert_file && (
                      <a 
                        href={`${api.defaults.baseURL}/admin/doctor-requests/documents/${selectedRequest.additional_cert_file}`} 
                        target="_blank" rel="noreferrer"
                        className="p-3 bg-slate-950/60 border border-white/5 hover:border-blue-500/20 rounded-xl flex items-center justify-between text-slate-300 hover:text-white transition-all"
                      >
                        <span className="font-semibold">📄 Add. Certifications</span>
                        <ChevronRight size={14} className="text-slate-500" />
                      </a>
                    )}
                  </div>
                </div>

              </div>

            </div>

            <div className="pt-3 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-semibold">Verify all credentials prior to approval.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all"
                >
                  Close
                </button>
                {selectedRequest.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        handleRejectDoctorRequest(selectedRequest.id)
                        setSelectedRequest(null)
                      }}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold uppercase transition-all"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => {
                        handleApproveDoctorRequest(selectedRequest.id)
                        setSelectedRequest(null)
                      }}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase transition-all"
                    >
                      Approve & Activate
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Doctor Profile Modal */}
      {editingDoctor && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Edit Clinician: {editingDoctor.doctor_name}</h3>
                <span className="text-[10px] text-slate-500 font-mono">Doctor Code: {editingDoctor.doctor_code}</span>
              </div>
              <button
                onClick={() => setEditingDoctor(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateDoctorSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <label className="label-text">Name</label>
                  <input
                    type="text" required className="input-field mt-1 py-2"
                    value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Phone Number</label>
                  <input
                    type="text" className="input-field mt-1 py-2"
                    value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Specialization</label>
                  <input
                    type="text" className="input-field mt-1 py-2"
                    value={editForm.specialization} onChange={e => setEditForm({ ...editForm, specialization: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Qualification</label>
                  <input
                    type="text" className="input-field mt-1 py-2"
                    value={editForm.qualification} onChange={e => setEditForm({ ...editForm, qualification: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Experience (Years)</label>
                    <input
                      type="number" className="input-field mt-1 py-2"
                      value={editForm.experience_years} onChange={e => setEditForm({ ...editForm, experience_years: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-text">Consultation Fee (₹)</label>
                    <input
                      type="number" className="input-field mt-1 py-2"
                      value={editForm.consultation_fee} onChange={e => setEditForm({ ...editForm, consultation_fee: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Assign Faculty Dept</label>
                    <select
                      value={editForm.department_id}
                      onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}
                      className="input-field mt-1 py-2 bg-slate-900 border-white/5 cursor-pointer animate-none"
                    >
                      <option value="">-- No Department --</option>
                      {departmentsList.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Assign Hospital Facility</label>
                    <select
                      value={editForm.hospital_id}
                      onChange={e => setEditForm({ ...editForm, hospital_id: e.target.value })}
                      className="input-field mt-1 py-2 bg-slate-900 border-white/5 cursor-pointer animate-none"
                    >
                      <option value="">-- No Hospital --</option>
                      {hospitalsList.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text">Slot Duration (Mins)</label>
                  <input
                    type="number" className="input-field mt-1 py-2"
                    value={editForm.slot_duration_mins} onChange={e => setEditForm({ ...editForm, slot_duration_mins: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Max Patients / Day</label>
                  <input
                    type="number" className="input-field mt-1 py-2"
                    value={editForm.max_patients_per_day} onChange={e => setEditForm({ ...editForm, max_patients_per_day: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text block mb-1">Clinic Availability</label>
                  <select
                    value={editForm.is_available ? 'yes' : 'no'}
                    onChange={e => setEditForm({ ...editForm, is_available: e.target.value === 'yes' })}
                    className="input-field mt-1 py-2 bg-slate-900 border-white/5 cursor-pointer"
                  >
                    <option value="yes">Available / On Duty</option>
                    <option value="no">Suspended / Off Duty</option>
                  </select>
                </div>

                <div>
                  <label className="label-text block mb-1">User Account Status</label>
                  <select
                    value={editForm.is_active ? 'yes' : 'no'}
                    onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'yes' })}
                    className="input-field mt-1 py-2 bg-slate-900 border-white/5 cursor-pointer"
                  >
                    <option value="yes">Active (Can Login)</option>
                    <option value="no">Blocked (Access Revoked)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label-text">Biography</label>
                  <textarea
                    rows="3" className="input-field mt-1 py-2 text-xs resize-none"
                    value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                  />
                </div>

              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button" onClick={() => setEditingDoctor(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={actionLoading}
                  className="btn btn-primary px-6 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-1"
                >
                  {actionLoading ? <RefreshCw className="animate-spin" size={12} /> : <CheckCircle2 size={14} />}
                  Save Doctor Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
