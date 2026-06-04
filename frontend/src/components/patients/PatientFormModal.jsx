import { useState, useEffect } from 'react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'
import { X, User, Phone, Mail, MapPin, Droplets, AlertCircle } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const EMPTY_FORM = {
  first_name: '', last_name: '', date_of_birth: '', gender: 'male',
  blood_group: '', phone: '', email: '', address: '', city: '', state: '', pincode: '',
  emergency_name: '', emergency_phone: '', emergency_relation: '',
  allergies: '', chronic_conditions: '', current_medications: '',
  insurance_provider: '', insurance_id: '', notes: ''
}

export default function PatientFormModal({ patient, onClose, onSaved }) {
  const [form, setForm] = useState(patient ? {
    ...patient,
    date_of_birth: patient.date_of_birth || ''
  } : EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('basic')

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.date_of_birth || !form.phone) {
      return toast.error('Please fill all required fields')
    }
    setLoading(true)
    try {
      if (patient) {
        await patientApi.update(patient.id, form)
        toast.success('Patient updated successfully')
      } else {
        await patientApi.create(form)
        toast.success('Patient added successfully')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const TABS = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'medical', label: 'Medical' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'insurance', label: 'Insurance' },
  ]

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              {patient ? 'Edit Patient' : 'Add New Patient'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {patient ? `Editing ${patient.full_name}` : 'Fill in the patient details below'}
            </p>
          </div>
          <button id="btn-modal-close" onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <form id="patient-form" onSubmit={handleSubmit}>
          {tab === 'basic' && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div>
                <label className="label-text">First Name *</label>
                <input className="input-field" placeholder="John" value={form.first_name} onChange={set('first_name')} />
              </div>
              <div>
                <label className="label-text">Last Name *</label>
                <input className="input-field" placeholder="Doe" value={form.last_name} onChange={set('last_name')} />
              </div>
              <div>
                <label className="label-text">Date of Birth *</label>
                <input className="input-field" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
              </div>
              <div>
                <label className="label-text">Gender *</label>
                <select className="input-field" value={form.gender} onChange={set('gender')}>
                  <option value="male" className="bg-slate-900">Male</option>
                  <option value="female" className="bg-slate-900">Female</option>
                  <option value="other" className="bg-slate-900">Other</option>
                </select>
              </div>
              <div>
                <label className="label-text">Blood Group</label>
                <select className="input-field" value={form.blood_group} onChange={set('blood_group')}>
                  <option value="" className="bg-slate-900">Select</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b} className="bg-slate-900">{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label-text">Phone *</label>
                <input className="input-field" placeholder="+91 9999999999" value={form.phone} onChange={set('phone')} />
              </div>
              <div className="col-span-2">
                <label className="label-text">Email</label>
                <input className="input-field" type="email" placeholder="patient@email.com" value={form.email} onChange={set('email')} />
              </div>
              <div className="col-span-2">
                <label className="label-text">Address</label>
                <input className="input-field" placeholder="Street address" value={form.address} onChange={set('address')} />
              </div>
              <div>
                <label className="label-text">City</label>
                <input className="input-field" placeholder="Mumbai" value={form.city} onChange={set('city')} />
              </div>
              <div>
                <label className="label-text">State</label>
                <input className="input-field" placeholder="Maharashtra" value={form.state} onChange={set('state')} />
              </div>
            </div>
          )}

          {tab === 'medical' && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="label-text">Allergies</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Penicillin, Sulfa drugs..." value={form.allergies} onChange={set('allergies')} />
              </div>
              <div>
                <label className="label-text">Chronic Conditions</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Diabetes Type 2, Hypertension..." value={form.chronic_conditions} onChange={set('chronic_conditions')} />
              </div>
              <div>
                <label className="label-text">Current Medications</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Metformin 500mg, Aspirin 75mg..." value={form.current_medications} onChange={set('current_medications')} />
              </div>
              <div>
                <label className="label-text">Notes</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Additional notes..." value={form.notes} onChange={set('notes')} />
              </div>
            </div>
          )}

          {tab === 'emergency' && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div className="col-span-2">
                <label className="label-text">Emergency Contact Name</label>
                <input className="input-field" placeholder="Jane Doe" value={form.emergency_name} onChange={set('emergency_name')} />
              </div>
              <div>
                <label className="label-text">Emergency Phone</label>
                <input className="input-field" placeholder="+91 9999999999" value={form.emergency_phone} onChange={set('emergency_phone')} />
              </div>
              <div>
                <label className="label-text">Relation</label>
                <input className="input-field" placeholder="Spouse, Parent..." value={form.emergency_relation} onChange={set('emergency_relation')} />
              </div>
            </div>
          )}

          {tab === 'insurance' && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div className="col-span-2">
                <label className="label-text">Insurance Provider</label>
                <input className="input-field" placeholder="Star Health Insurance" value={form.insurance_provider} onChange={set('insurance_provider')} />
              </div>
              <div className="col-span-2">
                <label className="label-text">Insurance ID / Policy No.</label>
                <input className="input-field" placeholder="SHI-2024-XXXXX" value={form.insurance_id} onChange={set('insurance_id')} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/8">
            <button type="button" id="btn-cancel-patient" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" id="btn-save-patient" disabled={loading} className="btn-primary">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : patient ? 'Update Patient' : 'Add Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
