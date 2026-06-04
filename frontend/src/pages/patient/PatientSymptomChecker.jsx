import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Brain, Activity, ShieldAlert, CheckCircle, RefreshCw, Calendar,
  User, Database, AlertTriangle, FileText, Check, ShieldCheck,
  Search, X, Plus, Sparkles, Tag
} from 'lucide-react'
import { predictionApi } from '@/services/predictionApi'
import { patientApi } from '@/services/patientApi'
import api from '@/services/api'
import toast from 'react-hot-toast'
import SYMPTOM_LIBRARY from '@/data/symptoms.json'

/* ─── legacy 12-item static list (for backward compat with presets) ─── */
const LEGACY_SYMPTOMS = [
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

/* ─── categories derived from the library ─── */
const CATEGORIES = [...new Set(SYMPTOM_LIBRARY.map(s => s.category))].sort()

/* ─── helper: extract keywords from free-form text ─── */
function extractSymptomTokens(text) {
  return text
    .split(/[,;]+/)
    .map(t => t.trim())
    .filter(t => t.length > 1)
}

/* ─── Searchable Symptom Input component ─── */
function SearchableSymptomInput({ selectedSymptoms, setSelectedSymptoms }) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  /* filtered suggestions */
  const suggestions = useMemo(() => {
    let pool = SYMPTOM_LIBRARY
    if (activeCategory !== 'All') {
      pool = pool.filter(s => s.category === activeCategory)
    }
    if (!query.trim()) return pool.slice(0, 12)
    const q = query.toLowerCase()
    return pool
      .filter(s => s.label.toLowerCase().includes(q) || s.id.includes(q.replace(/\s/g, '_')))
      .slice(0, 10)
  }, [query, activeCategory])

  /* click outside to close */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addSymptom = (symptomId) => {
    if (!selectedSymptoms.includes(symptomId)) {
      setSelectedSymptoms([...selectedSymptoms, symptomId])
    }
    setQuery('')
    setHighlightIdx(-1)
  }

  const removeSymptom = (symptomId) => {
    setSelectedSymptoms(selectedSymptoms.filter(id => id !== symptomId))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        addSymptom(suggestions[highlightIdx].id)
      } else if (query.trim()) {
        /* custom symptom — NLP keyword extraction */
        const tokens = extractSymptomTokens(query)
        tokens.forEach(tok => {
          const customId = tok.toLowerCase().replace(/\s+/g, '_')
          if (!selectedSymptoms.includes(customId)) {
            setSelectedSymptoms(prev => [...prev, customId])
          }
        })
        setQuery('')
        toast.success(`Added ${tokens.length} custom symptom${tokens.length > 1 ? 's' : ''}`)
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const getLabelForId = (id) => {
    const found = SYMPTOM_LIBRARY.find(s => s.id === id)
    return found ? found.label : id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const getCategoryForId = (id) => {
    const found = SYMPTOM_LIBRARY.find(s => s.id === id)
    return found ? found.category : 'Custom'
  }

  return (
    <div className="space-y-3">
      {/* ─── Search Bar ─── */}
      <div className="relative" ref={inputRef}>
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.6))',
            borderColor: showDropdown ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
            boxShadow: showDropdown ? '0 0 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)'
          }}
        >
          <Search size={16} className="text-indigo-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search symptoms... (e.g. chest pain, fever, headache)"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); setHighlightIdx(-1) }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button onClick={() => { setQuery(''); setHighlightIdx(-1) }}
              className="text-slate-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
          <div className="h-4 w-px bg-white/10" />
          <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
            {selectedSymptoms.length} selected
          </span>
        </div>

        {/* ─── Dropdown ─── */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-2 w-full rounded-2xl border overflow-hidden animate-fade-in"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(10,15,30,0.98))',
              borderColor: 'rgba(255,255,255,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(99,102,241,0.08)',
              backdropFilter: 'blur(20px)',
              maxHeight: '380px'
            }}
          >
            {/* Category pills */}
            <div className="p-3 border-b border-white/5 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {['All', ...CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setHighlightIdx(-1) }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap transition-all duration-200"
                  style={{
                    background: activeCategory === cat
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))'
                      : 'rgba(255,255,255,0.03)',
                    color: activeCategory === cat ? '#a5b4fc' : '#64748b',
                    border: `1px solid ${activeCategory === cat ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: activeCategory === cat ? '0 0 10px rgba(99,102,241,0.15)' : 'none'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Suggestions list */}
            <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
              {suggestions.length > 0 ? (
                suggestions.map((s, idx) => {
                  const isSelected = selectedSymptoms.includes(s.id)
                  const isHighlighted = idx === highlightIdx
                  return (
                    <button
                      key={s.id}
                      onClick={() => { addSymptom(s.id); setShowDropdown(false) }}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-left transition-all duration-150"
                      style={{
                        background: isHighlighted
                          ? 'linear-gradient(90deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))'
                          : isSelected
                            ? 'rgba(16,185,129,0.05)'
                            : 'transparent',
                        borderLeft: isHighlighted ? '2px solid #6366f1' : '2px solid transparent'
                      }}
                      onMouseEnter={() => setHighlightIdx(idx)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isSelected ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isSelected ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`
                          }}
                        >
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-white">{s.label}</span>
                          <span className="text-[10px] text-slate-500 ml-2">{s.category}</span>
                        </div>
                      </div>
                      {!isSelected && (
                        <Plus size={12} className="text-slate-600" />
                      )}
                    </button>
                  )
                })
              ) : (
                <div className="px-4 py-6 text-center">
                  <Sparkles size={16} className="text-indigo-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-500">No matching symptoms found</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono">Enter</kbd> to add "<span className="text-indigo-400">{query}</span>" as custom
                  </p>
                </div>
              )}
            </div>

            {/* Footer tip */}
            <div className="p-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[9px] text-slate-600">
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono mr-1">↑↓</kbd>
                Navigate
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono mx-1">Enter</kbd>
                Select
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono mx-1">Esc</kbd>
                Close
              </span>
              <span className="text-[9px] text-slate-600">
                {SYMPTOM_LIBRARY.length} symptoms available
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Selected Symptom Chips ─── */}
      {selectedSymptoms.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-fade-in">
          {selectedSymptoms.map(id => {
            const cat = getCategoryForId(id)
            const isCustom = cat === 'Custom'
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 group"
                style={{
                  background: isCustom
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,88,12,0.1))'
                    : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                  border: `1px solid ${isCustom ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)'}`,
                  color: isCustom ? '#fbbf24' : '#a5b4fc'
                }}
              >
                {isCustom && <Sparkles size={9} className="opacity-70" />}
                <Tag size={9} className="opacity-50" />
                {getLabelForId(id)}
                <button
                  onClick={() => removeSymptom(id)}
                  className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-white/10 transition-all"
                >
                  <X size={8} />
                </button>
              </span>
            )
          })}
          {selectedSymptoms.length > 2 && (
            <button
              onClick={() => setSelectedSymptoms([])}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.15)'
              }}
            >
              <X size={8} /> Clear All
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT — PatientSymptomChecker
   ═══════════════════════════════════════════════════════════════════ */
export default function PatientSymptomChecker() {
  const navigate = useNavigate()
  
  const getSeverityBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return <span className="badge-severity-low">🟢 Low</span>
      case 'medium':
        return <span className="badge-severity-medium">🟡 Medium</span>
      case 'high':
        return <span className="badge-severity-high">🔴 High</span>
      case 'emergency':
        return <span className="badge-severity-emergency">⚠️ Emergency</span>
      default:
        return <span className="badge bg-slate-500/10 text-slate-400 border border-white/5">{level}</span>
    }
  }

  const [patient, setPatient] = useState(null)
  const [fever, setFever] = useState(98.6)
  const [cough, setCough] = useState(false)
  const [oxygen, setOxygen] = useState(98)
  const [systolic, setSystolic] = useState(120)
  const [diastolic, setDiastolic] = useState(80)
  const [sugar, setSugar] = useState(95)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [modelType, setModelType] = useState('Random Forest')
  
  const [loading, setLoading] = useState(false)
  const [predictionResult, setPredictionResult] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    loadPatientAndHistory()
  }, [])

  const loadPatientAndHistory = async () => {
    try {
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user
      
      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(p => p.email === loggedUser.email)
      
      if (linkedPatient) {
        setPatient(linkedPatient)
        const { data: histRes } = await predictionApi.getHistory({ patient_id: linkedPatient.id })
        setHistory(histRes.history || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const toggleSymptom = (symptomId) => {
    if (selectedSymptoms.includes(symptomId)) {
      setSelectedSymptoms(selectedSymptoms.filter(id => id !== symptomId))
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptomId])
    }
  }

  const handlePredict = async (e) => {
    e.preventDefault()
    if (!patient) return toast.error('Patient clinical profile is required to log prediction history.')
    
    setLoading(true)
    setPredictionResult(null)

    const payload = {
      patient_id: patient.id,
      fever,
      cough,
      oxygen_level: oxygen,
      systolic_bp: systolic,
      diastolic_bp: diastolic,
      sugar_level: sugar,
      symptoms: selectedSymptoms,
      model_used: modelType
    }

    try {
      const { data } = await predictionApi.predict(payload)
      setPredictionResult(data.prediction)
      toast.success('AI diagnostic evaluation complete!')
      loadPatientAndHistory()
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI prediction failed')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (type) => {
    if (type === 'pneumonia') {
      setFever(102.1)
      setCough(true)
      setOxygen(89)
      setSystolic(110)
      setDiastolic(70)
      setSugar(90)
      setSelectedSymptoms(['shortness_of_breath', 'chest_pain', 'fatigue'])
      toast.success('Loaded preset: Pneumonia symptoms')
    } else if (type === 'dka') {
      setFever(98.8)
      setCough(false)
      setOxygen(98)
      setSystolic(105)
      setDiastolic(68)
      setSugar(340)
      setSelectedSymptoms(['nausea', 'vomiting', 'fatigue', 'confusion'])
      toast.success('Loaded preset: Diabetic Ketoacidosis symptoms')
    } else if (type === 'hypertension') {
      setFever(98.0)
      setCough(false)
      setOxygen(99)
      setSystolic(195)
      setDiastolic(115)
      setSugar(100)
      setSelectedSymptoms(['headache', 'dizziness', 'chest_pain'])
      toast.success('Loaded preset: Hypertension Crisis symptoms')
    } else if (type === 'cold') {
      setFever(99.4)
      setCough(true)
      setOxygen(99)
      setSystolic(120)
      setDiastolic(80)
      setSugar(85)
      setSelectedSymptoms(['sore_throat', 'runny_nose', 'fatigue'])
      toast.success('Loaded preset: Common Cold symptoms')
    }
  }

  const getConfidenceParams = (percentage) => {
    const radius = 50
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference
    return { circumference, offset }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="text-blue-500 animate-pulse" size={26} />
          AI Symptom Checker
        </h1>
        <p className="text-slate-400 text-sm mt-1">Check symptoms, analyze vitals, and get immediate department referrals using Machine Learning classifiers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vital Input Form */}
        <div className="lg:col-span-2 glass-card p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <h2 className="text-base font-bold text-white">Input Vitals & Symptoms</h2>
            <div className="flex gap-2">
              <button onClick={() => applyPreset('cold')} className="px-2 py-1 text-[10px] rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300">Cold</button>
              <button onClick={() => applyPreset('pneumonia')} className="px-2 py-1 text-[10px] rounded bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400">Pneumonia</button>
              <button onClick={() => applyPreset('dka')} className="px-2 py-1 text-[10px] rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400">DKA</button>
            </div>
          </div>

          <form onSubmit={handlePredict} className="space-y-6">
            {/* Vitals range selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fever */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Body Temp</span>
                  <span className="text-xs font-bold text-white">{fever} °F</span>
                </div>
                <input
                  type="range" min="96.0" max="105.0" step="0.1"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={fever}
                  onChange={(e) => setFever(parseFloat(e.target.value))}
                />
              </div>

              {/* Oxygen */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Oxygen SpO2</span>
                  <span className="text-xs font-bold text-white">{oxygen} %</span>
                </div>
                <input
                  type="range" min="70" max="100"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={oxygen}
                  onChange={(e) => setOxygen(parseInt(e.target.value))}
                />
              </div>

              {/* Sugar */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Fasting Sugar</span>
                  <span className="text-xs font-bold text-white">{sugar} mg/dL</span>
                </div>
                <input
                  type="range" min="50" max="400"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={sugar}
                  onChange={(e) => setSugar(parseInt(e.target.value))}
                />
              </div>

              {/* Systolic */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Systolic BP</span>
                  <span className="text-xs font-bold text-white">{systolic} mmHg</span>
                </div>
                <input
                  type="range" min="80" max="220"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={systolic}
                  onChange={(e) => setSystolic(parseInt(e.target.value))}
                />
              </div>

              {/* Diastolic */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Diastolic BP</span>
                  <span className="text-xs font-bold text-white">{diastolic} mmHg</span>
                </div>
                <input
                  type="range" min="50" max="130"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={diastolic}
                  onChange={(e) => setDiastolic(parseInt(e.target.value))}
                />
              </div>

              {/* Cough */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase block">Dry Cough</span>
                  <span className="text-[9px] text-slate-500">Persistent symptoms</span>
                </div>
                <button
                  type="button" onClick={() => setCough(!cough)}
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors ${cough ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <div className={`bg-white w-5 h-5 rounded-full shadow transform transition-transform ${cough ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Model Type */}
            <div>
              <label className="label-text">Select AI Model Algorithm</label>
              <select
                className="input-field mt-1"
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
              >
                <option value="Random Forest" className="bg-slate-900 text-white">Random Forest (Ensemble Triage Model)</option>
                <option value="Decision Tree" className="bg-slate-900 text-white">Decision Tree (Standard Rules Model)</option>
                <option value="XGBoost" className="bg-slate-900 text-white">XGBoost (Gradient Boosted Tree)</option>
              </select>
            </div>

            {/* ══════ NEW: SEARCHABLE SYMPTOM INPUT ══════ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="label-text flex items-center gap-2">
                  <Search size={13} className="text-indigo-400" />
                  Search & Select Symptoms
                </label>
                <span className="text-[10px] text-slate-600">{SYMPTOM_LIBRARY.length} symptoms available</span>
              </div>
              <SearchableSymptomInput
                selectedSymptoms={selectedSymptoms}
                setSelectedSymptoms={setSelectedSymptoms}
              />
            </div>

            {/* ══════ ORIGINAL: Symptom grid (quick-select common symptoms) ══════ */}
            <div className="space-y-2">
              <label className="label-text">Quick Select — Common Symptoms</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {LEGACY_SYMPTOMS.map((s) => {
                  const active = selectedSymptoms.includes(s.id)
                  return (
                    <button
                      key={s.id} type="button" onClick={() => toggleSymptom(s.id)}
                      className={`p-2.5 text-left text-xs rounded-xl border transition-all flex items-center justify-between ${
                        active ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border flex items-center justify-center ${active ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600'}`}>
                        {active && <Check size={8} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <><Brain size={16} /> Run Diagnostics Analysis</>}
            </button>
          </form>
        </div>

        {/* Diagnostic Results & History Sidebar */}
        <div className="space-y-6">
          {predictionResult ? (
            <div className="glass-card p-6 space-y-5 border-blue-500/30 bg-gradient-to-br from-blue-500/[0.03] via-slate-950/60 to-slate-900/80 animate-fade-in" style={{ boxShadow: '0 0 25px rgba(59,130,246,0.15)' }}>
              <div className="border-b border-white/5 pb-3">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={10} className="animate-pulse" /> Inference Verdict
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{predictionResult.predicted_disease}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center min-h-[64px]">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Triage Level</span>
                  <div className="mt-2 scale-95">{getSeverityBadge(predictionResult.risk_level)}</div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center min-h-[64px]">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Referral</span>
                  <div className="text-xs font-black text-white truncate mt-2">{predictionResult.recommended_dept}</div>
                </div>
              </div>

              {/* Confidence Circle */}
              <div className="flex flex-col items-center py-2">
                <div className="relative flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle cx="48" cy="48" r="38" className="text-slate-800" strokeWidth="8" stroke="currentColor" fill="transparent" />
                    <circle cx="48" cy="48" r="38" className="text-blue-500" strokeWidth="8"
                       strokeDasharray={getConfidenceParams(predictionResult.confidence).circumference}
                       strokeDashoffset={getConfidenceParams(predictionResult.confidence).offset}
                       strokeLinecap="round" stroke="currentColor" fill="transparent" />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-lg font-black text-white">{predictionResult.confidence}%</span>
                    <span className="block text-[8px] text-slate-500 uppercase font-semibold">Confidence</span>
                  </div>
                </div>
              </div>

              {DEPARTMENTS[predictionResult.recommended_dept] && (
                <div className={`p-4 rounded-xl bg-gradient-to-br ${DEPARTMENTS[predictionResult.recommended_dept].color} text-white`}>
                  <div className="text-[10px] opacity-75 uppercase font-bold">Assigned Department Location</div>
                  <div className="text-sm font-bold mt-0.5">{predictionResult.recommended_dept}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">{DEPARTMENTS[predictionResult.recommended_dept].location}</div>
                </div>
              )}

              {/* Recommended Booking Action */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 space-y-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Recommended Action</span>
                <p className="text-xs font-bold text-white leading-normal">
                  Book {predictionResult.recommended_dept} Consultation
                </p>
                <button
                  onClick={() => navigate('/patient/appointments', { state: { departmentName: predictionResult.recommended_dept } })}
                  className="w-full btn btn-primary py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Calendar size={13} /> Book Appointment
                </button>
              </div>

              <div className="flex gap-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-500/80 leading-normal">
                  Inferences are triaging recommendations only. Please consult a doctor immediately for clinical validation.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 text-center text-slate-500 flex flex-col items-center justify-center gap-3 h-80">
              <Brain size={32} className="opacity-30" />
              <h3 className="text-sm font-semibold text-white">Diagnostics Pending</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-normal">
                Adjust vitals sliders and check signs, then click diagnostic inference to trigger ML evaluations.
              </p>
            </div>
          )}

          {/* Quick Logs */}
          <div className="glass-card p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText size={12} /> Recent Triages
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.length > 0 ? (
                history.slice(0, 4).map((h, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] flex justify-between items-center">
                    <div>
                      <strong className="text-white font-bold block">{h.predicted_disease}</strong>
                      <span className="text-slate-500">{h.model_used} | {h.confidence}% conf.</span>
                    </div>
                    <div className="scale-90 origin-right">
                      {getSeverityBadge(h.risk_level)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-600 text-xs">No prediction history yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
