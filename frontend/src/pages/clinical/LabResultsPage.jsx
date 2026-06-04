import { useState, useEffect } from 'react'
import { FlaskConical, Search, Plus, X, Download, Loader2, AlertCircle, Calendar, FileText, Eye } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function LabResultsPage() {
  const [reports, setReports] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // all, lab_result, imaging
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  
  // Form state
  const [uploadForm, setUploadForm] = useState({
    patient_id: '',
    report_name: '',
    report_type: 'lab_result',
    report_date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  })

  useEffect(() => {
    loadReports()
    loadPatients()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      // Get all reports, then we filter client-side for lab_result or imaging
      const { data } = await patientApi.listAllReports()
      // Filter reports to only show lab_result or imaging
      const allReports = data.reports || []
      const labReports = allReports.filter(r => r.report_type === 'lab_result' || r.report_type === 'imaging')
      setReports(labReports)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load lab results')
    } finally {
      setLoading(false)
    }
  }

  const loadPatients = async () => {
    try {
      const { data } = await patientApi.list({ per_page: 100 })
      setPatients(data.patients || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size exceeds 5MB limit.')
        e.target.value = null
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!uploadForm.patient_id || !uploadForm.report_name || !selectedFile) {
      toast.error('Please complete all required fields and choose a file')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('report_name', uploadForm.report_name)
    formData.append('report_type', uploadForm.report_type)
    formData.append('report_date', uploadForm.report_date)
    formData.append('description', uploadForm.description || '')

    toast.loading('Uploading laboratory document to storage...', { id: 'upload-toast' })
    try {
      await patientApi.uploadReport(uploadForm.patient_id, formData)
      toast.success('Lab result successfully recorded!', { id: 'upload-toast' })
      setShowUploadModal(false)
      setSelectedFile(null)
      setUploadForm({
        patient_id: '',
        report_name: '',
        report_type: 'lab_result',
        report_date: format(new Date(), 'yyyy-MM-dd'),
        description: ''
      })
      loadReports()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to upload report', { id: 'upload-toast' })
    }
  }

  const handleDeleteReport = async (id) => {
    if (!confirm('Are you sure you want to delete this lab result?')) return
    
    try {
      await patientApi.deleteReport(id)
      toast.success('Lab result deleted successfully.')
      loadReports()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete report')
    }
  }

  // Filter records
  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      r.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.patient_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.report_name?.toLowerCase().includes(searchQuery.toLowerCase())
      
    if (!matchesSearch) return false
    
    if (activeTab !== 'all' && r.report_type !== activeTab) return false
    return true
  })

  return (
    <div className="space-y-6 text-slate-300">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="text-blue-400 animate-pulse" size={24} />
            Diagnostic Labs & Pathology Reports
          </h1>
          <p className="text-slate-400 text-sm mt-1">Access blood counts, pathology logs, MRI scans, and ultrasound findings.</p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="btn btn-primary text-xs flex items-center gap-2 py-2"
        >
          <Plus size={14} />
          Upload Lab Result
        </button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex gap-1 bg-slate-950/60 p-1 rounded-lg border border-white/5 w-full sm:w-auto">
          {['all', 'lab_result', 'imaging'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-black uppercase transition-all flex-1 sm:flex-initial ${
                activeTab === tab 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'lab_result' ? 'Lab Tests' : tab === 'imaging' ? 'Imaging / Scans' : 'All Results'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search patient, test name..."
            className="input-field pl-9 text-xs py-2 bg-slate-950/60 border-white/5"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="glass-card p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <span className="text-slate-500 text-xs">Loading lab archives...</span>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 font-bold">
                  <th className="py-3 px-2">Patient Details</th>
                  <th className="py-3 px-2">Test Name</th>
                  <th className="py-3 px-2">Classification</th>
                  <th className="py-3 px-2">Date of Test</th>
                  <th className="py-3 px-2">Uploaded By</th>
                  <th className="py-3 px-2 text-center">Files & Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((rep) => (
                  <tr key={rep.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01] transition-all">
                    <td className="py-3 px-2">
                      <strong className="text-white block">{rep.patient_name}</strong>
                      <span className="text-[10px] text-slate-500 block font-mono">{rep.patient_code}</span>
                    </td>
                    <td className="py-3 px-2 font-semibold text-white">
                      {rep.report_name}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block border ${
                        rep.report_type === 'imaging' 
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {rep.report_type === 'imaging' ? 'Imaging / Scan' : 'Lab Result'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {rep.report_date ? format(new Date(rep.report_date), 'dd MMM yyyy') : format(new Date(rep.uploaded_at), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 px-2 text-slate-400">
                      {rep.uploader_name || 'System Upload'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center gap-2">
                        <a
                          href={`${api.defaults.baseURL}/uploads/${rep.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent rounded-lg transition-all"
                          title="Open Lab Report"
                        >
                          <Eye size={14} />
                        </a>
                        <button
                          onClick={() => handleDeleteReport(rep.id)}
                          className="p-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg transition-all"
                          title="Delete Record"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <AlertCircle size={40} className="mx-auto opacity-20 mb-3" />
            <strong>No diagnostic lab reports recorded.</strong>
          </div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg relative bg-slate-950 border border-white/10 text-left">
            <button 
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FlaskConical className="text-blue-400" size={20} />
              Record New Lab Analysis
            </h3>
            
            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="label-text">Select Patient</label>
                <select
                  className="input-field bg-slate-900 border-white/5 py-2"
                  value={uploadForm.patient_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, patient_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Test Type / Class</label>
                  <select
                    className="input-field bg-slate-900 border-white/5 py-2"
                    value={uploadForm.report_type}
                    onChange={(e) => setUploadForm({ ...uploadForm, report_type: e.target.value })}
                  >
                    <option value="lab_result">Lab Results (Blood, Urine, Path)</option>
                    <option value="imaging">Imaging (X-Ray, MRI, CT Scan)</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">Date of Test</label>
                  <input
                    type="date"
                    className="input-field"
                    value={uploadForm.report_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, report_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="label-text">Diagnostic Report Name</label>
                <input
                  type="text"
                  placeholder="e.g. Thyroid Panel (TSH, Free T4)"
                  className="input-field"
                  value={uploadForm.report_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, report_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label-text">Upload Scan / Document (PDF, PNG, JPG &lt; 5MB)</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="input-field bg-slate-900 border-white/5 py-1 text-slate-400"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                />
              </div>

              <div>
                <label className="label-text">Description / Remarks</label>
                <textarea
                  placeholder="Input clinical findings or pathology overview"
                  rows={2}
                  className="input-field"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                />
              </div>
              
              <button type="submit" className="w-full btn btn-primary py-2.5 text-xs">
                Upload Diagnostic Report
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
