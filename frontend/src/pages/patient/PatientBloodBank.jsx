import { useState, useEffect } from 'react'
import {
  Droplet, Search, Send, UserCheck, Heart, Activity,
  AlertTriangle, CheckCircle, Loader2, Calendar, ShieldAlert
} from 'lucide-react'
import api from '@/services/api'
import { bloodbankApi } from '@/services/bloodbankApi'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

export default function PatientBloodBank() {
  const [patient, setPatient] = useState(null)
  const [inventory, setInventory] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('inventory') // inventory, request, register

  // Blood Request Form State
  const [requestForm, setRequestForm] = useState({
    patient_name: '',
    blood_group: 'A+',
    units_requested: 1,
    urgency: 'normal'
  })
  const [requestResult, setRequestResult] = useState(null)

  // Donor Registration Form State
  const [donorForm, setDonorForm] = useState({
    name: '',
    blood_group: 'A+',
    phone: '',
    email: '',
    weight: '',
    hemoglobin: '',
    last_donation_date: ''
  })
  const [donorResult, setDonorResult] = useState(null)

  // Instant eligibility check helper on frontend
  const checkEligibility = (weight, hemoglobin, lastDonationDate) => {
    const warnings = []
    const w = parseFloat(weight)
    const h = parseFloat(hemoglobin)

    if (weight && w < 50) {
      warnings.push('Weight must be at least 50 kg.')
    }
    if (hemoglobin && h < 12.5) {
      warnings.push('Hemoglobin level must be at least 12.5 g/dL.')
    }
    if (lastDonationDate) {
      const lastDate = new Date(lastDonationDate)
      const diffTime = Math.abs(new Date() - lastDate)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays < 90) {
        warnings.push(`Minimum of 90 days between donations required. (Only ${diffDays} days elapsed).`)
      }
    }

    return {
      eligible: warnings.length === 0,
      warnings
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Fetch inventories
      const { data: invData } = await bloodbankApi.getInventory()
      setInventory(invData.inventory || [])

      // 2. Fetch logged in user & patient profile
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user

      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(p => p.email === loggedUser.email)

      if (linkedPatient) {
        setPatient(linkedPatient)
        // Auto-fill forms with patient details
        setRequestForm(prev => ({
          ...prev,
          patient_name: linkedPatient.full_name,
          blood_group: linkedPatient.blood_group || 'A+'
        }))
        setDonorForm(prev => ({
          ...prev,
          name: linkedPatient.full_name,
          blood_group: linkedPatient.blood_group || 'A+',
          phone: linkedPatient.phone || '',
          email: linkedPatient.email || ''
        }))
      }
    } catch (err) {
      console.error('Error loading blood bank data:', err)
      toast.error('Failed to load blood bank information.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    if (!requestForm.patient_name) return toast.error('Patient name is required.')
    if (requestForm.units_requested < 1) return toast.error('Requested units must be at least 1.')

    setSubmitting(true)
    setRequestResult(null)
    try {
      const payload = {
        ...requestForm,
        patient_id: patient?.id || null
      }
      const { data } = await bloodbankApi.submitRequest(payload)
      setRequestResult(data)
      
      if (data.emergency_dispatch) {
        toast.error('⚠️ Inventory shortage! Matched donors have been notified via simulated SMS dispatches.', { duration: 6000 })
      } else {
        toast.success(data.message || 'Blood request submitted successfully.')
      }

      // Refresh stock inventory in case it was deducted
      const { data: invData } = await bloodbankApi.getInventory()
      setInventory(invData.inventory || [])
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to submit blood request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDonorSubmit = async (e) => {
    e.preventDefault()
    if (!donorForm.name || !donorForm.phone || !donorForm.weight || !donorForm.hemoglobin) {
      return toast.error('All fields except email and last donation date are required.')
    }

    setSubmitting(true)
    setDonorResult(null)
    try {
      const payload = {
        ...donorForm,
        patient_id: patient?.id || null,
        weight: parseFloat(donorForm.weight),
        hemoglobin: parseFloat(donorForm.hemoglobin)
      }
      const { data } = await bloodbankApi.registerDonor(payload)
      setDonorResult(data.donor)

      if (data.donor?.eligibility_status) {
        toast.success('🎉 Registered successfully! You are ELIGIBLE to donate.')
      } else {
        toast.error('Registered successfully, but you are not eligible to donate currently.')
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to register as donor')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredInventory = inventory.filter(item => 
    item.blood_group.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const eligibility = checkEligibility(donorForm.weight, donorForm.hemoglobin, donorForm.last_donation_date)

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Droplet className="text-rose-500" size={26} />
          LifePulse Blood Bank Portal
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Search real-time blood stock availability, request blood units for clinical therapy, or register as a donor.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'inventory' 
              ? 'border-rose-500 text-rose-500' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Blood Inventory
        </button>
        <button
          onClick={() => setActiveTab('request')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'request' 
              ? 'border-rose-500 text-rose-500' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Request Blood Units
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'register' 
              ? 'border-rose-500 text-rose-500' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Register as Donor
        </button>
      </div>

      {/* TAB CONTENT: INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 animate-fade-in">
          {/* Search bar */}
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search blood group (e.g. O-, AB+)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton h-32" />
              ))}
            </div>
          ) : filteredInventory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {filteredInventory.map((item) => {
                const isCritical = item.units_available <= item.units_critical_threshold
                return (
                  <div 
                    key={item.id} 
                    className={`glass-card p-5 relative overflow-hidden border ${
                      isCritical ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-white/5'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/[0.01] rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-1.5">
                        <Droplet className={isCritical ? 'text-amber-500' : 'text-rose-500'} size={20} />
                        <span className="text-xl font-black text-white">{item.blood_group}</span>
                      </div>
                      
                      {isCritical ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold uppercase tracking-wider">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                          In Stock
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-white">
                        {item.units_available} <span className="text-xs text-slate-500 font-normal">units</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Critical limit: {item.units_critical_threshold} units
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <p className="text-slate-500 text-sm">No blood inventories matched your filter.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: REQUEST BLOOD */}
      {activeTab === 'request' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
              <Send size={18} className="text-rose-500" />
              Submit Clinical Request
            </h2>

            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Recipient Full Name</label>
                  <input
                    type="text"
                    required
                    value={requestForm.patient_name}
                    onChange={(e) => setRequestForm({...requestForm, patient_name: e.target.value})}
                    placeholder="Enter recipient's full name"
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label className="label-text">Blood Group</label>
                  <select
                    value={requestForm.blood_group}
                    onChange={(e) => setRequestForm({...requestForm, blood_group: e.target.value})}
                    className="input-field mt-1 cursor-pointer"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Required Units (Volume)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={requestForm.units_requested}
                    onChange={(e) => setRequestForm({...requestForm, units_requested: parseInt(e.target.value) || 1})}
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label className="label-text">Clinical Urgency</label>
                  <select
                    value={requestForm.urgency}
                    onChange={(e) => setRequestForm({...requestForm, urgency: e.target.value})}
                    className="input-field mt-1 cursor-pointer"
                  >
                    <option value="normal">Normal Clinical Flow</option>
                    <option value="urgent">Urgent Requirements</option>
                    <option value="emergency">Emergency Critical Lifesaving</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary py-3 px-6 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Submit Request
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {/* Status updates / result of request */}
            {requestResult ? (
              <div className="glass-card p-5 space-y-4 animate-fade-in">
                <h3 className="font-bold text-white text-sm">Request Evaluation Status</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-400">Request ID</span>
                    <span className="text-xs font-semibold text-white">#{requestResult.request?.id}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-xs text-slate-400">Status</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      requestResult.request?.status === 'fulfilled' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                    }`}>
                      {requestResult.request?.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-xs text-slate-400">Inventory Status</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {requestResult.emergency_dispatch ? 'Shortage Detected' : 'Units Allocated'}
                    </span>
                  </div>
                </div>

                {requestResult.emergency_dispatch ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                    <div className="flex gap-2 text-rose-400 text-xs font-bold items-center">
                      <ShieldAlert size={16} />
                      EMERGENCY DISPATCH INITIATED
                    </div>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      We found <strong>{requestResult.dispatched_donors?.length || 0}</strong> compatible eligible donors. Live notifications have been dispatched to notify them immediately.
                    </p>
                    {requestResult.dispatched_donors?.length > 0 && (
                      <div className="pt-2 border-t border-rose-500/10 space-y-1.5 max-h-[150px] overflow-y-auto">
                        {requestResult.dispatched_donors.map((d, i) => (
                          <div key={i} className="text-[10px] text-slate-400 flex justify-between">
                            <span>{d.name} ({d.blood_group})</span>
                            <span className="text-slate-500">{d.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-2 text-emerald-400 text-xs">
                    <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Units Reserved</strong>
                      <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                        Blood units successfully allocated and reserved. Handover documentation dispatched.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-5 text-center text-slate-500 text-xs py-8">
                Submit a blood request on the left to see allocation and dispatch logs in real-time.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REGISTER AS DONOR */}
      {activeTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
              <Heart size={18} className="text-rose-500" />
              Register as Blood Donor
            </h2>

            <form onSubmit={handleDonorSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Full Name</label>
                  <input
                    type="text"
                    required
                    value={donorForm.name}
                    onChange={(e) => setDonorForm({...donorForm, name: e.target.value})}
                    placeholder="Enter your full name"
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label className="label-text">Blood Group</label>
                  <select
                    value={donorForm.blood_group}
                    onChange={(e) => setDonorForm({...donorForm, blood_group: e.target.value})}
                    className="input-field mt-1 cursor-pointer"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={donorForm.phone}
                    onChange={(e) => setDonorForm({...donorForm, phone: e.target.value})}
                    placeholder="e.g. +1 555-0199"
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label className="label-text">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={donorForm.email}
                    onChange={(e) => setDonorForm({...donorForm, email: e.target.value})}
                    placeholder="e.g. email@example.com"
                    className="input-field mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-text">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={donorForm.weight}
                    onChange={(e) => setDonorForm({...donorForm, weight: e.target.value})}
                    placeholder="e.g. 70"
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label className="label-text">Hemoglobin Level (g/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={donorForm.hemoglobin}
                    onChange={(e) => setDonorForm({...donorForm, hemoglobin: e.target.value})}
                    placeholder="e.g. 14.2"
                    className="input-field mt-1"
                  />
                </div>

                <div>
                  <label className="label-text">Last Donation Date</label>
                  <input
                    type="date"
                    value={donorForm.last_donation_date}
                    onChange={(e) => setDonorForm({...donorForm, last_donation_date: e.target.value})}
                    className="input-field mt-1 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary py-3 px-6 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}
                Submit Registration
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {/* Live Eligibility Check Screen */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <Activity size={16} className="text-rose-500" />
                Live Eligibility Monitor
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Min Weight</span>
                  <span className="text-xs font-semibold text-slate-200">50.0 kg</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Min Hemoglobin</span>
                  <span className="text-xs font-semibold text-slate-200">12.5 g/dL</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs text-slate-400">Donation Gap</span>
                  <span className="text-xs font-semibold text-slate-200">90 days</span>
                </div>
              </div>

              {/* Status Certificate Indicator */}
              {donorForm.weight || donorForm.hemoglobin || donorForm.last_donation_date ? (
                eligibility.eligible ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={14} /> ELIGIBLE
                    </span>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Based on current entries, you meet clinical guidelines. You will be registered as active and searchable.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                      <AlertTriangle size={14} /> INELIGIBLE
                    </span>
                    <div className="space-y-1">
                      {eligibility.warnings.map((w, idx) => (
                        <div key={idx} className="text-[10px] text-slate-300 flex items-start gap-1">
                          <span className="text-rose-500 mt-0.5">•</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-center text-slate-500 text-xs">
                  Fill in your health variables to check eligibility in real-time.
                </div>
              )}
            </div>

            {/* Saved Registered Certificate Card */}
            {donorResult && (
              <div className="glass-card p-5 bg-gradient-to-br from-rose-500/[0.03] to-slate-900 border-rose-500/20 space-y-3 animate-fade-in">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400">Donor Registration Card</h3>
                <div className="text-xs space-y-1">
                  <div className="text-white font-bold text-sm">{donorResult.name}</div>
                  <div className="text-slate-400">Blood Group: <strong className="text-rose-400">{donorResult.blood_group}</strong></div>
                  <div className="text-slate-400">Rare Blood Type: <strong>{donorResult.is_rare ? 'Yes' : 'No'}</strong></div>
                  <div className="text-slate-400">Status: <strong className={donorResult.eligibility_status ? 'text-emerald-400' : 'text-rose-400'}>
                    {donorResult.eligibility_status ? 'Active' : 'Inactive (Ineligible)'}
                  </strong></div>
                  {!donorResult.eligibility_status && (
                    <div className="text-[10px] text-slate-500 mt-1 italic">
                      Note: {donorResult.eligibility_notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
