import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShieldAlert, ShieldCheck, Heart, Activity, AlertTriangle, Thermometer,
  Clock, Plus, Volume2, VolumeX, CheckCircle2, UserPlus, Play, Pause,
  AlertCircle, ChevronRight, X, PhoneCall, Loader, RefreshCw
} from 'lucide-react'
import { emergencyApi } from '@/services/emergencyApi'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

// Bedside Monitor scrolling ECG trace animation component
function EcgMonitor({ heartRate, isCritical }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let x = 0

    // Set layout resolution
    canvas.width = canvas.parentElement.clientWidth
    canvas.height = 70

    // Clear background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const draw = () => {
      // Background grid lines (subtle dark green/blue)
      if (x % 40 === 0) {
        ctx.strokeStyle = 'rgba(16,185,129,0.03)'
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // Draw a black cover block right ahead of our scan bar to clear old trace
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(x + 1, 0, 12, canvas.height)

      // Calculate ECG PQRST waveform complex
      // Heart rate dictates spacing of beats
      const beatSpacing = Math.max(30, Math.floor(4000 / heartRate))
      const beatPosition = x % beatSpacing
      let yOffset = canvas.height / 2

      if (beatPosition === 0) {
        // P wave
        yOffset -= 3
      } else if (beatPosition === 4) {
        // Q wave (down)
        yOffset += 4
      } else if (beatPosition === 6) {
        // R wave (main spike up)
        yOffset -= 28
      } else if (beatPosition === 8) {
        // S wave (down)
        yOffset += 14
      } else if (beatPosition === 12) {
        // T wave (moderate recovery up)
        yOffset -= 6
      } else {
        // baseline noise
        yOffset += (Math.random() - 0.5) * 1
      }

      // Draw line segment
      ctx.strokeStyle = isCritical ? '#f43f5e' : '#10b981'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(x === 0 ? 0 : x - 1, canvas.height / 2) // placeholder start
      ctx.lineTo(x, yOffset)
      ctx.stroke()

      // Increment x coordinate or wrap around scan
      x = (x + 1) % canvas.width

      animationId = requestAnimationFrame(draw)
    }

    animationId = requestAnimationFrame(draw)

    const handleResize = () => {
      if (canvas) {
        canvas.width = canvas.parentElement.clientWidth
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [heartRate, isCritical])

  return (
    <div className="bg-slate-950/80 rounded-xl overflow-hidden border border-white/5 h-[70px] relative">
      <canvas ref={canvasRef} className="w-full block" />
      <div className="absolute top-1.5 left-2.5 text-[8px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-1">
        <Activity size={8} className={isCritical ? 'text-rose-400 animate-pulse' : 'text-emerald-400'} />
        Live Telemetry Feed
      </div>
    </div>
  )
}

export default function EmergencyDashboard() {
  const [activeTab, setActiveTab] = useState('active-monitors')
  const [patients, setPatients] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState(null)
  
  // Simulated patient vitals telemetry state
  const [simulatedPatients, setSimulatedPatients] = useState([
    { id: 1, name: 'Alice Smith', code: 'LP001', heartRate: 72, oxygen: 98, temp: 98.4, bpSys: 120, bpDia: 80, isCritical: false, triggers: [] },
    { id: 2, name: 'Robert Johnson', code: 'LP002', heartRate: 115, oxygen: 91, temp: 101.2, bpSys: 135, bpDia: 90, isCritical: false, triggers: [] },
    { id: 3, name: 'Clara Oswald', code: 'LP003', heartRate: 64, oxygen: 97, temp: 98.6, bpSys: 118, bpDia: 76, isCritical: false, triggers: [] },
    { id: 4, name: 'David Tennant', code: 'LP004', heartRate: 145, oxygen: 84, temp: 103.5, bpSys: 195, bpDia: 118, isCritical: true, triggers: ['Severe Hypoxia', 'Extreme Tachycardia', 'Hypertension Stage 2'] },
    { id: 5, name: 'Bruce Banner', code: 'LP005', heartRate: 58, oxygen: 99, temp: 97.9, bpSys: 110, bpDia: 70, isCritical: false, triggers: [] }
  ])
  
  const [selectedSimPatient, setSelectedSimPatient] = useState(null)
  const [isSimulating, setIsSimulating] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  
  // Custom Override Form
  const [overrideHR, setOverrideHR] = useState(75)
  const [overrideSpO2, setOverrideSpO2] = useState(98)
  const [overrideTemp, setOverrideTemp] = useState(98.6)
  const [overrideSys, setOverrideSys] = useState(120)
  const [overrideDia, setOverrideDia] = useState(80)

  // Web Audio Context & Oscillator Refs
  const audioCtxRef = useRef(null)
  const alarmIntervalRef = useRef(null)

  // Load backend alerts and stats
  useEffect(() => {
    loadAlertsAndStats()
    
    // Fetch active patients from database to map to simulation if needed
    patientApi.list({ limit: 10 })
      .then(({ data }) => {
        if (data?.patients?.length > 0) {
          setPatients(data.patients)
        }
      })
      .catch(console.error)
  }, [])

  const loadAlertsAndStats = () => {
    setStatsLoading(true)
    Promise.all([
      emergencyApi.getAlerts(),
      emergencyApi.getStats()
    ])
      .then(([alertsRes, statsRes]) => {
        setAlerts(alertsRes.data.alerts)
        setStats(statsRes.data)
      })
      .catch(err => console.error('Failed to load emergency alerts', err))
      .finally(() => setStatsLoading(false))
  }

  // Audio synthesizer player for bedside alert sirens
  const startAudioAlarm = useCallback(() => {
    if (alarmIntervalRef.current || !soundEnabled) return
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }

    const playBeep = () => {
      if (audioCtxRef.current.state === 'suspended') return
      
      const osc = audioCtxRef.current.createOscillator()
      const gain = audioCtxRef.current.createGain()
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(987.77, audioCtxRef.current.currentTime) // B5 note (typical ICU alert pitch)
      
      gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.3)
      
      osc.connect(gain)
      gain.connect(audioCtxRef.current.destination)
      
      osc.start()
      osc.stop(audioCtxRef.current.currentTime + 0.35)
    }

    alarmIntervalRef.current = setInterval(playBeep, 800)
  }, [soundEnabled])

  const stopAudioAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
  }, [])

  // Evaluate any active critical alerts in the simulated dataset
  const hasExtremeAlerts = simulatedPatients.some(p => p.isCritical)

  useEffect(() => {
    if (hasExtremeAlerts && soundEnabled) {
      startAudioAlarm()
    } else {
      stopAudioAlarm()
    }
    return () => stopAudioAlarm()
  }, [hasExtremeAlerts, soundEnabled, startAudioAlarm, stopAudioAlarm])

  // Simulation loop: jitters vitals every 3 seconds
  useEffect(() => {
    if (!isSimulating) return

    const simulationInterval = setInterval(() => {
      setSimulatedPatients(prev => {
        return prev.map(patient => {
          // If the patient is not selected for manual override, jitter their vitals
          if (selectedSimPatient?.id === patient.id) return patient

          // Jitter parameters
          let hrOffset = Math.floor((Math.random() - 0.5) * 6)
          let oxOffset = Math.floor((Math.random() - 0.5) * 2)
          let tempOffset = parseFloat(((Math.random() - 0.5) * 0.2).toFixed(1))
          let sysOffset = Math.floor((Math.random() - 0.5) * 6)
          let diaOffset = Math.floor((Math.random() - 0.5) * 4)

          // Vitals bounds
          let hr = Math.max(40, Math.min(180, patient.heartRate + hrOffset))
          let ox = Math.max(70, Math.min(100, patient.oxygen + oxOffset))
          let temp = parseFloat(Math.max(95.0, Math.min(106.0, patient.temp + tempOffset)).toFixed(1))
          let sys = Math.max(80, Math.min(230, patient.bpSys + sysOffset))
          let dia = Math.max(50, Math.min(130, patient.bpDia + diaOffset))

          // Evaluate risk locally to toggle critical state
          const localEvaluation = evaluateRiskLocal(hr, ox, temp, sys, dia)
          
          // Auto evaluate and post to database if critical alerts are triggered
          if (localEvaluation.isCritical && !patient.isCritical) {
            triggerBackendAlert(patient.name, hr, ox, temp, sys, dia, localEvaluation.triggers)
          }

          return {
            ...patient,
            heartRate: hr,
            oxygen: ox,
            temp: temp,
            bpSys: sys,
            bpDia: dia,
            isCritical: localEvaluation.isCritical,
            triggers: localEvaluation.triggers
          }
        })
      })
    }, 3000)

    return () => clearInterval(simulationInterval)
  }, [isSimulating, selectedSimPatient])

  // Local rule checker helper for telemetry loops
  const evaluateRiskLocal = (hr, ox, temp, sys, dia) => {
    const triggers = []
    if (ox < 90) triggers.push('Hypoxia')
    if (hr > 130) triggers.push('Tachycardia')
    if (hr < 45) triggers.push('Bradycardia')
    if (sys >= 180 || dia >= 110) triggers.push('HTN Emergency')
    if (sys < 90) triggers.push('Hypotension')
    if (temp > 103.0) triggers.push('Hyperpyrexia')

    return {
      isCritical: triggers.length > 0,
      triggers
    }
  }

  // Trigger alert post to backend SQLite/MySQL DB
  const triggerBackendAlert = (patientName, hr, ox, temp, sys, dia, triggers) => {
    // Attempt to map to a database patient if matches
    const matched = patients.find(p => p.full_name?.toLowerCase() === patientName.toLowerCase())
    
    const payload = {
      patient_id: matched ? matched.id : null,
      heart_rate: hr,
      oxygen_level: ox,
      temperature: temp,
      systolic_bp: sys,
      diastolic_bp: dia
    }

    emergencyApi.evaluate(payload)
      .then(() => {
        toast.error(`TELEMETRY TRIGGER: Critical Alert raised for ${patientName}!`)
        loadAlertsAndStats()
      })
      .catch(console.error)
  }

  // Handle bedside override input changes
  const applyBedsideOverride = (e) => {
    e.preventDefault()
    if (!selectedSimPatient) return

    const hr = parseInt(overrideHR)
    const ox = parseInt(overrideSpO2)
    const temp = parseFloat(overrideTemp)
    const sys = parseInt(overrideSys)
    const dia = parseInt(overrideDia)

    const evaluation = evaluateRiskLocal(hr, ox, temp, sys, dia)

    setSimulatedPatients(prev => {
      return prev.map(p => {
        if (p.id === selectedSimPatient.id) {
          const updated = {
            ...p,
            heartRate: hr,
            oxygen: ox,
            temp: temp,
            bpSys: sys,
            bpDia: dia,
            isCritical: evaluation.isCritical,
            triggers: evaluation.triggers
          }
          setSelectedSimPatient(updated)
          return updated
        }
        return p
      })
    })

    if (evaluation.isCritical) {
      triggerBackendAlert(selectedSimPatient.name, hr, ox, temp, sys, dia, evaluation.triggers)
    } else {
      toast.success(`Bedside vitals updated for ${selectedSimPatient.name}`)
    }
  }

  // Quick vital overrides on active panel
  const induceEmergencyPreset = (patientId, presetType) => {
    setSimulatedPatients(prev => {
      return prev.map(p => {
        if (p.id === patientId) {
          let updated = { ...p }
          if (presetType === 'cardiac') {
            updated.heartRate = 160
            updated.oxygen = 88
            updated.bpSys = 205
            updated.bpDia = 122
            updated.isCritical = true
            updated.triggers = ['Tachycardia', 'Hypoxia', 'HTN Emergency']
          } else if (presetType === 'hypoxia') {
            updated.heartRate = 95
            updated.oxygen = 81
            updated.bpSys = 100
            updated.bpDia = 60
            updated.isCritical = true
            updated.triggers = ['Hypoxia', 'Hypotension']
          } else if (presetType === 'shock') {
            updated.heartRate = 38
            updated.oxygen = 92
            updated.bpSys = 80
            updated.bpDia = 48
            updated.isCritical = true
            updated.triggers = ['Bradycardia', 'Hypotension']
          } else {
            // Restore normal
            updated.heartRate = 72
            updated.oxygen = 98
            updated.temp = 98.4
            updated.bpSys = 120
            updated.bpDia = 80
            updated.isCritical = false
            updated.triggers = []
          }
          
          if (updated.isCritical) {
            triggerBackendAlert(updated.name, updated.heartRate, updated.oxygen, updated.temp, updated.bpSys, updated.bpDia, updated.triggers)
          } else {
            toast.success(`Vitals stabilized for ${p.name}`)
          }

          if (selectedSimPatient?.id === p.id) {
            setSelectedSimPatient(updated)
          }
          return updated
        }
        return p
      })
    })
  }

  // Backend triage resolve / acknowledge actions
  const handleResolveAlert = (alertId, newStatus) => {
    toast.promise(
      emergencyApi.updateAlert(alertId, { 
        status: newStatus, 
        notes: `Triage response executed: ${newStatus === 'acknowledged' ? 'Triage desk acknowledged' : 'ICU Transfer/Stabilization verified'}`
      }),
      {
        loading: 'Updating alert audit log...',
        success: `Alert marked as ${newStatus}`,
        error: 'Failed to update alert state'
      }
    ).then(() => {
      loadAlertsAndStats()
      // Stabilize the simulated patient locally if resolved
      const alert = alerts.find(a => a.id === alertId)
      if (alert && newStatus === 'resolved') {
        const simPat = simulatedPatients.find(p => p.name.toLowerCase() === alert.patient_name.toLowerCase())
        if (simPat) {
          induceEmergencyPreset(simPat.id, 'normalize')
        }
      }
    })
  }

  return (
    <div className={`space-y-6 ${hasExtremeAlerts ? 'relative' : ''}`}>
      {/* Full screen flashing border overlay on extreme emergency */}
      {hasExtremeAlerts && (
        <div className="fixed inset-0 pointer-events-none z-50 border-4 border-rose-600/60 animate-pulse" 
             style={{ boxShadow: 'inset 0 0 40px rgba(244,63,94,0.35)' }} />
      )}

      {/* Flashing Banner Alert */}
      {hasExtremeAlerts && (
        <div className="bg-rose-950/80 border border-rose-500/30 text-rose-300 px-6 py-4 rounded-2xl flex items-center justify-between shadow-lg backdrop-blur-md animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center animate-ping flex-shrink-0">
              <ShieldAlert className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wide">Emergency Protocol Triggered</h3>
              <p className="text-xs text-rose-300/80 mt-0.5">Telemetry monitor reports critical vitals on telemetry units. Action required.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border transition-colors ${
                soundEnabled 
                  ? 'bg-rose-600/20 border-rose-500/40 text-white hover:bg-rose-600/30' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Toggle Audio Alarm"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className={hasExtremeAlerts ? 'text-rose-500 animate-pulse' : 'text-blue-500'} size={26} />
            Emergency Triage Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time cardiac telemetry monitoring and bedside risk evaluations</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900/60 backdrop-blur-md p-1 rounded-xl border border-white/5 self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab('active-monitors')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'active-monitors' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity size={14} />
            Telemetry Units
          </button>
          <button
            onClick={() => setActiveTab('active-alerts')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'active-alerts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert size={14} />
            Alert Logs ({stats?.active_alerts_count || 0})
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-600 to-pink-500 shadow-md">
            <ShieldAlert size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats?.active_alerts_count || 0}</div>
            <div className="text-xs text-slate-400">Active Critical Alerts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-600 to-orange-500 shadow-md">
            <Clock size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats?.acknowledged_alerts_count || 0}</div>
            <div className="text-xs text-slate-400">Acknowledged Logs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{simulatedPatients.length}</div>
            <div className="text-xs text-slate-400">Active Telemetries</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-600 to-green-500 shadow-md">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats?.resolved_alerts_count || 0}</div>
            <div className="text-xs text-slate-400">Resolved Alerts</div>
          </div>
        </div>
      </div>

      {activeTab === 'active-monitors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active telemetry monitors grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center bg-white/5 border border-white/5 rounded-xl px-4 py-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity size={16} className="text-blue-400" />
                Bedside Telemetry Hub
              </h2>

              <div className="flex items-center gap-4">
                {/* Simulator controls */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Telemetry Engine:</span>
                  <button
                    onClick={() => setIsSimulating(!isSimulating)}
                    className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                      isSimulating 
                        ? 'bg-blue-600/15 border border-blue-500/20 text-blue-400' 
                        : 'bg-slate-800 border border-white/5 text-slate-400'
                    }`}
                  >
                    {isSimulating ? (
                      <>
                        <Pause size={10} />
                        Active
                      </>
                    ) : (
                      <>
                        <Play size={10} />
                        Paused
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulatedPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => {
                    setSelectedSimPatient(patient)
                    setOverrideHR(patient.heartRate)
                    setOverrideSpO2(patient.oxygen)
                    setOverrideTemp(patient.temp)
                    setOverrideSys(patient.bpSys)
                    setOverrideDia(patient.bpDia)
                  }}
                  className={`glass-card p-4 space-y-3 cursor-pointer hover:border-white/10 transition-all duration-200 ${
                    patient.isCritical 
                      ? 'border-rose-500/40 bg-rose-950/10 shadow-lg relative overflow-hidden animate-pulse' 
                      : selectedSimPatient?.id === patient.id
                      ? 'border-blue-500/30'
                      : ''
                  }`}
                >
                  {patient.isCritical && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-bl">
                      Critical Threat
                    </div>
                  )}

                  {/* Header info */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-white text-sm">{patient.name}</h3>
                      <span className="text-[10px] text-slate-500">{patient.code} | Unit 0{patient.id}</span>
                    </div>
                  </div>

                  {/* Waveform Canvas */}
                  <EcgMonitor heartRate={patient.heartRate} isCritical={patient.isCritical} />

                  {/* Vital numbers */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {/* HR */}
                    <div className={`p-2 rounded-lg ${patient.heartRate > 120 || patient.heartRate < 50 ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-slate-900/40 text-emerald-400'}`}>
                      <div className="text-[9px] uppercase font-semibold text-slate-500 flex items-center justify-center gap-0.5">
                        <Heart size={8} className="animate-beat inline" />
                        HR
                      </div>
                      <div className="text-xs font-black">{patient.heartRate}</div>
                    </div>

                    {/* SpO2 */}
                    <div className={`p-2 rounded-lg ${patient.oxygen < 92 ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-slate-900/40 text-blue-400'}`}>
                      <div className="text-[9px] uppercase font-semibold text-slate-500">SpO2</div>
                      <div className="text-xs font-black">{patient.oxygen}%</div>
                    </div>

                    {/* BP */}
                    <div className={`p-2 rounded-lg ${patient.bpSys >= 180 || patient.bpSys < 90 ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-slate-900/40 text-slate-300'}`}>
                      <div className="text-[9px] uppercase font-semibold text-slate-500">BP</div>
                      <div className="text-xs font-black leading-none mt-0.5">{patient.bpSys}/{patient.bpDia}</div>
                    </div>

                    {/* Temp */}
                    <div className={`p-2 rounded-lg ${patient.temp > 101.5 || patient.temp < 96.0 ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-slate-900/40 text-amber-400'}`}>
                      <div className="text-[9px] uppercase font-semibold text-slate-500">Temp</div>
                      <div className="text-xs font-black">{patient.temp}°F</div>
                    </div>
                  </div>

                  {/* Triggers indicator */}
                  {patient.isCritical && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.triggers.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-rose-500/10 border border-rose-500/20 text-rose-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Details & Override Panel */}
          <div className="space-y-4">
            {selectedSimPatient ? (
              <div className="glass-card p-5 space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <div>
                    <h3 className="font-bold text-white text-base">Bedside Monitor</h3>
                    <p className="text-[10px] text-slate-500">Triage control panel for simulated case {selectedSimPatient.code}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedSimPatient(null)} 
                    className="p-1 rounded bg-white/5 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Patient status */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-black block">Active Patient</label>
                  <div className="text-lg font-bold text-white mt-1">{selectedSimPatient.name}</div>
                </div>

                {/* Overrides form */}
                <form onSubmit={applyBedsideOverride} className="space-y-4">
                  <h4 className="text-xs font-bold text-white border-t border-white/5 pt-3">Vital Overrides (Test Triage Engine)</h4>
                  
                  {/* HR slider */}
                  <div className="space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Heart Rate:</span>
                      <strong className="text-emerald-400 font-bold">{overrideHR} BPM</strong>
                    </div>
                    <input
                      type="range"
                      min="35"
                      max="180"
                      className="w-full h-1 bg-slate-800 accent-blue-500"
                      value={overrideHR}
                      onChange={(e) => setOverrideHR(parseInt(e.target.value))}
                    />
                  </div>

                  {/* SpO2 slider */}
                  <div className="space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Oxygen Level SpO2:</span>
                      <strong className="text-blue-400 font-bold">{overrideSpO2} %</strong>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="100"
                      className="w-full h-1 bg-slate-800 accent-blue-500"
                      value={overrideSpO2}
                      onChange={(e) => setOverrideSpO2(parseInt(e.target.value))}
                    />
                  </div>

                  {/* Temperature slider */}
                  <div className="space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Temperature:</span>
                      <strong className="text-amber-400 font-bold">{overrideTemp} °F</strong>
                    </div>
                    <input
                      type="range"
                      min="95.0"
                      max="106.0"
                      step="0.1"
                      className="w-full h-1 bg-slate-800 accent-blue-500"
                      value={overrideTemp}
                      onChange={(e) => setOverrideTemp(parseFloat(e.target.value))}
                    />
                  </div>

                  {/* BP grid inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-slate-400">BP Systolic</div>
                      <input
                        type="number"
                        className="input text-xs py-1"
                        value={overrideSys}
                        onChange={(e) => setOverrideSys(parseInt(e.target.value) || 120)}
                      />
                    </div>
                    <div className="space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-slate-400">BP Diastolic</div>
                      <input
                        type="number"
                        className="input text-xs py-1"
                        value={overrideDia}
                        onChange={(e) => setOverrideDia(parseInt(e.target.value) || 80)}
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full btn btn-primary py-2.5 text-xs">
                    Apply Clinical Overrides
                  </button>
                </form>

                {/* Induced emergency presets */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black block">Induce Pathology (Simulate)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => induceEmergencyPreset(selectedSimPatient.id, 'cardiac')}
                      className="p-2 text-[10px] rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      Heart Attack (HTN)
                    </button>
                    <button
                      onClick={() => induceEmergencyPreset(selectedSimPatient.id, 'hypoxia')}
                      className="p-2 text-[10px] rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      Severe Hypoxia
                    </button>
                    <button
                      onClick={() => induceEmergencyPreset(selectedSimPatient.id, 'shock')}
                      className="p-2 text-[10px] rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      Bradycardic Shock
                    </button>
                    <button
                      onClick={() => induceEmergencyPreset(selectedSimPatient.id, 'normalize')}
                      className="p-2 text-[10px] rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                    >
                      Stabilize Vitals
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-6 text-center text-slate-500 flex flex-col items-center justify-center gap-3 h-[300px]">
                <Activity size={24} className="text-slate-600 opacity-60" />
                <h4 className="text-sm font-bold text-white">Select Telemetry Unit</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Click on any patient's monitor card to open manual clinical overrides, inspect full telemetry parameters, and test the alert engine.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'active-alerts' && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-white">Critical Incident Triage Logs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Audits of vital alerts logged by active bedside monitors</p>
            </div>
            <button 
              onClick={loadAlertsAndStats} 
              className="p-2 rounded bg-white/5 text-slate-400 hover:text-white"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-white/5">
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Alert Time</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Patient</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Recorded Vitals</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Trigger Causes</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">ICU Need</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Triage Status</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(alert.created_at).toLocaleDateString()} <br />
                          <span className="text-[10px] opacity-75">
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-white">{alert.patient_name}</div>
                          <span className="text-[10px] text-slate-400">Code: {alert.patient_code}</span>
                        </td>
                        <td className="p-4">
                          <div className="grid grid-cols-2 gap-x-3 text-[10px] text-slate-400">
                            <span>HR: <strong className="text-white">{alert.heart_rate}</strong></span>
                            <span>SpO2: <strong className="text-white">{alert.oxygen_level}%</strong></span>
                            <span>BP: <strong className="text-white">{alert.systolic_bp}/{alert.diastolic_bp}</strong></span>
                            <span>Temp: <strong className="text-white">{alert.temperature}°F</strong></span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {alert.trigger_vitals.map(v => (
                              <span key={v} className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold uppercase">
                                {v}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          {alert.icu_required ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] bg-rose-500/20 text-rose-300 font-bold uppercase">
                              ICU Recommended
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">General Ward</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            alert.status === 'active' 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                              : alert.status === 'acknowledged'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {alert.status === 'active' && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleResolveAlert(alert.id, 'acknowledged')}
                                className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-amber-500/10 hover:border-amber-500/20 text-amber-400 text-[10px] transition-colors"
                              >
                                Acknowledge
                              </button>
                            </div>
                          )}
                          {alert.status === 'acknowledged' && (
                            <button
                              onClick={() => handleResolveAlert(alert.id, 'resolved')}
                              className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/20 text-emerald-400 text-[10px] transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          {alert.status === 'resolved' && (
                            <span className="text-[10px] text-slate-600 italic">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-600 text-xs">
                        No telemetry emergency incidents logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
