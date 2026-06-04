import { useState, useEffect } from 'react'
import {
  X, CheckCircle, XCircle, Ban, Clock, User, Building,
  Calendar, Stethoscope, Hash, AlertTriangle, PhoneCall,
  Loader, Activity, FileText
} from 'lucide-react'
import { appointmentApi } from '@/services/appointmentApi'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  pending:   { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Pending Approval' },
  confirmed: { icon: CheckCircle,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Confirmed' },
  completed: { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Completed' },
  rejected:  { icon: XCircle,       color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Rejected' },
  cancelled: { icon: Ban,           color: 'text-slate-400',   bg: 'bg-slate-500/10',   label: 'Cancelled' },
  no_show:   { icon: AlertTriangle, color: 'text-orange-400',  bg: 'bg-orange-500/10',  label: 'No Show' },
}

export default function AppointmentDetailModal({ appointmentId, onClose }) {
  const [appt, setAppt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const fetchAppt = async () => {
    try {
      const { data } = await appointmentApi.get(appointmentId)
      setAppt(data.appointment)
    } catch { toast.error('Failed to load appointment') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAppt() }, [appointmentId])

  const doAction = async (action, payload) => {
    setActionLoading(action)
    try {
      if (action === 'approve') await appointmentApi.approve(appt.id)
      else if (action === 'reject') await appointmentApi.reject(appt.id, { reason: rejectReason })
      else if (action === 'cancel') await appointmentApi.cancel(appt.id)
      else if (action === 'complete') await appointmentApi.complete(appt.id)
      else if (action === 'checkin') await appointmentApi.checkin(appt.id)

      toast.success(`Appointment ${action}d successfully`)
      setShowRejectForm(false)
      await fetchAppt()
    } catch (err) {
      toast.error(err?.response?.data?.error || `${action} failed`)
    } finally { setActionLoading(null) }
  }

  if (loading) return (
    <div className="modal-backdrop">
      <div className="glass-card p-12 flex items-center gap-3">
        <Loader size={20} className="animate-spin text-blue-400" />
        <span className="text-slate-400">Loading appointment...</span>
      </div>
    </div>
  )

  if (!appt) return null

  const statusStyle = STATUS_STYLES[appt.status] || STATUS_STYLES.pending
  const StatusIcon = statusStyle.icon

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusStyle.bg}`}>
              <StatusIcon size={18} className={statusStyle.color} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white">{appt.appointment_code}</h2>
                <span className={`badge capitalize ${statusStyle.bg} ${statusStyle.color}`}>{appt.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">
                {appt.appointment_type?.replace('_', ' ')} · {appt.priority} priority
              </p>
            </div>
          </div>
          <button id="btn-close-detail" onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { icon: User,        label: 'Patient',    value: appt.patient_name },
            { icon: Stethoscope, label: 'Doctor',     value: appt.doctor_name ? `Dr. ${appt.doctor_name}` : '—' },
            { icon: Building,    label: 'Department', value: appt.department_name || '—' },
            { icon: Calendar,    label: 'Date',       value: appt.appointment_date ? format(parseISO(appt.appointment_date), 'PPP') : '—' },
            { icon: Clock,       label: 'Time',       value: `${appt.appointment_time || '—'} – ${appt.end_time || '?'}` },
            { icon: Hash,        label: 'Queue Token',value: appt.queue?.token_number ? `#${appt.queue.token_number}` : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="p-3 rounded-xl bg-white/3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={12} className="text-blue-400" />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
              <div className="text-sm font-semibold text-white truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Reason & Symptoms */}
        {appt.reason && (
          <div className="p-3 rounded-xl bg-white/3 border border-white/5 mb-3">
            <div className="text-xs text-slate-500 mb-1">Reason</div>
            <p className="text-sm text-white">{appt.reason}</p>
          </div>
        )}
        {appt.symptoms && (
          <div className="p-3 rounded-xl bg-white/3 border border-white/5 mb-3">
            <div className="text-xs text-slate-500 mb-1">Symptoms</div>
            <p className="text-sm text-white">{appt.symptoms}</p>
          </div>
        )}

        {/* Rejection Reason */}
        {appt.rejection_reason && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-3 flex gap-2">
            <XCircle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-rose-400 font-semibold mb-0.5">Rejection Reason</div>
              <p className="text-sm text-rose-300">{appt.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* Queue Info */}
        {appt.queue && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-blue-400">Queue Status</span>
              </div>
              <span className={`badge capitalize ${
                appt.queue.status === 'waiting' ? 'bg-amber-500/20 text-amber-300' :
                appt.queue.status === 'called' ? 'bg-blue-500/20 text-blue-300' :
                appt.queue.status === 'in_progress' ? 'bg-violet-500/20 text-violet-300' :
                'bg-emerald-500/20 text-emerald-300'
              }`}>{appt.queue.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <div className="text-lg font-bold text-white">#{appt.queue.token_number}</div>
                <div className="text-xs text-slate-500">Token</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">{appt.queue.position || '—'}</div>
                <div className="text-xs text-slate-500">Position</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">{appt.queue.estimated_wait_mins}m</div>
                <div className="text-xs text-slate-500">Est. Wait</div>
              </div>
            </div>
          </div>
        )}

        {/* Reject form */}
        {showRejectForm && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-4 animate-fade-in">
            <label className="label-text text-rose-400">Rejection Reason</label>
            <textarea className="input-field resize-none mt-1" rows={2}
              placeholder="Explain why this appointment is being rejected..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowRejectForm(false)} className="btn-secondary flex-1 justify-center text-xs">
                Cancel
              </button>
              <button onClick={() => doAction('reject')} className="btn-danger flex-1 justify-center text-xs">
                {actionLoading === 'reject'
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Confirm Reject'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/8">
          {appt.status === 'pending' && (
            <>
              <button id="btn-approve" onClick={() => doAction('approve')} className="btn-success flex-1 justify-center">
                {actionLoading === 'approve'
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle size={15} /> Approve</>}
              </button>
              <button id="btn-reject" onClick={() => setShowRejectForm(true)} className="btn-danger flex-1 justify-center">
                <XCircle size={15} /> Reject
              </button>
            </>
          )}
          {appt.status === 'confirmed' && !appt.checked_in_at && (
            <button id="btn-checkin" onClick={() => doAction('checkin')} className="btn-primary flex-1 justify-center">
              {actionLoading === 'checkin'
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><PhoneCall size={15} /> Check In</>}
            </button>
          )}
          {appt.status === 'confirmed' && (
            <button id="btn-complete" onClick={() => doAction('complete')} className="btn-success flex-1 justify-center">
              {actionLoading === 'complete'
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle size={15} /> Complete</>}
            </button>
          )}
          {!['completed', 'cancelled', 'rejected'].includes(appt.status) && (
            <button id="btn-cancel-appt-action" onClick={() => doAction('cancel')} className="btn-secondary justify-center">
              {actionLoading === 'cancel'
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Ban size={15} /> Cancel</>}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary justify-center">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
