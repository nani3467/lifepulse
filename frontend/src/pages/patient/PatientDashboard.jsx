import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity, Calendar, Heart, ShieldAlert, FileText, Sparkles, Droplet, User, ArrowRight,
  Brain, Clock, ShieldCheck, Thermometer
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { patientApi } from '@/services/patientApi'
import { predictionApi } from '@/services/predictionApi'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Dashboard States
  const [patient, setPatient] = useState(null)
  const [lastPrediction, setLastPrediction] = useState(null)
  const [latestVitals, setLatestVitals] = useState(null)
  const [vitalsLogs, setVitalsLogs] = useState([])
  const [latestScan, setLatestScan] = useState(null)
  const [healthScans, setHealthScans] = useState([])
  const [computedVitals, setComputedVitals] = useState(null) // aggregated best-values across all scans
  const [upcomingAppt, setUpcomingAppt] = useState(null)
  const [history, setHistory] = useState([])
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sosLoading, setSosLoading] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 1. Fetch patient profile associated with logged-in user
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user
      
      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(
        p => p.email?.toLowerCase() === loggedUser.email?.toLowerCase()
      ) || patientsRes.patients[0]
      
      if (linkedPatient) {
        setPatient(linkedPatient)
        
        // 2. Fetch last prediction history for this patient
        const { data: predRes } = await predictionApi.getHistory({ patient_id: linkedPatient.id })
        const predHistory = predRes.history || []
        setHistory(predHistory)
        if (predHistory.length > 0) {
          setLastPrediction(predHistory[0])
        }

        // 3. Fetch appointments
        const { data: apptRes } = await api.get('/appointments')
        const apptList = apptRes.appointments || []
        setAppointments(apptList)
        if (apptList.length > 0) {
          const upcoming = apptList.find(a => a.status === 'confirmed' || a.status === 'pending')
          setUpcomingAppt(upcoming || apptList[0])
        }

        // 4. Fetch prescriptions
        const { data: prescRes } = await api.get('/pharmacy/prescriptions')
        setPrescriptions(prescRes.prescriptions || [])

        // 5. Fetch latest health scans + compute aggregated vitals
        try {
          const { data: scansRes } = await patientApi.getHealthScans(linkedPatient.id)
          const scans = scansRes.scans || []
          setHealthScans(scans)
          if (scans.length > 0) {
            setLatestScan(scans[0])
            
            // Aggregate: find the latest non-null value for each metric across all scans
            const metricsToAggregate = [
              'heart_rate', 'hrv', 'spo2', 'respiratory_rate',
              'stress_score', 'stress_level', 'recovery_score', 'health_score',
              'systolic_bp', 'diastolic_bp', 'bp_category',
              'fatigue_level', 'alertness_score',
              'bmi', 'weight_category', 'height', 'weight'
            ]
            const aggregated = {}
            for (const key of metricsToAggregate) {
              // scans are ordered desc by created_at, so first non-null is the latest
              const scanWithValue = scans.find(s => s[key] !== null && s[key] !== undefined)
              aggregated[key] = scanWithValue ? scanWithValue[key] : null
            }
            setComputedVitals(aggregated)
          }
        } catch (scansErr) {
          console.error('Error fetching health scans:', scansErr)
        }

        // 6. Fetch latest vitals logs
        try {
          const { data: vitalsRes } = await patientApi.getVitalsLogs(linkedPatient.id)
          const logs = vitalsRes.logs || []
          setVitalsLogs(logs)
          if (logs.length > 0) {
            setLatestVitals(logs[0])
          }
        } catch (vitalsErr) {
          console.error('Error fetching vitals logs:', vitalsErr)
        }
      }
    } catch (err) {
      console.error('Error fetching patient dashboard records:', err)
    } finally {
      setLoading(false)
    }
  }

  // Trigger SOS Emergency Alert
  const handleSOSAlert = async () => {
    if (!patient) return toast.error('Patient profile not linked yet')
    
    if (!window.confirm('WARNING: You are triggering a critical ICU Telemetry Emergency Alert. This will notify medical officers immediately. Proceed?')) {
      return
    }

    setSosLoading(true)
    try {
      const payload = {
        patient_id: patient.id,
        heart_rate: 155, // Critical tachycardia
        oxygen_level: 82, // Critical hypoxia
        temperature: 103.5, // High hyperpyrexia
        systolic_bp: 210, // Hypertensive crisis
        diastolic_bp: 120
      }
      
      const { data } = await api.post('/emergency/evaluate', payload)
      if (data.evaluation && data.evaluation.alert_logged) {
        toast.error('🚨 SOS CRITICAL TELEMETRY DISPATCHED! Ambulance dispatch simulated and medical team notified.', {
          duration: 6000,
          position: 'top-center',
          style: {
            background: '#f43f5e',
            color: '#fff',
            fontWeight: 'bold',
            border: '2px solid #ef4444'
          }
        })
      } else {
        toast.success('Emergency alert sent.')
      }
    } catch (err) {
      toast.error('SOS transmission failure: ' + (err.response?.data?.error || err.message))
    } finally {
      setSosLoading(false)
    }
  }

  // Helper values for vitals cards
  const getHeartRateInfo = (hr) => {
    if (hr >= 60 && hr <= 100) return { label: 'Normal', color: 'text-emerald-400' }
    if (hr < 60) return { label: 'Low', color: 'text-sky-400' }
    if (hr > 100 && hr <= 120) return { label: 'Elevated', color: 'text-amber-400' }
    return { label: 'High', color: 'text-rose-500 animate-pulse' }
  }

  const getHRVInfo = (hrv) => {
    if (hrv > 70) return { label: 'Excellent Recovery', color: 'text-emerald-400' }
    if (hrv >= 50) return { label: 'Good Recovery', color: 'text-teal-400' }
    if (hrv >= 30) return { label: 'Moderate Recovery', color: 'text-amber-400' }
    return { label: 'Poor Recovery', color: 'text-rose-500 animate-pulse' }
  }

  const getSpO2Info = (spo2) => {
    if (spo2 >= 95) return { label: 'Normal', color: 'text-emerald-400' }
    if (spo2 >= 90) return { label: 'Warning', color: 'text-amber-400' }
    return { label: 'Critical', color: 'text-rose-500 animate-pulse' }
  }

  const getHealthScoreInfo = (score) => {
    if (score >= 85) return { label: 'Excellent Health', color: 'text-emerald-400' }
    if (score >= 70) return { label: 'Good Health', color: 'text-teal-400' }
    if (score >= 50) return { label: 'Fair Health', color: 'text-amber-400' }
    return { label: 'Poor Health', color: 'text-rose-500 animate-pulse' }
  }

  // Chronological timeline construction
  const timelineItems = []

  healthScans.forEach(s => {
    timelineItems.push({
      id: `scan-${s.scan_id}`,
      date: new Date(s.created_at),
      type: 'health_scan',
      title: 'AI Health Scan Completed',
      desc: `Heart Rate: ${s.heart_rate} BPM | HRV: ${s.hrv} ms | SpO2: ${s.spo2}% | Respiratory Rate: ${s.respiratory_rate} breaths/min | Health Score: ${s.health_score}/100`,
      icon: Activity,
      color: 'text-blue-400 bg-blue-500/10'
    })
  })

  vitalsLogs.forEach(v => {
    timelineItems.push({
      id: `vitals-${v.id}`,
      date: new Date(v.created_at),
      type: 'vitals',
      title: 'Health Assessment Updated',
      desc: `Heart Rate: ${v.heart_rate} bpm | Blood Pressure: ${v.systolic_bp}/${v.diastolic_bp} | Oxygen Saturation: ${v.oxygen_level}% | Diabetes Risk: ${v.diabetes_risk || 'Low Risk'}`,
      icon: Activity,
      color: 'text-emerald-400 bg-emerald-500/10'
    })
  })

  history.forEach(h => {
    timelineItems.push({
      id: `pred-${h.id}`,
      date: new Date(h.created_at),
      type: 'prediction',
      title: `AI Triage: ${h.predicted_disease}`,
      desc: `Evaluated using ${h.model_used} (${h.confidence}% confidence). Referral: ${h.recommended_dept}.`,
      risk: h.risk_level,
      icon: Brain,
      color: 'text-blue-400 bg-blue-500/10'
    })
  })

  appointments.forEach(a => {
    timelineItems.push({
      id: `appt-${a.id}`,
      date: new Date(a.appointment_date + 'T' + (a.appointment_time?.split(' - ')[0] || '10:00')),
      type: 'appointment',
      title: `Consultation: Dr. ${a.doctor_name || 'Staff'}`,
      desc: `Department: ${a.department_name}. Consultation type: ${a.consultation_type}. Status: ${a.status}.`,
      icon: Calendar,
      color: 'text-purple-400 bg-purple-500/10'
    })
  })

  prescriptions.forEach(p => {
    timelineItems.push({
      id: `presc-${p.id}`,
      date: new Date(p.created_at),
      type: 'prescription',
      title: `Prescription #${p.id} Issued`,
      desc: `Contains ${p.items?.length || 0} medications. Approved safety screen status.`,
      icon: FileText,
      color: 'text-emerald-400 bg-emerald-500/10'
    })
  })

  // Sort descending
  timelineItems.sort((a, b) => b.date - a.date)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-card p-6 bg-gradient-to-r from-blue-600/10 via-cyan-500/5 to-slate-900 border-blue-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wider uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg">
            Patient Portal Home
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name}!</h1>
          <p className="text-slate-400 text-sm">
            {patient ? `Patient ID: LP-PT-${String(patient.id).padStart(4, '0')} | ` : ''}Manage bookings, AI symptom checkers, e-medicine orders and medical records.
          </p>
        </div>

        {/* SOS Emergency Button */}
        <button
          onClick={handleSOSAlert}
          disabled={sosLoading}
          className="btn-danger animate-pulse py-3 px-6 text-sm font-black tracking-wide uppercase flex items-center gap-2 flex-shrink-0"
          style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)' }}
        >
          <ShieldAlert size={18} />
          {sosLoading ? 'Transmitting SOS...' : 'Emergency SOS (Triage Alert)'}
        </button>
      </div>

      {/* 12-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Vitals Overview & Timeline (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Dashboard Alert - show only if NO scan records exist at all */}
          {!computedVitals && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <p className="text-xs text-slate-300">
                  ⚠ You have not completed your health assessment. Complete Track Your Health to view personalized health metrics.
                </p>
              </div>
              <button
                onClick={() => navigate('/patient/track-health')}
                className="btn btn-primary py-1.5 px-4 text-xs font-bold uppercase tracking-wider flex-shrink-0"
              >
                Go to Track Your Health
              </button>
            </div>
          )}

          {/* Active Health Alerts Section */}
          {computedVitals && (
            (computedVitals.heart_rate > 100 || (computedVitals.spo2 !== null && computedVitals.spo2 < 95) || (computedVitals.stress_score !== null && computedVitals.stress_score >= 70))
          ) && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-500 animate-pulse" />
                Active Health Alerts
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {computedVitals.heart_rate > 100 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3.5 text-xs text-rose-400 animate-pulse shadow-sm">
                    <span className="text-lg">⚠</span>
                    <div>
                      <strong className="font-bold">Elevated Heart Rate Detected</strong>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Your heart rate is currently {computedVitals.heart_rate} BPM. We advise limiting intense physical activities and avoiding stimulants.
                      </p>
                    </div>
                  </div>
                )}
                {computedVitals.spo2 !== null && computedVitals.spo2 < 95 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3.5 text-xs text-rose-400 animate-pulse shadow-sm">
                    <span className="text-lg">🚨</span>
                    <div>
                      <strong className="font-bold">Low Oxygen Saturation Detected</strong>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Oxygen saturation level is currently {computedVitals.spo2}%. If symptoms of breathlessness persist, please consult a healthcare professional.
                      </p>
                    </div>
                  </div>
                )}
                {computedVitals.stress_score !== null && computedVitals.stress_score >= 70 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3.5 text-xs text-rose-400 animate-pulse shadow-sm">
                    <span className="text-lg">⚠</span>
                    <div>
                      <strong className="font-bold">High Stress Level Detected</strong>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Calculated stress is high ({computedVitals.stress_score}%). Consider performing diaphragmatic breathing exercises and scheduling rest.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Health Overview Cards (Vitals Grid) */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={16} className="text-blue-400" />
              Health Vitals Overview
            </h2>
            
            {computedVitals ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Heart Rate */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Heart Rate</span>
                      <Heart className={`text-rose-500 ${computedVitals.heart_rate ? 'animate-pulse' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.heart_rate !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.heart_rate} <span className="text-[10px] font-normal text-slate-500">BPM</span>
                          </div>
                          <div className={`text-[10px] font-bold ${getHeartRateInfo(computedVitals.heart_rate).color}`}>
                            {getHeartRateInfo(computedVitals.heart_rate).label}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Pending Scan</div>
                      )}
                    </div>
                  </div>

                  {/* HRV */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">HRV</span>
                      <Activity className={`text-blue-400 ${computedVitals.hrv ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.hrv !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.hrv} <span className="text-[10px] font-normal text-slate-500">ms</span>
                          </div>
                          <div className={`text-[10px] font-bold ${getHRVInfo(computedVitals.hrv).color}`}>
                            {getHRVInfo(computedVitals.hrv).label}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Pending Scan</div>
                      )}
                    </div>
                  </div>

                  {/* Oxygen Saturation */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Oxygen SpO2</span>
                      <Droplet className={`text-cyan-400 ${computedVitals.spo2 ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.spo2 !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.spo2} <span className="text-[10px] font-normal text-slate-500">%</span>
                          </div>
                          <div className={`text-[10px] font-bold ${getSpO2Info(computedVitals.spo2).color}`}>
                            {getSpO2Info(computedVitals.spo2).label}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Pending Scan</div>
                      )}
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Health Score</span>
                      <Brain className={`text-purple-400 ${computedVitals.health_score ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.health_score !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.health_score} <span className="text-[10px] font-normal text-slate-500">/100</span>
                          </div>
                          <div className={`text-[10px] font-bold ${getHealthScoreInfo(computedVitals.health_score).color}`}>
                            {getHealthScoreInfo(computedVitals.health_score).label}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Calculate After Scans</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Second row: BP, Respiratory, Stress, BMI */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Blood Pressure */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Blood Pressure</span>
                      <Activity className={`text-amber-500 ${computedVitals.systolic_bp ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.systolic_bp !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.systolic_bp}/{computedVitals.diastolic_bp}
                          </div>
                          <div className="text-[10px] font-bold text-amber-400">{computedVitals.bp_category || 'N/A'}</div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Pending Scan</div>
                      )}
                    </div>
                  </div>

                  {/* Respiratory Rate */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Resp. Rate</span>
                      <Activity className={`text-blue-400 ${computedVitals.respiratory_rate ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.respiratory_rate !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.respiratory_rate} <span className="text-[10px] font-normal text-slate-500">RPM</span>
                          </div>
                          <div className={`text-[10px] font-bold ${computedVitals.respiratory_rate >= 12 && computedVitals.respiratory_rate <= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {computedVitals.respiratory_rate >= 12 && computedVitals.respiratory_rate <= 20 ? 'Normal' : 'Elevated'}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Pending Scan</div>
                      )}
                    </div>
                  </div>

                  {/* Stress Score */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Stress</span>
                      <Brain className={`text-violet-400 ${computedVitals.stress_score ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.stress_score !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.stress_score} <span className="text-[10px] font-normal text-slate-500">%</span>
                          </div>
                          <div className={`text-[10px] font-bold ${computedVitals.stress_score < 35 ? 'text-emerald-400' : computedVitals.stress_score <= 70 ? 'text-amber-400' : 'text-rose-500'}`}>
                            {computedVitals.stress_level || 'Assessed'}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Run Analysis</div>
                      )}
                    </div>
                  </div>

                  {/* BMI */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28 hover:scale-[1.02] transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">BMI</span>
                      <User className={`text-slate-400 ${computedVitals.bmi ? '' : 'opacity-45'}`} size={16} />
                    </div>
                    <div className="space-y-1">
                      {computedVitals.bmi !== null ? (
                        <>
                          <div className="text-2xl font-black text-white">
                            {computedVitals.bmi}
                          </div>
                          <div className={`text-[10px] font-bold ${computedVitals.weight_category === 'Normal' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {computedVitals.weight_category || 'N/A'}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-semibold text-slate-500 leading-tight">Enter Height & Weight</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Heart Rate */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Heart Rate</span>
                      <Heart className="text-rose-500 opacity-45" size={16} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 leading-tight">No Health Data Available</div>
                    </div>
                  </div>

                  {/* HRV */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">HRV</span>
                      <Activity className="text-blue-400 opacity-45" size={16} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 leading-tight">Check Your Health Status</div>
                    </div>
                  </div>

                  {/* Oxygen Saturation */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Oxygen Saturation</span>
                      <Activity className="text-cyan-400 opacity-45" size={16} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 leading-tight">Track Your Health Required</div>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className="glass-card p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Health Score</span>
                      <Brain className="text-purple-400 opacity-45" size={16} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-400 leading-tight">Assessment Not Completed</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => navigate('/patient/track-health')}
                    className="btn btn-primary py-3 px-8 text-xs font-black uppercase tracking-wider flex items-center gap-2"
                  >
                    Complete Health Assessment
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={16} className="text-blue-400" />
              Health & Clinic Activity Timeline
            </h2>
            
            <div className="glass-card p-6 space-y-6">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton h-16 w-full" />
                  ))}
                </div>
              ) : timelineItems.length > 0 ? (
                <div className="relative border-l-2 border-slate-800 ml-3.5 pl-6 space-y-6">
                  {timelineItems.slice(0, 6).map((item) => (
                    <div key={item.id} className="relative group animate-fade-in">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full border border-slate-900 flex items-center justify-center ${item.color}`}>
                        <item.icon size={12} />
                      </span>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-white">{item.title}</h4>
                          <span className="text-[9px] text-slate-500 font-semibold">{format(item.date, 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal max-w-2xl">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-600 text-xs">
                  No historical entries found in your clinic records. Start by analyzing symptoms or booking appointments.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Quick Actions & Profile Vitals (4 Columns) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
              Quick Portals Actions
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <Link to="/patient/symptoms" className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all flex flex-col gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center">
                  <Brain size={16} className="group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <strong className="text-white text-xs font-bold block leading-tight">Symptom Checker</strong>
                  <span className="text-[9px] text-slate-500 mt-0.5 block leading-tight">Run AI classifier triage</span>
                </div>
              </Link>

              <Link to="/patient/appointments" className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all flex flex-col gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-400 flex items-center justify-center">
                  <Calendar size={16} className="group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <strong className="text-white text-xs font-bold block leading-tight">Book Doctor</strong>
                  <span className="text-[9px] text-slate-500 mt-0.5 block leading-tight">Schedule clinical slots</span>
                </div>
              </Link>

              <Link to="/patient/pharmacy" className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all flex flex-col gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-400 flex items-center justify-center">
                  <Sparkles size={16} className="group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <strong className="text-white text-xs font-bold block leading-tight">Pharmacy</strong>
                  <span className="text-[9px] text-slate-500 mt-0.5 block leading-tight">Check safety & checkout</span>
                </div>
              </Link>

              <Link to="/patient/bloodbank" className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all flex flex-col gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-rose-600/10 text-rose-400 flex items-center justify-center">
                  <Droplet size={16} className="group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <strong className="text-white text-xs font-bold block leading-tight">Blood Bank</strong>
                  <span className="text-[9px] text-slate-500 mt-0.5 block leading-tight">Check stock or register</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Clinician Patient Profile */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">
              Clinical Vitals Profile
            </h3>
            
            {patient ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Full Name</span>
                  <span className="text-xs font-semibold text-white capitalize">{patient.full_name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Gender / Age</span>
                  <span className="text-xs font-semibold text-white capitalize">{patient.gender} ({patient.age}y)</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Blood Group</span>
                  <span className="text-xs font-bold text-rose-400">{patient.blood_group || 'Not Logged'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Allergies</span>
                  <span className="text-xs font-semibold text-rose-400 truncate max-w-[150px]">{patient.allergies || 'None'}</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs text-slate-400">Chronic Conditions</span>
                  <span className="text-xs font-semibold text-white truncate max-w-[150px]">{patient.chronic_conditions || 'None'}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">
                Loading linked clinical profile...
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
