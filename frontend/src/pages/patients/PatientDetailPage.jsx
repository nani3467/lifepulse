import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, User, Phone, Mail, Droplets, Calendar, MapPin,
  Activity, Bed, FileText, Plus, Edit, AlertCircle, Upload,
  ChevronDown, Stethoscope, Pill, ClipboardList, Trash2
} from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import AdmitModal from '@/components/patients/AdmitModal'
import DischargeModal from '@/components/patients/DischargeModal'
import HistoryModal from '@/components/patients/HistoryModal'
import DiseaseModal from '@/components/patients/DiseaseModal'
import ReportUpload from '@/components/patients/ReportUpload'

const TAB_LIST = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'history', label: 'Medical History', icon: ClipboardList },
  { id: 'admissions', label: 'Admissions', icon: Bed },
  { id: 'diseases', label: 'Diseases', icon: Activity },
  { id: 'reports', label: 'Reports', icon: FileText },
]

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(null) // 'admit' | 'discharge' | 'history' | 'disease' | 'report'
  const [activeAdmission, setActiveAdmission] = useState(null)

  const fetchPatient = async () => {
    setLoading(true)
    try {
      const { data } = await patientApi.get(id)
      setPatient(data.patient)
      setActiveAdmission(data.patient.admissions?.find(a => a.status === 'admitted') || null)
    } catch { toast.error('Patient not found'); navigate('/patients') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPatient() }, [id])

  const handleDeleteHistory = async (recordId) => {
    if (!window.confirm('Delete this history record?')) return
    try {
      await patientApi.deleteHistory(recordId)
      toast.success('Record deleted')
      fetchPatient()
    } catch { toast.error('Failed to delete') }
  }

  const handleDeleteDisease = async (recordId) => {
    if (!window.confirm('Delete this disease record?')) return
    try {
      await patientApi.deleteDisease(recordId)
      toast.success('Disease record deleted')
      fetchPatient()
    } catch { toast.error('Failed to delete') }
  }

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Delete this report?')) return
    try {
      await patientApi.deleteReport(reportId)
      toast.success('Report deleted')
      fetchPatient()
    } catch { toast.error('Failed to delete') }
  }

  const onModalDone = () => { setModal(null); fetchPatient() }

  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-48 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  )

  if (!patient) return null

  const statusColor = {
    active: 'badge-active', admitted: 'badge-admitted',
    critical: 'badge-critical', discharged: 'badge-discharged'
  }[patient.status] || 'badge-active'

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button id="btn-back-patients" onClick={() => navigate('/patients')}
          className="btn-secondary">
          <ArrowLeft size={15} /> Back to Patients
        </button>
        <div className="flex gap-2 flex-wrap">
          {patient.status !== 'admitted' && (
            <button id="btn-admit" onClick={() => setModal('admit')} className="btn-primary">
              <Bed size={15} /> Admit Patient
            </button>
          )}
          {activeAdmission && (
            <button id="btn-discharge" onClick={() => setModal('discharge')}
              className="btn-success">
              <ArrowLeft size={15} /> Discharge
            </button>
          )}
        </div>
      </div>

      {/* Patient Header Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white flex-shrink-0"
            style={{
              background: patient.gender === 'female'
                ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
            }}>
            {patient.full_name?.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">{patient.full_name}</h1>
                <p className="text-slate-400 font-mono text-sm mt-0.5">{patient.patient_code}</p>
              </div>
              <span className={`badge ${statusColor} ml-0 sm:ml-auto capitalize`}>{patient.status}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { icon: Calendar, label: 'Age', value: `${patient.age} years (${patient.gender})` },
                { icon: Droplets, label: 'Blood Group', value: patient.blood_group || '—' },
                { icon: Phone, label: 'Phone', value: patient.phone },
                { icon: Mail, label: 'Email', value: patient.email || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={13} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-sm text-white truncate max-w-28">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alert banners */}
      {patient.allergies && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25">
          <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold text-rose-400 uppercase">Allergies: </span>
            <span className="text-sm text-rose-300">{patient.allergies}</span>
          </div>
        </div>
      )}
      {patient.chronic_conditions && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <Activity size={16} className="text-amber-400 flex-shrink-0" />
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase">Chronic: </span>
            <span className="text-sm text-amber-300">{patient.chronic_conditions}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="flex overflow-x-auto border-b border-white/5">
          {TAB_LIST.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0
                ${tab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 animate-fade-in">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoSection title="Personal" items={[
                ['Address', patient.address || '—'],
                ['City', patient.city || '—'],
                ['State', patient.state || '—'],
                ['Pincode', patient.pincode || '—'],
              ]} />
              <InfoSection title="Emergency Contact" items={[
                ['Name', patient.emergency_name || '—'],
                ['Phone', patient.emergency_phone || '—'],
                ['Relation', patient.emergency_relation || '—'],
              ]} />
              <InfoSection title="Insurance" items={[
                ['Provider', patient.insurance_provider || '—'],
                ['Policy ID', patient.insurance_id || '—'],
              ]} />
              <InfoSection title="Current Medications" items={[
                ['Medications', patient.current_medications || '—'],
              ]} />
            </div>
          )}

          {/* MEDICAL HISTORY */}
          {tab === 'history' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">Medical History</h3>
                <button id="btn-add-history" onClick={() => setModal('history')} className="btn-primary">
                  <Plus size={14} /> Add Record
                </button>
              </div>
              {patient.medical_history?.length === 0 ? (
                <EmptyState icon={ClipboardList} msg="No medical history recorded yet." />
              ) : (
                <div className="space-y-3">
                  {patient.medical_history?.map(h => (
                    <div key={h.id} className="p-4 rounded-xl bg-white/3 border border-white/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="badge badge-active capitalize">{h.visit_type?.replace('_', ' ')}</span>
                            <span className="text-xs text-slate-500">{h.date}</span>
                            {h.doctor_name && <span className="text-xs text-blue-400">Dr. {h.doctor_name}</span>}
                          </div>
                          <p className="text-sm font-medium text-white">{h.diagnosis}</p>
                          {h.chief_complaint && <p className="text-xs text-slate-400 mt-1">Complaint: {h.chief_complaint}</p>}
                          {h.prescription && <p className="text-xs text-slate-400 mt-1">Rx: {h.prescription}</p>}
                          {h.follow_up_date && <p className="text-xs text-amber-400 mt-1">Follow-up: {h.follow_up_date}</p>}
                        </div>
                        <button onClick={() => handleDeleteHistory(h.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-colors flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADMISSIONS */}
          {tab === 'admissions' && (
            <div>
              <h3 className="font-semibold text-white mb-4">Admission History</h3>
              {patient.admissions?.length === 0 ? (
                <EmptyState icon={Bed} msg="No admissions recorded." />
              ) : (
                <div className="space-y-3">
                  {patient.admissions?.map(a => (
                    <div key={a.id} className="p-4 rounded-xl bg-white/3 border border-white/5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`badge badge-${a.status}`}>{a.status}</span>
                            {a.ward && <span className="text-xs text-slate-400">Ward: {a.ward}</span>}
                            {a.room_number && <span className="text-xs text-slate-400">Room: {a.room_number}</span>}
                          </div>
                          <p className="text-sm font-medium text-white">{a.reason}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Admitted: {format(new Date(a.admit_date), 'PPP')}
                            {a.discharge_date && ` → ${format(new Date(a.discharge_date), 'PPP')} (${a.duration_days} days)`}
                          </p>
                          {a.discharge_notes && <p className="text-xs text-slate-400 mt-1">{a.discharge_notes}</p>}
                        </div>
                        {a.total_cost && (
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Total Cost</div>
                            <div className="text-sm font-bold text-emerald-400">₹{Number(a.total_cost).toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DISEASES */}
          {tab === 'diseases' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">Disease Records</h3>
                <button id="btn-add-disease" onClick={() => setModal('disease')} className="btn-primary">
                  <Plus size={14} /> Add Disease
                </button>
              </div>
              {patient.diseases?.length === 0 ? (
                <EmptyState icon={Activity} msg="No disease records found." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {patient.diseases?.map(d => (
                    <div key={d.id} className="p-4 rounded-xl bg-white/3 border border-white/5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-white text-sm">{d.disease_name}</div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className={`badge badge-${d.severity}`}>{d.severity}</span>
                            <span className={`badge badge-${d.status === 'active' ? 'active' : 'discharged'}`}>{d.status}</span>
                            {d.is_chronic && <span className="badge badge-critical">Chronic</span>}
                            {d.icd_code && <span className="badge badge-discharged">{d.icd_code}</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-2">Diagnosed: {d.diagnosed_date}</div>
                        </div>
                        <button onClick={() => handleDeleteDisease(d.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPORTS */}
          {tab === 'reports' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">Patient Reports</h3>
                <button id="btn-upload-report" onClick={() => setModal('report')} className="btn-primary">
                  <Upload size={14} /> Upload Report
                </button>
              </div>
              {patient.reports?.length === 0 ? (
                <EmptyState icon={FileText} msg="No reports uploaded yet." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {patient.reports?.map(r => (
                    <div key={r.id} className="p-4 rounded-xl bg-white/3 border border-white/5 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{r.report_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="badge badge-active capitalize text-xs">{r.report_type?.replace('_', ' ')}</span>
                          <span className="text-xs text-slate-500">{r.uploaded_at ? format(new Date(r.uploaded_at), 'MMM d, yyyy') : ''}</span>
                        </div>
                        {r.file_size && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {(r.file_size / 1024).toFixed(1)} KB
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <a href={r.download_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-blue-500/15 text-slate-400 hover:text-blue-400 transition-colors">
                          <FileText size={14} />
                        </a>
                        <button onClick={() => handleDeleteReport(r.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'admit' && <AdmitModal patientId={id} onClose={() => setModal(null)} onDone={onModalDone} />}
      {modal === 'discharge' && <DischargeModal admission={activeAdmission} onClose={() => setModal(null)} onDone={onModalDone} />}
      {modal === 'history' && <HistoryModal patientId={id} onClose={() => setModal(null)} onDone={onModalDone} />}
      {modal === 'disease' && <DiseaseModal patientId={id} onClose={() => setModal(null)} onDone={onModalDone} />}
      {modal === 'report' && <ReportUpload patientId={id} onClose={() => setModal(null)} onDone={onModalDone} />}
    </div>
  )
}

function InfoSection({ title, items }) {
  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/5">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-xs text-white text-right max-w-40 truncate">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
      <Icon size={36} className="opacity-25" />
      <p className="text-sm">{msg}</p>
    </div>
  )
}
