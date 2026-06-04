import { useEffect, useState } from 'react'
import { appointmentApi } from '@/services/appointmentApi'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { CalendarDays, Clock, CheckCircle, Users, TrendingUp, AlertCircle } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend)

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 12,
    }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'Inter' } }, beginAtZero: true },
  }
}

export default function AppointmentAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    appointmentApi.analytics()
      .then(({ data: d }) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-56 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}
      </div>
    </div>
  )

  const today = data?.today || {}
  const kpis = [
    { label: "Today's Total",     value: today.total ?? 0,     icon: CalendarDays, color: 'from-blue-600 to-cyan-500',    glow: 'rgba(59,130,246,0.3)' },
    { label: "Pending Approval",  value: today.pending ?? 0,   icon: Clock,        color: 'from-amber-600 to-orange-500', glow: 'rgba(245,158,11,0.3)' },
    { label: "Confirmed Today",   value: today.confirmed ?? 0, icon: CheckCircle,  color: 'from-emerald-600 to-green-500',glow: 'rgba(16,185,129,0.3)' },
    { label: "Avg Wait (mins)",   value: data?.avg_wait_mins ?? 0, icon: TrendingUp, color: 'from-violet-600 to-purple-500', glow: 'rgba(139,92,246,0.3)' },
  ]

  // Peak hours chart
  const peakHoursChart = {
    labels: data?.peak_hours?.map(h => h.hour) ?? [],
    datasets: [{
      label: 'Appointments',
      data: data?.peak_hours?.map(h => h.count) ?? [],
      backgroundColor: data?.peak_hours?.map((h, i) => {
        const cnt = h.count
        const max = Math.max(...(data.peak_hours.map(x => x.count) || [1]))
        const ratio = cnt / max
        return `rgba(59,130,246,${0.3 + ratio * 0.6})`
      }) ?? [],
      borderRadius: 6,
      borderWidth: 0,
    }]
  }

  // Department traffic doughnut
  const deptChart = {
    labels: data?.department_traffic?.map(d => d.department) ?? [],
    datasets: [{
      data: data?.department_traffic?.map(d => d.count) ?? [],
      backgroundColor: data?.department_traffic?.map(d => d.color + 'cc') ?? [],
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }

  // Daily trend line
  const dailyChart = {
    labels: data?.daily_trend?.map(d => d.date?.slice(5)) ?? [], // MM-DD
    datasets: [{
      label: 'Appointments',
      data: data?.daily_trend?.map(d => d.count) ?? [],
      borderColor: 'rgba(59,130,246,0.9)',
      backgroundColor: 'rgba(59,130,246,0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: 'rgba(59,130,246,1)',
      pointRadius: 4,
      pointBorderWidth: 0,
    }]
  }

  // Monthly trend
  const monthlyChart = {
    labels: data?.monthly_trend?.map(m => m.month) ?? [],
    datasets: [{
      label: 'Appointments',
      data: data?.monthly_trend?.map(m => m.count) ?? [],
      backgroundColor: 'rgba(6,182,212,0.7)',
      borderRadius: 8,
      borderWidth: 0,
    }]
  }

  // By type bar
  const typeNames = Object.keys(data?.by_type ?? {})
  const typeChart = {
    labels: typeNames.map(t => t.replace('_', ' ')),
    datasets: [{
      label: 'Count',
      data: typeNames.map(t => data.by_type[t]),
      backgroundColor: ['rgba(59,130,246,0.7)','rgba(6,182,212,0.7)','rgba(244,63,94,0.7)',
                        'rgba(16,185,129,0.7)','rgba(245,158,11,0.7)','rgba(139,92,246,0.7)'],
      borderRadius: 6,
      borderWidth: 0,
    }]
  }

  const noData = (arr) => !arr || arr.length === 0 || arr.every(x => x === 0 || x.count === 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Appointment Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Insights into scheduling, wait times, and department load</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${k.color}`}
              style={{ boxShadow: `0 4px 16px ${k.glow}` }}>
              <k.icon size={18} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{k.value}</div>
              <div className="text-xs text-slate-400">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1 — Peak Hours + Dept Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            Peak Booking Hours
          </h2>
          {noData(data?.peak_hours) ? <Empty /> : (
            <div className="h-64">
              <Bar data={peakHoursChart} options={chartBase} />
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={16} className="text-cyan-400" />
            Department Traffic
          </h2>
          {noData(data?.department_traffic) ? <Empty /> : (
            <>
              <div className="h-48">
                <Doughnut data={deptChart} options={{ ...chartBase, scales: undefined, cutout: '60%' }} />
              </div>
              {/* Legend */}
              <div className="mt-3 space-y-1">
                {data.department_traffic.slice(0, 5).map(d => (
                  <div key={d.department} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-slate-400 truncate">{d.department}</span>
                    </div>
                    <span className="text-xs font-semibold text-white">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Trend + By Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            Daily Trend (Last 30 Days)
          </h2>
          {noData(data?.daily_trend) ? <Empty /> : (
            <div className="h-56">
              <Line data={dailyChart} options={chartBase} />
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <CalendarDays size={16} className="text-violet-400" />
            Appointment Types
          </h2>
          {noData(typeNames) ? <Empty /> : (
            <div className="h-56">
              <Bar data={typeChart} options={chartBase} />
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Monthly */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-400" />
          Monthly Appointments (Last 6 Months)
        </h2>
        {noData(data?.monthly_trend) ? <Empty msg="No historical data yet." /> : (
          <div className="h-56">
            <Bar data={monthlyChart} options={chartBase} />
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">Appointment Status Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(data?.by_status || {}).map(([status, count]) => {
            const colors = {
              pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
              confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
              completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              rejected:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
              cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
              no_show:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
            }
            return (
              <div key={status} className={`p-4 rounded-xl border text-center ${colors[status] || ''}`}>
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs capitalize mt-1">{status.replace('_', ' ')}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Empty({ msg = 'No data yet.' }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-600">
      <AlertCircle size={28} className="opacity-40" />
      <p className="text-sm">{msg}</p>
    </div>
  )
}
