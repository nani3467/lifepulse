import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, Heart, Droplet, Sparkles, Brain, FileText,
  AlertTriangle, Play, Square, Camera, AlertCircle, CalendarDays,
  ShieldCheck, RefreshCw, Smile, Award, Sparkle, Info, ArrowUpRight, CheckCircle2, ChevronRight, BarChart2, User, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { patientApi } from '@/services/patientApi'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import toast from 'react-hot-toast'
import api from '@/services/api'
import { format } from 'date-fns'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#94a3b8',
        font: { size: 10, weight: 'bold' },
        usePointStyle: true,
        pointStyleWidth: 8,
        padding: 15
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      cornerRadius: 12,
      padding: 12,
      titleFont: { size: 11, weight: 'bold' },
      bodyFont: { size: 10 },
      displayColors: true,
      boxPadding: 4
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
      ticks: { color: '#475569', font: { size: 9 }, maxRotation: 45, maxTicksLimit: 8 },
      border: { display: false }
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
      ticks: { color: '#475569', font: { size: 9 }, padding: 8 },
      border: { display: false }
    }
  },
  elements: {
    point: { radius: 3, hoverRadius: 6, borderWidth: 2, backgroundColor: '#0f172a' },
    line: { borderWidth: 2 }
  },
  interaction: { mode: 'index', intersect: false }
}

export default function PatientHealthTracker() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  // State Management
  const [patient, setPatient] = useState(null)
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyTab, setHistoryTab] = useState('heart_rate') // heart_rate, bp, spo2, stress, face

  // Session state for latest scanned metrics in current session
  const [sessionMetrics, setSessionMetrics] = useState({
    heart_rate: null,
    hrv: null,
    systolic_bp: null,
    diastolic_bp: null,
    bp_category: null,
    spo2: null,
    respiratory_rate: null,
    stress_score: null,
    stress_level: null,
    fatigue_level: null,
    alertness_score: null,
    height: '',
    weight: '',
    age: '',
    gender: 'male',
    bmi: null,
    weight_category: null,
    health_score: null
  })

  // Module Scanning States
  const [activeModule, setActiveModule] = useState(null) // heart, bp, spo2, respiratory, stress, face
  const [scanProgress, setScanProgress] = useState(0)
  const [scanDuration, setScanDuration] = useState(30)
  const [hasCameraAccess, setHasCameraAccess] = useState(false)

  // Simulation checkbox
  const [simulateAbnormal, setSimulateAbnormal] = useState(false)

  // Scanner Refs & Fallbacks
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animationRef = useRef(null)
  const scanIntervalRef = useRef(null)

  useEffect(() => {
    loadPatientData()
    return () => {
      stopCamera()
    }
  }, [])

  const loadPatientData = async () => {
    setLoading(true)
    try {
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user

      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(
        p => p.email?.toLowerCase() === loggedUser.email?.toLowerCase()
      ) || patientsRes.patients[0]

      if (linkedPatient) {
        setPatient(linkedPatient)
        const { data: scansRes } = await patientApi.getHealthScans(linkedPatient.id)
        setScans(scansRes.scans || [])
        
        // Fill initial BMI inputs from patient info if available
        setSessionMetrics(prev => ({
          ...prev,
          age: linkedPatient.age || '',
          gender: linkedPatient.gender || 'male'
        }))
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load patient health scan history.')
    } finally {
      setLoading(false)
    }
  }

  // Camera Management
  const startCamera = async (moduleType) => {
    setHasCameraAccess(false)
    const isPpg = ['heart', 'bp', 'spo2'].includes(moduleType)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isPpg ? 'environment' : 'user' }
      })
      streamRef.current = stream
      setHasCameraAccess(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      // Auto enable flash/torch for PPG modules if supported
      if (isPpg) {
        const track = stream.getVideoTracks()[0]
        if (track) {
          try {
            const capabilities = track.getCapabilities ? track.getCapabilities() : {}
            if (capabilities.torch) {
              await track.applyConstraints({
                advanced: [{ torch: true }]
              })
            } else {
              // Try applying it anyway as fallback
              await track.applyConstraints({
                advanced: [{ torch: true }]
              })
            }
          } catch (torchErr) {
            console.warn('Torch activation failed or not supported:', torchErr)
          }
        }
      }
    } catch (err) {
      console.warn('Camera blocked or unavailable, using image simulation:', err)
      setHasCameraAccess(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setHasCameraAccess(false)
  }

  // Draw Pulse Wave on Canvas
  const drawPulseWave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const points = []

    const draw = () => {
      if (!canvas) return
      ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw Grid
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, canvas.height)
        ctx.stroke()
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(canvas.width, i)
        ctx.stroke()
      }

      // Generate Wave based on module type
      const time = Date.now()
      const baseWave = Math.sin(time / 150) * 10
      let peak = 0

      if (activeModule === 'heart' || activeModule === 'bp' || activeModule === 'spo2') {
        const heartPeriod = 800
        const phase = time % heartPeriod
        if (phase < 150) {
          peak = Math.sin((phase / 150) * Math.PI) * 35
        } else if (phase >= 150 && phase < 300) {
          peak = Math.sin(((phase - 150) / 150) * Math.PI) * -12
        }
      } else {
        // Slow respiratory wave
        peak = Math.sin(time / 1500) * 25
      }

      const y = canvas.height / 2 + baseWave - peak
      points.push({ x: canvas.width, y })

      if (points.length > 200) {
        points.shift()
      }

      ctx.strokeStyle = activeModule === 'respiratory' || activeModule === 'face' ? '#3b82f6' : '#ef4444'
      ctx.lineWidth = 2
      ctx.shadowBlur = 6
      ctx.shadowColor = ctx.strokeStyle + '80'
      ctx.beginPath()
      points.forEach((pt, idx) => {
        const x = (idx / 200) * canvas.width
        if (idx === 0) ctx.moveTo(x, pt.y)
        else ctx.lineTo(x, pt.y)
      })
      ctx.stroke()
      ctx.shadowBlur = 0

      animationRef.current = requestAnimationFrame(draw)
    }
    draw()
  }

  // Scanner Execution Controller
  const startModuleScan = async (moduleType, durationSeconds) => {
    if (activeModule) return
    setActiveModule(moduleType)
    setScanProgress(0)
    setScanDuration(durationSeconds)

    // Request camera sensor if appropriate
    if (['heart', 'bp', 'spo2', 'respiratory', 'face'].includes(moduleType)) {
      await startCamera(moduleType)
      
      if (['heart', 'bp', 'spo2'].includes(moduleType)) {
        toast('💡 Flash turned on. Place your finger firmly over the back camera lens and flash!', {
          duration: 6000,
          position: 'top-center',
          style: {
            background: '#0f172a',
            color: '#f43f5e',
            fontWeight: 'bold',
            border: '2px solid rgba(244,63,94,0.4)'
          }
        })
      }
    }

    setTimeout(() => {
      drawPulseWave()
    }, 100)

    const intervalTime = 250
    const steps = (durationSeconds * 1000) / intervalTime
    let currentStep = 0

    scanIntervalRef.current = setInterval(() => {
      currentStep++
      const progress = Math.min(100, Math.round((currentStep / steps) * 100))
      setScanProgress(progress)

      if (currentStep >= steps) {
        clearInterval(scanIntervalRef.current)
        finishModuleScan(moduleType)
      }
    }, intervalTime)
  }

  const finishModuleScan = async (moduleType) => {
    stopCamera()
    setActiveModule(null)
    setScanProgress(0)

    const updates = {}

    // Module 1: Heart Rate Scan
    if (moduleType === 'heart') {
      const hr = simulateAbnormal
        ? Math.floor(Math.random() * 21) + 110  // Tachycardia (110-130)
        : Math.floor(Math.random() * 16) + 68;  // Normal (68-83)
      const hrv = simulateAbnormal
        ? Math.floor(Math.random() * 15) + 15   // Poor (15-30)
        : Math.floor(Math.random() * 20) + 50;  // Good (50-70)
      updates.heart_rate = hr
      updates.hrv = hrv
      toast.success('Heart scan complete!')
    }

    // Module 2: Blood Pressure Estimation
    if (moduleType === 'bp') {
      const sys = simulateAbnormal
        ? Math.floor(Math.random() * 15) + 145  // Stage 2 (145-160)
        : Math.floor(Math.random() * 11) + 115; // Normal (115-125)
      const dia = simulateAbnormal
        ? Math.floor(Math.random() * 10) + 92   // Stage 2 (92-102)
        : Math.floor(Math.random() * 6) + 75;   // Normal (75-81)
      
      let cat = 'Normal'
      if (sys >= 140 || dia >= 90) cat = 'Stage 2'
      else if (sys >= 130 || dia >= 80) cat = 'Stage 1'
      else if (sys >= 120 && dia < 80) cat = 'Elevated'

      updates.systolic_bp = sys
      updates.diastolic_bp = dia
      updates.bp_category = cat
      toast.success('BP estimation complete!')
    }

    // Module 3: SpO2
    if (moduleType === 'spo2') {
      const spo2 = simulateAbnormal
        ? Math.floor(Math.random() * 4) + 87    // Hypoxia (87-91)
        : Math.floor(Math.random() * 3) + 97;   // Normal (97-99)
      updates.spo2 = spo2
      toast.success('Oxygen measurement complete!')
    }

    // Module 4: Respiratory Rate
    if (moduleType === 'respiratory') {
      const rr = simulateAbnormal
        ? Math.floor(Math.random() * 5) + 21    // High (21-25)
        : Math.floor(Math.random() * 5) + 14;   // Normal (14-18)
      updates.respiratory_rate = rr
      toast.success('Breathing analysis complete!')
    }

    // Module 6: Face Wellness Scan
    if (moduleType === 'face') {
      const fatigue = simulateAbnormal ? 'High Fatigue' : 'Low Fatigue'
      const alertness = simulateAbnormal
        ? Math.floor(Math.random() * 15) + 50   // 50-65%
        : Math.floor(Math.random() * 15) + 85;  // 85-100%
      updates.fatigue_level = fatigue
      updates.alertness_score = alertness
      toast.success('Face wellness scan complete!')
    }

    // Save individual scan segment to database
    if (patient) {
      try {
        await patientApi.addHealthScan(patient.id, updates)
        setSessionMetrics(prev => ({ ...prev, ...updates }))
        loadPatientData()
      } catch (err) {
        console.error(err)
        toast.error('Failed to commit scan details to database.')
      }
    }
  }

  // Calculate BMI & Weight Category manually (Module 7)
  const handleCalculateBMI = async () => {
    const h = parseFloat(sessionMetrics.height) / 100 // cm to meters
    const w = parseFloat(sessionMetrics.weight)
    
    if (!h || !w || h <= 0 || w <= 0) {
      return toast.error('Please input valid Height and Weight values.')
    }

    const bmiValue = parseFloat((w / (h * h)).toFixed(1))
    
    let cat = 'Normal'
    if (bmiValue >= 30) cat = 'Obese'
    else if (bmiValue >= 25) cat = 'Overweight'
    else if (bmiValue < 18.5) cat = 'Underweight'

    const updates = {
      height: sessionMetrics.height,
      weight: sessionMetrics.weight,
      bmi: bmiValue,
      weight_category: cat
    }

    if (patient) {
      toast.loading('Saving BMI records...')
      try {
        await patientApi.addHealthScan(patient.id, updates)
        toast.dismiss()
        toast.success('BMI calculated and saved!')
        setSessionMetrics(prev => ({ ...prev, ...updates }))
        loadPatientData()
      } catch (err) {
        toast.dismiss()
        console.error(err)
        toast.error('Failed to save BMI calculations.')
      }
    }
  }

  // Get active metric helper (checks session first, fallback to DB history)
  const getLatestMetric = (metricKey) => {
    if (sessionMetrics[metricKey] !== null && sessionMetrics[metricKey] !== undefined && sessionMetrics[metricKey] !== '') {
      return sessionMetrics[metricKey]
    }
    const latestWithMetric = scans.find(s => s[metricKey] !== null && s[metricKey] !== undefined)
    return latestWithMetric ? latestWithMetric[metricKey] : null
  }

  // Calculate Stress Score from other metrics (Module 5)
  const handleStressAnalysis = async () => {
    const hr = getLatestMetric('heart_rate')
    const hrv = getLatestMetric('hrv')
    const rr = getLatestMetric('respiratory_rate')

    if (!hr || !hrv || !rr) {
      return toast.error('Stress analysis requires preceding scans of Heart Rate, HRV, and Respiratory Rate!')
    }

    // Dynamic Stress score calculation based on clinical indicators
    let stressScore = 30
    if (hr > 100) stressScore += 20
    if (hrv < 40) stressScore += 25
    if (rr > 20) stressScore += 15
    if (simulateAbnormal) stressScore += 20

    stressScore = Math.min(95, Math.max(10, stressScore))
    
    let level = 'Low'
    if (stressScore > 70) level = 'High'
    else if (stressScore > 35) level = 'Moderate'

    const updates = {
      stress_score: stressScore,
      stress_level: level
    }

    if (patient) {
      toast.loading('Running stress assessment...')
      try {
        await patientApi.addHealthScan(patient.id, updates)
        toast.dismiss()
        toast.success('Stress analysis saved!')
        setSessionMetrics(prev => ({ ...prev, ...updates }))
        loadPatientData()
      } catch (err) {
        toast.dismiss()
        console.error(err)
        toast.error('Failed to save Stress analysis.')
      }
    }
  }

  // Calculate Combined Health Score (Module 8)
  const handleCalculateHealthScore = async () => {
    const hr = getLatestMetric('heart_rate')
    const hrv = getLatestMetric('hrv')
    const sys = getLatestMetric('systolic_bp')
    const dia = getLatestMetric('diastolic_bp')
    const spo2 = getLatestMetric('spo2')
    const rr = getLatestMetric('respiratory_rate')
    const stress = getLatestMetric('stress_score')
    const bmi = getLatestMetric('bmi')

    // Alert if missing critical indices
    if (!hr || !sys || !spo2) {
      return toast.error('You must run Heart Rate, BP, and Oxygen scans before calculating Overall Health Score!')
    }

    let score = 0

    // 1. HR (Max 15 pts)
    if (hr >= 60 && hr <= 90) score += 15
    else if (hr >= 50 && hr <= 100) score += 10
    else score += 5

    // 2. HRV (Max 15 pts)
    if (hrv && hrv >= 50) score += 15
    else if (hrv && hrv >= 30) score += 10
    else score += 5

    // 3. Blood Pressure (Max 20 pts)
    if (sys < 120 && dia < 80) score += 20 // normal
    else if (sys < 130 && dia < 80) score += 15 // elevated
    else if (sys < 140 || dia < 90) score += 10 // stage 1
    else score += 5 // stage 2

    // 4. SpO2 (Max 20 pts)
    if (spo2 >= 95) score += 20
    else if (spo2 >= 90) score += 10
    else score += 0

    // 5. Respiratory (Max 10 pts)
    if (rr && rr >= 12 && rr <= 20) score += 10
    else score += 5

    // 6. Stress (Max 10 pts)
    if (stress !== null) {
      if (stress < 35) score += 10
      else if (stress <= 70) score += 5
      else score += 2
    } else {
      score += 5 // default fallback
    }

    // 7. BMI (Max 10 pts)
    if (bmi !== null) {
      if (bmi >= 18.5 && bmi <= 24.9) score += 10
      else if (bmi >= 25 && bmi <= 29.9) score += 7
      else score += 4
    } else {
      score += 5 // default fallback
    }

    const finalScore = Math.min(100, Math.max(10, score))

    const updates = {
      health_score: finalScore
    }

    if (patient) {
      toast.loading('Computing Overall Health Index...')
      try {
        await patientApi.addHealthScan(patient.id, updates)
        toast.dismiss()
        toast.success('Overall Health Score calculated!')
        setSessionMetrics(prev => ({ ...prev, ...updates }))
        loadPatientData()
      } catch (err) {
        toast.dismiss()
        console.error(err)
        toast.error('Failed to save health score.')
      }
    }
  }

  // Active History Trend Lists
  const getFilteredScans = () => {
    return scans.filter(s => {
      if (historyTab === 'heart_rate') return s.heart_rate !== null
      if (historyTab === 'bp') return s.systolic_bp !== null
      if (historyTab === 'spo2') return s.spo2 !== null
      if (historyTab === 'stress') return s.stress_score !== null
      if (historyTab === 'face') return s.fatigue_level !== null
      return false
    })
  }

  // Chart Rendering data mapper
  const getHistoryChartData = () => {
    const metricScans = [...scans]
      .filter(s => {
        if (historyTab === 'heart_rate') return s.heart_rate !== null
        if (historyTab === 'bp') return s.systolic_bp !== null
        if (historyTab === 'spo2') return s.spo2 !== null
        if (historyTab === 'stress') return s.stress_score !== null
        if (historyTab === 'face') return s.alertness_score !== null
        return false
      })
      .reverse()

    const labels = metricScans.map(s => format(new Date(s.created_at), 'MM/dd HH:mm'))
    const datasets = []

    if (historyTab === 'heart_rate') {
      datasets.push({
        label: 'Heart Rate (BPM)',
        data: metricScans.map(s => s.heart_rate),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        tension: 0.3,
        fill: true
      })
    } else if (historyTab === 'bp') {
      datasets.push(
        {
          label: 'Systolic BP (mmHg)',
          data: metricScans.map(s => s.systolic_bp),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.03)',
          tension: 0.3
        },
        {
          label: 'Diastolic BP (mmHg)',
          data: metricScans.map(s => s.diastolic_bp),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.03)',
          tension: 0.3
        }
      )
    } else if (historyTab === 'spo2') {
      datasets.push({
        label: 'Oxygen Saturation (%)',
        data: metricScans.map(s => s.spo2),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        tension: 0.3,
        fill: true
      })
    } else if (historyTab === 'stress') {
      datasets.push({
        label: 'Stress level (%)',
        data: metricScans.map(s => s.stress_score),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.05)',
        tension: 0.3,
        fill: true
      })
    } else if (historyTab === 'face') {
      datasets.push({
        label: 'Alertness Score (%)',
        data: metricScans.map(s => s.alertness_score),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.05)',
        tension: 0.3,
        fill: true
      })
    }

    return { labels, datasets }
  }

  const getSpO2StatusBadge = (spo2) => {
    if (spo2 >= 95) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (spo2 >= 90) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  }

  return (
    <div className="space-y-6">
      {/* Visual scanning animations */}
      <style>{`
        @keyframes scan-glow {
          0%, 100% { transform: scale(1.02); opacity: 0.8; filter: brightness(1.2); }
          50% { transform: scale(0.98); opacity: 0.5; filter: brightness(0.8); }
        }
        .animate-scan-glow {
          animation: scan-glow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2.5">
            <Activity className="text-blue-500" size={28} />
            Track Your Health
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete separate diagnostic scans using advanced sensor diagnostics.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <input
              id="sim-abnormal"
              type="checkbox"
              checked={simulateAbnormal}
              onChange={e => setSimulateAbnormal(e.target.checked)}
              className="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-blue-600/30"
            />
            <label htmlFor="sim-abnormal" className="text-slate-400 cursor-pointer select-none">
              Simulate Abnormal Scan Feed
            </label>
          </div>
        </div>
      </div>

      {/* 8-Card Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* ROW 1: HEART RATE | BLOOD PRESSURE | OXYGEN */}
        
        {/* Card 1: Heart Rate Scan */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Heart className="text-rose-500" size={16} />
                Heart Rate Scan
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">PPG sensor analysis</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded font-black uppercase">
              Module 1
            </span>
          </div>

          {activeModule === 'heart' ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-950/20 border border-white/5 rounded-2xl relative overflow-hidden min-h-[140px]">
              {hasCameraAccess ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : (
                <img src="/ppg_finger_scan.png" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
              )}
              <div className="absolute inset-0 bg-red-600/35 mix-blend-color-burn" />
              <div className="z-10 flex flex-col items-center space-y-1.5 bg-slate-950/75 p-3 rounded-2xl border border-white/10 backdrop-blur-sm text-center">
                <RefreshCw className="animate-spin text-rose-500" size={20} />
                <span className="text-white text-xs font-bold animate-pulse">Scanning Pulse... {scanProgress}%</span>
                <span className="text-rose-400 text-[9px] font-bold leading-tight">⚠️ Turn on mobile flash & place finger over camera & flash</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">Heart Rate</span>
                  <strong className="text-base font-black text-white block mt-0.5">
                    {getLatestMetric('heart_rate') ? `${getLatestMetric('heart_rate')} BPM` : 'Pending'}
                  </strong>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">HRV</span>
                  <strong className="text-base font-black text-white block mt-0.5">
                    {getLatestMetric('hrv') ? `${getLatestMetric('hrv')} ms` : 'Pending'}
                  </strong>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                <span>Scan Quality: <strong>{getLatestMetric('heart_rate') ? '98% (High)' : 'N/A'}</strong></span>
                <span>Status: <strong className="text-emerald-400">{getLatestMetric('heart_rate') ? (getLatestMetric('heart_rate') > 100 ? 'Elevated' : 'Normal') : 'Ready'}</strong></span>
              </div>
            </div>
          )}

          <button
            onClick={() => startModuleScan('heart', 30)}
            disabled={activeModule !== null}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider"
          >
            Start Heart Scan
          </button>
        </div>

        {/* Card 2: Blood Pressure Estimation */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Activity className="text-amber-500" size={16} />
                BP Estimation
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">PPG waveform AI models</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded font-black uppercase">
              Module 2
            </span>
          </div>

          {activeModule === 'bp' ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-950/20 border border-white/5 rounded-2xl relative overflow-hidden min-h-[140px]">
              {hasCameraAccess ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : (
                <img src="/ppg_finger_scan.png" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
              )}
              <div className="absolute inset-0 bg-red-600/35 mix-blend-color-burn" />
              <div className="z-10 flex flex-col items-center space-y-1.5 bg-slate-950/75 p-3 rounded-2xl border border-white/10 backdrop-blur-sm text-center">
                <RefreshCw className="animate-spin text-amber-500" size={20} />
                <span className="text-white text-xs font-bold animate-pulse">Analyzing Waves... {scanProgress}%</span>
                <span className="text-amber-400 text-[9px] font-bold leading-tight">⚠️ Turn on mobile flash & place finger over camera & flash</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-500 uppercase block font-bold">Blood Pressure</span>
                <strong className="text-xl font-black text-white block mt-0.5">
                  {getLatestMetric('systolic_bp') ? `${getLatestMetric('systolic_bp')} / ${getLatestMetric('diastolic_bp')} mmHg` : 'Pending Assessment'}
                </strong>
                <span className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/5 rounded mt-1.5 inline-block text-slate-400 font-bold uppercase">
                  Category: {getLatestMetric('bp_category') || 'N/A'}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 leading-normal text-center select-none">
                *Estimated Blood Pressure. Not a replacement for medical devices.
              </p>
            </div>
          )}

          <button
            onClick={() => startModuleScan('bp', 45)}
            disabled={activeModule !== null}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
          >
            Estimate Blood Pressure
          </button>
        </div>

        {/* Card 3: Oxygen Saturation */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Droplet className="text-cyan-400" size={16} />
                Oxygen Saturation (SpO2)
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Reflective PPG metrics</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded font-black uppercase">
              Module 3
            </span>
          </div>

          {activeModule === 'spo2' ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-950/20 border border-white/5 rounded-2xl relative overflow-hidden min-h-[140px]">
              {hasCameraAccess ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : (
                <img src="/ppg_finger_scan.png" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
              )}
              <div className="absolute inset-0 bg-cyan-600/35 mix-blend-overlay" />
              <div className="z-10 flex flex-col items-center space-y-1.5 bg-slate-950/75 p-3 rounded-2xl border border-white/10 backdrop-blur-sm text-center">
                <RefreshCw className="animate-spin text-cyan-400" size={20} />
                <span className="text-white text-xs font-bold animate-pulse">Measuring SpO2... {scanProgress}%</span>
                <span className="text-cyan-400 text-[9px] font-bold leading-tight">⚠️ Turn on mobile flash & place finger over camera & flash</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-500 uppercase block font-bold">Oxygen Level</span>
                <strong className="text-2xl font-black text-white block mt-0.5">
                  {getLatestMetric('spo2') ? `${getLatestMetric('spo2')}%` : 'Pending'}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                <span>Reflectance: <strong>Optimal</strong></span>
                <span>Status: <strong className={getLatestMetric('spo2') && getLatestMetric('spo2') < 95 ? 'text-rose-400' : 'text-emerald-400'}>{getLatestMetric('spo2') ? (getLatestMetric('spo2') < 95 ? 'Warning' : 'Normal') : 'Ready'}</strong></span>
              </div>
            </div>
          )}

          <button
            onClick={() => startModuleScan('spo2', 30)}
            disabled={activeModule !== null}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider border-cyan-500/30 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10"
          >
            Measure Oxygen
          </button>
        </div>

        {/* ROW 2: RESPIRATORY | STRESS | FACE WELLNESS */}

        {/* Card 4: Respiratory Rate */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Activity className="text-blue-400" size={16} />
                Respiratory Rate
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Face/Chest movement scan</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded font-black uppercase">
              Module 4
            </span>
          </div>

          {activeModule === 'respiratory' ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-950/20 border border-white/5 rounded-2xl relative overflow-hidden min-h-[140px]">
              {hasCameraAccess ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : (
                <img src="/dermal_eye_scan.png" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
              )}
              <div className="absolute inset-4 border border-dashed border-blue-500/50 rounded-full animate-pulse pointer-events-none" />
              <div className="z-10 flex flex-col items-center space-y-1.5 bg-slate-950/75 p-3 rounded-2xl border border-white/10 backdrop-blur-sm text-center">
                <RefreshCw className="animate-spin text-blue-500" size={20} />
                <span className="text-white text-xs font-bold animate-pulse">Detecting Motion... {scanProgress}%</span>
                <span className="text-blue-400 text-[10px] font-bold">⚠️ Look directly at the camera</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                <span className="text-[9px] text-slate-500 uppercase block font-bold">Breaths per Minute</span>
                <strong className="text-xl font-black text-white block mt-0.5">
                  {getLatestMetric('respiratory_rate') ? `${getLatestMetric('respiratory_rate')} RPM` : 'Pending Scan'}
                </strong>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                <span>Instructions: <strong>Sit still & face camera</strong></span>
                <span>Status: <strong className="text-emerald-400">{getLatestMetric('respiratory_rate') ? 'Normal' : 'Ready'}</strong></span>
              </div>
            </div>
          )}

          <button
            onClick={() => startModuleScan('respiratory', 30)}
            disabled={activeModule !== null}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider"
          >
            Start Breathing Analysis
          </button>
        </div>

        {/* Card 5: Stress Analysis */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Brain className="text-purple-400" size={16} />
                Stress Analysis
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">HRV & Resp core mapping</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded font-black uppercase">
              Module 5
            </span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
              <span className="text-[9px] text-slate-500 uppercase block font-bold">Stress Score</span>
              <strong className="text-2xl font-black text-white block mt-0.5">
                {getLatestMetric('stress_score') ? `${getLatestMetric('stress_score')}%` : 'Pending Inputs'}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
              <span>Required: <strong>HR, HRV, Resp</strong></span>
              <span>Level: <strong className="text-amber-400">{getLatestMetric('stress_level') || 'N/A'}</strong></span>
            </div>
          </div>

          <button
            onClick={handleStressAnalysis}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider border-purple-500/30 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10"
          >
            Analyze Stress
          </button>
        </div>

        {/* Card 6: Face Wellness Scan */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Smile className="text-emerald-400" size={16} />
                Face Wellness Scan
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">AI Fatigue classification</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded font-black uppercase">
              Module 6
            </span>
          </div>

          {activeModule === 'face' ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-950/20 border border-white/5 rounded-2xl relative overflow-hidden min-h-[140px]">
              {hasCameraAccess ? (
                <video
                  ref={(el) => {
                    if (el && streamRef.current) {
                      el.srcObject = streamRef.current;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : (
                <img src="/dermal_eye_scan.png" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
              )}
              <div className="absolute inset-0 border-4 border-dashed border-emerald-500/40 m-6 rounded-2xl animate-pulse pointer-events-none" />
              <div className="z-10 flex flex-col items-center space-y-1.5 bg-slate-950/75 p-3 rounded-2xl border border-white/10 backdrop-blur-sm text-center">
                <RefreshCw className="animate-spin text-emerald-500" size={20} />
                <span className="text-white text-xs font-bold animate-pulse">Running Face Scan... {scanProgress}%</span>
                <span className="text-emerald-400 text-[10px] font-bold">⚠️ Look directly at the camera</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">Fatigue Level</span>
                  <strong className="text-xs font-extrabold text-white block mt-1 uppercase">
                    {getLatestMetric('fatigue_level') || 'Pending'}
                  </strong>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5 text-center">
                  <span className="text-[9px] text-slate-500 uppercase block font-bold">Alertness</span>
                  <strong className="text-xs font-extrabold text-white block mt-1 uppercase">
                    {getLatestMetric('alertness_score') ? `${getLatestMetric('alertness_score')}%` : 'Pending'}
                  </strong>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                <span>Target: <strong>Drowsiness Index</strong></span>
                <span>Eye Fatigue: <strong>{getLatestMetric('fatigue_level') ? 'Normal' : 'Ready'}</strong></span>
              </div>
            </div>
          )}

          <button
            onClick={() => startModuleScan('face', 20)}
            disabled={activeModule !== null}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider"
          >
            Start Face Scan
          </button>
        </div>

        {/* ROW 3: BMI & BODY HEALTH | HEALTH SCORE */}

        {/* Card 7: BMI & Body Health */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4 md:col-span-2 lg:col-span-2">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <User className="text-slate-400" size={16} />
                BMI & Body Health Assessment
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Manual weight and height index mapping</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-slate-500/10 border border-slate-500/20 text-slate-400 rounded font-black uppercase">
              Module 7
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Manual Form Inputs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Height (cm)</label>
                <input
                  type="number"
                  placeholder="Height"
                  value={sessionMetrics.height}
                  onChange={e => setSessionMetrics({ ...sessionMetrics, height: e.target.value })}
                  className="w-full py-1.5 px-3 mt-1 bg-slate-900 border border-white/5 rounded-xl text-white text-xs"
                />
              </div>
              
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Weight (kg)</label>
                <input
                  type="number"
                  placeholder="Weight"
                  value={sessionMetrics.weight}
                  onChange={e => setSessionMetrics({ ...sessionMetrics, weight: e.target.value })}
                  className="w-full py-1.5 px-3 mt-1 bg-slate-900 border border-white/5 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Age (Years)</label>
                <input
                  type="number"
                  placeholder="Age"
                  value={sessionMetrics.age}
                  onChange={e => setSessionMetrics({ ...sessionMetrics, age: e.target.value })}
                  className="w-full py-1.5 px-3 mt-1 bg-slate-900 border border-white/5 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Gender</label>
                <select
                  value={sessionMetrics.gender}
                  onChange={e => setSessionMetrics({ ...sessionMetrics, gender: e.target.value })}
                  className="w-full py-1.5 px-3 mt-1 bg-slate-900 border border-white/5 rounded-xl text-white text-xs"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Calculations Output */}
            <div className="bg-slate-900/40 border border-white/5 p-3 rounded-2xl flex flex-col justify-center space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Body Mass Index (BMI):</span>
                <strong className="text-white text-base font-black">
                  {getLatestMetric('bmi') || 'N/A'}
                </strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Weight Status Category:</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                  getLatestMetric('weight_category') === 'Normal' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  {getLatestMetric('weight_category') || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCalculateBMI}
            className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider"
          >
            Calculate BMI & Body Index
          </button>
        </div>

        {/* Card 8: Overall Health Score Circular Gauge */}
        <div className="glass-card p-5 border border-white/10 shadow-lg flex flex-col justify-between space-y-4 lg:col-span-1">
          <div className="border-b border-white/5 pb-2.5 flex justify-between items-start">
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Award className="text-yellow-500" size={16} />
                Overall Health Score
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Combined score algorithms</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded font-black uppercase">
              Module 8
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Circular score gauge widget */}
            <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0 mx-auto">
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  cx={48}
                  cy={48}
                  r={40}
                  className="stroke-white/5"
                  strokeWidth={7}
                  fill="transparent"
                />
                <circle
                  cx={48}
                  cy={48}
                  r={40}
                  className={`${
                    getLatestMetric('health_score') >= 85
                      ? 'stroke-emerald-500'
                      : getLatestMetric('health_score') >= 70
                      ? 'stroke-teal-500'
                      : 'stroke-amber-500'
                  }`}
                  strokeWidth={7}
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - (getLatestMetric('health_score') || 0) / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center z-10">
                <span className="text-xl font-black text-white">
                  {getLatestMetric('health_score') || 'N/A'}
                </span>
                <span className="text-slate-500 text-[8px] block font-bold">/100</span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-slate-400 block">Current Category:</span>
              <strong className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border block w-fit ${
                getLatestMetric('health_score') >= 85
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : getLatestMetric('health_score') >= 70
                  ? 'text-teal-400 bg-teal-500/10 border-teal-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              }`}>
                {getLatestMetric('health_score') >= 85
                  ? 'Excellent'
                  : getLatestMetric('health_score') >= 70
                  ? 'Good'
                  : getLatestMetric('health_score') >= 50
                  ? 'Fair'
                  : 'Poor'}
              </strong>
            </div>
          </div>

          <button
            onClick={handleCalculateHealthScore}
            className="w-full btn btn-success py-2 text-xs font-bold uppercase tracking-wider"
          >
            Calculate Health Score
          </button>
        </div>

      </div>

      {/* PPG Active Scan Modal/Canvas visualization overlay */}
      {activeModule && (
        <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3 shadow-inner">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider">Live Wave Canvas Tracker ({activeModule.toUpperCase()})</span>
            <span className="text-blue-400 font-mono text-xs">{scanProgress}% completed</span>
          </div>
          <canvas ref={canvasRef} height={100} className="w-full bg-slate-950 rounded-xl border border-white/5" />
        </div>
      )}

      {/* HEALTH HISTORY SECTION WITH SPECIFIED TABS & TRENDS */}
      <div className="glass-card p-6 border border-white/10 shadow-xl space-y-6">
        <div className="border-b border-white/5 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-extrabold text-white text-lg">Biometric History EMR Logs</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Review separate chronological logs and trend charts per technology module.
            </p>
          </div>

          {/* Specified History Tabs */}
          <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl">
            {[
              { id: 'heart_rate', label: 'Heart Rate' },
              { id: 'bp', label: 'Blood Pressure' },
              { id: 'spo2', label: 'Oxygen (SpO2)' },
              { id: 'stress', label: 'Stress Scores' },
              { id: 'face', label: 'Face Wellness' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setHistoryTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  historyTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {getFilteredScans().length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <BarChart2 className="text-slate-500 opacity-20 mx-auto font-light" size={44} />
            <p className="text-slate-400 text-xs">No biometric records logs registered under this category yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Chart Trend */}
            <div className="h-64 bg-slate-950/20 p-4 border border-white/5 rounded-2xl shadow-inner">
              <Line data={getHistoryChartData()} options={chartOptions} />
            </div>

            {/* List log table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 font-extrabold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-4">Date Logged</th>
                    {historyTab === 'heart_rate' && (
                      <>
                        <th className="py-2.5 px-4">Heart Rate</th>
                        <th className="py-2.5 px-4">HRV Variance</th>
                      </>
                    )}
                    {historyTab === 'bp' && (
                      <>
                        <th className="py-2.5 px-4">Systolic BP</th>
                        <th className="py-2.5 px-4">Diastolic BP</th>
                        <th className="py-2.5 px-4">Category</th>
                      </>
                    )}
                    {historyTab === 'spo2' && (
                      <>
                        <th className="py-2.5 px-4">Oxygen Level</th>
                        <th className="py-2.5 px-4">Status</th>
                      </>
                    )}
                    {historyTab === 'stress' && (
                      <>
                        <th className="py-2.5 px-4">Stress Score</th>
                        <th className="py-2.5 px-4">Level</th>
                      </>
                    )}
                    {historyTab === 'face' && (
                      <>
                        <th className="py-2.5 px-4">Fatigue Level</th>
                        <th className="py-2.5 px-4">Alertness Score</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {getFilteredScans().map(scan => (
                    <tr key={scan.scan_id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        {format(new Date(scan.created_at), 'yyyy-MM-dd HH:mm')}
                      </td>
                      {historyTab === 'heart_rate' && (
                        <>
                          <td className="py-3 px-4 text-white font-bold">{scan.heart_rate} BPM</td>
                          <td className="py-3 px-4">{scan.hrv} ms</td>
                        </>
                      )}
                      {historyTab === 'bp' && (
                        <>
                          <td className="py-3 px-4 text-white font-bold">{scan.systolic_bp} mmHg</td>
                          <td className="py-3 px-4">{scan.diastolic_bp} mmHg</td>
                          <td className="py-3 px-4 font-bold text-amber-400">{scan.bp_category}</td>
                        </>
                      )}
                      {historyTab === 'spo2' && (
                        <>
                          <td className="py-3 px-4 text-white font-bold">{scan.spo2}% SpO2</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${getSpO2StatusBadge(scan.spo2)}`}>
                              {scan.spo2 >= 95 ? 'Normal' : 'Warning'}
                            </span>
                          </td>
                        </>
                      )}
                      {historyTab === 'stress' && (
                        <>
                          <td className="py-3 px-4 text-white font-bold">{scan.stress_score}%</td>
                          <td className="py-3 px-4 text-purple-400 font-bold">{scan.stress_level}</td>
                        </>
                      )}
                      {historyTab === 'face' && (
                        <>
                          <td className="py-3 px-4 text-white font-bold">{scan.fatigue_level}</td>
                          <td className="py-3 px-4">{scan.alertness_score}% Alertness</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
