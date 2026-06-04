import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
         eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths,
         subMonths, addWeeks, subWeeks, addDays, subDays, parseISO,
         getHours } from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, LayoutGrid, List,
  Calendar as CalIcon, Clock, Filter, RefreshCw
} from 'lucide-react'
import { appointmentApi } from '@/services/appointmentApi'
import AppointmentFormModal from '@/components/appointments/AppointmentFormModal'
import AppointmentDetailModal from '@/components/appointments/AppointmentDetailModal'
import toast from 'react-hot-toast'

const VIEW_MODES = ['month', 'week', 'day', 'list']
const STATUS_COLORS = {
  pending:   { bg: 'bg-amber-500/20',   text: 'text-amber-300',   dot: 'bg-amber-400' },
  confirmed: { bg: 'bg-blue-500/20',    text: 'text-blue-300',    dot: 'bg-blue-400' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  rejected:  { bg: 'bg-rose-500/20',    text: 'text-rose-300',    dot: 'bg-rose-400' },
  cancelled: { bg: 'bg-slate-500/20',   text: 'text-slate-400',   dot: 'bg-slate-500' },
  no_show:   { bg: 'bg-orange-500/20',  text: 'text-orange-300',  dot: 'bg-orange-400' },
}

export default function AppointmentsPage() {
  const [view, setView] = useState('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailAppt, setDetailAppt] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const { data } = await appointmentApi.calendar({ year, month })
      setAppointments(data.appointments)
    } catch { toast.error('Failed to load appointments') }
    finally { setLoading(false) }
  }, [currentDate])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const navigate = (dir) => {
    if (view === 'month') setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    else setCurrentDate(dir > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1))
  }

  const apptsByDate = appointments.reduce((acc, a) => {
    const key = a.appointment_date
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const filteredApptsByDate = statusFilter
    ? Object.fromEntries(
        Object.entries(apptsByDate).map(([k, v]) => [k, v.filter(a => a.status === statusFilter)])
      )
    : apptsByDate

  const onSaved = () => { setShowForm(false); setSelected(null); fetchAppointments() }
  const onDetailClose = () => { setDetailAppt(null); fetchAppointments() }

  const headerLabel = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      const we = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy')
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <p className="text-slate-400 text-sm">{appointments.length} appointments this month</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button id="btn-refresh-cal" onClick={fetchAppointments} className="btn-secondary">
            <RefreshCw size={14} />
          </button>
          <select
            className="input-field w-auto text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s} className="bg-slate-900 capitalize">{s}</option>
            ))}
          </select>
          <button id="btn-book-appointment" onClick={() => { setSelected(null); setShowForm(true) }}
            className="btn-primary">
            <Plus size={16} /> Book Appointment
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Nav */}
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
              Today
            </button>
            <button onClick={() => navigate(1)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
            <h2 className="text-lg font-bold text-white ml-2">{headerLabel()}</h2>
          </div>

          {/* View switcher */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 gap-0.5">
            {VIEW_MODES.map(v => (
              <button key={v} onClick={() => setView(v)}
                id={`view-${v}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all
                  ${view === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Views */}
      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          apptsByDate={filteredApptsByDate}
          loading={loading}
          onDayClick={(d) => { setCurrentDate(d); setView('day') }}
          onApptClick={setDetailAppt}
        />
      )}
      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          apptsByDate={filteredApptsByDate}
          loading={loading}
          onApptClick={setDetailAppt}
        />
      )}
      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          appointments={(filteredApptsByDate[format(currentDate, 'yyyy-MM-dd')] || []).sort(
            (a, b) => a.appointment_time?.localeCompare(b.appointment_time)
          )}
          loading={loading}
          onApptClick={setDetailAppt}
        />
      )}
      {view === 'list' && (
        <ListView
          appointments={Object.values(filteredApptsByDate).flat().sort(
            (a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`)
          )}
          loading={loading}
          onApptClick={setDetailAppt}
        />
      )}

      {showForm && (
        <AppointmentFormModal
          prefillDate={selected}
          onClose={() => { setShowForm(false); setSelected(null) }}
          onSaved={onSaved}
        />
      )}
      {detailAppt && (
        <AppointmentDetailModal
          appointmentId={detailAppt.id}
          onClose={onDetailClose}
        />
      )}
    </div>
  )
}

// ─── Month View ──────────────────────────────────────────────────────────────

function MonthView({ currentDate, apptsByDate, loading, onDayClick, onApptClick }) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="glass-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-white/5">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayAppts = apptsByDate[key] || []
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isTodayDate = isToday(day)

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`min-h-24 p-2 border-b border-r border-white/5 cursor-pointer transition-colors
                ${!isCurrentMonth ? 'opacity-30' : 'hover:bg-white/3'}
                ${isTodayDate ? 'bg-blue-500/5' : ''}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold mb-1 transition-colors
                ${isTodayDate
                  ? 'bg-blue-600 text-white'
                  : isCurrentMonth ? 'text-white' : 'text-slate-600'
                }`}>
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending
                  return (
                    <div
                      key={a.id}
                      onClick={e => { e.stopPropagation(); onApptClick(a) }}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium truncate
                        cursor-pointer hover:opacity-80 transition-opacity ${sc.bg} ${sc.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <span className="truncate">
                        {a.appointment_time?.slice(0, 5)} {a.patient_name}
                      </span>
                    </div>
                  )
                })}
                {dayAppts.length > 3 && (
                  <div className="text-xs text-slate-500 px-1">+{dayAppts.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week View ───────────────────────────────────────────────────────────────

function WeekView({ currentDate, apptsByDate, loading, onApptClick }) {
  const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: ws, end: addDays(ws, 6) })
  const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8AM–8PM

  return (
    <div className="glass-card overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-white/5 sticky top-0 bg-surface-card z-10">
        <div className="py-3 text-center text-xs text-slate-600 border-r border-white/5">Time</div>
        {days.map(d => (
          <div key={d.toString()} className={`py-3 text-center border-r border-white/5 ${isToday(d) ? 'bg-blue-500/5' : ''}`}>
            <div className="text-xs text-slate-500">{format(d, 'EEE')}</div>
            <div className={`text-sm font-bold mt-0.5 ${isToday(d) ? 'text-blue-400' : 'text-white'}`}>
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Hour rows */}
      {hours.map(h => (
        <div key={h} className="grid grid-cols-8 border-b border-white/5 min-h-16">
          <div className="px-2 py-1 text-xs text-slate-600 border-r border-white/5 sticky left-0 flex items-start pt-1">
            {h}:00
          </div>
          {days.map(d => {
            const key = format(d, 'yyyy-MM-dd')
            const hourAppts = (apptsByDate[key] || []).filter(a => {
              const ah = parseInt(a.appointment_time?.split(':')[0] || '0')
              return ah === h
            })
            return (
              <div key={d.toString()}
                className={`border-r border-white/5 p-1 ${isToday(d) ? 'bg-blue-500/3' : ''}`}>
                {hourAppts.map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending
                  return (
                    <div key={a.id} onClick={() => onApptClick(a)}
                      className={`text-xs px-1.5 py-1 rounded mb-0.5 cursor-pointer hover:opacity-80 ${sc.bg} ${sc.text}`}>
                      <div className="font-semibold truncate">{a.patient_name}</div>
                      <div className="opacity-70">{a.appointment_time?.slice(0, 5)}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({ currentDate, appointments, loading, onApptClick }) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8)

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <h3 className="font-semibold text-white">{format(currentDate, 'EEEE, MMMM d')}</h3>
        <p className="text-xs text-slate-400">{appointments.length} appointments</p>
      </div>
      <div className="divide-y divide-white/5">
        {hours.map(h => {
          const hourAppts = appointments.filter(a =>
            parseInt(a.appointment_time?.split(':')[0] || '0') === h
          )
          return (
            <div key={h} className="flex">
              <div className="w-16 flex-shrink-0 px-3 py-3 text-xs text-slate-600 border-r border-white/5">
                {h}:00
              </div>
              <div className="flex-1 p-2 min-h-14 space-y-1.5">
                {hourAppts.map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending
                  return (
                    <div key={a.id} onClick={() => onApptClick(a)}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity ${sc.bg} border border-white/5`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{a.patient_name}</span>
                          <span className={`text-xs ${sc.text} capitalize`}>{a.status}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {a.appointment_time?.slice(0, 5)} · {a.department_name || 'General'} · Dr. {a.doctor_name || 'Unassigned'}
                        </div>
                        {a.reason && <div className="text-xs text-slate-500 truncate mt-0.5">{a.reason}</div>}
                      </div>
                      <span className={`text-xs badge badge-${a.status === 'confirmed' ? 'admitted' : a.status === 'completed' ? 'active' : 'discharged'} capitalize flex-shrink-0`}>
                        {a.appointment_type?.replace('_', ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({ appointments, loading, onApptClick }) {
  if (loading) return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  )

  const grouped = appointments.reduce((acc, a) => {
    const key = a.appointment_date
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.keys(grouped).sort().map(dateKey => (
        <div key={dateKey}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`px-3 py-1 rounded-lg text-xs font-semibold
              ${dateKey === format(new Date(), 'yyyy-MM-dd')
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-slate-400'}`}>
              {dateKey === format(new Date(), 'yyyy-MM-dd')
                ? 'Today'
                : format(parseISO(dateKey), 'EEEE, MMM d')}
            </div>
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-slate-500">{grouped[dateKey].length} appts</span>
          </div>
          <div className="space-y-2">
            {grouped[dateKey].map(a => {
              const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending
              return (
                <div key={a.id} onClick={() => onApptClick(a)}
                  className="glass-card p-4 cursor-pointer hover:border-white/20 transition-all flex items-center gap-4">
                  <div className={`w-1 h-12 rounded-full flex-shrink-0 ${sc.dot}`} />
                  <div className="w-14 text-center flex-shrink-0">
                    <div className="text-lg font-bold text-white">{a.appointment_time?.slice(0, 5)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{a.patient_name}</span>
                      <span className="font-mono text-xs text-slate-500">{a.appointment_code}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Dr. {a.doctor_name || 'TBD'} · {a.department_name || 'General'} · {a.appointment_type?.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`badge capitalize ${sc.bg} ${sc.text}`}>{a.status}</span>
                    {a.priority !== 'normal' && (
                      <span className="text-xs text-rose-400 font-semibold uppercase">{a.priority}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {Object.keys(grouped).length === 0 && (
        <div className="glass-card p-16 text-center text-slate-500">
          <CalIcon size={40} className="mx-auto mb-3 opacity-20" />
          <p>No appointments found</p>
        </div>
      )}
    </div>
  )
}
