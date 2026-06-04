import { useState } from 'react'
import { X, Activity } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

const SEVERITIES = ['mild', 'moderate', 'severe', 'critical']
const CATEGORIES = ['Cardiovascular', 'Respiratory', 'Neurological', 'Endocrine', 'Gastrointestinal', 'Infectious', 'Musculoskeletal', 'Mental Health', 'Oncology', 'Other']

export default function DiseaseModal({ patientId, onClose, onDone }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    disease_name: '', icd_code: '', category: '', severity: 'mild',
    diagnosed_date: today, is_chronic: false, status: 'active', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.disease_name) return toast.error('Disease name is required')
    setLoading(true)
    try {
      await patientApi.addDisease(patientId, form)
      toast.success('Disease record added')
      onDone()
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed to add') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Activity size={18} className="text-rose-400" />
            </div>
            <h2 className="font-bold text-white">Add Disease Record</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form id="disease-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-text">Disease Name *</label>
            <input className="input-field" placeholder="e.g., Type 2 Diabetes Mellitus" value={form.disease_name} onChange={set('disease_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">ICD Code</label>
              <input className="input-field" placeholder="E11.9" value={form.icd_code} onChange={set('icd_code')} />
            </div>
            <div>
              <label className="label-text">Category</label>
              <select className="input-field" value={form.category} onChange={set('category')}>
                <option value="" className="bg-slate-900">Select</option>
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Severity</label>
              <select className="input-field" value={form.severity} onChange={set('severity')}>
                {SEVERITIES.map(s => <option key={s} value={s} className="bg-slate-900 capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Diagnosed Date</label>
              <input type="date" className="input-field" value={form.diagnosed_date} onChange={set('diagnosed_date')} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
            <input type="checkbox" id="is-chronic" className="w-4 h-4 accent-blue-500"
              checked={form.is_chronic} onChange={e => setForm(f => ({ ...f, is_chronic: e.target.checked }))} />
            <label htmlFor="is-chronic" className="text-sm text-slate-300 cursor-pointer">Mark as Chronic Condition</label>
          </div>
          <div>
            <label className="label-text">Notes</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Additional notes..." value={form.notes} onChange={set('notes')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" id="btn-save-disease" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Add Disease'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
