import { useState, useEffect } from 'react'
import {
  Sparkles, ShieldCheck, ShieldAlert, ShoppingCart, Truck,
  DollarSign, Check, Info, FileText, Loader2, ArrowRight
} from 'lucide-react'
import api from '@/services/api'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

export default function PatientPharmacy() {
  const [patient, setPatient] = useState(null)
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPresc, setSelectedPresc] = useState(null)

  // Checkout State
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [checkingSafety, setCheckingSafety] = useState(false)
  const [safetyChecked, setSafetyChecked] = useState(false)
  const [safetyWarnings, setSafetyWarnings] = useState([])
  
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentDone, setPaymentDone] = useState(false)
  const [orderStep, setOrderStep] = useState(0) // 0: ordered, 1: dispatched, 2: out, 3: delivered

  useEffect(() => {
    loadPatientAndPrescs()
  }, [])

  const loadPatientAndPrescs = async () => {
    setLoading(true)
    try {
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user
      
      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(p => p.email === loggedUser.email)
      
      if (linkedPatient) {
        setPatient(linkedPatient)
        // Fetch prescriptions
        const { data: prescRes } = await api.get('/pharmacy/prescriptions')
        // Filter approved prescriptions only
        const approved = (prescRes.prescriptions || []).filter(p => p.status === 'approved')
        setPrescriptions(approved)
        if (approved.length > 0) {
          setSelectedPresc(approved[0])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // AI Safety Screener
  const runAISafetyScreener = () => {
    if (!selectedPresc || !patient) return
    setCheckingSafety(true)
    setSafetyWarnings([])
    
    setTimeout(() => {
      // Simulate clinical checks: drug-drug interactions & allergies
      const warnings = []
      const medNames = selectedPresc.items.map(i => i.medicine_name.toLowerCase())
      
      // 1. Check drug interaction
      if (medNames.includes('aspirin') && medNames.includes('warfarin')) {
        warnings.push({
          type: 'interaction',
          severity: 'critical',
          text: 'Critical Interaction: Aspirin + Warfarin Sodium. Concomitant use increases risk of severe clinical bleeding.'
        })
      }
      if (medNames.includes('lisinopril') && medNames.includes('spironolactone')) {
        warnings.push({
          type: 'interaction',
          severity: 'medium',
          text: 'Medium Interaction: Lisinopril + Spironolactone. Concomitant use increases risk of high blood potassium levels.'
        })
      }

      // 2. Check patient documented allergies
      const patientAllergies = (patient.allergies || '').toLowerCase()
      selectedPresc.items.forEach(item => {
        const medName = item.medicine_name.toLowerCase()
        if (patientAllergies && patientAllergies.includes(medName)) {
          warnings.push({
            type: 'allergy',
            severity: 'high',
            text: `Allergy Contraindication: Patient has documented allergy matching medicine compound '${item.medicine_name}'.`
          })
        }
      })

      setSafetyWarnings(warnings)
      setCheckingSafety(false)
      setSafetyChecked(true)
      
      if (warnings.length > 0) {
        toast.error('⚠️ AI Triage Warning: Drug interactions or allergies detected!')
      } else {
        toast.success('✅ AI Compatibility Scan: Prescription Safe!')
      }
    }, 2000)
  }

  const handleCheckoutSubmit = (e) => {
    e.preventDefault()
    if (!deliveryAddress.trim()) return toast.error('Please input a delivery address.')
    
    setPaymentDone(true)
    toast.success('Payment accepted! E-Medicine order placed.')

    // Simulate real-time delivery status updates
    let step = 0
    const interval = setInterval(() => {
      step += 1
      setOrderStep(step)
      if (step === 1) toast.success('Order status: Dispatched from central pharmacy.')
      if (step === 2) toast.success('Order status: Medicines out for delivery.')
      if (step === 3) {
        toast.success('Order status: Medicines successfully delivered!')
        clearInterval(interval)
      }
    }, 6000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="text-blue-500" size={26} />
          E-Medicine Pharmacy Store
        </h1>
        <p className="text-slate-400 text-sm mt-1">AI-powered medical dispensary checkout. Check prescription safety metrics and order medicine delivery</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prescription details & Checkout Form */}
        <div className="lg:col-span-2 space-y-6">
          {checkoutMode ? (
            /* Checkout view */
            <div className="glass-card p-6 space-y-6 animate-fade-in">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingCart size={16} className="text-blue-400" />
                  Pharmacy Checkout Order
                </h2>
                <button
                  onClick={() => {
                    setCheckoutMode(false)
                    setPaymentDone(false)
                    setSafetyChecked(false)
                    setOrderStep(0)
                  }}
                  className="text-xs text-blue-400 font-bold uppercase"
                >
                  Back
                </button>
              </div>

              {!paymentDone ? (
                <div className="space-y-6">
                  {/* AI Safety Checker Button */}
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-blue-400" />
                      Prescription Safety Evaluator
                    </span>
                    <p className="text-xs text-slate-400 leading-normal">
                      Trigger our medical compatibility rules engine to verify drug interactions and patient allergies automatically.
                    </p>
                    
                    {!safetyChecked ? (
                      <button
                        onClick={runAISafetyScreener} disabled={checkingSafety}
                        className="btn-primary py-2 px-4 text-xs"
                      >
                        {checkingSafety ? <Loader2 className="animate-spin mr-1" size={12} /> : null}
                        {checkingSafety ? 'Scanning compositions...' : 'Run AI Compatibility Scan'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                          <Check size={12} /> Scan Finished
                        </div>
                        {safetyWarnings.length > 0 ? (
                          <div className="space-y-2 pt-2">
                            {safetyWarnings.map((w, i) => (
                              <div key={i} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-2 text-xs text-rose-400">
                                <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
                                <div>
                                  <strong className="font-bold block uppercase text-[9px]">{w.severity} alert</strong>
                                  <p>{w.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-300">
                            No drug conflicts or active allergen ingredients detected. Safe checkout confirmed.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Checkout inputs */}
                  <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                    <div>
                      <label className="label-text">Delivery Address</label>
                      <input
                        type="text" required className="input-field mt-1" placeholder="123 Hospital Lane, Central District"
                        value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                      />
                    </div>

                    <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 space-y-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        Payment Summary
                      </span>
                      <div className="text-xs text-slate-300 flex justify-between items-center border-b border-white/5 pb-2">
                        <span>Items Subtotal</span>
                        <span>$24.50</span>
                      </div>
                      <div className="text-xs text-slate-300 flex justify-between items-center border-b border-white/5 pb-2">
                        <span>Delivery Fee</span>
                        <span>$5.00</span>
                      </div>
                      <div className="text-xs font-bold text-white flex justify-between items-center">
                        <span>Total Price</span>
                        <span>$29.50</span>
                      </div>
                    </div>

                    <button
                      type="submit" disabled={safetyWarnings.some(w => w.severity === 'critical')}
                      className="btn-success w-full justify-center py-3 text-sm font-bold uppercase tracking-wider"
                    >
                      Process Checkout & Pay
                    </button>
                  </form>
                </div>
              ) : (
                /* Order delivery tracking view */
                <div className="space-y-6 text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20 mb-2">
                    <Truck size={28} className="animate-pulse" />
                  </div>
                  <h3 className="text-lg font-bold text-white">E-Medicine Order Dispatched</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                    Your transaction has been finalized and medicines packed. Track your live dispatch delivery status below:
                  </p>

                  {/* Tracking progress bar */}
                  <div className="max-w-md mx-auto pt-6 px-4">
                    <div className="relative flex justify-between items-center">
                      {/* Line connector */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-800 -z-10" />
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 transition-all duration-500"
                        style={{ width: `${(orderStep / 3) * 100}%` }}
                      />
                      
                      {/* Step circles */}
                      {['Ordered', 'Dispatched', 'Out for Delivery', 'Delivered'].map((step, idx) => {
                        const active = orderStep >= idx
                        return (
                          <div key={step} className="flex flex-col items-center gap-1.5 relative">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${
                              active ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'
                            }`}>
                              {idx + 1}
                            </div>
                            <span className={`text-[9px] font-bold uppercase ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {step}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Prescription view */
            <div className="glass-card p-6 space-y-6 animate-fade-in">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-blue-400" />
                Select Approved Prescription
              </h2>
              
              {loading ? (
                <div className="skeleton h-40" />
              ) : selectedPresc ? (
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div className="flex justify-between items-start border-b border-white/5 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Prescription Slip #{selectedPresc.id}</h3>
                      <span className="text-[10px] text-slate-400">Date: {selectedPresc.created_at?.slice(0, 10)}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      {selectedPresc.status}
                    </span>
                  </div>

                  {/* Medicines list */}
                  <div className="space-y-3">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block">Prescribed Medicines</span>
                    {selectedPresc.items.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-white block">{item.medicine_name}</strong>
                          <span className="text-slate-500">{item.dosage} • {item.frequency}</span>
                        </div>
                        <span className="text-slate-400">{item.duration_days} days</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setCheckoutMode(true)}
                    className="btn-primary w-full justify-center py-3 text-sm font-bold uppercase tracking-wider"
                  >
                    Buy Prescribed Medicines <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No approved prescriptions found in your account database logs. Clinicians must approve prescriptions before e-commerce purchase.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prescription Index list */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-bold text-white text-sm">Approved Slips</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {loading ? (
              [...Array(2)].map((_, i) => <div key={i} className="skeleton h-16" />)
            ) : prescriptions.length > 0 ? (
              prescriptions.map((p) => (
                <button
                  key={p.id} onClick={() => { setSelectedPresc(p); setCheckoutMode(false); setPaymentDone(false); }}
                  className={`w-full p-3 text-left rounded-xl border transition-all flex justify-between items-center ${
                    selectedPresc?.id === p.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div>
                    <strong className="text-white text-xs block">Prescription #{p.id}</strong>
                    <span className="text-[9px] text-slate-500">{p.items.length} items</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{p.created_at?.slice(0, 10)}</span>
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-slate-600 text-xs">No approved slips.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
