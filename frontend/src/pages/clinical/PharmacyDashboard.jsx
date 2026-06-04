import { useState, useEffect } from 'react'
import {
  FileText, Activity, AlertTriangle, ShieldCheck, ShieldAlert,
  Search, Plus, Clipboard, User, Calendar, Trash2, CheckCircle2,
  AlertCircle, DollarSign, Layers, ChevronRight, X, Sparkles, RefreshCw
} from 'lucide-react'
import { pharmacyApi } from '@/services/pharmacyApi'
import { patientApi } from '@/services/patientApi'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import toast from 'react-hot-toast'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend
)

const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
    },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      padding: 8,
    }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.01)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 9 } } },
    y: { grid: { color: 'rgba(255,255,255,0.01)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 9 } }, beginAtZero: true }
  }
}

export default function PharmacyDashboard() {
  const [activeTab, setActiveTab] = useState('clinical-screening')
  const [inventory, setInventory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // AI Prescriber States
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [prescriptionItems, setPrescriptionItems] = useState([
    { medicine_id: '', dosage: '500mg', frequency: 'Twice daily', duration_days: 7 }
  ])
  const [aiChecks, setAiChecks] = useState(null)
  const [screenedPrescription, setScreenedPrescription] = useState(null)
  const [aiSafeStatus, setAiSafeStatus] = useState(null)

  // Doctor Verification portal states
  const [selectedPresc, setSelectedPresc] = useState(null)
  const [actionNotes, setActionNotes] = useState('')

  useEffect(() => {
    loadAllData()
    patientApi.list({ limit: 50 })
      .then(({ data }) => {
        if (data?.patients) setPatients(data.patients)
      })
      .catch(console.error)
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [invRes, prescRes, anaRes] = await Promise.all([
        pharmacyApi.getInventory(),
        pharmacyApi.getPrescriptions(),
        pharmacyApi.getAnalytics()
      ])
      setInventory(invRes.data.medicines || [])
      setAlerts(invRes.data.alerts || [])
      setPrescriptions(prescRes.data.prescriptions || [])
      setAnalytics(anaRes.data || null)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load pharmacy registers')
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = () => {
    setSeeding(true)
    toast.loading('Seeding pharmacy stock list and suppliers details...', { id: 'seed-toast' })
    pharmacyApi.seed()
      .then(() => {
        toast.success('Successfully seeded Pharmacy baseline modules!', { id: 'seed-toast' })
        loadAllData()
      })
      .catch(err => {
        console.error(err)
        toast.error('Seeding failed: ' + (err.response?.data?.error || err.message), { id: 'seed-toast' })
      })
      .finally(() => setSeeding(false))
  }

  // AI screening functions
  const addPrescItem = () => {
    setPrescriptionItems([...prescriptionItems, { medicine_id: '', dosage: '1 tablet', frequency: 'Once daily', duration_days: 7 }])
  }

  const removePrescItem = (idx) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== idx))
  }

  const handlePrescItemChange = (idx, field, value) => {
    setPrescriptionItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const handleRunAiScreen = (e) => {
    e.preventDefault()
    if (!selectedPatientId) {
      toast.error('Please select an active patient profile')
      return
    }
    const emptyItems = prescriptionItems.some(item => !item.medicine_id)
    if (emptyItems) {
      toast.error('Please specify medicines for all prescription line items')
      return
    }

    const payload = {
      patient_id: parseInt(selectedPatientId),
      items: prescriptionItems.map(item => ({
        ...item,
        medicine_id: parseInt(item.medicine_id),
        duration_days: parseInt(item.duration_days)
      }))
    }

    toast.promise(
      pharmacyApi.submitPrescription(payload),
      {
        loading: 'Running clinical safety check: matching drug interactions, composition allergies, pregnancy logs...',
        success: (res) => {
          setAiChecks(res.data.checks)
          setScreenedPrescription(res.data.prescription)
          setAiSafeStatus(res.data.is_safe)
          loadAllData()
          return res.data.is_safe
            ? 'AI Clinical Screening Complete: Combination verified as Safe!'
            : 'AI Warning: Critical clinical contraindications detected!'
        },
        error: (err) => err.response?.data?.error || 'Safety check failed'
      }
    )
  }

  // Reset prescriber screen
  const resetPrescriber = () => {
    setSelectedPatientId('')
    setPrescriptionItems([{ medicine_id: '', dosage: '500mg', frequency: 'Twice daily', duration_days: 7 }])
    setAiChecks(null)
    setScreenedPrescription(null)
    setAiSafeStatus(null)
  }

  // Doctor Action
  const handleDoctorVerify = (action) => {
    if (!selectedPresc) return

    toast.promise(
      pharmacyApi.verifyPrescription(selectedPresc.id, action, actionNotes),
      {
        loading: `Executing doctor verification: ${action}ing stay prescription...`,
        success: () => {
          loadAllData()
          setSelectedPresc(null)
          setActionNotes('')
          return `Prescription successfully marked as ${action}ed!`
        },
        error: (err) => err.response?.data?.error || 'Verification action failed'
      }
    )
  }

  // Chart configs
  const mostUsedChart = {
    labels: analytics?.most_used?.map(m => m.medicine) || ['Aspirin', 'Paracetamol', 'Amoxicillin', 'Lisinopril', 'Metformin'],
    datasets: [{
      label: 'Dispensed Units (Monthly)',
      data: analytics?.most_used?.map(m => m.dispensed) || [240, 185, 110, 95, 80],
      backgroundColor: 'rgba(59,130,246,0.85)',
      borderRadius: 4
    }]
  }

  const expiryForecastChart = {
    labels: analytics?.expiry_forecasts?.map(f => f.range) || ['< 30 days', '30-90 days', '90-180 days', '180+ days'],
    datasets: [{
      data: analytics?.expiry_forecasts?.map(f => f.count) || [2, 5, 12, 45],
      backgroundColor: ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981'],
      borderWidth: 0
    }]
  }

  // Map patient notes
  const patientDetails = patients.find(p => p.id === parseInt(selectedPatientId))

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-blue-400" size={24} />
            Smart Medicine Management Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI prescription checking engines, doctor verifications workflows, and inventory low-stock / expiry logs.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="btn btn-secondary text-xs flex items-center gap-2 py-2"
          >
            <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} />
            Seed Inventory
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900/60 backdrop-blur-md p-1 rounded-xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('clinical-screening')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'clinical-screening' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles size={14} />
          AI Clinician Prescriber
        </button>
        <button
          onClick={() => setActiveTab('doctor-portal')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'doctor-portal' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clipboard size={14} />
          Verifications Portal ({prescriptions.filter(p => p.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('inventory-board')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'inventory-board' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={14} />
          Pharmacy Stock Matrix ({inventory.length})
        </button>
      </div>

      {/* Main Tab content rendering */}
      {activeTab === 'clinical-screening' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Safety screening panel form */}
          <div className="xl:col-span-2 glass-card p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="text-blue-400" size={16} />
                Generate Safe Clinical Prescription
              </h2>
              {aiSafeStatus !== null && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  aiSafeStatus 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/20 animate-pulse'
                }`}>
                  {aiSafeStatus ? 'Screen Clean: Safe' : 'Contraindications Detected'}
                </span>
              )}
            </div>

            <form onSubmit={handleRunAiScreen} className="space-y-4">
              {/* Select patient */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="label-text">Select Patient Profile</label>
                  <select
                    className="input-field text-xs py-2.5 bg-slate-900 border-white/5"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Admitted Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} (Age: {p.age} | Allergies: {p.allergies || 'None'} | Notes: {p.notes || 'None'})
                      </option>
                    ))}
                  </select>
                </div>
                {patientDetails && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] space-y-1">
                    <div><span className="text-slate-500">Allergies:</span> <strong className="text-amber-400 font-bold">{patientDetails.allergies || 'No allergies recorded'}</strong></div>
                    <div><span className="text-slate-500">Conditions:</span> <strong className="text-blue-400 font-bold">{patientDetails.chronic_conditions || 'None'}</strong></div>
                  </div>
                )}
              </div>

              {/* Items grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="label-text text-[10px]">Prescribed Drugs Checklist</label>
                  <button
                    type="button"
                    onClick={addPrescItem}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Drug
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {prescriptionItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-white/5 rounded-xl border border-white/5 relative items-end">
                      <div className="md:col-span-4">
                        <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Select Medicine</label>
                        <select
                          className="input-field text-xs py-2 bg-slate-900 border-white/5"
                          value={item.medicine_id}
                          onChange={(e) => handlePrescItemChange(idx, 'medicine_id', e.target.value)}
                          required
                        >
                          <option value="">-- Choose Medicine --</option>
                          {inventory.map(med => (
                            <option key={med.id} value={med.id}>
                              {med.name} ({med.category} | Composition: {med.composition})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Dosage</label>
                        <input
                          type="text"
                          placeholder="e.g. 500mg / 1 tab"
                          className="input-field text-xs py-2"
                          value={item.dosage}
                          onChange={(e) => handlePrescItemChange(idx, 'dosage', e.target.value)}
                          required
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Frequency</label>
                        <input
                          type="text"
                          placeholder="e.g. Twice daily"
                          className="input-field text-xs py-2"
                          value={item.frequency}
                          onChange={(e) => handlePrescItemChange(idx, 'frequency', e.target.value)}
                          required
                        />
                      </div>

                      <div className="md:col-span-1.5 flex gap-2">
                        <div className="w-full">
                          <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Days</label>
                          <input
                            type="number"
                            min="1"
                            max="90"
                            className="input-field text-xs py-2"
                            value={item.duration_days}
                            onChange={(e) => handlePrescItemChange(idx, 'duration_days', e.target.value)}
                            required
                          />
                        </div>
                        {prescriptionItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePrescItem(idx)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-colors mb-0.5"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button type="submit" className="flex-1 btn btn-primary py-2.5 text-xs flex items-center justify-center gap-1.5">
                  <Sparkles size={14} /> Run AI Safety Check & Submit
                </button>
                {(aiChecks || selectedPatientId) && (
                  <button
                    type="button"
                    onClick={resetPrescriber}
                    className="btn btn-secondary text-xs"
                  >
                    Clear Prescriber
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* AI Diagnostic Check Report logs */}
          <div className="glass-card p-5 space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="text-teal-400 animate-pulse" size={16} />
                AI Clinical Screening Report
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Real-time check outputs on clinical constraints</p>
            </div>

            {aiChecks ? (
              <div className="space-y-4 text-xs">
                {/* Safe Banner */}
                {aiSafeStatus ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex gap-2">
                    <ShieldCheck size={16} className="flex-shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <strong className="font-extrabold block">NO INTERACTIONS DETECTED</strong>
                      The selected drug combinations, dosage levels, allergy vectors, and medical history match safely.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex gap-2">
                    <ShieldAlert size={16} className="flex-shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <strong className="font-extrabold block">CLINICAL ALERTS TRIGGERED</strong>
                      Please audit safety conflicts prior to validating final hospital dispensation.
                    </div>
                  </div>
                )}

                {/* Section: Drug-Drug interactions */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">
                    Drug-Drug Interactions ({aiChecks.interactions?.length || 0})
                  </h4>
                  {aiChecks.interactions?.length > 0 ? (
                    aiChecks.interactions.map((chk, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-950/60 border border-rose-500/20 space-y-1">
                        <div className="flex justify-between font-bold text-white text-[11px]">
                          <span>{chk.drugs.join(' ↔️ ')}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            chk.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                          }`}>
                            {chk.severity} (Score: {chk.score})
                          </span>
                        </div>
                        <p className="text-slate-400 leading-relaxed mt-1 text-[10px]">{chk.warning}</p>
                        <p className="text-[10px] text-emerald-400">💡 Alternative: {chk.alternative}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 text-xs py-2 bg-slate-950/20 rounded text-center">
                      No drug interactions detected.
                    </div>
                  )}
                </div>

                {/* Section: Allergy conflicts */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">
                    Patient Allergy Matches ({aiChecks.allergies?.length || 0})
                  </h4>
                  {aiChecks.allergies?.length > 0 ? (
                    aiChecks.allergies.map((chk, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-orange-500/20 text-[10px] space-y-1">
                        <div className="font-bold text-orange-400">Allergen: {chk.allergen_detected.toUpperCase()}</div>
                        <p className="text-slate-300">{chk.warning}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 text-xs py-2 bg-slate-950/20 rounded text-center">
                      No matching allergies detected.
                    </div>
                  )}
                </div>

                {/* Section: Pregnancy contraindications */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">
                    Pregnancy Contraindications ({aiChecks.pregnancy?.length || 0})
                  </h4>
                  {aiChecks.pregnancy?.length > 0 ? (
                    aiChecks.pregnancy.map((chk, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-rose-500/20 text-[10px] space-y-1">
                        <div className="font-bold text-rose-400">Medicine: {chk.medicine}</div>
                        <p className="text-slate-300">{chk.warning}</p>
                        <p className="text-emerald-400">💡 Safe Alternative: {chk.alternative}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 text-xs py-2 bg-slate-950/20 rounded text-center">
                      No pregnancy conflicts detected.
                    </div>
                  )}
                </div>

                {/* Section: Duplicate active compounds */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">
                    Duplicate Active Compounds ({aiChecks.duplicates?.length || 0})
                  </h4>
                  {aiChecks.duplicates?.length > 0 ? (
                    aiChecks.duplicates.map((chk, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-amber-500/20 text-[10px] space-y-1">
                        <div className="font-bold text-amber-400">Compound: {chk.duplicate_compound}</div>
                        <p className="text-slate-300">{chk.warning}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 text-xs py-2 bg-slate-950/20 rounded text-center">
                      No duplicated compounds detected.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2 bg-slate-950/20 rounded-2xl h-[360px] justify-center">
                <Sparkles size={24} className="text-slate-600 opacity-60 animate-pulse" />
                <h4 className="text-xs font-bold text-white">Awaiting prescription safety run</h4>
                <p className="text-[10px] leading-relaxed max-w-xs px-4">
                  Select a patient, input medicines list, and click safety check. The AI will screen clinical records.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: Doctor Portal Verification */}
      {activeTab === 'doctor-portal' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Pending requests grid list */}
          <div className="xl:col-span-2 glass-card p-5 space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clipboard className="text-blue-400" size={16} />
                Prescriptions Verification Workflow Queue
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Click on a pending record to view the screen report, approve stock deduction, or reject.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Patient</th>
                    <th>Items Count</th>
                    <th>Screener Note Summary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((presc) => (
                    <tr
                      key={presc.id}
                      onClick={() => {
                        setSelectedPresc(presc)
                        setActionNotes('')
                      }}
                      className={`${selectedPresc?.id === presc.id ? 'bg-white/5 border-l border-blue-500' : ''}`}
                    >
                      <td>#{presc.id}</td>
                      <td className="font-bold text-white">{presc.patient_name}</td>
                      <td>{presc.items?.length || 0} drugs</td>
                      <td className="text-xs text-slate-400 truncate max-w-xs">{presc.notes}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          presc.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : presc.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                        }`}>
                          {presc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {prescriptions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-slate-500 py-10">
                        No prescriptions currently logged. Build or seed database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action details panel */}
          <div className="space-y-4">
            {selectedPresc ? (
              <div className="glass-card p-5 space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <div>
                    <h3 className="font-bold text-white text-base">Verify Prescription #{selectedPresc.id}</h3>
                    <p className="text-[10px] text-slate-500">Review clinical screenings audit trail</p>
                  </div>
                  <button
                    onClick={() => setSelectedPresc(null)}
                    className="p-1 rounded bg-white/5 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div>
                  <label className="text-[9px] text-slate-500 uppercase tracking-widest font-black block">Admitted Patient</label>
                  <div className="text-sm font-bold text-white mt-0.5">{selectedPresc.patient_name}</div>
                </div>

                {/* Line items list */}
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 uppercase tracking-widest font-black block">Prescribed Medicines</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedPresc.items?.map((item, i) => (
                      <div key={i} className="p-2 bg-slate-950/60 rounded border border-white/5 text-xs flex justify-between">
                        <div>
                          <div className="font-bold text-white">{item.medicine_name}</div>
                          <div className="text-[10px] text-slate-500">{item.dosage} | {item.frequency}</div>
                        </div>
                        <span className="text-[10px] font-black text-slate-300">{item.duration_days} days</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Screening logs */}
                <div>
                  <label className="text-[9px] text-slate-500 uppercase tracking-widest font-black block">AI Screener Logs</label>
                  <div className="p-3 bg-slate-950 rounded border border-white/5 text-xs text-amber-400 italic leading-relaxed mt-1">
                    "{selectedPresc.notes}"
                  </div>
                </div>

                {/* Action inputs */}
                {selectedPresc.status === 'pending' ? (
                  <div className="space-y-3.5 border-t border-white/5 pt-4">
                    <div>
                      <label className="label-text">Audit Notes (Optional)</label>
                      <textarea
                        rows="2"
                        className="input-field text-xs py-2 focus:outline-none"
                        placeholder="Rejection reasons or override notes..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleDoctorVerify('approve')}
                        className="btn btn-success text-xs py-2.5 justify-center"
                      >
                        Approve & Deduct Stock
                      </button>
                      <button
                        onClick={() => handleDoctorVerify('reject')}
                        className="btn btn-danger text-xs py-2.5 justify-center"
                      >
                        Reject Request
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/5 rounded border border-white/5 text-center text-xs text-slate-400">
                    This prescription has already been marked as <strong>{selectedPresc.status.toUpperCase()}</strong>.
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-6 text-center text-slate-500 flex flex-col items-center justify-center gap-3 h-[300px]">
                <Clipboard size={24} className="text-slate-600 opacity-60" />
                <h4 className="text-sm font-bold text-white">Select Pending Record</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Select any prescription line from the verification list on the left to verify active safety screener checks, and approve stock adjustments.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Inventory Stock Matrices & Alerts */}
      {activeTab === 'inventory-board' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Inventory Table Grid */}
          <div className="xl:col-span-2 glass-card p-5 space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="text-blue-400" size={16} />
                Pharmacy Medicine Inventory Board
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Displays real-time prices, expiry records, and active stock counts.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Stock Units</th>
                    <th>Min Level</th>
                    <th>Unit Price</th>
                    <th>Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((med) => {
                    const isLow = med.stock_count <= med.min_stock_level
                    return (
                      <tr key={med.id}>
                        <td>
                          <div className="font-bold text-white">{med.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{med.composition}</div>
                        </td>
                        <td>{med.category}</td>
                        <td>
                          <span className={`font-bold ${isLow ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
                            {med.stock_count} units
                          </span>
                        </td>
                        <td>{med.min_stock_level} units</td>
                        <td>${med.price?.toFixed(2)}</td>
                        <td className="text-xs text-slate-400">{med.expiry_date}</td>
                      </tr>
                    );
                  })}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-slate-500 py-10">
                        No medicines currently logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Warnings & Analytics */}
          <div className="space-y-6">
            
            {/* Pharmacy stock alerts */}
            <div className="glass-card p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="text-amber-500" size={14} />
                  Active Safety Warnings ({alerts.length})
                </h3>
              </div>
              <div className="space-y-3.5 max-h-48 overflow-y-auto">
                {alerts.map((al) => (
                  <div key={al.id} className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex gap-2 text-xs">
                    {al.alert_type === 'low_stock' ? (
                      <Layers size={14} className="text-orange-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    ) : (
                      <Calendar size={14} className="text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                    )}
                    <div>
                      <strong className={`font-extrabold uppercase ${
                        al.alert_type === 'low_stock' ? 'text-orange-400' : 'text-rose-400'
                      }`}>
                        {al.alert_type === 'low_stock' ? 'Low Stock alert' : 'Expiry warnings'}
                      </strong>
                      <p className="text-slate-400 mt-1 text-[10px] leading-relaxed">{al.message}</p>
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="p-4 rounded bg-white/5 border border-white/5 text-center text-xs text-slate-500">
                    No active stock warnings flagged.
                  </div>
                )}
              </div>
            </div>

            {/* Micro Charts Grid */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                Monthly Dispensation Frequency
              </h3>
              <div className="h-40">
                <Bar
                  data={mostUsedChart}
                  options={{
                    ...chartBaseOptions,
                    plugins: { legend: { display: false } }
                  }}
                />
              </div>
            </div>

            <div className="glass-card p-5 space-y-4">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                Expiry Forecast Projections
              </h3>
              <div className="h-40 flex justify-center">
                <Doughnut
                  data={expiryForecastChart}
                  options={{
                    ...chartBaseOptions,
                    scales: undefined
                  }}
                />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
