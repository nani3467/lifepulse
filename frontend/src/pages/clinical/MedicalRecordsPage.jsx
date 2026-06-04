import { useState, useEffect } from 'react'
import { ClipboardList, Search, Plus, X, Eye, HelpCircle, Loader2, AlertCircle, Calendar } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function MedicalRecordsPage() {
  const [historyRecords, setHistoryRecords] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // all, consultation, follow_up, emergency, procedure
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // Add Form State
  const [addForm, setAddForm] = useState({
    patient_id: '',
    visit_type: 'consultation',
    date: format(new Date(), 'yyyy-MM-dd'),
    chief_complaint: '',
    diagnosis: '',
    treatment: '',
    prescription: '',
    notes: '',
    follow_up_date: ''
  })

  useEffect(() => {
    loadRecords()
    loadPatients()
  }, [])

  const loadRecords = async () => {
    setLoading(true)
    try {
      const { data } = await patientApi.listAllMedicalRecords()
      setHistoryRecords(data.history || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load medical history records')
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

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!addForm.patient_id || !addForm.diagnosis || !addForm.chief_complaint) {
      toast.error('Please select a patient, chief complaint, and diagnosis')
      return
    }
    
    try {
      await patientApi.addHistory(addForm.patient_id, {
        date: addForm.date,
        visit_type: addForm.visit_type,
        chief_complaint: addForm.chief_complaint,
        diagnosis: addForm.diagnosis,
        treatment: addForm.treatment,
        prescription: addForm.prescription,
        notes: addForm.notes,
        follow_up_date: addForm.follow_up_date || null
      })
      toast.success('Clinical record saved to patient EMR!')
      setShowAddModal(false)
      setAddForm({
        patient_id: '',
        visit_type: 'consultation',
        date: format(new Date(), 'yyyy-MM-dd'),
        chief_complaint: '',
        diagnosis: '',
        treatment: '',
        prescription: '',
        notes: '',
        follow_up_date: ''
      })
      loadRecords()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to save record')
    }
  }

  // Filter records
  const filteredRecords = historyRecords.filter(r => {
    const matchesSearch = 
      r.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.patient_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.chief_complaint?.toLowerCase().includes(searchQuery.toLowerCase())
      
    if (!matchesSearch) return false
    
    if (activeTab !== 'all' && r.visit_type !== activeTab) return false
    return true
  })

  return (
    <div className="space-y-6 text-slate-300">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="text-emerald-500 animate-pulse" size={24} />
            Central EMR & Clinical Records
          </h1>
          <p className="text-slate-400 text-sm mt-1">Review diagnostic logs, treatment histories, prescriptions, and clinical follow-ups.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary text-xs flex items-center gap-2 py-2"
        >
          <Plus size={14} />
          Add EMR Record
        </button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex gap-1 bg-slate-950/60 p-1 rounded-lg border border-white/5 w-full sm:w-auto overflow-x-auto">
          {['all', 'consultation', 'follow_up', 'emergency', 'procedure'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all flex-1 sm:flex-initial whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search patient, diagnosis..."
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
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <span className="text-slate-500 text-xs">Loading EMR logs...</span>
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 font-bold">
                  <th className="py-3 px-2">Patient Details</th>
                  <th className="py-3 px-2">Classification</th>
                  <th className="py-3 px-2">Chief Complaint</th>
                  <th className="py-3 px-2">Primary Diagnosis</th>
                  <th className="py-3 px-2">Date Logged</th>
                  <th className="py-3 px-2">Physician</th>
                  <th className="py-3 px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01] transition-all">
                    <td className="py-3 px-2">
                      <strong className="text-white block">{rec.patient_name}</strong>
                      <span className="text-[10px] text-slate-500 block font-mono">{rec.patient_code}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block border ${
                        rec.visit_type === 'emergency' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : rec.visit_type === 'procedure'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {rec.visit_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-2 max-w-[150px] truncate" title={rec.chief_complaint}>
                      {rec.chief_complaint}
                    </td>
                    <td className="py-3 px-2 text-white font-semibold max-w-[150px] truncate" title={rec.diagnosis}>
                      {rec.diagnosis}
                    </td>
                    <td className="py-3 px-2">
                      {format(new Date(rec.date), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 px-2 text-slate-400">
                      {rec.doctor_name || 'System Attending'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => {
                          setSelectedRecord(rec)
                          setShowDetailModal(true)
                        }}
                        className="p-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent rounded-lg transition-all"
                        title="View Complete Clinical Note"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <AlertCircle size={40} className="mx-auto opacity-20 mb-3" />
            <strong>No medical records recorded for patients.</strong>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedRecord && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-xl relative bg-slate-950 border border-white/10 text-left space-y-4">
            <button 
              onClick={() => {
                setShowDetailModal(false)
                setSelectedRecord(null)
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardList className="text-emerald-500" size={20} />
              Inpatient EMR / Consultation Slip
            </h3>
            
            <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Patient Name:</span>
                <strong className="text-white">{selectedRecord.patient_name} ({selectedRecord.patient_code})</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Consultation Date:</span>
                <strong className="text-white">{format(new Date(selectedRecord.date), 'dd MMMM yyyy')}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Attending Physician:</span>
                <strong className="text-white">{selectedRecord.doctor_name || 'System Attending'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Classification:</span>
                <strong className="text-white uppercase">{selectedRecord.visit_type?.replace('_', ' ')}</strong>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="border-b border-white/5 pb-2">
                <span className="text-slate-500 font-bold block mb-1">Chief Complaint:</span>
                <p className="text-slate-200 bg-slate-900/40 p-2.5 rounded-lg border border-white/5">{selectedRecord.chief_complaint}</p>
              </div>
              
              <div className="border-b border-white/5 pb-2">
                <span className="text-emerald-400 font-bold block mb-1">Primary Diagnosis:</span>
                <p className="text-white font-semibold bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-900/20">{selectedRecord.diagnosis}</p>
              </div>
              
              <div className="border-b border-white/5 pb-2">
                <span className="text-slate-500 font-bold block mb-1">Treatment & Clinical Interventions:</span>
                <p className="text-slate-200 bg-slate-900/40 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap">{selectedRecord.treatment || 'No clinical intervention recorded.'}</p>
              </div>

              <div className="border-b border-white/5 pb-2">
                <span className="text-slate-500 font-bold block mb-1">Prescribed Medicines & Dosages:</span>
                <p className="text-slate-200 bg-slate-900/40 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap">{selectedRecord.prescription || 'No medicines prescribed.'}</p>
              </div>

              {selectedRecord.notes && (
                <div className="border-b border-white/5 pb-2">
                  <span className="text-slate-500 font-bold block mb-1">General Notes:</span>
                  <p className="text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap">{selectedRecord.notes}</p>
                </div>
              )}

              {selectedRecord.follow_up_date && (
                <div className="flex gap-2 items-center bg-blue-500/10 text-blue-400 border border-blue-500/20 p-3 rounded-lg">
                  <Calendar size={14} />
                  <span>Scheduled Follow-up Date: <strong>{format(new Date(selectedRecord.follow_up_date), 'dd MMMM yyyy')}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD RECORD MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-xl relative bg-slate-950 border border-white/10 text-left">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ClipboardList className="text-emerald-500" size={20} />
              Write New EMR Consultation Entry
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="label-text">Select Patient</label>
                  <select
                    className="input-field bg-slate-900 border-white/5 py-2"
                    value={addForm.patient_id}
                    onChange={(e) => setAddForm({ ...addForm, patient_id: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text">Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={addForm.date}
                    onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Visit Classification</label>
                  <select
                    className="input-field bg-slate-900 border-white/5 py-2"
                    value={addForm.visit_type}
                    onChange={(e) => setAddForm({ ...addForm, visit_type: e.target.value })}
                  >
                    <option value="consultation">Standard Consultation</option>
                    <option value="follow_up">Scheduled Follow-up</option>
                    <option value="emergency">Emergency / Acute Care</option>
                    <option value="procedure">Clinical Procedure</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">Follow-up Date (Optional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={addForm.follow_up_date}
                    onChange={(e) => setAddForm({ ...addForm, follow_up_date: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <label className="label-text">Chief Complaint</label>
                <textarea
                  placeholder="Primary symptoms or issues patient describes"
                  rows={2}
                  className="input-field"
                  value={addForm.chief_complaint}
                  onChange={(e) => setAddForm({ ...addForm, chief_complaint: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label-text">Primary Diagnosis</label>
                <input
                  type="text"
                  placeholder="Identify disease/condition"
                  className="input-field"
                  value={addForm.diagnosis}
                  onChange={(e) => setAddForm({ ...addForm, diagnosis: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label-text">Treatment & Clinical Action Plan</label>
                <textarea
                  placeholder="Describe treatment procedures, therapies, diet, lifestyle advice"
                  rows={2.5}
                  className="input-field"
                  value={addForm.treatment}
                  onChange={(e) => setAddForm({ ...addForm, treatment: e.target.value })}
                />
              </div>

              <div>
                <label className="label-text">Prescribed Medicines & Instructions</label>
                <textarea
                  placeholder="e.g. Paracetamol 500mg, 1 tab twice daily for 5 days"
                  rows={2}
                  className="input-field"
                  value={addForm.prescription}
                  onChange={(e) => setAddForm({ ...addForm, prescription: e.target.value })}
                />
              </div>

              <div>
                <label className="label-text">Attending Physician Notes (Confidential)</label>
                <textarea
                  placeholder="Internal observations, diagnostic warnings, or physician remarks"
                  rows={2}
                  className="input-field"
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                />
              </div>
              
              <button type="submit" className="w-full btn btn-primary py-2.5 text-xs bg-emerald-600 hover:bg-emerald-500">
                Authorize EMR Log Placement
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
