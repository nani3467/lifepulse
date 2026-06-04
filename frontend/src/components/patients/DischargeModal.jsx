import { useState } from 'react'
import { X, LogOut } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

export default function DischargeModal({ admission, onClose, onDone }) {
  const [form, setForm] = useState({ diagnosis_at_discharge: '', discharge_notes: '', total_cost: '' })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await patientApi.discharge(admission.id, form)
      toast.success('Patient discharged successfully')
      onDone()
    } catch (err) { toast.error(err?.response?.data?.error || 'Discharge failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <LogOut size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Discharge Patient</h2>
              <p className="text-xs text-slate-400">Ward: {admission?.ward} | Room: {admission?.room_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form id="discharge-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-text">Final Diagnosis</label>
            <input className="input-field" placeholder="Diagnosis at discharge" value={form.diagnosis_at_discharge} onChange={set('diagnosis_at_discharge')} />
          </div>
          <div>
            <label className="label-text">Discharge Notes</label>
            <textarea className="input-field resize-none" rows={3} placeholder="Instructions, follow-up care..." value={form.discharge_notes} onChange={set('discharge_notes')} />
          </div>
          <div>
            <label className="label-text">Total Cost (₹)</label>
            <input className="input-field" type="number" placeholder="15000" value={form.total_cost} onChange={set('total_cost')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" id="btn-confirm-discharge" disabled={loading} className="btn-success flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Discharge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
