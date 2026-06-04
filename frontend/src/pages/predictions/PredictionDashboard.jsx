import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Activity, ShieldAlert, CheckCircle, RefreshCw, Calendar,
  User, Database, BarChart2, TrendingUp, AlertTriangle, FileText, Check, Search, Plus, Info
} from 'lucide-react'
import { predictionApi } from '@/services/predictionApi'
import { patientApi } from '@/services/patientApi'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import toast from 'react-hot-toast'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const SYMPTOMS = [
  { id: 'shortness_of_breath', label: 'Shortness of Breath' },
  { id: 'fatigue', label: 'Fatigue / Tiredness' },
  { id: 'chest_pain', label: 'Chest Pain' },
  { id: 'headache', label: 'Headache' },
  { id: 'body_ache', label: 'Body Ache' },
  { id: 'sore_throat', label: 'Sore Throat' },
  { id: 'runny_nose', label: 'Runny Nose' },
  { id: 'nausea', label: 'Nausea' },
  { id: 'vomiting', label: 'Vomiting' },
  { id: 'dizziness', label: 'Dizziness' },
  { id: 'confusion', label: 'Confusion' },
  { id: 'wheezing', label: 'Wheezing' }
]

const DEPARTMENTS = {
  'General Medicine': { location: 'Block A, Floor 0', color: 'from-blue-600 to-cyan-500', glow: 'rgba(59,130,246,0.3)' },
  'Pulmonology': { location: 'Block B, Floor 2', color: 'from-rose-600 to-pink-500', glow: 'rgba(244,63,94,0.3)' },
  'Endocrinology': { location: 'Block C, Floor 2', color: 'from-emerald-600 to-green-500', glow: 'rgba(16,185,129,0.3)' },
  'Cardiology': { location: 'Block A, Floor 2', color: 'from-violet-600 to-purple-500', glow: 'rgba(139,92,246,0.3)' },
  'Neurology': { location: 'Block B, Floor 3', color: 'from-amber-600 to-orange-500', glow: 'rgba(245,158,11,0.3)' }
}

export default function PredictionDashboard() {
  const [activeTab, setActiveTab] = useState('predict')
  
  // Predict Form State
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [fever, setFever] = useState(98.6)
  const [cough, setCough] = useState(false)
  const [oxygen, setOxygen] = useState(98)
  const [systolic, setSystolic] = useState(120)
  const [diastolic, setDiastolic] = useState(80)
  const [sugar, setSugar] = useState(95)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [modelType, setModelType] = useState('Random Forest')
  
  // API Load State
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)
  const [predictionResult, setPredictionResult] = useState(null)
  
  // Stats and Metrics Data
  const [stats, setStats] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [history, setHistory] = useState([])
  const [statsLoading, setStatsLoading] = useState(false)
  
  // Search query for history
  const [historySearch, setHistorySearch] = useState('')
  const [historyRiskFilter, setHistoryRiskFilter] = useState('all')

  // Load patient list and initial stats
  useEffect(() => {
    patientApi.list({ limit: 100 })
      .then(({ data }) => setPatients(data?.patients || []))
      .catch(err => console.error('Failed to load patients', err))

    loadDashboardStats()
  }, [])

  const loadDashboardStats = () => {
    setStatsLoading(true)
    Promise.all([
      predictionApi.getStats(),
      predictionApi.getMetrics(),
      predictionApi.getHistory()
    ])
      .then(([statsRes, metricsRes, historyRes]) => {
        setStats(statsRes.data)
        setMetrics(metricsRes.data.metrics)
        setHistory(historyRes.data.history)
      })
      .catch(err => console.error('Failed to load metrics/stats', err))
      .finally(() => setStatsLoading(false))
  }

  // Pre-fill vitals if patient is selected
  const handlePatientSelect = (e) => {
    const pId = e.target.value
    setSelectedPatientId(pId)
    if (!pId) return

    const patient = patients.find(p => p.id === parseInt(pId))
    if (patient) {
      toast.success(`Loaded profile for ${patient.full_name}`)
      // Load patient-specific history or set default vitals for simulation
      // If patient has chronic conditions, we can suggest symptoms
      const chronic = patient.chronic_conditions?.toLowerCase() || ''
      const preSelectedSymp = []
      if (chronic.includes('asthma') || chronic.includes('copd')) {
        preSelectedSymp.push('shortness_of_breath')
        preSelectedSymp.push('wheezing')
        setOxygen(94)
      }
      if (chronic.includes('diabetes')) {
        setSugar(160)
      }
      if (chronic.includes('hypertension')) {
        setSystolic(140)
        setDiastolic(90)
      }
      setSelectedSymptoms(preSelectedSymp)
    }
  }

  const toggleSymptom = (symptomId) => {
    if (selectedSymptoms.includes(symptomId)) {
      setSelectedSymptoms(selectedSymptoms.filter(id => id !== symptomId))
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptomId])
    }
  }

  const handlePredict = (e) => {
    e.preventDefault()
    setLoading(true)
    setPredictionResult(null)

    const payload = {
      patient_id: selectedPatientId ? parseInt(selectedPatientId) : null,
      fever,
      cough,
      oxygen_level: oxygen,
      systolic_bp: systolic,
      diastolic_bp: diastolic,
      sugar_level: sugar,
      symptoms: selectedSymptoms,
      model_used: modelType
    }

    predictionApi.predict(payload)
      .then(({ data }) => {
        setPredictionResult(data.prediction)
        toast.success('AI Prediction computed!')
        // Reload history log and dashboard stats
        loadDashboardStats()
      })
      .catch(err => {
        console.error(err)
        toast.error(err.response?.data?.error || 'Failed to complete prediction')
      })
      .finally(() => setLoading(false))
  }

  // Trigger retraining pipeline
  const handleTrainModels = () => {
    setTraining(true)
    toast.loading('ML Pipeline: Training Random Forest, Decision Tree & XGBoost models...', { id: 'training-toast' })
    
    predictionApi.train()
      .then(({ data }) => {
        toast.success('Model training successfully completed! Accuracy metrics updated.', { id: 'training-toast' })
        setMetrics(data.metrics)
        loadDashboardStats()
      })
      .catch(err => {
        console.error(err)
        toast.error('Retraining failed: ' + (err.response?.data?.error || err.message), { id: 'training-toast' })
      })
      .finally(() => setTraining(false))
  }

  // Quick preset loader to test clinical logic
  const applyPreset = (type) => {
    if (type === 'pneumonia') {
      setFever(102.1)
      setCough(true)
      setOxygen(89)
      setSystolic(110)
      setDiastolic(70)
      setSugar(90)
      setSelectedSymptoms(['shortness_of_breath', 'chest_pain', 'fatigue'])
      toast.success('Applied "Pneumonia" vital presets')
    } else if (type === 'dka') {
      setFever(98.8)
      setCough(false)
      setOxygen(98)
      setSystolic(105)
      setDiastolic(68)
      setSugar(340)
      setSelectedSymptoms(['nausea', 'vomiting', 'fatigue', 'confusion'])
      toast.success('Applied "Diabetic Ketoacidosis" vital presets')
    } else if (type === 'hypertension') {
      setFever(98.0)
      setCough(false)
      setOxygen(99)
      setSystolic(195)
      setDiastolic(115)
      setSugar(100)
      setSelectedSymptoms(['headache', 'dizziness', 'chest_pain'])
      toast.success('Applied "Hypertension Crisis" vital presets')
    } else if (type === 'cold') {
      setFever(99.4)
      setCough(true)
      setOxygen(99)
      setSystolic(120)
      setDiastolic(80)
      setSugar(85)
      setSelectedSymptoms(['sore_throat', 'runny_nose', 'fatigue'])
      toast.success('Applied "Common Cold" vital presets')
    }
  }

  // Model Comparison Chart Data
  const modelComparisonChart = metrics ? {
    labels: Object.keys(metrics),
    datasets: [
      {
        label: 'Accuracy',
        data: Object.values(metrics).map(m => m.accuracy),
        backgroundColor: 'rgba(59,130,246,0.85)',
        borderRadius: 6,
      },
      {
        label: 'F1 Score',
        data: Object.values(metrics).map(m => m.f1_score),
        backgroundColor: 'rgba(16,185,129,0.85)',
        borderRadius: 6,
      }
    ]
  } : null

  // Feature Importance Chart Data for selected model
  const selectedModelMetrics = metrics ? metrics[modelType] : null
  const featureImportanceChart = selectedModelMetrics ? {
    labels: selectedModelMetrics.feature_importances.slice(0, 10).map(item => item[0].replace('_', ' ')),
    datasets: [{
      label: 'Importance Value',
      data: selectedModelMetrics.feature_importances.slice(0, 10).map(item => item[1]),
      backgroundColor: 'rgba(139,92,246,0.8)',
      borderRadius: 6,
    }]
  } : null

  // Filtered History
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.patient_name.toLowerCase().includes(historySearch.toLowerCase()) || 
      item.predicted_disease.toLowerCase().includes(historySearch.toLowerCase())
    const matchesRisk = historyRiskFilter === 'all' || item.risk_level === historyRiskFilter
    return matchesSearch && matchesRisk
  })

  // Gauge circular parameters
  const getConfidenceParams = (percentage) => {
    const radius = 50
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference
    return { circumference, offset }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="text-blue-500 animate-pulse" size={26} />
            AI Disease Prediction
          </h1>
          <p className="text-slate-400 text-sm mt-1">Multi-model diagnostic clinical aid for triage and risk assessment</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900/60 backdrop-blur-md p-1 rounded-xl border border-white/5 self-stretch md:self-auto">
          <button
            onClick={() => setActiveTab('predict')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'predict' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity size={14} />
            Diagnose Vitals
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 size={14} />
            Model Analytics
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText size={14} />
            Prediction Logs
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'predict' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="text-blue-400" size={18} />
                Clinical Case Input
              </h2>
              {/* Presets */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Presets:</span>
                <button onClick={() => applyPreset('pneumonia')} className="px-2.5 py-1 text-[10px] rounded bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 text-rose-400 transition-colors">Pneumonia</button>
                <button onClick={() => applyPreset('dka')} className="px-2.5 py-1 text-[10px] rounded bg-white/5 border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/20 text-emerald-400 transition-colors">DKA</button>
                <button onClick={() => applyPreset('hypertension')} className="px-2.5 py-1 text-[10px] rounded bg-white/5 border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/20 text-amber-400 transition-colors">HTN Crisis</button>
                <button onClick={() => applyPreset('cold')} className="px-2.5 py-1 text-[10px] rounded bg-white/5 border border-white/5 hover:bg-slate-500/20 hover:border-slate-500/30 text-slate-300 transition-colors">Cold</button>
              </div>
            </div>

            <form onSubmit={handlePredict} className="space-y-6">
              {/* Patient Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Link Active Patient <span className="text-slate-500 text-[10px]">(Optional)</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-slate-500" size={16} />
                    <select
                      className="select pl-9"
                      value={selectedPatientId}
                      onChange={handlePatientSelect}
                    >
                      <option value="">-- Select Patient Profile --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">ML Classifier Engine</label>
                  <select
                    className="select"
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value)}
                  >
                    <option value="Random Forest">Random Forest Classifier (Ensemble)</option>
                    <option value="Decision Tree">Decision Tree Classifier</option>
                    <option value="XGBoost">XGBoost Gradient Boosting Classifier</option>
                  </select>
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Fever */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Fever / Temp</label>
                    <span className="text-xs font-bold text-white">{fever} °F</span>
                  </div>
                  <input
                    type="range"
                    min="96.0"
                    max="105.0"
                    step="0.1"
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    value={fever}
                    onChange={(e) => setFever(parseFloat(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>96 °F</span>
                    <span>98.6 °F (Norm)</span>
                    <span>105 °F</span>
                  </div>
                </div>

                {/* Oxygen Level */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Oxygen Level</label>
                    <span className={`text-xs font-bold ${oxygen < 92 ? 'text-rose-400' : 'text-white'}`}>{oxygen} % SpO2</span>
                  </div>
                  <input
                    type="range"
                    min="75"
                    max="100"
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    value={oxygen}
                    onChange={(e) => setOxygen(parseInt(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>75 %</span>
                    <span>95 % (Norm)</span>
                    <span>100 %</span>
                  </div>
                </div>

                {/* Sugar Level */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Fasting Sugar</label>
                    <span className={`text-xs font-bold ${sugar > 140 ? 'text-rose-400' : 'text-white'}`}>{sugar} mg/dL</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="400"
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    value={sugar}
                    onChange={(e) => setSugar(parseInt(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>50</span>
                    <span>100 (Norm)</span>
                    <span>400</span>
                  </div>
                </div>

                {/* Systolic BP */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Systolic BP</label>
                    <span className={`text-xs font-bold ${systolic > 140 ? 'text-rose-400' : 'text-white'}`}>{systolic} mmHg</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="220"
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    value={systolic}
                    onChange={(e) => setSystolic(parseInt(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>80</span>
                    <span>120 (Norm)</span>
                    <span>220</span>
                  </div>
                </div>

                {/* Diastolic BP */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Diastolic BP</label>
                    <span className={`text-xs font-bold ${diastolic > 90 ? 'text-rose-400' : 'text-white'}`}>{diastolic} mmHg</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="130"
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    value={diastolic}
                    onChange={(e) => setDiastolic(parseInt(e.target.value))}
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>50</span>
                    <span>80 (Norm)</span>
                    <span>130</span>
                  </div>
                </div>

                {/* Cough Toggle */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold uppercase block">Persistent Cough</label>
                    <span className="text-[10px] text-slate-500">Triage flag</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCough(!cough)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                      cough ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                        cough ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Symptoms Selector */}
              <div className="space-y-2">
                <label className="label">Presenting Clinical Symptoms <span className="text-xs text-slate-500">(Toggle all that apply)</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {SYMPTOMS.map((symptom) => {
                    const isSelected = selectedSymptoms.includes(symptom.id)
                    return (
                      <button
                        key={symptom.id}
                        type="button"
                        onClick={() => toggleSymptom(symptom.id)}
                        className={`p-2.5 text-left text-xs rounded-xl border transition-all duration-200 flex items-center justify-between gap-1 ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500/40 text-blue-300 font-medium'
                            : 'bg-white/5 border-white/5 hover:border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{symptom.label}</span>
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <Check size={10} className="text-white font-bold" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn btn-primary flex items-center justify-center gap-2 py-3"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Analyzing Clinical Features...
                    </>
                  ) : (
                    <>
                      <Brain size={16} />
                      Execute Diagnostic Inference
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatientId('')
                    setFever(98.6)
                    setCough(false)
                    setOxygen(98)
                    setSystolic(120)
                    setDiastolic(80)
                    setSugar(95)
                    setSelectedSymptoms([])
                    setPredictionResult(null)
                  }}
                  className="px-4 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Results Side */}
          <div className="space-y-6">
            {predictionResult ? (
              <div className="glass-card p-6 space-y-6 relative overflow-hidden border-blue-500/20">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />

                <div className="border-b border-white/5 pb-4">
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Diagnostic Output</span>
                  <h3 className="text-2xl font-black text-white mt-1">{predictionResult.predicted_disease}</h3>
                </div>

                {/* Risk Level Badge */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-slate-400 mb-1 uppercase font-semibold">Triage Risk</div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg capitalize ${
                      predictionResult.risk_level === 'high'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : predictionResult.risk_level === 'medium'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <ShieldAlert size={12} />
                      {predictionResult.risk_level}
                    </span>
                  </div>

                  {/* Model Engine */}
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-slate-400 mb-1 uppercase font-semibold">Model Used</div>
                    <div className="text-xs font-bold text-white truncate">{predictionResult.model_used}</div>
                  </div>
                </div>

                {/* Confidence Meter Radial */}
                <div className="flex flex-col items-center py-4 bg-slate-900/30 rounded-2xl border border-white/5">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      {/* background circle */}
                      <circle
                        cx="64"
                        cy="64"
                        r="50"
                        className="text-slate-800"
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                      />
                      {/* confidence circle */}
                      <circle
                        cx="64"
                        cy="64"
                        r="50"
                        className="text-blue-500"
                        strokeWidth="10"
                        strokeDasharray={getConfidenceParams(predictionResult.confidence).circumference}
                        strokeDashoffset={getConfidenceParams(predictionResult.confidence).offset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-2xl font-black text-white">{predictionResult.confidence}%</span>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Confidence</p>
                    </div>
                  </div>
                </div>

                {/* Recommended Department Details */}
                {DEPARTMENTS[predictionResult.recommended_dept] && (
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${DEPARTMENTS[predictionResult.recommended_dept].color} text-white`}
                       style={{ boxShadow: `0 4px 16px ${DEPARTMENTS[predictionResult.recommended_dept].glow}` }}>
                    <div className="text-xs opacity-75 uppercase font-semibold">Recommended Ward / Referral</div>
                    <div className="text-lg font-bold mt-1">{predictionResult.recommended_dept}</div>
                    <div className="text-xs opacity-75 mt-1">Location: {DEPARTMENTS[predictionResult.recommended_dept].location}</div>
                  </div>
                )}

                {/* Warning note */}
                <div className="flex gap-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-500/80 leading-relaxed">
                    AI diagnostic references are for triage recommendation only. Clinicians must verify vitals and clinical signs before administering treatment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-3 h-[420px]">
                <div className="w-16 h-16 rounded-full bg-slate-900/60 flex items-center justify-center border border-white/5 mb-2">
                  <Brain size={28} className="text-slate-400 opacity-60" />
                </div>
                <h3 className="text-base font-bold text-white">Diagnostics Awaiting Vitals</h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Enter patient vitals and check symptoms to run classification inference across Random Forest, Decision Tree, and XGBoost models.
                </p>
              </div>
            )}

            {/* Quick Stats Panel */}
            <div className="glass-card p-5 space-y-4">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Database size={14} className="text-blue-400" />
                Diagnostic Pipeline Stats
              </h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="text-lg font-black text-white">{stats?.total_predictions || 0}</div>
                  <div className="text-[10px] text-slate-500">Inferences Logged</div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <div className="text-lg font-black text-white">{stats?.avg_confidence || 0}%</div>
                  <div className="text-[10px] text-slate-500">Avg Confidence</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="glass-card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-white">Algorithm Performance & Feature Rankings</h2>
              <p className="text-xs text-slate-400 mt-0.5">Model evaluations against hold-out synthetic clinical test data</p>
            </div>
            
            <button
              onClick={handleTrainModels}
              disabled={training}
              className="btn btn-primary text-xs flex items-center gap-2 py-2"
            >
              <RefreshCw className={training ? 'animate-spin' : ''} size={14} />
              Retrain ML Models
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Model comparison */}
            <div className="glass-card p-5 lg:col-span-2 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <BarChart2 size={16} className="text-blue-400" />
                Model Accuracy & F1 Score Comparison
              </h3>
              {modelComparisonChart ? (
                <div className="h-72">
                  <Bar
                    data={modelComparisonChart}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { labels: { color: '#94a3b8' } }
                      },
                      scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' } },
                        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' }, max: 1.0, beginAtZero: true }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="h-60 flex items-center justify-center text-slate-500">Loading charts...</div>
              )}
            </div>

            {/* Model select & stats */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="font-bold text-white text-sm">Active Model Metrics</h3>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">Select Model</label>
                <select
                  className="select mt-1"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                >
                  <option value="Random Forest">Random Forest Classifier</option>
                  <option value="Decision Tree">Decision Tree Classifier</option>
                  <option value="XGBoost">XGBoost Classifier</option>
                </select>
              </div>

              {selectedModelMetrics && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-400">Accuracy</span>
                    <span className="text-xs font-bold text-white">{(selectedModelMetrics.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-400">Weighted Precision</span>
                    <span className="text-xs font-bold text-white">{(selectedModelMetrics.precision * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-400">Weighted Recall</span>
                    <span className="text-xs font-bold text-white">{(selectedModelMetrics.recall * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-400">Weighted F1-Score</span>
                    <span className="text-xs font-bold text-white">{(selectedModelMetrics.f1_score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-xs text-slate-400">Dataset Splits</span>
                    <span className="text-xs font-bold text-slate-400">80% Train / 20% Test</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 2: Feature Importance */}
            <div className="glass-card p-5 lg:col-span-2 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-400" />
                Top 10 Feature Importances ({modelType})
              </h3>
              {featureImportanceChart ? (
                <div className="h-72">
                  <Bar
                    data={featureImportanceChart}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false }
                      },
                      scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' } },
                        y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="h-60 flex items-center justify-center text-slate-500">Loading charts...</div>
              )}
            </div>

            {/* Confusion matrix or details info */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Info size={15} className="text-blue-400" />
                Pipeline Metadata
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The models are trained using cross-validation over medical diagnostic simulations containing structured correlation parameters:
              </p>
              <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside bg-slate-900/30 p-3 rounded-xl border border-white/5">
                <li><strong className="text-white">Random Forest:</strong> Leverages feature bagger ensembles to avoid overfitting.</li>
                <li><strong className="text-white">Decision Tree:</strong> Provides trace paths for clinical diagnostic splits.</li>
                <li><strong className="text-white">XGBoost:</strong> Employs regularized gradient boosted decision trees for performance.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search patient or disease..."
                className="input pl-9 text-xs py-2"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <select
                className="select py-2 text-xs w-full md:w-44"
                value={historyRiskFilter}
                onChange={(e) => setHistoryRiskFilter(e.target.value)}
              >
                <option value="all">All Risks</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>
          </div>

          {/* History Logs Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-white/5">
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Timestamp</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Patient Profile</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Input Metrics Summary</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Symptoms</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Classifier used</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Diagnosis Prediction</th>
                    <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString()} <br />
                          <span className="text-[10px] opacity-75">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-white">{item.patient_name}</div>
                          <div className="text-[10px] text-slate-400">ID: #{item.patient_id || 'Anonymous'}</div>
                        </td>
                        <td className="p-4 text-xs text-slate-400 whitespace-normal">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                            <span>Temp: <strong className="text-white">{item.fever}°F</strong></span>
                            <span>SpO2: <strong className="text-white">{item.oxygen_level}%</strong></span>
                            <span>BP: <strong className="text-white">{item.systolic_bp}/{item.diastolic_bp}</strong></span>
                            <span>Sugar: <strong className="text-white">{item.sugar_level} mg/dL</strong></span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.symptoms.length > 0 ? (
                              item.symptoms.map(s => (
                                <span key={s} className="px-1.5 py-0.5 text-[9px] rounded-md bg-slate-800 border border-white/5 text-slate-400 truncate capitalize">
                                  {s.replace('_', ' ')}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-600 italic">None</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-400 font-medium">
                          {item.model_used}
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-white">{item.predicted_disease}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Dept: {item.recommended_dept} | Conf: {item.confidence}%
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.risk_level === 'high'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : item.risk_level === 'medium'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {item.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-600 text-xs">
                        No prediction records found matching the search criteria.
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
