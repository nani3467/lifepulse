import { useState, useEffect } from 'react'
import { Bed, Search, Plus, X, Check, Eye, HelpCircle, Loader2, AlertCircle } from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // all, active, discharged
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modals state
  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [showDischargeModal, setShowDischargeModal] = useState(false)
  const [selectedAdmission, setSelectedAdmission] = useState(null)
  
  // Form states
  const [admitForm, setAdmitForm] = useState({
    patient_id: '',
    ward: 'General Ward',
    room_number: '',
    bed_number: '',
    reason: '',
    diagnosis_at_admission: ''
  })
  
  const [dischargeForm, setDischargeForm] = useState({
    diagnosis_at_discharge: '',
    discharge_notes: '',
    total_cost: ''
  })

  useEffect(() => {
    loadAdmissions()
    loadPatients()
  }, [])

  const loadAdmissions = async () => {
    setLoading(true)
    try {
      const { data } = await patientApi.listAllAdmissions()
      setAdmissions(data.admissions || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load admissions log')
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

  const handleAdmitSubmit = async (e) => {
    e.preventDefault()
    if (!admitForm.patient_id || !admitForm.reason) {
      toast.error('Please select a patient and specify admission reason')
      return
    }
    
    try {
      await patientApi.admit(admitForm.patient_id, {
        ward: admitForm.ward,
        room_number: admitForm.room_number,
        bed_number: admitForm.bed_number,
        reason: admitForm.reason,
        diagnosis_at_admission: admitForm.diagnosis_at_admission
      })
      toast.success('Patient admitted successfully!')
      setShowAdmitModal(false)
      setAdmitForm({
        patient_id: '',
        ward: 'General Ward',
        room_number: '',
        bed_number: '',
        reason: '',
        diagnosis_at_admission: ''
      })
      loadAdmissions()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to admit patient')
    }
  }

  const handleDischargeSubmit = async (e) => {
    e.preventDefault()
    if (!selectedAdmission) return

    try {
      await patientApi.discharge(selectedAdmission.id, {
        diagnosis_at_discharge: dischargeForm.diagnosis_at_discharge,
        discharge_notes: dischargeForm.discharge_notes,
        total_cost: dischargeForm.total_cost ? parseFloat(dischargeForm.total_cost) : 0
      })
      toast.success('Patient discharged successfully!')
      setShowDischargeModal(false)
      setSelectedAdmission(null)
      setDischargeForm({
        diagnosis_at_discharge: '',
        discharge_notes: '',
        total_cost: ''
      })
      loadAdmissions()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Discharge action failed')
    }
  }

  // Filter admissions
  const filteredAdmissions = admissions.filter(a => {
    const matchesSearch = 
      a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.patient_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.ward?.toLowerCase().includes(searchQuery.toLowerCase())
      
    if (!matchesSearch) return false
    
    if (activeTab === 'active') return a.status === 'admitted'
    if (activeTab === 'discharged') return a.status === 'discharged'
    return true
  })

  return (
    <div className="space-y-6 text-slate-300">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bed className="text-blue-500 animate-pulse" size={24} />
            Clinical Admissions & Bed Control
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage inpatient admissions, assign wards/beds, and coordinate patient discharge logs.</p>
        </div>

        <button
          onClick={() => setShowAdmitModal(true)}
          className="btn btn-primary text-xs flex items-center gap-2 py-2"
        >
          <Plus size={14} />
          New Admission
        </button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex gap-1 bg-slate-950/60 p-1 rounded-lg border border-white/5 w-full sm:w-auto">
          {['all', 'active', 'discharged'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-black uppercase transition-all flex-1 sm:flex-initial ${
                activeTab === tab 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search patient or ward..."
            className="input-field pl-9 text-xs py-2 bg-slate-950/60 border-white/5"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table grid */}
      <div className="glass-card p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <span className="text-slate-500 text-xs">Loading admissions records...</span>
          </div>
        ) : filteredAdmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 font-bold">
                  <th className="py-3 px-2">Patient Details</th>
                  <th className="py-3 px-2">Ward & Bed Allocation</th>
                  <th className="py-3 px-2">Admit Reason</th>
                  <th className="py-3 px-2">Admission Date</th>
                  <th className="py-3 px-2">Discharge Date</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmissions.map((adm) => (
                  <tr key={adm.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.01] transition-all">
                    <td className="py-3 px-2">
                      <strong className="text-white block">{adm.patient_name}</strong>
                      <span className="text-[10px] text-slate-500 block font-mono">{adm.patient_code}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-1">
                        {adm.ward || 'General Ward'}
                      </span>
                      <span className="block text-[10px] text-slate-400">Room: {adm.room_number || 'N/A'} | Bed: {adm.bed_number || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-2 max-w-[150px] truncate" title={adm.reason}>
                      {adm.reason}
                    </td>
                    <td className="py-3 px-2">
                      {format(new Date(adm.admit_date), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="py-3 px-2">
                      {adm.discharge_date 
                        ? format(new Date(adm.discharge_date), 'dd MMM yyyy, hh:mm a') 
                        : <span className="text-slate-500 italic">Still admitted</span>
                      }
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-block ${
                        adm.status === 'admitted' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {adm.status === 'admitted' ? 'Admitted' : 'Discharged'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {adm.status === 'admitted' ? (
                        <button
                          onClick={() => {
                            setSelectedAdmission(adm)
                            setShowDischargeModal(true)
                          }}
                          className="px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg transition-all"
                        >
                          Discharge
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Logged</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <AlertCircle size={40} className="mx-auto opacity-20 mb-3" />
            <strong>No admissions logged matching the current criteria.</strong>
          </div>
        )}
      </div>

      {/* ADMIT MODAL */}
      {showAdmitModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg relative bg-slate-950 border border-white/10">
            <button 
              onClick={() => setShowAdmitModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Bed className="text-blue-500" size={20} />
              Inpatient Admission Order
            </h3>
            
            <form onSubmit={handleAdmitSubmit} className="space-y-4 text-left">
              <div>
                <label className="label-text">Select Patient</label>
                <select
                  className="input-field bg-slate-900 border-white/5 py-2"
                  value={admitForm.patient_id}
                  onChange={(e) => setAdmitForm({ ...admitForm, patient_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_code})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-text">Ward Category</label>
                  <select
                    className="input-field bg-slate-900 border-white/5 py-2"
                    value={admitForm.ward}
                    onChange={(e) => setAdmitForm({ ...admitForm, ward: e.target.value })}
                  >
                    <option value="General Ward">General Ward</option>
                    <option value="Semi-Private">Semi-Private</option>
                    <option value="Private Room">Private Room</option>
                    <option value="ICU">ICU</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 402"
                    className="input-field"
                    value={admitForm.room_number}
                    onChange={(e) => setAdmitForm({ ...admitForm, room_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-text">Bed Number</label>
                  <input
                    type="text"
                    placeholder="e.g. B-12"
                    className="input-field"
                    value={admitForm.bed_number}
                    onChange={(e) => setAdmitForm({ ...admitForm, bed_number: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <label className="label-text">Reason for Admission</label>
                <textarea
                  placeholder="Describe patient condition necessitating admission"
                  rows={2}
                  className="input-field"
                  value={admitForm.reason}
                  onChange={(e) => setAdmitForm({ ...admitForm, reason: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label-text">Initial Diagnosis at Admission</label>
                <textarea
                  placeholder="Clinical diagnostic evaluation"
                  rows={2}
                  className="input-field"
                  value={admitForm.diagnosis_at_admission}
                  onChange={(e) => setAdmitForm({ ...admitForm, diagnosis_at_admission: e.target.value })}
                />
              </div>
              
              <button type="submit" className="w-full btn btn-primary py-2.5 text-xs">
                Authorize Patient Admission
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DISCHARGE MODAL */}
      {showDischargeModal && selectedAdmission && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg relative bg-slate-950 border border-white/10">
            <button 
              onClick={() => setShowDischargeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Check className="text-emerald-500" size={20} />
              Discharge Patient
            </h3>
            <p className="text-xs text-slate-500 mb-4">Patient: {selectedAdmission.patient_name} | Ward: {selectedAdmission.ward}</p>
            
            <form onSubmit={handleDischargeSubmit} className="space-y-4 text-left">
              <div>
                <label className="label-text">Final Diagnosis at Discharge</label>
                <textarea
                  placeholder="Specify final clinical findings"
                  rows={2}
                  className="input-field"
                  value={dischargeForm.diagnosis_at_discharge}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, diagnosis_at_discharge: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label-text">Discharge & Recovery Notes</label>
                <textarea
                  placeholder="Prescription guidelines, follow-up instructions, or post-discharge warnings"
                  rows={3}
                  className="input-field"
                  value={dischargeForm.discharge_notes}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, discharge_notes: e.target.value })}
                />
              </div>

              <div>
                <label className="label-text">Total Admission Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter total bill amount"
                  className="input-field"
                  value={dischargeForm.total_cost}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, total_cost: e.target.value })}
                />
              </div>
              
              <button type="submit" className="w-full btn btn-primary py-2.5 text-xs bg-emerald-600 hover:bg-emerald-500">
                Authorize Discharge Plan
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
