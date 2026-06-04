import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Users, PhoneCall, SkipForward, Clock, CheckCircle, RefreshCw, Activity } from 'lucide-react'
import { appointmentApi } from '@/services/appointmentApi'
import toast from 'react-hot-toast'

const QUEUE_STATUS_STYLES = {
  waiting:     { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/25',   label: 'Waiting' },
  called:      { bg: 'bg-blue-500/10',    text: 'text-blue-300',    border: 'border-blue-500/25',    label: 'Called' },
  in_progress: { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/25',  label: 'In Progress' },
  done:        { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25', label: 'Done' },
  skipped:     { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/25',   label: 'Skipped' },
}

export default function QueuePage() {
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [queueDate, setQueueDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    appointmentApi.getDoctors({}).then(({ data }) => {
      setDoctors(data.doctors)
      if (data.doctors.length > 0) setSelectedDoctor(data.doctors[0])
    })
  }, [])

  const fetchQueue = useCallback(async () => {
    if (!selectedDoctor) return
    setLoading(true)
    try {
      const { data } = await appointmentApi.getQueue({
        doctor_id: selectedDoctor.id,
        date: queueDate
      })
      setQueue(data.queue)
    } catch { toast.error('Failed to load queue') }
    finally { setLoading(false) }
  }, [selectedDoctor, queueDate])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const handleCall = async (entryId) => {
    setActionLoading(`call-${entryId}`)
    try {
      await appointmentApi.callPatient(entryId)
      toast.success('Patient called!')
      fetchQueue()
    } catch (err) { toast.error(err?.response?.data?.error || 'Call failed') }
    finally { setActionLoading(null) }
  }

  const handleSkip = async (entryId) => {
    setActionLoading(`skip-${entryId}`)
    try {
      await appointmentApi.skipPatient(entryId)
      toast.success('Patient skipped')
      fetchQueue()
    } catch (err) { toast.error('Skip failed') }
    finally { setActionLoading(null) }
  }

  const waiting = queue.filter(e => e.status === 'waiting')
  const called  = queue.filter(e => e.status === 'called' || e.status === 'in_progress')
  const done    = queue.filter(e => e.status === 'done' || e.status === 'skipped')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Queue Management</h1>
          <p className="text-slate-400 text-sm">Live patient queue dashboard</p>
        </div>
        <button id="btn-refresh-queue" onClick={fetchQueue} className="btn-secondary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Doctor + Date selector */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="label-text">Doctor</label>
          <select className="input-field"
            value={selectedDoctor?.id || ''}
            onChange={e => setSelectedDoctor(doctors.find(d => d.id === parseInt(e.target.value)))}>
            <option value="">Select doctor</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id} className="bg-slate-900">
                Dr. {d.doctor_name} — {d.department_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-text">Date</label>
          <input type="date" className="input-field"
            value={queueDate} onChange={e => setQueueDate(e.target.value)} />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: queue.length,   color: 'from-blue-600 to-cyan-500',    glow: 'rgba(59,130,246,0.3)' },
          { label: 'Waiting',    value: waiting.length, color: 'from-amber-600 to-orange-500', glow: 'rgba(245,158,11,0.3)' },
          { label: 'In Progress',value: called.length,  color: 'from-violet-600 to-purple-500',glow: 'rgba(139,92,246,0.3)' },
          { label: 'Completed',  value: done.length,    color: 'from-emerald-600 to-green-500',glow: 'rgba(16,185,129,0.3)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}
              style={{ boxShadow: `0 4px 12px ${s.glow}` }}>
              <Users size={16} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Waiting Queue */}
        <div className="glass-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              Waiting Queue
              {waiting.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {waiting.length}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : waiting.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
              <CheckCircle size={36} className="opacity-20" />
              <p className="text-sm">No patients waiting</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waiting.map((entry, idx) => (
                <div key={entry.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all">
                  {/* Position badge */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                    style={{
                      background: idx === 0
                        ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                        : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    }}>
                    #{entry.token_number}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm">
                      {entry.appointment?.patient_name || '—'}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {entry.appointment?.appointment_time?.slice(0, 5)} ·{' '}
                      Est. wait: <span className="text-amber-400">{entry.estimated_wait_mins}m</span>
                    </div>
                    {entry.appointment?.reason && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">{entry.appointment.reason}</div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      id={`btn-call-${entry.id}`}
                      onClick={() => handleCall(entry.id)}
                      disabled={actionLoading === `call-${entry.id}`}
                      className="btn-primary py-1.5 px-3 text-xs"
                    >
                      {actionLoading === `call-${entry.id}`
                        ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        : <><PhoneCall size={13} /> Call</>}
                    </button>
                    <button
                      id={`btn-skip-${entry.id}`}
                      onClick={() => handleSkip(entry.id)}
                      disabled={actionLoading === `skip-${entry.id}`}
                      className="btn-secondary py-1.5 px-3 text-xs"
                    >
                      {actionLoading === `skip-${entry.id}`
                        ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        : <><SkipForward size={13} /> Skip</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Called / Done Panel */}
        <div className="space-y-4">
          {/* Currently Called */}
          <div className="glass-card p-4">
            <h2 className="font-semibold text-white flex items-center gap-2 mb-3">
              <Activity size={16} className="text-blue-400" />
              Currently Called ({called.length})
            </h2>
            {called.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Nobody being seen</p>
            ) : (
              <div className="space-y-2">
                {called.map(entry => {
                  const style = QUEUE_STATUS_STYLES[entry.status]
                  return (
                    <div key={entry.id}
                      className={`p-3 rounded-xl border ${style.bg} ${style.border} flex items-center gap-3`}>
                      <div className={`text-sm font-bold ${style.text}`}>#{entry.token_number}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {entry.appointment?.patient_name}
                        </div>
                        <div className={`text-xs ${style.text} capitalize`}>{style.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Completed */}
          <div className="glass-card p-4">
            <h2 className="font-semibold text-white flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-emerald-400" />
              Done Today ({done.length})
            </h2>
            {done.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No completed visits yet</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {done.map(entry => (
                  <div key={entry.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                    <div className="text-xs font-bold text-slate-500">#{entry.token_number}</div>
                    <div className="text-xs text-slate-400 truncate flex-1">
                      {entry.appointment?.patient_name}
                    </div>
                    <span className={`text-xs capitalize ${
                      entry.status === 'done' ? 'text-emerald-400' : 'text-slate-500'
                    }`}>{entry.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
