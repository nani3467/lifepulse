import { useState, useCallback } from 'react'
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

const REPORT_TYPES = ['lab_result', 'imaging', 'prescription', 'discharge_summary', 'other']

export default function ReportUpload({ patientId, onClose, onDone }) {
  const today = new Date().toISOString().split('T')[0]
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ report_name: '', report_type: 'lab_result', description: '', report_date: today })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) {
      setFile(accepted[0])
      if (!form.report_name) setForm(f => ({ ...f, report_name: accepted[0].name }))
    }
  }, [form.report_name])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/*': [], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [] },
    maxSize: 16 * 1024 * 1024,
    multiple: false
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please select a file to upload')
    if (!form.report_name) return toast.error('Report name is required')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('report_name', form.report_name)
      fd.append('report_type', form.report_type)
      fd.append('description', form.description)
      fd.append('report_date', form.report_date)
      await patientApi.uploadReport(patientId, fd)
      toast.success('Report uploaded successfully')
      onDone()
    } catch (err) { toast.error(err?.response?.data?.error || 'Upload failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Upload size={18} className="text-cyan-400" />
            </div>
            <h2 className="font-bold text-white">Upload Report</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form id="upload-form" onSubmit={handleSubmit} className="space-y-3">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/15 hover:border-white/30 hover:bg-white/3'}`}
          >
            <input {...getInputProps()} id="report-file-input" />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle size={32} className="text-emerald-400" />
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="text-xs text-rose-400 hover:text-rose-300">Remove</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-slate-500" />
                <p className="text-sm text-slate-400">
                  {isDragActive ? 'Drop file here...' : 'Drag & drop or click to browse'}
                </p>
                <p className="text-xs text-slate-600">PDF, PNG, JPG, DOCX — max 16MB</p>
              </div>
            )}
          </div>

          <div>
            <label className="label-text">Report Name *</label>
            <input className="input-field" placeholder="Blood CBC Report" value={form.report_name} onChange={set('report_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">Report Type</label>
              <select className="input-field" value={form.report_type} onChange={set('report_type')}>
                {REPORT_TYPES.map(t => <option key={t} value={t} className="bg-slate-900 capitalize">{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Report Date</label>
              <input type="date" className="input-field" value={form.report_date} onChange={set('report_date')} />
            </div>
          </div>
          <div>
            <label className="label-text">Description</label>
            <input className="input-field" placeholder="Brief description..." value={form.description} onChange={set('description')} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" id="btn-confirm-upload" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Upload Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
