import { useState } from 'react'
import { X, Bed } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

export default function AdmitModal({ patientId, onClose, onDone }) {
  const [form, setForm] = useState({ ward: '', room_number: '', bed_number: '', reason: '', diagnosis_at_admission: '' })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.reason) return toast.error('Reason for admission is required')
    setLoading(true)
    try {
      await patientApi.admit(patientId, form)
      toast.success('Patient admitted successfully')
      onDone()
    } catch (err) { toast.error(err?.response?.data?.error || 'Admission failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Bed size={18} className="text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Admit Patient</h2>
              <p className="text-xs text-slate-400">Fill admission details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form id="admit-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label-text">Ward</label><input className="input-field" placeholder="General" value={form.ward} onChange={set('ward')} /></div>
            <div><label className="label-text">Room</label><input className="input-field" placeholder="101" value={form.room_number} onChange={set('room_number')} /></div>
            <div><label className="label-text">Bed</label><input className="input-field" placeholder="A1" value={form.bed_number} onChange={set('bed_number')} /></div>
          </div>
          <div>
            <label className="label-text">Reason for Admission *</label>
            <textarea className="input-field resize-none" rows={3} placeholder="Describe the reason..." value={form.reason} onChange={set('reason')} />
          </div>
          <div>
            <label className="label-text">Diagnosis at Admission</label>
            <input className="input-field" placeholder="Initial diagnosis" value={form.diagnosis_at_admission} onChange={set('diagnosis_at_admission')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" id="btn-confirm-admit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
