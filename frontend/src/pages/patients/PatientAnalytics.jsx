import { useEffect, useState } from 'react'
import { patientApi } from '@/services/patientApi'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title,
  Tooltip, Legend, ArcElement, PointElement, LineElement, RadialLinearScale
} from 'chart.js'
import { Bar, Doughnut, Line, PolarArea } from 'react-chartjs-2'
import { Activity, Users, Bed, TrendingUp, AlertCircle } from 'lucide-react'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  ArcElement, PointElement, LineElement, RadialLinearScale
)

const CHART_COLORS = {
  blue: 'rgba(59,130,246,0.85)',
  cyan: 'rgba(6,182,212,0.85)',
  emerald: 'rgba(16,185,129,0.85)',
  amber: 'rgba(245,158,11,0.85)',
  rose: 'rgba(244,63,94,0.85)',
  violet: 'rgba(139,92,246,0.85)',
  orange: 'rgba(249,115,22,0.85)',
  teal: 'rgba(20,184,166,0.85)',
  pink: 'rgba(236,72,153,0.85)',
  indigo: 'rgba(99,102,241,0.85)',
}

const baseChartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
    },
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
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
  }
}

export default function PatientAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    patientApi.analytics()
      .then(({ data: d }) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}
      </div>
    </div>
  )

  const statusColors = {
    active: 'rgba(16,185,129,0.8)',
    admitted: 'rgba(59,130,246,0.8)',
    discharged: 'rgba(100,116,139,0.8)',
    critical: 'rgba(244,63,94,0.8)',
    deceased: 'rgba(51,65,85,0.8)',
  }

  // KPI summary cards
  const kpis = [
    { label: 'Total Patients', value: data?.total_patients ?? 0, icon: Users, color: 'from-blue-600 to-cyan-500', glow: 'rgba(59,130,246,0.3)' },
    { label: 'Currently Admitted', value: data?.by_status?.admitted ?? 0, icon: Bed, color: 'from-violet-600 to-purple-500', glow: 'rgba(139,92,246,0.3)' },
    { label: 'Active Patients', value: data?.by_status?.active ?? 0, icon: Activity, color: 'from-emerald-600 to-green-500', glow: 'rgba(16,185,129,0.3)' },
    { label: 'Critical Cases', value: data?.by_status?.critical ?? 0, icon: AlertCircle, color: 'from-rose-600 to-red-500', glow: 'rgba(244,63,94,0.3)' },
  ]

  // Disease trend chart
  const diseaseTrend = {
    labels: data?.disease_trend?.map(d => d.disease.length > 22 ? d.disease.slice(0, 22) + '…' : d.disease) ?? [],
    datasets: [{
      label: 'Cases',
      data: data?.disease_trend?.map(d => d.count) ?? [],
      backgroundColor: Object.values(CHART_COLORS),
      borderRadius: 6,
      borderWidth: 0,
    }]
  }

  // Status doughnut
  const statusLabels = Object.keys(data?.by_status ?? {})
  const statusDoughnut = {
    labels: statusLabels.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [{
      data: statusLabels.map(s => data.by_status[s]),
      backgroundColor: statusLabels.map(s => statusColors[s] || 'rgba(100,116,139,0.8)'),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }

  // Gender polar
  const genderLabels = Object.keys(data?.by_gender ?? {})
  const genderPolar = {
    labels: genderLabels.map(g => g.charAt(0).toUpperCase() + g.slice(1)),
    datasets: [{
      data: genderLabels.map(g => data.by_gender[g]),
      backgroundColor: ['rgba(59,130,246,0.75)', 'rgba(236,72,153,0.75)', 'rgba(100,116,139,0.75)'],
      borderWidth: 0,
    }]
  }

  // Severity chart
  const severityLabels = ['mild', 'moderate', 'severe', 'critical']
  const severityChart = {
    labels: severityLabels.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [{
      label: 'Disease Cases',
      data: severityLabels.map(s => data?.severity_distribution?.[s] ?? 0),
      backgroundColor: [
        'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)',
        'rgba(249,115,22,0.7)', 'rgba(244,63,94,0.7)'
      ],
      borderRadius: 8,
      borderWidth: 0,
    }]
  }

  // Monthly admissions line
  const monthlyLine = {
    labels: data?.monthly_admissions?.map(m => m.month) ?? [],
    datasets: [{
      label: 'Admissions',
      data: data?.monthly_admissions?.map(m => m.count) ?? [],
      borderColor: 'rgba(59,130,246,0.9)',
      backgroundColor: 'rgba(59,130,246,0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: 'rgba(59,130,246,1)',
      pointBorderWidth: 0,
      pointRadius: 4,
    }]
  }

  // Blood group chart
  const bloodLabels = Object.keys(data?.by_blood_group ?? {})
  const bloodChart = {
    labels: bloodLabels,
    datasets: [{
      label: 'Patients',
      data: bloodLabels.map(b => data.by_blood_group[b]),
      backgroundColor: Object.values(CHART_COLORS).slice(0, bloodLabels.length),
      borderRadius: 6,
      borderWidth: 0,
    }]
  }

  const noData = (arr) => !arr || arr.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Patient Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time insights from patient data</p>
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

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-white mb-4">Top Disease Trends</h2>
          {noData(data?.disease_trend) ? <Empty /> : (
            <div className="h-64">
              <Bar data={diseaseTrend} options={{ ...baseChartOpts, indexAxis: 'y' }} />
            </div>
          )}
        </div>
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4">Patient Status</h2>
          {noData(statusLabels) ? <Empty /> : (
            <div className="h-64">
              <Doughnut data={statusDoughnut} options={{ ...baseChartOpts, scales: undefined, cutout: '65%' }} />
            </div>
          )}
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4">Gender Distribution</h2>
          {noData(genderLabels) ? <Empty /> : (
            <div className="h-60">
              <PolarArea data={genderPolar} options={{ ...baseChartOpts, scales: undefined }} />
            </div>
          )}
        </div>
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4">Disease Severity</h2>
          <div className="h-60">
            <Bar data={severityChart} options={baseChartOpts} />
          </div>
        </div>
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4">Blood Groups</h2>
          {noData(bloodLabels) ? <Empty /> : (
            <div className="h-60">
              <Bar data={bloodChart} options={baseChartOpts} />
            </div>
          )}
        </div>
      </div>

      {/* Monthly Admissions */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">Monthly Admissions Trend</h2>
        {noData(data?.monthly_admissions) ? <Empty msg="No admission data yet." /> : (
          <div className="h-56">
            <Line data={monthlyLine} options={baseChartOpts} />
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ msg = 'No data available yet.' }) {
  return (
    <div className="h-56 flex flex-col items-center justify-center gap-2 text-slate-600">
      <AlertCircle size={28} className="opacity-40" />
      <p className="text-sm">{msg}</p>
    </div>
  )
}
