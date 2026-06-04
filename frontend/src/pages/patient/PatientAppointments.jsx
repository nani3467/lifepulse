import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Calendar, Clock, User, Stethoscope, Video, MapPin, DollarSign,
  AlertCircle, CheckCircle, RefreshCw, X, CreditCard, Star, CheckSquare
} from 'lucide-react'
import api from '@/services/api'
import { patientApi, adminApi } from '@/services/patientApi'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const HOSPITAL_DETAILS = {
  'Apollo Hospital': { rating: '4.8', img: '🏥', desc: 'Premium Cardiology & Neurology Center', depts: 'Cardiology, Neurology, Pulmonology, General Medicine' },
  'Fortis Hospital': { rating: '4.6', img: '🏥', desc: 'Multi-specialty Trauma & Surgery Care', depts: 'Orthopedics, Dermatology, Pediatrics, General Medicine' },
  'Care Hospital': { rating: '4.5', img: '🏥', desc: 'Advanced Diagnostics & Orthopedics Care', depts: 'General Medicine, Cardiology, ENT' },
  'AIIMS Hospital': { rating: '4.9', img: '🏥', desc: 'Premium National Public Health Institute', depts: 'General Medicine, Neurology, Pediatrics' }
}

export default function PatientAppointments() {
  const location = useLocation()
  const [patient, setPatient] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  // Booking Wizard State
  const [hospitals, setHospitals] = useState([])
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [slots, setSlots] = useState([])

  const [bookingForm, setBookingForm] = useState({
    hospital_id: '',
    department_id: '',
    doctor_profile_id: '',
    consultation_type: 'in_person', // in_person, video
    appointment_date: format(new Date(), 'yyyy-MM-dd'),
    time_slot_id: '',
    appointment_time: '',
    priority: 'normal',
    reason: '',
    symptoms: ''
  })

  const [wizardStep, setWizardStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [createdAppointment, setCreatedAppointment] = useState(null)

  // Load patient, bookings list, and departments
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      // Get patient profile
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user
      
      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(p => p.email === loggedUser.email)
      
      if (linkedPatient) {
        setPatient(linkedPatient)
        fetchBookings()
      }

      // Fetch hospitals
      const { data: hospRes } = await adminApi.listHospitals()
      setHospitals(hospRes.hospitals || [])

      // Fetch departments
      const { data: depRes } = await api.get('/appointments/departments')
      setDepartments(depRes.departments || [])
      
      // Auto-preselect department if coming from Symptom Checker recommendation
      const recommendedDeptName = location.state?.departmentName
      if (recommendedDeptName && depRes.departments) {
        const matchedDep = depRes.departments.find(d => d.name.toLowerCase() === recommendedDeptName.toLowerCase())
        if (matchedDep) {
          const firstHospId = hospRes.hospitals?.[0]?.id || ''
          setBookingForm(f => ({ ...f, hospital_id: firstHospId, department_id: matchedDep.id }))
          fetchDoctorsForDepartment(matchedDep.id, firstHospId)
          setWizardStep(3)
          toast.success(`Pre-selected recommended department: ${matchedDep.name}`)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookings = async () => {
    try {
      const { data } = await api.get('/appointments')
      setAppointments(data.appointments || [])
    } catch (err) {
      console.error(err)
    }
  }

  const fetchDoctorsForDepartment = async (depId, hospId) => {
    try {
      const url = hospId
        ? `/appointments/doctors?department_id=${depId}&hospital_id=${hospId}`
        : `/appointments/doctors?department_id=${depId}`
      const { data } = await api.get(url)
      setDoctors(data.doctors || [])
    } catch (err) {
      console.error(err)
    }
  }

  const fetchSlotsForDoctor = async (docId, dateStr) => {
    try {
      const { data } = await api.get(`/appointments/slots?doctor_id=${docId}&date=${dateStr}`)
      setSlots(data.slots || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleHospitalSelect = (hospId) => {
    setBookingForm({
      ...bookingForm,
      hospital_id: hospId,
      department_id: '',
      doctor_profile_id: '',
      time_slot_id: '',
      appointment_time: ''
    })
    setWizardStep(2)
  }

  const handleDepartmentSelect = (depId) => {
    setBookingForm({
      ...bookingForm,
      department_id: depId,
      doctor_profile_id: '',
      time_slot_id: '',
      appointment_time: ''
    })
    fetchDoctorsForDepartment(depId, bookingForm.hospital_id)
    setWizardStep(3)
  }

  const handleDoctorSelect = (docId) => {
    setBookingForm({
      ...bookingForm,
      doctor_profile_id: docId,
      time_slot_id: '',
      appointment_time: ''
    })
    setWizardStep(4)
  }

  const handleConsultationTypeSelect = (type) => {
    setBookingForm({
      ...bookingForm,
      consultation_type: type
    })
    setWizardStep(5)
  }

  const handleDateChange = (dateStr) => {
    setBookingForm({
      ...bookingForm,
      appointment_date: dateStr,
      time_slot_id: '',
      appointment_time: ''
    })
    if (bookingForm.doctor_profile_id) {
      fetchSlotsForDoctor(bookingForm.doctor_profile_id, dateStr)
    }
  }

  const handleSlotSelect = (slot) => {
    setBookingForm({
      ...bookingForm,
      time_slot_id: slot.id,
      appointment_time: slot.start_time
    })
    setWizardStep(7)
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    const payload = {
      ...bookingForm,
      patient_id: patient.id,
      payment_status: 'paid' // Simulated Payment complete
    }
    
    if (bookingForm.consultation_type === 'video') {
      payload.meeting_link = `https://meet.jit.si/lifepulse-medi-${Math.floor(100000 + Math.random() * 900000)}`
    }

    try {
      const { data } = await api.post('/appointments', payload)
      setCreatedAppointment(data.appointment)
      toast.success('🎉 Consultation appointment scheduled successfully!')
      fetchBookings()
      setWizardStep(9)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking execution failed')
      setWizardStep(7)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelAppt = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    
    try {
      await api.post(`/appointments/${apptId}/cancel`, { reason: 'Cancelled by patient' })
      toast.success('Appointment cancelled')
      fetchBookings()
    } catch (err) {
      toast.error('Cancellation failed')
    }
  }

  const handleAcceptReschedule = async (apptId) => {
    try {
      await api.post(`/appointments/${apptId}/accept-reschedule`)
      toast.success('Reschedule accepted successfully!')
      fetchBookings()
    } catch (err) {
      toast.error('Failed to accept reschedule proposal.')
    }
  }

  const handleRejectReschedule = async (apptId) => {
    try {
      await api.post(`/appointments/${apptId}/reject-reschedule`)
      toast.success('Reschedule proposal rejected. Appointment cancelled.')
      fetchBookings()
    } catch (err) {
      toast.error('Failed to reject reschedule proposal.')
    }
  }

  // Cost calculations
  const selectedDoc = doctors.find(d => d.id === bookingForm.doctor_profile_id)
  const baseFee = selectedDoc?.consultation_fee || 500
  const platformFee = 50.00
  const gstTax = Math.round(baseFee * 0.18)
  const totalCost = baseFee + platformFee + gstTax

  const selectedHospObj = hospitals.find(h => h.id === bookingForm.hospital_id)
  const selectedDeptObj = departments.find(d => d.id === bookingForm.department_id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calendar className="text-blue-500" size={26} />
          Clinician Scheduler
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Smart medical scheduler. Select facility, clinician department, check slots and book visits instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wizard Booking Engine */}
        <div className="lg:col-span-2 glass-card p-6 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <h2 className="text-base font-bold text-white">Booking Wizard</h2>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-semibold uppercase">
              <span className={wizardStep === 1 ? 'text-blue-400 font-bold' : ''}>Hosp</span>
              <span>•</span>
              <span className={wizardStep === 2 ? 'text-blue-400 font-bold' : ''}>Dept</span>
              <span>•</span>
              <span className={wizardStep === 3 ? 'text-blue-400 font-bold' : ''}>Doc</span>
              <span>•</span>
              <span className={wizardStep === 4 ? 'text-blue-400 font-bold' : ''}>Type</span>
              <span>•</span>
              <span className={wizardStep === 5 ? 'text-blue-400 font-bold' : ''}>Date</span>
              <span>•</span>
              <span className={wizardStep === 6 ? 'text-blue-400 font-bold' : ''}>Slot</span>
              <span>•</span>
              <span className={wizardStep === 7 ? 'text-blue-400 font-bold' : ''}>Verify</span>
              <span>•</span>
              <span className={wizardStep === 8 ? 'text-blue-400 font-bold' : ''}>Pay</span>
            </div>
          </div>

          {/* Step 1: Select Hospital */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <label className="label-text text-sm font-bold block text-white">Step 1: Choose Medical Facility (Hospital)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hospitals.map((h) => {
                  const meta = HOSPITAL_DETAILS[h.name] || { rating: '4.5', img: '🏥', desc: 'Clinical Multi-specialty center', depts: 'All Departments' }
                  return (
                    <button
                      key={h.id} type="button" onClick={() => handleHospitalSelect(h.id)}
                      className="p-4 text-left rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.07] transition-all flex flex-col justify-between gap-3 h-40"
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20">
                          {meta.img}
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase flex items-center gap-1">
                          <Star size={8} className="fill-amber-400 text-amber-400" /> {meta.rating}
                        </span>
                      </div>
                      <div>
                        <strong className="text-white text-sm block font-bold">{h.name}</strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{h.address || 'Central Sector'}</span>
                        <span className="text-[9px] text-slate-500 block italic mt-1">{meta.desc}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Select Department */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="label-text text-sm font-bold block text-white">Step 2: Choose Specialized Department</label>
                <button onClick={() => setWizardStep(1)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {departments.map((d) => (
                  <button
                    key={d.id} type="button" onClick={() => handleDepartmentSelect(d.id)}
                    className="p-4 text-center rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.07] transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <span className="text-2xl">{d.icon || '⚕️'}</span>
                    <strong className="text-white text-xs block font-bold">{d.name}</strong>
                    <span className="text-[8px] text-slate-500 uppercase">{d.location || 'Block A'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Select Doctor */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="label-text text-sm font-bold block text-white">Step 3: Select Doctor Specialist</label>
                <button onClick={() => setWizardStep(2)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {doctors.length > 0 ? (
                  doctors.map((d) => (
                    <button
                      key={d.id} type="button" onClick={() => handleDoctorSelect(d.id)}
                      className="p-4 text-left rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.07] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center border border-blue-500/20 text-lg font-bold">
                          👨‍⚕️
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-white text-sm font-bold">{d.doctor_name}</strong>
                            <span className="text-[8px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5">{d.doctor_code}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 block">{d.specialization} • {d.qualification}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">⏱️ {d.experience_years} Years Experience</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xs text-blue-400 font-bold block">₹{d.consultation_fee} Fee</span>
                          <span className="text-[9px] text-slate-500 block">Mon - Fri slots</span>
                        </div>
                        <div className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider transition-colors">Select Doctor</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                    No specialist doctors are currently registered for this department at the chosen hospital.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Choose Consultation Type */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="label-text text-sm font-bold block text-white">Step 4: Choose Consultation Format</label>
                <button onClick={() => setWizardStep(3)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button" onClick={() => handleConsultationTypeSelect('in_person')}
                  className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.07] text-left space-y-3 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl">
                    🏢
                  </div>
                  <div>
                    <h4 className="text-white text-xs font-bold uppercase tracking-wide">In-Person Consultation</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Visit the clinician directly at their physical hospital address room chamber.</p>
                  </div>
                </button>

                <button
                  type="button" onClick={() => handleConsultationTypeSelect('video')}
                  className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.07] text-left space-y-3 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-xl">
                    🎥
                  </div>
                  <div>
                    <h4 className="text-white text-xs font-bold uppercase tracking-wide">Video consultation</h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Join a remote call session with the doctor 10 minutes before the scheduled time slot.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Choose Date */}
          {wizardStep === 5 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="label-text text-sm font-bold block text-white">Step 5: Pick Consultation Date</label>
                <button onClick={() => setWizardStep(4)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Pick Date (Future Dates Only)</label>
                <input
                  type="date" className="input-field" min={format(new Date(), 'yyyy-MM-dd')}
                  value={bookingForm.appointment_date} onChange={(e) => handleDateChange(e.target.value)}
                />
                <button
                  onClick={() => {
                    fetchSlotsForDoctor(bookingForm.doctor_profile_id, bookingForm.appointment_date)
                    setWizardStep(6)
                  }}
                  className="w-full btn btn-primary py-2.5 text-xs font-bold uppercase tracking-wider mt-4"
                >
                  Fetch Available Time Slots
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Choose Time Slot */}
          {wizardStep === 6 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="label-text text-sm font-bold block text-white">Step 6: Choose Time Slot Block</label>
                <button onClick={() => setWizardStep(5)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.length > 0 ? (
                  slots.map((s) => (
                    <button
                      key={s.id} type="button" disabled={s.is_booked} onClick={() => handleSlotSelect(s)}
                      className={`p-2.5 rounded-xl text-center text-xs border font-bold transition-all flex items-center justify-center gap-1.5 ${
                        s.is_booked
                          ? 'bg-slate-900 border-transparent text-slate-600 cursor-not-allowed'
                          : 'bg-white/5 border-white/5 hover:border-blue-500/30 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Clock size={12} />
                      {s.start_time}
                    </button>
                  ))
                ) : (
                  <div className="col-span-full text-center py-10 text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                    No open booking slots generated for the selected date. Choose another date.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 7: Summary Review */}
          {wizardStep === 7 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <label className="label-text text-sm font-bold block text-white">Step 7: Verify Consultation Specifications</label>
                <button onClick={() => setWizardStep(6)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3 text-xs text-slate-300">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Patient Profile:</span>
                  <strong className="text-white">{patient?.full_name}</strong>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Hospital Facility:</span>
                  <strong className="text-white">{selectedHospObj?.name}</strong>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Clinical Department:</span>
                  <strong className="text-white">{selectedDeptObj?.name}</strong>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Medical Officer:</span>
                  <strong className="text-white">{selectedDoc?.doctor_name}</strong>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Consultation Date:</span>
                  <strong className="text-white">{bookingForm.appointment_date}</strong>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Consultation Time:</span>
                  <strong className="text-white">{bookingForm.appointment_time}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Consultation Format:</span>
                  <strong className="text-white uppercase">{bookingForm.consultation_type === 'video' ? '🎥 Video' : '🏢 In-Person'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="label-text">Select Priority</label>
                  <select
                    className="input-field mt-1 text-xs" value={bookingForm.priority}
                    onChange={(e) => setBookingForm({ ...bookingForm, priority: e.target.value })}
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency Triage</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">Describe Symptoms (Optional)</label>
                  <input
                    type="text" className="input-field mt-1 text-xs" placeholder="e.g. Mild cough, fatigue"
                    value={bookingForm.symptoms} onChange={(e) => setBookingForm({ ...bookingForm, symptoms: e.target.value })}
                  />
                </div>
              </div>

              <button
                onClick={() => setWizardStep(8)}
                className="w-full btn btn-primary py-2.5 text-xs font-bold uppercase tracking-wider mt-4"
              >
                Proceed to Checkout Payment
              </button>
            </div>
          )}

          {/* Step 8: Payment Gateway */}
          {wizardStep === 8 && (
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <label className="label-text text-sm font-bold block text-white">Step 8: Payment Gateway Tunnels</label>
                <button type="button" onClick={() => setWizardStep(7)} className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300">Back</button>
              </div>

              <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Cost breakdown</span>
                <div className="flex justify-between text-slate-300">
                  <span>Consultation Doctor Fee:</span>
                  <span>₹{baseFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Medical Platform Charges:</span>
                  <span>₹{platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-300 border-b border-white/5 pb-2">
                  <span>Clinical Tax (18% GST):</span>
                  <span>₹{gstTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm pt-1">
                  <span>Total Amount Paid:</span>
                  <span>₹{totalCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Secure payment elements */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={12} className="text-blue-400" /> Enter Card Details
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" className="col-span-3 input-field text-xs py-2" placeholder="Card Number (4111 2222 3333 4444)" defaultValue="4111 2222 3333 4444" disabled />
                  <input type="text" className="input-field text-xs py-2" placeholder="MM/YY" defaultValue="12/29" disabled />
                  <input type="text" className="input-field text-xs py-2" placeholder="CVV" defaultValue="123" disabled />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn btn-success w-full justify-center py-3 text-xs font-bold uppercase tracking-wider">
                {submitting ? <RefreshCw className="animate-spin" size={14} /> : <>Pay & Confirm Appointment</>}
              </button>
            </form>
          )}

          {/* Step 9: Appointment Created */}
          {wizardStep === 9 && createdAppointment && (
            <div className="text-center py-8 space-y-4 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 text-2xl">
                ✔
              </div>
              <h3 className="text-lg font-bold text-white">Appointment Scheduled Successfully!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Your medical consultation is booked and paid. Re-verify summary below. 
              </p>
              
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl max-w-sm mx-auto text-left text-xs space-y-2">
                <div>Appointment Code: <strong className="text-blue-400 font-mono">{createdAppointment.appointment_code}</strong></div>
                <div>Status: <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase border border-amber-500/20">Pending Doctor Approval</span></div>
                <div>Time: <strong>{createdAppointment.appointment_date} @ {createdAppointment.appointment_time}</strong></div>
                <div>Format: <strong className="uppercase">{createdAppointment.consultation_type}</strong></div>
              </div>

              <button
                onClick={() => setWizardStep(1)}
                className="btn btn-primary px-5 py-2 text-xs font-bold uppercase tracking-wider mt-4"
              >
                Book Another Appointment
              </button>
            </div>
          )}
        </div>

        {/* Existing Bookings List */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-bold text-white text-sm">Active Bookings</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="skeleton h-20" />)
            ) : appointments.length > 0 ? (
              appointments.map((a) => (
                <div key={a.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3 relative">
                  
                  {/* Reschedule Request banner overlay */}
                  {a.status === 'rescheduled' && (
                    <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl space-y-2 text-xs text-amber-500">
                      <div className="flex gap-1.5 items-start">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Reschedule Proposed</strong>
                          <p className="text-[10px] text-slate-300 mt-1 leading-normal">
                            Doctor proposed: <strong>{a.reschedule_date} @ {a.reschedule_time}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleAcceptReschedule(a.id)}
                          className="flex-1 bg-emerald-600 text-white rounded py-1 text-[9px] font-black uppercase hover:bg-emerald-500 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectReschedule(a.id)}
                          className="flex-1 bg-rose-600 text-white rounded py-1 text-[9px] font-black uppercase hover:bg-rose-500 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-white text-xs block">{a.doctor_name || 'Clinician Specialist'}</strong>
                      <span className="text-[10px] text-slate-500">{a.appointment_date} @ {a.appointment_time}</span>
                    </div>
                    {(a.status === 'pending' || a.status === 'confirmed') && (
                      <button
                        onClick={() => handleCancelAppt(a.id)}
                        className="p-1 hover:bg-rose-500/15 rounded text-rose-400 transition-colors"
                        title="Cancel Appointment"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      a.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : a.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : a.status === 'rescheduled'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {a.status}
                    </span>
                    <span className="text-slate-400 text-[9px]">
                      {a.consultation_type === 'video' ? '🎥 Video' : '🏢 In-Person'}
                    </span>
                  </div>

                  {a.consultation_type === 'video' && a.status === 'confirmed' && a.meeting_link && (
                    <a
                      href={a.meeting_link} target="_blank" rel="noreferrer"
                      className="w-full btn btn-primary py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <Video size={12} /> Connect consultation Call
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                No active appointments scheduled. Select a facility to book your first doctor consultation call.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
