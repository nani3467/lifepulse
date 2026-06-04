import { useState, useEffect } from 'react'
import { X, CalendarDays, Clock, User, Building, Stethoscope, AlertCircle } from 'lucide-react'
import { appointmentApi } from '@/services/appointmentApi'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

const APPT_TYPES = ['consultation', 'follow_up', 'emergency', 'lab_test', 'procedure', 'vaccination']
const PRIORITIES = ['normal', 'urgent', 'emergency']

export default function AppointmentFormModal({ prefillDate, onClose, onSaved }) {
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [slots, setSlots] = useState([])
  const [patients, setPatients] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    patient_id: '',
    department_id: '',
    doctor_profile_id: '',
    time_slot_id: '',
    appointment_date: prefillDate ? format(prefillDate, 'yyyy-MM-dd') : today,
    appointment_time: '',
    appointment_type: 'consultation',
    priority: 'normal',
    reason: '',
    symptoms: '',
    notes: '',
    is_online: false,
  })

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [k]: val }))
  }

  useEffect(() => {
    appointmentApi.getDepartments().then(({ data }) => setDepartments(data.departments))
    patientApi.list({ per_page: 100 }).then(({ data }) => setPatients(data.patients))
  }, [])

  useEffect(() => {
    if (form.department_id) {
      appointmentApi.getDoctors({ department_id: form.department_id })
        .then(({ data }) => setDoctors(data.doctors))
    } else {
      setDoctors([])
    }
    setForm(f => ({ ...f, doctor_profile_id: '', time_slot_id: '', appointment_time: '' }))
  }, [form.department_id])

  useEffect(() => {
    if (form.doctor_profile_id && form.appointment_date) {
      setLoadingSlots(true)
      appointmentApi.getSlots({ doctor_id: form.doctor_profile_id, date: form.appointment_date })
        .then(({ data }) => setSlots(data.slots))
        .catch(() => setSlots([]))
        .finally(() => setLoadingSlots(false))
    } else {
      setSlots([])
    }
    setForm(f => ({ ...f, time_slot_id: '', appointment_time: '' }))
  }, [form.doctor_profile_id, form.appointment_date])

  const handleSlotSelect = (slot) => {
    setForm(f => ({ ...f, time_slot_id: slot.id, appointment_time: slot.start_time }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id) return toast.error('Please select a patient')
    if (!form.appointment_date) return toast.error('Please select a date')
    if (!form.appointment_time) return toast.error('Please select a time slot')

    setSaving(true)
    try {
      await appointmentApi.create(form)
      toast.success('Appointment booked successfully!')
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Booking failed')
    } finally { setSaving(false) }
  }

  const availableSlots = slots.filter(s => !s.is_booked && !s.is_blocked)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
              <CalendarDays size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-lg">Book Appointment</h2>
              <p className="text-xs text-slate-400">Fill in all the required details</p>
            </div>
          </div>
          <button id="btn-close-booking" onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Patient */}
          <div>
            <label className="label-text">Patient *</label>
            <select className="input-field" value={form.patient_id} onChange={set('patient_id')}>
              <option value="" className="bg-slate-900">Search & select patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {p.full_name} ({p.patient_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Department */}
            <div>
              <label className="label-text">Department</label>
              <select className="input-field" value={form.department_id} onChange={set('department_id')}>
                <option value="" className="bg-slate-900">Select department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900">{d.name}</option>
                ))}
              </select>
            </div>
            {/* Doctor */}
            <div>
              <label className="label-text">Doctor</label>
              <select className="input-field" value={form.doctor_profile_id} onChange={set('doctor_profile_id')}
                disabled={!form.department_id}>
                <option value="" className="bg-slate-900">Select doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id} className="bg-slate-900">
                    Dr. {d.doctor_name} — ₹{d.consultation_fee}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Date *</label>
              <input type="date" className="input-field" value={form.appointment_date}
                min={today} onChange={set('appointment_date')} />
            </div>
            <div>
              <label className="label-text">Type</label>
              <select className="input-field" value={form.appointment_type} onChange={set('appointment_type')}>
                {APPT_TYPES.map(t => (
                  <option key={t} value={t} className="bg-slate-900 capitalize">{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Slots */}
          {form.doctor_profile_id && form.appointment_date && (
            <div>
              <label className="label-text flex items-center gap-2">
                Time Slot *
                {loadingSlots && <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />}
              </label>
              {availableSlots.length === 0 && !loadingSlots ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-400" />
                  <p className="text-xs text-amber-300">No available slots for this date. Try generating slots or pick another date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {availableSlots.map(slot => (
                    <button key={slot.id} type="button" onClick={() => handleSlotSelect(slot)}
                      id={`slot-${slot.id}`}
                      className={`px-2 py-2 rounded-xl text-xs font-semibold transition-all border
                        ${form.time_slot_id === slot.id
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:border-blue-500/50 hover:text-white'
                        }`}>
                      {slot.start_time}
                    </button>
                  ))}
                </div>
              )}
              {/* Manual time if no slots */}
              {availableSlots.length === 0 && (
                <div className="mt-2">
                  <label className="label-text">Or enter time manually</label>
                  <input type="time" className="input-field" value={form.appointment_time} onChange={set('appointment_time')} />
                </div>
              )}
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="label-text">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-all
                    ${form.priority === p
                      ? p === 'emergency' ? 'bg-rose-600 text-white border-rose-500'
                        : p === 'urgent' ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-blue-600 text-white border-blue-500'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/25'
                    }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Reason & Symptoms */}
          <div>
            <label className="label-text">Reason / Chief Complaint</label>
            <input className="input-field" placeholder="Patient's main reason for visit" value={form.reason} onChange={set('reason')} />
          </div>
          <div>
            <label className="label-text">Symptoms</label>
            <textarea className="input-field resize-none" rows={2}
              placeholder="Describe symptoms..." value={form.symptoms} onChange={set('symptoms')} />
          </div>

          {/* Online toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
            <input type="checkbox" id="is-online" className="w-4 h-4 accent-blue-500"
              checked={form.is_online} onChange={set('is_online')} />
            <label htmlFor="is-online" className="text-sm text-slate-300 cursor-pointer flex-1">
              Online / Telemedicine appointment
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" id="btn-cancel-appt" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" id="btn-save-appt" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
