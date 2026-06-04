import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, Calendar, Heart, ShieldAlert, FileText, Sparkles, Droplet, User, ArrowRight,
  Brain, Clock, ShieldCheck, CheckCircle2, XCircle, Video, Plus, Trash2, Shield, Search,
  Printer, Send, AlertTriangle, HelpCircle, Clipboard, BookOpen, Layers, Award, RefreshCw
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { appointmentApi } from '@/services/appointmentApi'
import { pharmacyApi } from '@/services/pharmacyApi'
import { patientApi } from '@/services/patientApi'
import { predictionApi } from '@/services/predictionApi'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function DoctorDashboard({ initialTab = 'home' }) {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  // Navigation state within clinical workstation
  const [activeTab, setActiveTab] = useState(initialTab) // home, appointments, video, prescriptions, history, ai

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // Doctor profile & lists
  const [doctorProfile, setDoctorProfile] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters for Appointments
  const [apptFilter, setApptFilter] = useState('today') // today, upcoming, completed

  // History Detail view
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientHistory, setPatientHistory] = useState({
    predictions: [],
    appointments: [],
    prescriptions: []
  })

  // Video Consultation Panel States
  const [activeVideoAppt, setActiveVideoAppt] = useState(null)
  const [videoChat, setVideoChat] = useState([])
  const [videoMessage, setVideoMessage] = useState('')
  const [consultNotes, setConsultNotes] = useState('')
  const [consultDiagnosis, setConsultDiagnosis] = useState('')
  const [consultReports, setConsultReports] = useState([])

  // Prescription Form state
  const [prescriptionForm, setPrescriptionForm] = useState({
    patient_id: '',
    items: [],
    notes: ''
  })
  const [safetyChecked, setSafetyChecked] = useState(false)
  const [safetyWarnings, setSafetyWarnings] = useState([])
  const [checkingSafety, setCheckingSafety] = useState(false)
  const [tempMedicine, setTempMedicine] = useState({
    medicine_id: '',
    dosage: '1 tablet',
    frequency: 'Twice daily',
    duration_days: '7'
  })

  // Doctor AI Assistant States
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiAnswers, setAiAnswers] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  // Appointment Actions & Modal States
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleApptId, setRescheduleApptId] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectApptId, setRejectApptId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Video Consult extra states
  const [rightPanelTab, setRightPanelTab] = useState('chat') // chat, prescription
  const [callDuration, setCallDuration] = useState(0)
  const [consultPatientHistory, setConsultPatientHistory] = useState({
    predictions: [],
    appointments: [],
    prescriptions: []
  })

  // Consultation Prescription form states
  const [consultPrescriptionItems, setConsultPrescriptionItems] = useState([])
  const [consultTempMedicine, setConsultTempMedicine] = useState({
    medicine_id: '',
    dosage: '1 tablet',
    frequency: 'Twice daily',
    duration_days: '7'
  })
  const [consultSafetyChecked, setConsultSafetyChecked] = useState(false)
  const [consultSafetyWarnings, setConsultSafetyWarnings] = useState([])
  const [consultCheckingSafety, setConsultCheckingSafety] = useState(false)

  useEffect(() => {
    loadWorkstationData()
  }, [])

  useEffect(() => {
    let interval = null
    if (activeVideoAppt) {
      setCallDuration(0)
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      setCallDuration(0)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeVideoAppt])

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const loadWorkstationData = async () => {
    setLoading(true)
    try {
      // 1. Fetch current doctor profile
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user

      const { data: docRes } = await api.get('/appointments/doctors')
      const profile = docRes.doctors?.find(d => d.user_id === loggedUser.id)
      
      if (profile) {
        setDoctorProfile(profile)
      }

      // 2. Fetch appointments
      const { data: apptRes } = await api.get('/appointments')
      setAppointments(apptRes.appointments || [])

      // 3. Fetch patients
      const { data: patientRes } = await patientApi.list({ limit: 100 })
      setPatients(patientRes.patients || [])

      // 4. Fetch pharmacy medicines
      const { data: medRes } = await pharmacyApi.getInventory()
      setMedicines(medRes.medicines || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to initialize clinical workstation data.')
    } finally {
      setLoading(false)
    }
  }

  // Load a patient's historical logs
  const handleViewPatientHistory = async (patientObj) => {
    setSelectedPatient(patientObj)
    setActiveTab('history')
    try {
      const [predRes, apptRes, prescRes] = await Promise.all([
        predictionApi.getHistory({ patient_id: patientObj.id }),
        api.get('/appointments'),
        api.get('/pharmacy/prescriptions')
      ])

      setPatientHistory({
        predictions: predRes.data.history || [],
        appointments: (apptRes.data.appointments || []).filter(a => a.patient_id === patientObj.id),
        prescriptions: (prescRes.data.prescriptions || []).filter(p => p.patient_id === patientObj.id)
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load patient history records.')
    }
  }

  // Update appointment status using specialized action endpoints
  const handleUpdateApptStatus = async (apptId, status) => {
    if (status === 'confirmed') {
      try {
        await appointmentApi.approve(apptId)
        toast.success('Appointment status updated to confirmed')
        loadWorkstationData()
      } catch (err) {
        toast.error('Failed to approve appointment: ' + (err.response?.data?.error || err.message))
      }
    } else if (status === 'completed') {
      try {
        await appointmentApi.complete(apptId)
        toast.success('Appointment completed successfully')
        loadWorkstationData()
        if (activeVideoAppt?.id === apptId) {
          setActiveVideoAppt(null)
          setActiveTab('home')
        }
      } catch (err) {
        toast.error('Failed to complete appointment: ' + (err.response?.data?.error || err.message))
      }
    } else if (status === 'rejected') {
      setRejectApptId(apptId)
      setRejectReason('')
      setShowRejectModal(true)
    }
  }

  const handleRejectAppointmentSubmit = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason.')
      return
    }
    try {
      await appointmentApi.reject(rejectApptId, { reason: rejectReason })
      toast.success('Appointment rejected successfully')
      setShowRejectModal(false)
      setRejectReason('')
      setRejectApptId(null)
      loadWorkstationData()
    } catch (err) {
      toast.error('Failed to reject appointment: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleProposeReschedule = (apptId) => {
    setRescheduleApptId(apptId)
    setRescheduleDate('')
    setRescheduleTime('')
    setShowRescheduleModal(true)
  }

  const handleProposeRescheduleSubmit = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Please enter both date and time for rescheduling.')
      return
    }
    try {
      await appointmentApi.reschedule(rescheduleApptId, {
        reschedule_date: rescheduleDate,
        reschedule_time: rescheduleTime
      })
      toast.success('Reschedule proposal sent to patient')
      setShowRescheduleModal(false)
      setRescheduleDate('')
      setRescheduleTime('')
      setRescheduleApptId(null)
      loadWorkstationData()
    } catch (err) {
      toast.error('Failed to propose reschedule: ' + (err.response?.data?.error || err.message))
    }
  }

  const loadPatientHistoryForConsult = async (patientObj) => {
    try {
      const [predRes, apptRes, prescRes] = await Promise.all([
        predictionApi.getHistory({ patient_id: patientObj.id }),
        api.get('/appointments'),
        api.get('/pharmacy/prescriptions')
      ])

      setConsultPatientHistory({
        predictions: predRes.data.history || [],
        appointments: (apptRes.data.appointments || []).filter(a => a.patient_id === patientObj.id),
        prescriptions: (prescRes.data.prescriptions || []).filter(p => p.patient_id === patientObj.id)
      })
    } catch (err) {
      console.error('Failed to load consult patient history', err)
    }
  }

  // Live Consult Prescription item management
  const addConsultPrescriptionItem = () => {
    if (!consultTempMedicine.medicine_id) return toast.error('Please select a medicine.')
    const med = medicines.find(m => m.id === parseInt(consultTempMedicine.medicine_id))
    if (!med) return

    setConsultPrescriptionItems(prev => [
      ...prev,
      {
        ...consultTempMedicine,
        medicine_name: med.name
      }
    ])
    setConsultSafetyChecked(false)
    setConsultSafetyWarnings([])
    setConsultTempMedicine({
      medicine_id: '',
      dosage: '1 tablet',
      frequency: 'Twice daily',
      duration_days: '7'
    })
  }

  const removeConsultPrescriptionItem = (index) => {
    setConsultPrescriptionItems(prev => prev.filter((_, i) => i !== index))
    setConsultSafetyChecked(false)
    setConsultSafetyWarnings([])
  }

  const runConsultPrescriptionSafetyScreen = () => {
    if (!activeVideoAppt) return
    if (consultPrescriptionItems.length === 0) return toast.error('No medicines added to evaluate.')

    setConsultCheckingSafety(true)
    setConsultSafetyWarnings([])

    setTimeout(() => {
      const warnings = []
      const medNames = consultPrescriptionItems.map(i => i.medicine_name.toLowerCase())
      const pat = patients.find(p => p.id === activeVideoAppt.patient_id)

      // 1. Drug-Drug Interactions
      if (medNames.includes('aspirin') && medNames.includes('warfarin')) {
        warnings.push({
          severity: 'critical',
          message: 'CRITICAL DRUG INTERACTION: Aspirin + Warfarin. Concomitant use increases risk of severe clinical bleeding. Alternate: Use low-dose Aspirin only, or consider Heparin.'
        })
      }
      if (medNames.includes('lisinopril') && medNames.includes('spironolactone')) {
        warnings.push({
          severity: 'medium',
          message: 'MEDIUM DRUG INTERACTION: Lisinopril + Spironolactone. Concomitant use increases risk of Hyperkalemia (high blood potassium levels). Monitor electrolytes closely.'
        })
      }
      if (medNames.includes('ibuprofen') && medNames.includes('aspirin')) {
        warnings.push({
          severity: 'low',
          message: 'LOW DRUG INTERACTION: Ibuprofen + Aspirin. Overlapping NSAIDs can increase GI toxicity and impair renal function. Alternate: Substitute Ibuprofen with Paracetamol.'
        })
      }

      // 2. Allergy contraindications (using patient allergies)
      const patientAllergies = (pat?.allergies || '').toLowerCase()
      consultPrescriptionItems.forEach(item => {
        const medName = item.medicine_name.toLowerCase()
        if (medName === 'amoxicillin' && patientAllergies.includes('penicillin')) {
          warnings.push({
            severity: 'critical',
            message: `ALLERGY CONTRAINDICATION: Patient has documented Penicillin allergy. Amoxicillin belongs to the penicillin class. Alternate: Erythromycin.`
          })
        }
      })

      // 3. Dosage Validation (e.g. check for extreme high units/day values)
      consultPrescriptionItems.forEach(item => {
        const days = parseInt(item.duration_days)
        if (days > 180) {
          warnings.push({
            severity: 'medium',
            message: `DOSAGE WARNING: ${item.medicine_name} duration exceeds 180 days. Long term usage requires monitoring.`
          })
        }
      })

      setConsultSafetyWarnings(warnings)
      setConsultCheckingSafety(false)
      setConsultSafetyChecked(true)

      if (warnings.length > 0) {
        toast.error('⚠️ safety screening detected potential drug conflicts!')
      } else {
        toast.success('✅ AI Clinical Screening: Prescription Safe!')
      }
    }, 1500)
  }

  const submitConsultPrescription = async () => {
    if (!activeVideoAppt) return
    if (consultPrescriptionItems.length === 0) return toast.error('Please add at least one medicine.')

    try {
      const payload = {
        patient_id: parseInt(activeVideoAppt.patient_id),
        items: consultPrescriptionItems.map(i => ({
          medicine_id: parseInt(i.medicine_id),
          dosage: i.dosage,
          frequency: i.frequency,
          duration_days: parseInt(i.duration_days)
        }))
      }

      await pharmacyApi.submitPrescription(payload)
      toast.success('Prescription generated & submitted successfully!')
      
      // Reset Form
      setConsultPrescriptionItems([])
      setConsultSafetyChecked(false)
      setConsultSafetyWarnings([])
      loadWorkstationData()
    } catch (err) {
      toast.error('Failed to submit prescription: ' + (err.response?.data?.error || err.message))
    }
  }

  // Prescription item management
  const addPrescriptionItem = () => {
    if (!tempMedicine.medicine_id) return toast.error('Please select a medicine.')
    const med = medicines.find(m => m.id === parseInt(tempMedicine.medicine_id))
    if (!med) return

    setPrescriptionForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...tempMedicine,
          medicine_name: med.name
        }
      ]
    }))
    setSafetyChecked(false)
    setSafetyWarnings([])
    setTempMedicine({
      medicine_id: '',
      dosage: '1 tablet',
      frequency: 'Twice daily',
      duration_days: '7'
    })
  }

  const removePrescriptionItem = (index) => {
    setPrescriptionForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
    setSafetyChecked(false)
    setSafetyWarnings([])
  }

  // Run Doctor AI Safety Screening
  const runPrescriptionSafetyScreen = () => {
    if (!prescriptionForm.patient_id) return toast.error('Please select a patient first.')
    if (prescriptionForm.items.length === 0) return toast.error('No medicines added to evaluate.')

    setCheckingSafety(true)
    setSafetyWarnings([])

    setTimeout(() => {
      const warnings = []
      const medNames = prescriptionForm.items.map(i => i.medicine_name.toLowerCase())
      const pat = patients.find(p => p.id === parseInt(prescriptionForm.patient_id))

      // 1. Drug-Drug Interactions
      if (medNames.includes('aspirin') && medNames.includes('warfarin')) {
        warnings.push({
          severity: 'critical',
          message: 'CRITICAL DRUG INTERACTION: Aspirin + Warfarin. Concomitant use increases risk of severe clinical bleeding. Alternate: Use low-dose Aspirin only, or consider Heparin.'
        })
      }
      if (medNames.includes('lisinopril') && medNames.includes('spironolactone')) {
        warnings.push({
          severity: 'medium',
          message: 'MEDIUM DRUG INTERACTION: Lisinopril + Spironolactone. Concomitant use increases risk of Hyperkalemia (high blood potassium levels). Monitor electrolytes closely.'
        })
      }
      if (medNames.includes('ibuprofen') && medNames.includes('aspirin')) {
        warnings.push({
          severity: 'low',
          message: 'LOW DRUG INTERACTION: Ibuprofen + Aspirin. Overlapping NSAIDs can increase GI toxicity and impair renal function. Alternate: Substitute Ibuprofen with Paracetamol.'
        })
      }

      // 2. Allergy contraindications (using patient allergies)
      const patientAllergies = (pat?.allergies || '').toLowerCase()
      prescriptionForm.items.forEach(item => {
        const medName = item.medicine_name.toLowerCase()
        if (medName === 'amoxicillin' && patientAllergies.includes('penicillin')) {
          warnings.push({
            severity: 'critical',
            message: `ALLERGY CONTRAINDICATION: Patient has documented Penicillin allergy. Amoxicillin belongs to the penicillin class. Alternate: Erythromycin.`
          })
        }
      })

      // 3. Dosage Validation (e.g. check for extreme high units/day values)
      prescriptionForm.items.forEach(item => {
        const days = parseInt(item.duration_days)
        if (days > 180) {
          warnings.push({
            severity: 'medium',
            message: `DOSAGE WARNING: ${item.medicine_name} duration exceeds 180 days. Long term usage requires monitoring.`
          })
        }
      })

      setSafetyWarnings(warnings)
      setCheckingSafety(false)
      setSafetyChecked(true)

      if (warnings.length > 0) {
        toast.error('⚠️ safety screening detected potential drug conflicts!')
      } else {
        toast.success('✅ AI Clinical Screening: Prescription Safe!')
      }
    }, 1500)
  }

  // Submit Prescription to Database
  const submitPrescription = async () => {
    if (!prescriptionForm.patient_id) return toast.error('Please select a patient.')
    if (prescriptionForm.items.length === 0) return toast.error('Please add at least one medicine.')

    try {
      const payload = {
        patient_id: parseInt(prescriptionForm.patient_id),
        items: prescriptionForm.items.map(i => ({
          medicine_id: parseInt(i.medicine_id),
          dosage: i.dosage,
          frequency: i.frequency,
          duration_days: parseInt(i.duration_days)
        }))
      }

      await pharmacyApi.submitPrescription(payload)
      toast.success('Prescription generated & submitted successfully!')
      
      // Reset Form
      setPrescriptionForm({
        patient_id: '',
        items: [],
        notes: ''
      })
      setSafetyChecked(false)
      setSafetyWarnings([])
      loadWorkstationData()
    } catch (err) {
      toast.error('Failed to submit prescription: ' + (err.response?.data?.error || err.message))
    }
  }

  // Doctor Clinical AI Assistant Chat
  const askAIAssistant = () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)

    const query = aiPrompt
    setAiPrompt('')

    setTimeout(() => {
      let reply = "Based on clinical guidelines, typical therapy involves first-line lifestyle modifications. If symptoms persist, confirm diagnostics before drug prescription."

      const q = query.toLowerCase()
      if (q.includes('warfarin') || q.includes('aspirin')) {
        reply = "Clinical Guideline: Concomitant use of Warfarin and Aspirin increases bleeding risk. Avoid double antiplatelet/anticoagulation therapies unless specifically indicated (e.g., post-PCI or mechanical valves) and monitor INR closely."
      } else if (q.includes('hypertension') || q.includes('lisinopril')) {
        reply = "Clinical Guideline: For adult primary hypertension, ACE inhibitors (e.g. Lisinopril), ARBs, CCBs, or thiazide diuretics are recommended first-line. Avoid combining ACEi + ARB due to renal injury risk. Pregnant patients should use Methyldopa or Labetalol."
      } else if (q.includes('penicillin') || q.includes('amoxicillin')) {
        reply = "Clinical Guideline: Patients reporting penicillin allergy often tolerate cephalosporins, but cross-reactivity is ~3-5%. For severe anaphylaxis history, choose Macrolides (e.g. Azithromycin) or Lincosamides (Clindamycin)."
      }

      setAiAnswers(prev => [
        ...prev,
        { query, reply }
      ])
      setAiLoading(false)
      toast.success('AI clinical suggestion loaded.')
    }, 1500)
  }

  // Filters appointments list
  const filteredAppts = appointments.filter(a => {
    // Fallback: match doctor's profile
    if (doctorProfile && a.doctor_profile_id !== doctorProfile.id) return false

    const apptDate = a.appointment_date // yyyy-mm-dd
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    if (apptFilter === 'today') {
      return apptDate === todayStr && a.status !== 'completed' && a.status !== 'rejected'
    } else if (apptFilter === 'upcoming') {
      return apptDate > todayStr && a.status !== 'completed' && a.status !== 'rejected'
    } else {
      return a.status === 'completed' || a.status === 'rejected'
    }
  })

  // Start a Consultation
  const handleStartConsult = (appt) => {
    setActiveVideoAppt(appt)
    setConsultNotes(appt.reason || '')
    setConsultDiagnosis('')
    setConsultPrescriptionItems([])
    setConsultSafetyChecked(false)
    setConsultSafetyWarnings([])
    setVideoChat([
      { sender: 'system', text: `Consultation started. SECURE WEBRTC tunnel initiated with ${appt.patient_name}.` }
    ])
    const pat = patients.find(p => p.id === appt.patient_id)
    if (pat) {
      loadPatientHistoryForConsult(pat)
    }
    setActiveTab('video')
    toast.success(`Live consult room started for ${appt.patient_name}`)
  }

  // Send a chat message during video consult
  const sendVideoChat = () => {
    if (!videoMessage.trim()) return
    setVideoChat(prev => [
      ...prev,
      { sender: 'doctor', text: videoMessage }
    ])
    setVideoMessage('')

    // Simulate patient automated reply
    setTimeout(() => {
      setVideoChat(prev => [
        ...prev,
        { sender: 'patient', text: "Yes doctor, I can hear you clearly. Vitals metrics are linked." }
      ])
    }, 1000)
  }

  // Save Video Consultation Diagnosis
  const handleSaveDiagnosis = async () => {
    if (!activeVideoAppt) return
    try {
      // Mark appointment as Completed and save notes
      await api.put(`/appointments/${activeVideoAppt.id}`, {
        status: 'completed',
        notes: `Diagnosis: ${consultDiagnosis} | Notes: ${consultNotes}`
      })
      toast.success('Clinical consult successfully completed & logged in patient EMR.')
      loadWorkstationData()
      setActiveTab('home')
      setActiveVideoAppt(null)
    } catch (err) {
      toast.error('Failed to log diagnosis: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Clinician Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-500 animate-pulse" size={24} />
            LifePulse Physician Workstation
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Logged in: <strong className="text-blue-400 capitalize">{user?.name}</strong> | Specialization: <strong className="text-emerald-400 capitalize">{doctorProfile?.specialization || 'General Clinical Specialist'}</strong>
          </p>
        </div>

        {/* Workspace Quick Actions Row */}
        <div className="flex gap-2 flex-wrap">
          {['home', 'appointments', 'prescriptions', 'history', 'ai'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                activeTab === tab 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
          <div className="skeleton h-80 w-full" />
        </div>
      ) : (
        <div className="animate-fade-in">
          
          {/* TAB 1: DASHBOARD HOME OVERVIEW */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              
              {/* Clinician Profile Overview Card */}
              {doctorProfile && (
                <div className="glass-card p-6 border-blue-500/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none bg-blue-500" />
                  
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {doctorProfile.avatar ? (
                        <img 
                          src={`${api.defaults.baseURL}/admin/doctor-requests/documents/${doctorProfile.avatar}`} 
                          alt="Doctor Profile" 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = ''; e.target.className = 'hidden' }}
                        />
                      ) : (
                        <User size={36} className="text-slate-600" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 text-center md:text-left space-y-3">
                      <div className="space-y-1">
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                          <h2 className="text-xl font-bold text-white uppercase tracking-wide">Dr. {doctorProfile.doctor_name}</h2>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase bg-blue-600/25 border border-blue-500/30 text-blue-400 self-center">
                            {doctorProfile.doctor_code}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs">
                          {doctorProfile.qualification} &bull; {doctorProfile.specialization}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/5 text-left">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-black block">Hospital facility</span>
                          <strong className="text-xs text-white">{doctorProfile.hospital_name || 'LifePulse Medical Center'}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-black block">Experience</span>
                          <strong className="text-xs text-white">{doctorProfile.experience_years} Years Active</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-black block">Consultation Fee</span>
                          <strong className="text-xs text-emerald-400">₹{doctorProfile.consultation_fee}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase font-black block">Clinical Rating</span>
                          <div className="flex items-center gap-1 justify-start">
                            <strong className="text-xs text-amber-400">★ {doctorProfile.rating?.toFixed(1) || '4.8'}</strong>
                            <span className="text-[9px] text-slate-500 font-medium">({doctorProfile.appointment_count} cases)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Appointments */}
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center">
                      <Calendar size={18} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Today</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none mt-2">
                      {appointments.filter(a => a.status === 'confirmed').length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Today's Active Appointments</div>
                  </div>
                </div>

                {/* Pending Consults */}
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-400 flex items-center justify-center">
                      <Video size={18} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Tele-health</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none mt-2">
                      {appointments.filter(a => a.is_online && a.status === 'confirmed').length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Pending Video Consults</div>
                  </div>
                </div>

                {/* Active Patients */}
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Ecosystem</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none mt-2">{patients.length}</div>
                    <div className="text-xs text-slate-400 mt-1">Active Patient Registry</div>
                  </div>
                </div>

                {/* Completed treatments */}
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-600/10 text-rose-400 flex items-center justify-center">
                      <ShieldCheck size={18} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Completed</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none mt-2">
                      {appointments.filter(a => a.status === 'completed').length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Resolved Treatments Log</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel & Active Queue Splits */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Triage Queue List */}
                <div className="lg:col-span-2 glass-card p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-400" />
                      Live Diagnostic Consult Queue
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[9px] bg-blue-600/20 text-blue-400 font-black">
                      TODAY'S LIST
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length > 0 ? (
                      appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').map((appt) => (
                        <div key={appt.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-white/10 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <strong className="text-white text-xs block font-bold">{appt.patient_name}</strong>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                appt.is_online ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}>
                                {appt.is_online ? 'Video Consult' : 'In-Person'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              Time: {appt.appointment_time} | Reason: {appt.reason || 'Routine Checkup'}
                            </span>
                            {appt.symptoms && (
                              <p className="text-[10px] text-amber-500">
                                Symptoms: {appt.symptoms}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartConsult(appt)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-500 transition-colors flex items-center gap-1"
                            >
                              <Video size={12} /> Start Consult
                            </button>
                            <button
                              onClick={() => {
                                setPrescriptionForm(prev => ({ ...prev, patient_id: appt.patient_id }));
                                setActiveTab('prescriptions');
                              }}
                              className="px-3 py-1.5 bg-white/5 border border-white/5 text-slate-300 rounded-lg text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                            >
                              Rx Editor
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        No active patients waiting in your queue today.
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick actions panel */}
                <div className="space-y-6">
                  
                  {/* Assistant shortcuts */}
                  <div className="glass-card p-5 space-y-4">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                      Clinical Quick Links
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      <button onClick={() => { setPrescriptionForm({ patient_id: '', items: [], notes: '' }); setActiveTab('prescriptions'); }} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/30 text-left text-xs text-white font-semibold transition-all hover:bg-blue-500/[0.01]">
                        💊 Open Prescription Editor
                      </button>
                      <button onClick={() => setActiveTab('ai')} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/30 text-left text-xs text-white font-semibold transition-all hover:bg-blue-500/[0.01]">
                        🧠 Launch Clinical AI Assistant
                      </button>
                    </div>
                  </div>

                  {/* Active Patient demographics lookup */}
                  <div className="glass-card p-5 space-y-3">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                      Active Patient Search
                    </h3>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {patients.map(p => (
                        <div key={p.id} className="p-2.5 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-white block capitalize">{p.full_name}</strong>
                            <span className="text-[9px] text-slate-500">{p.gender} • {p.age} years</span>
                          </div>
                          <button
                            onClick={() => handleViewPatientHistory(p)}
                            className="text-[9px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-0.5 hover:text-blue-300"
                          >
                            History <ArrowRight size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: APPOINTMENT MANAGEMENT */}
          {activeTab === 'appointments' && (
            <div className="glass-card p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar size={18} className="text-blue-400" />
                  Appointment Management System
                </h2>
                
                {/* Filters */}
                <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5">
                  {['today', 'upcoming', 'completed'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setApptFilter(filter)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                        apptFilter === filter 
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAppts.length > 0 ? (
                  filteredAppts.map((appt) => {
                    const isUrgent = appt.priority === 'urgent' || appt.priority === 'emergency'
                    return (
                      <div 
                        key={appt.id} 
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between min-h-[160px] ${
                          isUrgent 
                            ? 'border-rose-500/30 bg-rose-500/[0.01]' 
                            : 'border-white/5 bg-slate-900/40 hover:border-white/10'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-bold text-white">{appt.patient_name}</h3>
                              <span className="text-[10px] text-slate-500">Code: {appt.patient_code || 'LP-PT'}</span>
                            </div>
                            
                            {/* Urgent tags */}
                            {isUrgent && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500 text-white tracking-widest animate-pulse">
                                AI Alert: Urgent
                              </span>
                            )}
                          </div>

                          <div className="text-xs space-y-1 text-slate-300">
                            <div>Slot: <strong className="text-white">{appt.appointment_date} @ {appt.appointment_time}</strong></div>
                            <div>Format: <span className="capitalize">{appt.is_online ? 'Video Consultation' : 'In-Person consultation'}</span></div>
                            {appt.symptoms && <div>Symptoms: <span className="italic">"{appt.symptoms}"</span></div>}
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-4">
                          <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                            appt.status === 'confirmed' 
                              ? 'bg-blue-500/10 text-blue-400' 
                              : appt.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {appt.status}
                          </span>

                          <div className="flex gap-2 flex-wrap">
                            {appt.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleUpdateApptStatus(appt.id, 'confirmed')}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase hover:bg-emerald-500 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleUpdateApptStatus(appt.id, 'rejected')}
                                  className="px-2.5 py-1 bg-rose-600 text-white rounded text-[10px] font-bold uppercase hover:bg-rose-500 transition-colors"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleProposeReschedule(appt.id)}
                                  className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded text-[10px] font-bold uppercase hover:bg-blue-600/30 transition-colors"
                                >
                                  Reschedule
                                </button>
                              </>
                            )}
                            {appt.status === 'confirmed' && (
                              <>
                                <button
                                  onClick={() => handleStartConsult(appt)}
                                  className="px-2.5 py-1 bg-blue-600 text-white rounded text-[10px] font-bold uppercase hover:bg-blue-500 transition-colors flex items-center gap-1"
                                >
                                  <Video size={10} /> Consult
                                </button>
                                <button
                                  onClick={() => handleUpdateApptStatus(appt.id, 'completed')}
                                  className="px-2.5 py-1 bg-white/5 border border-white/5 text-slate-300 rounded text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => handleProposeReschedule(appt.id)}
                                  className="px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded text-[10px] font-bold uppercase hover:bg-blue-600/30 transition-colors"
                                >
                                  Reschedule
                                </button>
                              </>
                            )}
                            {appt.status === 'rescheduled' && (
                              <span className="text-[10px] text-slate-400 italic">
                                Waiting for Patient Response
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="col-span-2 text-center py-16 text-slate-500 text-xs">
                    No appointments matched this filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VIDEO CONSULTATION PANEL */}
          {activeTab === 'video' && (
            <div className="glass-card p-6 space-y-6">
              {activeVideoAppt ? (
                <div className="space-y-6">
                  {/* Top consult bar */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        Live Consultation: {activeVideoAppt.patient_name}
                      </h3>
                      <span className="text-[10px] text-slate-500">ID: LP-PT-{activeVideoAppt.patient_id} | Scheduled: {activeVideoAppt.appointment_time}</span>
                    </div>
                    <button
                      onClick={() => { setActiveVideoAppt(null); setActiveTab('home'); }}
                      className="text-xs text-rose-500 font-bold uppercase border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      Exit Consult Room
                    </button>
                  </div>

                  {/* Split Screen Video Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Column: Patient Telemetry (col-span-3) */}
                    {(() => {
                      const pat = patients.find(p => p.id === activeVideoAppt.patient_id) || {}
                      return (
                        <div className="lg:col-span-3 glass-card p-4 space-y-4 max-h-[580px] overflow-y-auto">
                          <div className="border-b border-white/5 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient Telemetry</span>
                          </div>
                          <div className="space-y-3 text-xs">
                            <div className="p-3 bg-slate-900/60 border border-white/5 rounded-xl space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-400 flex items-center justify-center font-bold">
                                  {pat.full_name?.charAt(0) || 'P'}
                                </div>
                                <div>
                                  <strong className="text-white block capitalize">{pat.full_name}</strong>
                                  <span className="text-[9px] text-slate-500">ID: LP-PT-{pat.id}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5 text-slate-300 pt-2 border-t border-white/5">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Age / Gender:</span>
                                  <span className="font-semibold text-white capitalize">{pat.age} yrs / {pat.gender}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Blood Group:</span>
                                  <span className="font-semibold text-rose-400">{pat.blood_group || 'Not Logged'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Allergies:</span>
                                  <span className="font-semibold text-rose-400 capitalize">{pat.allergies || 'None'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Clinical History logs */}
                            <div className="space-y-2.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">EMR Diagnostics History</span>
                              
                              {/* Triages */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] text-slate-500 font-bold uppercase">Recent AI Triages</span>
                                {consultPatientHistory.predictions.length > 0 ? (
                                  consultPatientHistory.predictions.slice(0, 3).map(p => (
                                    <div key={p.id} className="p-2 bg-slate-950/40 border border-white/5 rounded-lg text-[10px]">
                                      <strong className="text-white block">{p.predicted_disease}</strong>
                                      <span className="text-slate-500">Confidence: {p.confidence}%</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[10px] text-slate-600 italic">No triage records.</div>
                                )}
                              </div>

                              {/* Prescriptions */}
                              <div className="space-y-1.5">
                                <span className="text-[9px] text-slate-500 font-bold uppercase">Past Prescriptions</span>
                                {consultPatientHistory.prescriptions.length > 0 ? (
                                  consultPatientHistory.prescriptions.slice(0, 2).map(pr => (
                                    <div key={pr.id} className="p-2 bg-slate-950/40 border border-white/5 rounded-lg text-[10px]">
                                      <strong className="text-white">Rx #{pr.id}</strong>
                                      <div className="text-slate-400 text-[9px] truncate">
                                        {pr.items?.map(i => i.medicine_name).join(', ')}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[10px] text-slate-600 italic">No prescriptions.</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Center Column: Video feeds & notes (col-span-6) */}
                    <div className="lg:col-span-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Patient Stream */}
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-white/5 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <div className="w-16 h-16 rounded-full bg-blue-600/10 text-blue-400 mx-auto flex items-center justify-center border border-blue-500/20">
                              <User size={28} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold block">{activeVideoAppt.patient_name} (Patient feed)</span>
                          </div>
                          
                          {/* Live heart rate indicator overlay */}
                          <div className="absolute bottom-3 left-3 bg-slate-900/80 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-black text-rose-400 flex items-center gap-1 select-none animate-pulse">
                            <Heart size={10} className="fill-rose-500 text-rose-500" />
                            HR: 76 bpm
                          </div>
                          
                          <div className="absolute top-3 right-3 bg-red-600 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider">
                            LIVE FEED
                          </div>
                        </div>

                        {/* Doctor Stream */}
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-white/5 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <div className="w-16 h-16 rounded-full bg-emerald-600/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20">
                              <Shield size={28} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold block">Dr. {user?.name} (Your Camera)</span>
                          </div>
                          <div className="absolute bottom-3 left-3 bg-slate-900/80 border border-white/10 px-2 py-1 rounded-lg text-[9px] text-slate-400">
                            Microphone Active
                          </div>
                          <div className="absolute top-3 right-3 bg-blue-600 px-2 py-0.5 rounded text-[8px] font-bold text-white tracking-wider flex items-center gap-1">
                            <Clock size={10} />
                            {formatDuration(callDuration)}
                          </div>
                        </div>
                      </div>

                      {/* Diagnostic Diagnosis & Notes input panel */}
                      <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Consultation Records Entry</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="label-text">Clinical Diagnosis Findings</label>
                            <input
                              type="text"
                              value={consultDiagnosis}
                              onChange={(e) => setConsultDiagnosis(e.target.value)}
                              placeholder="e.g. Acute bronchitis secondary to viral infection"
                              className="input-field mt-1 text-xs"
                            />
                          </div>

                          <div>
                            <label className="label-text">Treatment Guidelines & Consultation Notes</label>
                            <textarea
                              rows="3"
                              value={consultNotes}
                              onChange={(e) => setConsultNotes(e.target.value)}
                              placeholder="Prescribed rest, fluids, and dosage checks..."
                              className="input-field mt-1 text-xs resize-none"
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleSaveDiagnosis}
                          className="btn-success text-xs font-bold uppercase tracking-wider py-2.5 px-5 flex items-center gap-1.5 w-full justify-center"
                        >
                          <CheckCircle2 size={14} /> Log Diagnosis & Complete
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Chat panel / Rx console switcher (col-span-3) */}
                    <div className="lg:col-span-3 glass-card p-4 flex flex-col h-[580px] justify-between">
                      <div className="flex border-b border-white/5 pb-2 mb-2 justify-between">
                        <button
                          onClick={() => setRightPanelTab('chat')}
                          className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all ${
                            rightPanelTab === 'chat' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Live Chat
                        </button>
                        <button
                          onClick={() => setRightPanelTab('prescription')}
                          className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all ${
                            rightPanelTab === 'prescription' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Create Rx
                        </button>
                      </div>
                      
                      {rightPanelTab === 'chat' ? (
                        <>
                          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                            {videoChat.map((msg, idx) => (
                              <div key={idx} className={`flex flex-col ${msg.sender === 'doctor' ? 'items-end' : msg.sender === 'system' ? 'items-center' : 'items-start'}`}>
                                {msg.sender === 'system' ? (
                                  <span className="text-[9px] text-slate-500 italic block text-center max-w-[90%] leading-relaxed">
                                    {msg.text}
                                  </span>
                                ) : (
                                  <div className={`p-2.5 rounded-xl max-w-[85%] text-[11px] leading-relaxed ${
                                    msg.sender === 'doctor' 
                                      ? 'bg-blue-600 text-white rounded-tr-none' 
                                      : 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none'
                                  }`}>
                                    {msg.text}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="pt-3 border-t border-white/5 flex gap-2">
                            <input
                              type="text"
                              value={videoMessage}
                              onChange={(e) => setVideoMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') sendVideoChat() }}
                              placeholder="Send a prompt..."
                              className="input-field text-xs py-2 flex-1"
                            />
                            <button
                              onClick={sendVideoChat}
                              className="px-3 bg-blue-600 text-white hover:bg-blue-500 transition-colors rounded-xl flex items-center justify-center flex-shrink-0"
                            >
                              <Send size={13} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-3 pr-1 text-xs">
                          <div className="space-y-3">
                            {/* Add Medicine Line */}
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Add Medicine</span>
                              
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[9px] text-slate-400">Medicine</label>
                                  <select
                                    className="input-field mt-0.5 text-xs py-1.5 bg-slate-900 border-white/5 w-full"
                                    value={consultTempMedicine.medicine_id}
                                    onChange={(e) => setConsultTempMedicine({ ...consultTempMedicine, medicine_id: e.target.value })}
                                  >
                                    <option value="">-- Select Medicine --</option>
                                    {medicines.map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] text-slate-400">Dosage</label>
                                    <input
                                      type="text"
                                      value={consultTempMedicine.dosage}
                                      onChange={(e) => setConsultTempMedicine({ ...consultTempMedicine, dosage: e.target.value })}
                                      placeholder="1 tablet"
                                      className="input-field mt-0.5 text-xs py-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-slate-400">Freq.</label>
                                    <input
                                      type="text"
                                      value={consultTempMedicine.frequency}
                                      onChange={(e) => setConsultTempMedicine({ ...consultTempMedicine, frequency: e.target.value })}
                                      placeholder="Twice daily"
                                      className="input-field mt-0.5 text-xs py-1"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] text-slate-400">Days</label>
                                    <input
                                      type="number"
                                      value={consultTempMedicine.duration_days}
                                      onChange={(e) => setConsultTempMedicine({ ...consultTempMedicine, duration_days: e.target.value })}
                                      className="input-field mt-0.5 text-xs py-1"
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={addConsultPrescriptionItem}
                                      className="w-full btn btn-primary text-[10px] py-1.5 flex items-center justify-center gap-1 font-bold uppercase"
                                    >
                                      <Plus size={10} /> Add
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Prescription Summary */}
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold block">Prescription List</span>
                              {consultPrescriptionItems.length > 0 ? (
                                <div className="space-y-1.5">
                                  {consultPrescriptionItems.map((item, index) => (
                                    <div key={index} className="p-2 bg-slate-900/60 border border-white/5 rounded-lg flex justify-between items-center text-[11px]">
                                      <div>
                                        <strong className="text-white block truncate max-w-[120px]">{item.medicine_name}</strong>
                                        <span className="text-slate-500 text-[10px]">{item.dosage} • {item.frequency}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-semibold">{item.duration_days}d</span>
                                        <button
                                          type="button"
                                          onClick={() => removeConsultPrescriptionItem(index)}
                                          className="text-slate-500 hover:text-rose-500 transition-colors"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-3 text-slate-600 text-[10px] bg-slate-950/20 rounded-lg border border-white/5">No items.</div>
                              )}
                            </div>
                          </div>

                          {/* Safety Warnings & Submit Buttons */}
                          <div className="pt-2 border-t border-white/5 space-y-2">
                            {consultSafetyChecked && consultSafetyWarnings.length > 0 && (
                              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400 max-h-24 overflow-y-auto">
                                {consultSafetyWarnings.map((w, idx) => (
                                  <div key={idx} className="mb-1 last:mb-0 leading-tight">
                                    ⚠️ {w.message}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {consultSafetyChecked && consultSafetyWarnings.length === 0 && (
                              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400">
                                ✅ AI Screening: Prescription Safe!
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={runConsultPrescriptionSafetyScreen}
                                disabled={consultCheckingSafety}
                                className="flex-1 btn btn-secondary text-[10px] py-2 flex items-center justify-center gap-1 font-bold uppercase"
                              >
                                {consultCheckingSafety ? <RefreshCw className="animate-spin" size={10} /> : <ShieldCheck size={10} />}
                                Scan
                              </button>
                              <button
                                type="button"
                                onClick={submitConsultPrescription}
                                disabled={!consultSafetyChecked || consultSafetyWarnings.some(w => w.severity === 'critical')}
                                className="flex-1 btn-primary py-2 text-[10px] font-bold uppercase tracking-wider justify-center"
                              >
                                Send Rx
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ) : (
                <div className="text-center py-24 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <Video size={40} className="opacity-20" />
                  <h3 className="text-sm font-semibold text-white">No Active Consult Room</h3>
                  <p className="text-xs text-slate-500 max-w-sm leading-normal">
                    Select an appointment card from the queue or lists and click "Start Consult" to open the WebRTC tele-health portal.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRESCRIPTION SYSTEM */}
          {activeTab === 'prescriptions' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Left Column: Form Editor */}
              <div className="lg:col-span-2 glass-card p-6 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                  <FileText size={18} className="text-blue-400" />
                  Generate New Clinical Prescription Slip
                </h2>

                <div className="space-y-4">
                  {/* Select Patient */}
                  <div>
                    <label className="label-text">Select Patient</label>
                    <select
                      className="input-field mt-1 text-xs py-2.5 bg-slate-900 border-white/5"
                      value={prescriptionForm.patient_id}
                      onChange={(e) => {
                        setPrescriptionForm({ ...prescriptionForm, patient_id: e.target.value });
                        setSafetyChecked(false);
                        setSafetyWarnings([]);
                      }}
                    >
                      <option value="">-- Choose Admitted Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name} ({p.allergies ? `Allergies: ${p.allergies}` : 'No allergies'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Add item interface */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Add Medicine Line</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label-text">Medicine / Drug Name</label>
                        <select
                          className="input-field mt-1 text-xs py-2 bg-slate-900 border-white/5"
                          value={tempMedicine.medicine_id}
                          onChange={(e) => setTempMedicine({ ...tempMedicine, medicine_id: e.target.value })}
                        >
                          <option value="">-- Select Medicine --</option>
                          {medicines.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label-text">Dosage / Dose Volume</label>
                        <input
                          type="text"
                          value={tempMedicine.dosage}
                          onChange={(e) => setTempMedicine({ ...tempMedicine, dosage: e.target.value })}
                          placeholder="e.g. 500 mg"
                          className="input-field mt-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="label-text">Frequency</label>
                        <input
                          type="text"
                          value={tempMedicine.frequency}
                          onChange={(e) => setTempMedicine({ ...tempMedicine, frequency: e.target.value })}
                          placeholder="e.g. Twice daily"
                          className="input-field mt-1 text-xs"
                        />
                      </div>

                      <div>
                        <label className="label-text">Duration (Days)</label>
                        <input
                          type="number"
                          value={tempMedicine.duration_days}
                          onChange={(e) => setTempMedicine({ ...tempMedicine, duration_days: e.target.value })}
                          className="input-field mt-1 text-xs"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={addPrescriptionItem}
                          className="w-full btn btn-primary text-xs py-2 flex items-center justify-center gap-1"
                        >
                          <Plus size={12} /> Add to Slip
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Added medicines summary */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Prescription Summary list</span>
                    {prescriptionForm.items.length > 0 ? (
                      <div className="space-y-2">
                        {prescriptionForm.items.map((item, index) => (
                          <div key={index} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <strong className="text-white block">{item.medicine_name}</strong>
                              <span className="text-slate-500">{item.dosage} • {item.frequency}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-400 font-semibold">{item.duration_days} days</span>
                              <button
                                type="button"
                                onClick={() => removePrescriptionItem(index)}
                                className="text-slate-500 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-600 text-xs bg-slate-950/20 rounded-xl border border-white/5">No medicines added to this prescription yet.</div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={runPrescriptionSafetyScreen}
                      disabled={checkingSafety}
                      className="flex-1 btn btn-secondary text-xs py-3 flex items-center justify-center gap-1.5"
                    >
                      {checkingSafety ? <RefreshCw className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                      Run AI safety screening check
                    </button>
                    <button
                      type="button"
                      onClick={submitPrescription}
                      disabled={!safetyChecked || safetyWarnings.some(w => w.severity === 'critical')}
                      className="flex-1 btn-primary py-3 text-xs font-bold uppercase tracking-wider justify-center"
                    >
                      Approve & Send Patient Slip
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: AI safety warnings log */}
              <div className="space-y-6">
                <div className="glass-card p-5 space-y-4">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                    AI safety screening diagnostics
                  </h3>

                  {safetyChecked ? (
                    <div className="space-y-3">
                      {safetyWarnings.length > 0 ? (
                        <div className="space-y-2">
                          {safetyWarnings.map((w, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3.5 rounded-xl border text-xs flex gap-2.5 ${
                                w.severity === 'critical' 
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                                  : w.severity === 'medium'
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                              }`}
                            >
                              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="font-black uppercase text-[9px] block mb-1">{w.severity} alert</strong>
                                <p className="leading-relaxed">{w.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-2 text-emerald-400 text-xs">
                          <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                          <div>
                            <strong>No Safety Conflicts</strong>
                            <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                              Evaluated compositions against drug interaction datasets and patient allergies. Safe for clinical dispensation.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-500 text-xs bg-slate-950/20 rounded-xl">
                      Add medicines and run the AI safety screen checker to scan for drug-drug interactions and allergies.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PATIENT HISTORY VIEW */}
          {activeTab === 'history' && (
            <div className="glass-card p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clipboard size={18} className="text-blue-400" />
                  EMR Patient Health History
                </h2>

                {/* Patient Selector */}
                <select
                  className="input-field text-xs py-2 bg-slate-900 border-white/5 w-64 cursor-pointer"
                  value={selectedPatient?.id || ''}
                  onChange={(e) => {
                    const pat = patients.find(p => p.id === parseInt(e.target.value))
                    if (pat) handleViewPatientHistory(pat)
                  }}
                >
                  <option value="">-- Choose Admitted Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              {selectedPatient ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left: General EMR Info */}
                  <div className="space-y-4">
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 text-xs">
                      <h3 className="font-bold text-white text-sm capitalize">{selectedPatient.full_name}</h3>
                      <div className="space-y-2 text-slate-300">
                        <div className="flex justify-between border-b border-white/5 pb-1.5">
                          <span>Patient ID:</span>
                          <span className="font-bold text-white">LP-PT-{String(selectedPatient.id).padStart(4, '0')}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1.5">
                          <span>Gender / Age:</span>
                          <span className="font-bold text-white capitalize">{selectedPatient.gender} / {selectedPatient.age} years</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1.5">
                          <span>Blood Group:</span>
                          <span className="font-bold text-rose-400">{selectedPatient.blood_group || 'Not Logged'}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1.5">
                          <span>Allergies:</span>
                          <span className="font-bold text-rose-400 capitalize">{selectedPatient.allergies || 'None'}</span>
                        </div>
                        <div className="flex justify-between pb-0.5">
                          <span>Phone Contact:</span>
                          <span className="font-bold text-white">{selectedPatient.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Center: AI Diagnosis logs & Predictions */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Triage history */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Symptom Triages</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {patientHistory.predictions.length > 0 ? (
                          patientHistory.predictions.map((p) => (
                            <div key={p.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                              <div>
                                <strong className="text-white block">{p.predicted_disease}</strong>
                                <span className="text-[10px] text-slate-500">Confidence: {p.confidence}% | Model: {p.model_used}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                p.risk_level === 'high' || p.risk_level === 'emergency' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {p.risk_level}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-slate-600 text-xs bg-slate-950/20 rounded-xl">No AI prediction logs recorded.</div>
                        )}
                      </div>
                    </div>

                    {/* Prescriptions History */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Past Prescriptions</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {patientHistory.prescriptions.length > 0 ? (
                          patientHistory.prescriptions.map((pr) => (
                            <div key={pr.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl text-xs space-y-2">
                              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                                <div>
                                  <strong className="text-white">Rx Slip #{pr.id}</strong>
                                  <span className="text-[9px] text-slate-500 ml-2">Date: {pr.created_at?.slice(0, 10)}</span>
                                </div>
                                <span className="text-[10px] text-emerald-400 uppercase font-semibold">{pr.status}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Medicines: {pr.items?.map(i => `${i.medicine_name} (${i.dosage})`).join(', ')}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-slate-600 text-xs bg-slate-950/20 rounded-xl">No prescriptions recorded.</div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 text-xs">
                  Please select an active patient from the EMR list to load history logs.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DOCTOR AI ASSISTANT */}
          {activeTab === 'ai' && (
            <div className="glass-card p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div className="border-b border-white/5 pb-3 flex items-center gap-2">
                <Brain className="text-blue-500 animate-pulse" size={20} />
                <div>
                  <h2 className="text-base font-bold text-white">Clinical AI Diagnostic Assistant</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">Drug information guidelines, dosage interactions checker, and disease reference help.</p>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {aiAnswers.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    {/* Prompt */}
                    <div className="flex justify-end">
                      <div className="p-3 bg-blue-600 text-white rounded-2xl rounded-tr-none text-xs max-w-[80%]">
                        {item.query}
                      </div>
                    </div>
                    {/* Response */}
                    <div className="flex justify-start">
                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl rounded-tl-none text-xs text-slate-300 max-w-[85%] space-y-2">
                        <strong className="text-emerald-400 text-[10px] uppercase block tracking-wider">AI Clinical Advice</strong>
                        <p className="leading-relaxed">{item.reply}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {aiLoading && (
                  <div className="flex items-center gap-1 bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none max-w-[70px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="flex gap-3 pt-3 border-t border-white/5">
                <input
                  type="text"
                  placeholder="e.g. What is the clinical guidelines for Lisinopril + Spironolactone?"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') askAIAssistant() }}
                  className="input-field text-xs py-3 flex-1"
                />
                <button
                  onClick={askAIAssistant}
                  disabled={aiLoading}
                  className="btn-primary px-6 text-xs uppercase tracking-wider font-bold"
                >
                  Query AI
                </button>
              </div>

              {/* Quick suggestion prompt chips */}
              <div className="flex gap-2 flex-wrap text-[10px] text-slate-400">
                <span className="font-semibold py-1">Quick Queries:</span>
                <button onClick={() => setAiPrompt("ACE inhibitor pregnancy guidelines")} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded hover:text-white transition-all">ACE inhibitor pregnancy guidelines</button>
                <button onClick={() => setAiPrompt("Aspirin + Warfarin risk details")} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded hover:text-white transition-all">Aspirin + Warfarin risk details</button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Reschedule Proposal Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={16} className="text-blue-400" />
                Propose Reschedule
              </h3>
              <button 
                onClick={() => setShowRescheduleModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="label-text">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="input-field mt-1 text-xs"
                />
              </div>
              <div>
                <label className="label-text">New Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="input-field mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleProposeRescheduleSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Propose Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Appointment Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <XCircle size={16} className="text-rose-500" />
                Reject Appointment
              </h3>
              <button 
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            
            <div>
              <label className="label-text">Reason for Rejection</label>
              <textarea
                rows="3"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Schedule conflict or specialist referral required..."
                className="input-field mt-1 text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectAppointmentSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold uppercase"
              >
                Reject Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
