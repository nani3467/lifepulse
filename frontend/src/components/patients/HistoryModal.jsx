import { useState } from 'react'
import { X, ClipboardList } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

const VISIT_TYPES = ['consultation', 'emergency', 'follow_up', 'surgery', 'lab_test', 'vaccination']

export default function HistoryModal({ patientId, onClose, onDone }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today, visit_type: 'consultation', chief_complaint: '',
    diagnosis: '', treatment: '', prescription: '', notes: '', follow_up_date: ''
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.diagnosis) return toast.error('Diagnosis is required')
    setLoading(true)
    try {
      await patientApi.addHistory(patientId, form)
      toast.success('History record added')
      onDone()
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed to add') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ClipboardList size={18} className="text-violet-400" />
            </div>
            <h2 className="font-bold text-white">Add Medical History</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form id="history-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={set('date')} />
            </div>
            <div>
              <label className="label-text">Visit Type</label>
              <select className="input-field" value={form.visit_type} onChange={set('visit_type')}>
                {VISIT_TYPES.map(v => <option key={v} value={v} className="bg-slate-900 capitalize">{v.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-text">Chief Complaint</label>
            <input className="input-field" placeholder="Patient's main complaint" value={form.chief_complaint} onChange={set('chief_complaint')} />
          </div>
          <div>
            <label className="label-text">Diagnosis *</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Clinical diagnosis..." value={form.diagnosis} onChange={set('diagnosis')} />
          </div>
          <div>
            <label className="label-text">Treatment Plan</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Treatment prescribed..." value={form.treatment} onChange={set('treatment')} />
          </div>
          <div>
            <label className="label-text">Prescription / Medications</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Medicines with dosage..." value={form.prescription} onChange={set('prescription')} />
          </div>
          <div>
            <label className="label-text">Follow-up Date</label>
            <input type="date" className="input-field" value={form.follow_up_date} onChange={set('follow_up_date')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" id="btn-save-history" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
