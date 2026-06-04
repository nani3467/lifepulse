import { useState, useEffect } from 'react'
import {
  Droplet, Users, AlertTriangle, CheckCircle2, Heart,
  Calendar, Send, RefreshCw, Plus, Search, ShieldAlert,
  TrendingUp, Award, Layers, Check, X, Clock, HelpCircle
} from 'lucide-react'
import { bloodbankApi } from '@/services/bloodbankApi'
import { patientApi } from '@/services/patientApi'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import toast from 'react-hot-toast'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
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

export default function BloodBankDashboard() {
  const [inventory, setInventory] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // Registration Form State
  const [donorForm, setDonorForm] = useState({
    name: '',
    blood_group: 'O+',
    phone: '',
    email: '',
    weight: '',
    hemoglobin: '',
    last_donation_date: '',
    patient_id: ''
  })
  const [eligibilityResult, setEligibilityResult] = useState(null)

  // Request Form State
  const [requestForm, setRequestForm] = useState({
    patient_name: '',
    blood_group: 'O+',
    units_requested: 1,
    urgency: 'normal',
    patient_id: ''
  })
  const [dispatchResult, setDispatchResult] = useState(null)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchProgress, setDispatchProgress] = useState(0)

  // Load baseline data
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
      const [invRes, anaRes] = await Promise.all([
        bloodbankApi.getInventory(),
        bloodbankApi.getAnalytics()
      ])
      setInventory(invRes.data.inventory || [])
      setAnalytics(anaRes.data || null)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load blood bank records')
    } finally {
      setLoading(false)
    }
  }

  // Seeding trigger
  const handleSeed = () => {
    setSeeding(true)
    toast.loading('Seeding standard blood inventories and sample donor list...', { id: 'seed-toast' })
    bloodbankApi.seed()
      .then(() => {
        toast.success('Successfully seeded Blood Bank module data!', { id: 'seed-toast' })
        loadAllData()
      })
      .catch(err => {
        console.error(err)
        toast.error('Seeding failed: ' + (err.response?.data?.error || err.message), { id: 'seed-toast' })
      })
      .finally(() => setSeeding(false))
  }

  // Pre-evaluate donor eligibility client-side
  const checkClientEligibility = (weight, hb, lastDate) => {
    const checks = []
    let eligible = true

    if (weight && parseFloat(weight) < 50) {
      eligible = false
      checks.push('Weight is below 50kg limit.')
    }
    if (hb && parseFloat(hb) < 12.5) {
      eligible = false
      checks.push('Hemoglobin level is below 12.5 g/dL.')
    }
    if (lastDate) {
      const last = new Date(lastDate)
      const diffTime = Math.abs(new Date() - last)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays < 90) {
        eligible = false
        checks.push(`Interval is only ${diffDays} days (90 days minimum required).`)
      }
    }

    return { eligible, notes: checks.length ? checks.join(' ') : 'Meets all physiological requirements.' }
  }

  const handleDonorFormChange = (e) => {
    const { name, value } = e.target
    const updated = { ...donorForm, [name]: value }
    setDonorForm(updated)

    if (name === 'weight' || name === 'hemoglobin' || name === 'last_donation_date') {
      const check = checkClientEligibility(updated.weight, updated.hemoglobin, updated.last_donation_date)
      setEligibilityResult(check)
    }
  }

  const handleDonorSubmit = (e) => {
    e.preventDefault()
    if (!donorForm.name || !donorForm.phone || !donorForm.weight || !donorForm.hemoglobin) {
      toast.error('Please fill in all mandatory donor fields')
      return
    }

    const payload = {
      ...donorForm,
      weight: parseFloat(donorForm.weight),
      hemoglobin: parseFloat(donorForm.hemoglobin),
      patient_id: donorForm.patient_id ? parseInt(donorForm.patient_id) : null
    }

    toast.promise(
      bloodbankApi.registerDonor(payload),
      {
        loading: 'Verifying clinical metrics and recording donor...',
        success: (res) => {
          const d = res.data.donor
          loadAllData()
          // Reset form
          setDonorForm({
            name: '',
            blood_group: 'O+',
            phone: '',
            email: '',
            weight: '',
            hemoglobin: '',
            last_donation_date: '',
            patient_id: ''
          })
          setEligibilityResult(null)
          return d.eligibility_status 
            ? `Donor ${d.name} registered as Eligible! Vitals approved.` 
            : `Donor ${d.name} registered. Disqualified: ${d.eligibility_notes}`
        },
        error: (err) => err.response?.data?.error || 'Registration failed'
      }
    )
  }

  // Handle blood request
  const handleRequestSubmit = (e) => {
    e.preventDefault()
    if (!requestForm.patient_name || !requestForm.units_requested) {
      toast.error('Please specify patient name and unit counts')
      return
    }

    const payload = {
      ...requestForm,
      units_requested: parseInt(requestForm.units_requested),
      patient_id: requestForm.patient_id ? parseInt(requestForm.patient_id) : null
    }

    bloodbankApi.submitRequest(payload)
      .then(({ data: res }) => {
        loadAllData()
        if (res.emergency_dispatch) {
          // Trigger Emergency Notifications Modal
          setDispatchResult(res)
          setShowDispatchModal(true)
          setDispatchProgress(0)
          
          // Animate SMS Dispatch progress
          let progress = 0
          const interval = setInterval(() => {
            progress += 20
            setDispatchProgress(progress)
            if (progress >= 100) {
              clearInterval(interval)
              toast.error('URGENT: Shortage triggers SMS & email dispatch to all matching O- / same blood groups.')
            }
          }, 300)
        } else {
          toast.success(res.message)
          setRequestForm({
            patient_name: '',
            blood_group: 'O+',
            units_requested: 1,
            urgency: 'normal',
            patient_id: ''
          })
        }
      })
      .catch(err => {
        console.error(err)
        toast.error(err.response?.data?.error || 'Failed to submit request')
      })
  }

  // Map database patient select
  const handleSelectPatient = (type, pat) => {
    if (type === 'donor') {
      setDonorForm(prev => ({
        ...prev,
        patient_id: pat.id,
        name: pat.full_name,
        phone: pat.phone || prev.phone,
        email: pat.email || prev.email
      }))
      toast.success(`Loaded patient metadata for donor profile`)
    } else {
      setRequestForm(prev => ({
        ...prev,
        patient_id: pat.id,
        patient_name: pat.full_name
      }))
      toast.success(`Loaded patient metadata for blood request`)
    }
  }

  // Analytics Chart Computations
  const monthlyTrendChart = {
    labels: analytics?.monthly_trend?.map(t => t.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Donation Units',
        data: analytics?.monthly_trend?.map(t => t.donations) || [24, 30, 28, 35, 42],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.05)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      },
      {
        label: 'Requested Units',
        data: analytics?.monthly_trend?.map(t => t.requests) || [18, 25, 29, 30, 38],
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244,63,94,0.05)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }
    ]
  }

  const groupDistributionChart = {
    labels: analytics?.group_distribution?.map(d => d.group) || ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'],
    datasets: [{
      data: analytics?.group_distribution?.map(d => d.count) || [12, 10, 8, 4, 3, 2, 2, 1],
      backgroundColor: [
        '#ef4444', '#f87171', '#fca5a5', '#fee2e2',
        '#b91c1c', '#dc2626', '#991b1b', '#7f1d1d'
      ],
      borderWidth: 0
    }]
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Droplet className="text-rose-500 animate-pulse" size={24} />
            AI Blood Bank & Donor Registry
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time stock visualizations, donor eligibility rules engine, and automated crisis notification relays.</p>
        </div>

        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn btn-primary text-xs flex items-center gap-2 py-2"
        >
          <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} />
          Seeding Mock Bank
        </button>
      </div>

      {/* KPI Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-rose-600 to-red-500 shadow-md">
            <Droplet size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {inventory.reduce((acc, curr) => acc + curr.units_available, 0)} Units
            </div>
            <div className="text-xs text-slate-400">Total Blood Stock</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-500 shadow-md">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{analytics?.total_donors || 0}</div>
            <div className="text-xs text-slate-400">Registered Donors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-500 shadow-md">
            <Award size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{analytics?.rare_donors_count || 0}</div>
            <div className="text-xs text-slate-400">Rare Blood Type Donors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-600 to-orange-500 shadow-md">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {inventory.filter(i => i.is_low).length} Blood Groups
            </div>
            <div className="text-xs text-slate-400">Critical Stock Warning</div>
          </div>
        </div>
      </div>

      {/* Main Row: Inventory Grid & Requests Form */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Inventory Stock Visualizer */}
        <div className="xl:col-span-2 glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="text-blue-400" size={16} />
              Real-Time Stock Availability Matrix
            </h2>
            <span className="text-[10px] text-rose-400 font-extrabold uppercase bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              Threshold: &lt;5 Units Alert
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {inventory.map((item) => {
              const pct = Math.min(100, (item.units_available / 25) * 100)
              const isLow = item.is_low
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border relative transition-all duration-300 ${
                    isLow 
                      ? 'border-rose-500/40 bg-rose-950/10 shadow-lg animate-pulse' 
                      : 'border-white/5 bg-slate-900/40 hover:border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xl font-black ${isLow ? 'text-rose-400' : 'text-slate-200'}`}>
                      {item.blood_group}
                    </span>
                    {isLow ? (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500 text-white tracking-wide">
                        Shortage
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400">
                        Adequate
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-black text-white">{item.units_available}</div>
                  <span className="text-[9px] text-slate-500 uppercase font-semibold">Available Units</span>

                  {/* Stock level bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Request Dispatch */}
        <div className="glass-card p-5 space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="text-rose-400" size={16} />
              Emergency Triage Request
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Deducts stock automatically. Activates alarm systems if units are missing.</p>
          </div>

          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div>
              <label className="label-text">Linked Patient (Optional)</label>
              <select
                className="input-field text-xs py-2 bg-slate-900 border-white/5"
                value={requestForm.patient_id}
                onChange={(e) => {
                  const pat = patients.find(p => p.id === parseInt(e.target.value))
                  if (pat) handleSelectPatient('request', pat)
                }}
              >
                <option value="">-- Choose Admitted Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.blood_group})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text">Patient Name</label>
              <input
                type="text"
                placeholder="Full clinical name"
                className="input-field text-xs"
                value={requestForm.patient_name}
                onChange={(e) => setRequestForm({ ...requestForm, patient_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-text">Blood Group Required</label>
                <select
                  className="input-field text-xs py-2 bg-slate-900 border-white/5"
                  value={requestForm.blood_group}
                  onChange={(e) => setRequestForm({ ...requestForm, blood_group: e.target.value })}
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-text">Units Needed</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="input-field text-xs"
                  value={requestForm.units_requested}
                  onChange={(e) => setRequestForm({ ...requestForm, units_requested: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label-text">Urgency Classification</label>
              <div className="grid grid-cols-3 gap-2">
                {['normal', 'urgent', 'emergency'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRequestForm({ ...requestForm, urgency: level })}
                    className={`py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${
                      requestForm.urgency === level
                        ? level === 'emergency'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                          : level === 'urgent'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'border-white/5 bg-slate-900/40 text-slate-500 hover:text-white'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full btn btn-primary py-2.5 text-xs">
              Process Blood Dispensation
            </button>
          </form>
        </div>

      </div>

      {/* Row 2: Donor Registration & Eligibility Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Donor Registration Form */}
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="text-emerald-400" size={16} />
              Register New Donor Profile
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Calculates eligibility status instantly based on physiological vitals.</p>
          </div>

          <form onSubmit={handleDonorSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-text">Link Existing Patient Record</label>
                <select
                  className="input-field text-xs py-2 bg-slate-900 border-white/5"
                  value={donorForm.patient_id}
                  onChange={(e) => {
                    const pat = patients.find(p => p.id === parseInt(e.target.value))
                    if (pat) handleSelectPatient('donor', pat)
                  }}
                >
                  <option value="">-- Choose Admitted Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.blood_group})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-text">Donor Full Name</label>
                <input
                  type="text"
                  placeholder="Donor name"
                  className="input-field text-xs"
                  value={donorForm.name}
                  onChange={handleDonorFormChange}
                  name="name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label-text">Blood Group</label>
                <select
                  className="input-field text-xs py-2 bg-slate-900 border-white/5"
                  value={donorForm.blood_group}
                  onChange={handleDonorFormChange}
                  name="blood_group"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-text">Phone Contact</label>
                <input
                  type="tel"
                  placeholder="Phone number"
                  className="input-field text-xs"
                  value={donorForm.phone}
                  onChange={handleDonorFormChange}
                  name="phone"
                  required
                />
              </div>

              <div>
                <label className="label-text">Email Address</label>
                <input
                  type="email"
                  placeholder="name@domain.com"
                  className="input-field text-xs"
                  value={donorForm.email}
                  onChange={handleDonorFormChange}
                  name="email"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label-text">Donor Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="200"
                  placeholder="Min 50 kg required"
                  className="input-field text-xs"
                  value={donorForm.weight}
                  onChange={handleDonorFormChange}
                  name="weight"
                  required
                />
              </div>

              <div>
                <label className="label-text">Hemoglobin Level (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="25"
                  placeholder="Min 12.5 required"
                  className="input-field text-xs"
                  value={donorForm.hemoglobin}
                  onChange={handleDonorFormChange}
                  name="hemoglobin"
                  required
                />
              </div>

              <div>
                <label className="label-text">Last Donation Date</label>
                <input
                  type="date"
                  className="input-field text-xs"
                  value={donorForm.last_donation_date}
                  onChange={handleDonorFormChange}
                  name="last_donation_date"
                />
              </div>
            </div>

            {/* Instant eligibility warning boxes */}
            {eligibilityResult && (
              <div className={`p-4 rounded-xl border text-xs flex gap-3 transition-colors ${
                eligibilityResult.eligible 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {eligibilityResult.eligible ? (
                  <>
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-extrabold uppercase">Eligible Donation Vitals</h4>
                      <p className="mt-1 font-medium">{eligibilityResult.notes}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-extrabold uppercase">Disqualified Criteria Detected</h4>
                      <p className="mt-1 font-medium">{eligibilityResult.notes}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <button type="submit" className="w-full btn btn-primary py-2.5 text-xs">
              Verify eligibility and save donor profile
            </button>
          </form>
        </div>

        {/* Eligibility Criteria guidelines block */}
        <div className="glass-card p-5 space-y-4">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Heart className="text-rose-500" size={16} />
              Donation Safeguard Parameters
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Rules governed by hospital clinical standards</p>
          </div>

          <div className="space-y-3.5 text-xs text-slate-300">
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <strong className="text-white block">Weight Limits</strong>
                Donor must weigh at least 50 kg (110 lbs) for a standard whole blood donation (450 mL).
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <strong className="text-white block">Hemoglobin Concentration</strong>
                Must be at least 12.5 g/dL to verify iron reserves are safe to withstand donation.
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <strong className="text-white block">Minimum Frequency Interval</strong>
                A waiting span of 90 days must elapse between donations to prevent clinical anemia.
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">4</div>
              <div>
                <strong className="text-white block">Rare Antigen Detection</strong>
                Antigens AB-, A-, B-, and O- are automatically flagged as rare to speed up triage alerts.
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 3: Analytics Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Donation/Demand Chart */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Donations vs Requests Trends</h3>
            <TrendingUp size={14} className="text-slate-500" />
          </div>
          <div className="h-60">
            <Line
              data={monthlyTrendChart}
              options={chartBaseOptions}
            />
          </div>
        </div>

        {/* Rare group splits */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Donor Blood Group Splits</h3>
            <Award size={14} className="text-slate-500" />
          </div>
          <div className="h-60 flex justify-center">
            <Doughnut
              data={groupDistributionChart}
              options={{
                ...chartBaseOptions,
                scales: undefined
              }}
            />
          </div>
        </div>

      </div>

      {/* Dispatch Emergency SMS Relay Modal */}
      {showDispatchModal && dispatchResult && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg border-rose-500/40 bg-rose-950/20 relative">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-rose-600 flex items-center justify-center shadow-lg border-4 border-slate-900 animate-bounce">
              <ShieldAlert className="text-white" size={36} />
            </div>

            <div className="text-center pt-8 space-y-4">
              <h3 className="text-lg font-black text-rose-400 uppercase tracking-widest">
                CRITICAL SHORTAGE EMERGENCY ACTIVATED
              </h3>
              
              <div className="p-4 bg-slate-950/80 rounded-xl border border-white/5 text-xs text-left space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Group:</span>
                  <span className="font-bold text-white">{dispatchResult.request?.blood_group}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Units Demanded:</span>
                  <span className="font-bold text-white">{dispatchResult.request?.units_requested} Units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Urgency Classification:</span>
                  <span className="font-bold text-rose-400 uppercase">{dispatchResult.request?.urgency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-amber-400">{dispatchResult.request?.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-rose-300">
                  <span>SMS/Email Notification Broadcast:</span>
                  <span>{dispatchProgress}%</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-rose-600 transition-all duration-300 rounded-full"
                    style={{ width: `${dispatchProgress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white text-left">
                  Matched Potential Donors Selected ({dispatchResult.dispatched_donors?.length || 0}):
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-2">
                  {dispatchResult.dispatched_donors?.length > 0 ? (
                    dispatchResult.dispatched_donors.map((donor) => (
                      <div key={donor.id} className="p-2.5 bg-slate-950/60 rounded-lg flex justify-between items-center text-xs border border-white/5">
                        <div>
                          <div className="font-bold text-white">{donor.name} ({donor.blood_group})</div>
                          <div className="text-[10px] text-slate-500">{donor.phone}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-300 animate-pulse">
                          Dispatched
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-600 text-xs text-center py-4 bg-slate-950/20 rounded-lg">
                      No matching eligible O- or similar blood group donors found in system registers.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowDispatchModal(false)}
                  className="flex-1 btn btn-secondary text-xs"
                >
                  Acknowledge & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
