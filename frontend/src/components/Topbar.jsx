import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Search, Moon, Sun, X, ShieldAlert, Droplet,
  Sparkles, Calendar, Check, CheckSquare, Loader2
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { notificationApi } from '@/services/notificationApi'
import toast from 'react-hot-toast'

export default function Topbar({ collapsed, onToggle, darkMode, onToggleDark }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchVal, setSearchVal] = useState('')

  // Notifications state
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    fetchNotifications()

    // Poll for new centralized notifications every 15 seconds to keep alerts live
    const interval = setInterval(fetchNotifications, 15000)

    // Click outside handler to close dropdown
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', clickOutside)

    return () => {
      clearInterval(interval)
      document.removeEventListener('mousedown', clickOutside)
    }
  }, [])

  const fetchNotifications = () => {
    notificationApi.list()
      .then(({ data }) => {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      })
      .catch(console.error)
  }

  const handleMarkAllRead = () => {
    setLoading(true)
    notificationApi.markAllRead()
      .then(() => {
        toast.success('All notifications marked as read')
        fetchNotifications()
      })
      .catch(err => {
        console.error(err)
        toast.error('Failed to clear notifications')
      })
      .finally(() => setLoading(false))
  }

  const handleNotificationClick = (notif) => {
    setDropdownOpen(false)
    notificationApi.markAsRead(notif.id)
      .then(() => {
        fetchNotifications()
        if (notif.link) {
          navigate(notif.link)
        }
      })
      .catch(console.error)
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'emergency':
        return <ShieldAlert size={14} className="text-rose-400 animate-pulse" />
      case 'blood_crisis':
        return <Droplet size={14} className="text-rose-400" />
      case 'stock_warning':
        return <Sparkles size={14} className="text-amber-400" />
      case 'appointment':
        return <Calendar size={14} className="text-blue-400" />
      default:
        return <Bell size={14} className="text-slate-400" />
    }
  }

  const getNotificationColor = (type) => {
    switch (type) {
      case 'emergency':
        return 'bg-rose-500/10 border-rose-500/20'
      case 'blood_crisis':
        return 'bg-rose-500/10 border-rose-500/20'
      case 'stock_warning':
        return 'bg-amber-500/10 border-amber-500/20'
      case 'appointment':
        return 'bg-blue-500/10 border-blue-500/20'
      default:
        return 'bg-slate-800 border-slate-700/50'
    }
  }

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center gap-4 px-6 transition-all duration-300"
      style={{
        left: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        height: 'var(--topbar-height)',
        background: 'rgba(10,15,30,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Search */}
      <div className="search-bar flex-1 max-w-md">
        <Search size={15} className="text-slate-500 flex-shrink-0" />
        <input
          id="global-search"
          type="text"
          placeholder="Search patients, records..."
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Animated sliding sun/moon toggle */}
        <button
          id="btn-dark-mode"
          onClick={onToggleDark}
          className={`relative w-12 h-6.5 rounded-full p-0.5 transition-all duration-300 focus:outline-none flex items-center border ${
            darkMode 
              ? 'bg-slate-900 border-slate-700 justify-end' 
              : 'bg-amber-100/50 border-amber-300 justify-start'
          }`}
          style={{ width: '48px', height: '24px' }}
          title="Toggle dark/light mode"
        >
          {/* Sliding circle */}
          <div 
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 shadow ${
              darkMode ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {darkMode ? <Moon size={11} className="animate-pulse" /> : <Sun size={11} />}
          </div>
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="btn-notifications"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`relative p-2 rounded-xl hover:bg-white/5 transition-colors ${
              dropdownOpen ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white'
            }`}
            title="Notification Alerts Center"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center border border-slate-900 animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Centralized Notifications Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 glass-card p-3 rounded-2xl border-white/10 shadow-2xl z-40 bg-slate-950/95 backdrop-blur-xl animate-slide-up">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-2.5">
                <div>
                  <h3 className="font-bold text-white text-xs uppercase tracking-wide">Hospital Alerts ({unreadCount})</h3>
                  <span className="text-[9px] text-slate-500">System integrated notification stream</span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={loading}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    {loading ? <Loader2 size={10} className="animate-spin" /> : <CheckSquare size={10} />}
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all hover:bg-white/5 flex gap-2.5 items-start ${
                        getNotificationColor(notif.type)
                      } ${!notif.is_read ? 'shadow-md border-opacity-40' : 'opacity-60'}`}
                    >
                      <div className="mt-0.5">{getNotificationIcon(notif.type)}</div>
                      <div className="flex-1 space-y-0.5 text-left">
                        <div className="flex justify-between items-start">
                          <strong className="font-bold text-white text-[10px]">{notif.title}</strong>
                          {!notif.is_read && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0 mt-1" />}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-600 text-xs flex flex-col items-center justify-center gap-2">
                    <Check size={20} className="opacity-40" />
                    <span>All clear! No pending notifications.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 ml-1 pl-3 border-l border-white/10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-white leading-none">{user?.name}</div>
            <div className="text-xs text-slate-500 capitalize mt-0.5">{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
