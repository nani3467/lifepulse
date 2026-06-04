import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Calendar, Clock, X, Check, Ban } from 'lucide-react'
import { appointmentApi } from '@/services/appointmentApi'
import { formatDistanceToNow } from 'date-fns'

const NOTIF_ICONS = {
  booked:       { icon: Calendar,   color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  confirmed:    { icon: Check,      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  rejected:     { icon: X,          color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  reminder:     { icon: Clock,      color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  cancelled:    { icon: Ban,        color: 'text-slate-400',   bg: 'bg-slate-500/10' },
  queue_called: { icon: Bell,       color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  rescheduled:  { icon: Calendar,   color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef()

  const fetchNotifs = async () => {
    try {
      const { data } = await appointmentApi.getNotifications({ limit: 20 })
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {}
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    try {
      await appointmentApi.markAllRead()
      fetchNotifs()
    } catch {}
  }

  const markOne = async (id) => {
    try {
      await appointmentApi.markRead(id)
      fetchNotifs()
    } catch {}
  }

  return (
    <div className="relative" ref={ref}>
      <button
        id="btn-notifications"
        onClick={() => { setOpen(!open); if (!open) fetchNotifs() }}
        className="relative p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-card overflow-hidden z-50 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="font-semibold text-white text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
                <Bell size={28} className="opacity-20" />
                <p className="text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map(n => {
                const style = NOTIF_ICONS[n.type] || NOTIF_ICONS.booked
                const Icon = style.icon
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markOne(n.id)}
                    className={`flex gap-3 px-4 py-3 border-b border-white/5 cursor-pointer transition-colors
                      ${n.is_read ? 'opacity-50' : 'hover:bg-white/3'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Icon size={14} className={style.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-white leading-tight">{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
