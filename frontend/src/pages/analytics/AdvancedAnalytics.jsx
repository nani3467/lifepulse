import { useState, useEffect } from 'react'
import {
  BarChart3, Calendar, DollarSign, Users, Award, TrendingUp,
  Filter, RotateCcw, AlertCircle, Database, HelpCircle
} from 'lucide-react'
import { analyticsApi } from '@/services/analyticsApi'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line, Doughnut, PolarArea } from 'react-chartjs-2'
import toast from 'react-hot-toast'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler
)

const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
    },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      padding: 10,
    }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }, beginAtZero: true }
  }
}

export default function AdvancedAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // Advanced Top Slicers (Filters)
  const [days, setDays] = useState(180)  // default Last 6 Months
  const [ward, setWard] = useState('')
  const [severity, setSeverity] = useState('')

  const loadAdvancedStats = () => {
    setLoading(true)
    const params = {}
    if (days) params.days = days
    if (ward) params.ward = ward
    if (severity) params.severity = severity

    analyticsApi.getAdvancedStats(params)
      .then(({ data: res }) => {
        setData(res)
      })
      .catch(err => {
        console.error(err)
        toast.error('Failed to load advanced analytics reports')
      })
      .finally(() => setLoading(false))
  }

  // Trigger loading when slicers change
  useEffect(() => {
    loadAdvancedStats()
  }, [days, ward, severity])

  const handleBackfill = () => {
    setSeeding(true)
    toast.loading('Operational Pipeline: Backfilling historical clinical cases and admissions costs...', { id: 'backfill-toast' })
    
    analyticsApi.backfillData()
      .then(({ data: res }) => {
        toast.success(`Success! Generated ${res.admissions_created} admissions and ${res.diseases_created} disease tracking logs.`, { id: 'backfill-toast' })
        loadAdvancedStats()
      })
      .catch(err => {
        console.error(err)
        toast.error('Backfill seeding failed: ' + (err.response?.data?.error || err.message), { id: 'backfill-toast' })
      })
      .finally(() => setSeeding(false))
  }

  // Clear all slicers
  const resetFilters = () => {
    setDays(180)
    setWard('')
    setSeverity('')
    toast.success('Slicers reset to default values')
  }

  if (loading && !data) return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="skeleton h-14 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
      </div>
    </div>
  )

  const kpis = data?.kpis || {}

  // 1. Line/Area Chart: Monthly Revenue Trend
  const monthlyRevenueChart = {
    labels: data?.revenue?.monthly?.map(item => item.month) || [],
    datasets: [{
      label: 'Monthly Revenue ($)',
      data: data?.revenue?.monthly?.map(item => item.revenue) || [],
      borderColor: 'rgba(6,182,212,0.9)',
      backgroundColor: 'rgba(6,182,212,0.06)',
      borderWidth: 2,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: '#06b6d4',
      pointRadius: 4
    }]
  }

  // 2. Horizontal Bar Chart: Revenue by Ward
  const wardRevenueChart = {
    labels: data?.revenue?.by_ward?.map(item => item.ward) || [],
    datasets: [{
      label: 'Total Revenue ($)',
      data: data?.revenue?.by_ward?.map(item => item.revenue) || [],
      backgroundColor: 'rgba(59,130,246,0.8)',
      borderRadius: 4
    }]
  }

  // 3. Stacked Bar Chart: Bed Occupancy by Ward
  const bedOccupancyChart = {
    labels: data?.bed_occupancy?.map(item => item.ward) || [],
    datasets: [
      {
        label: 'Occupied Beds',
        data: data?.bed_occupancy?.map(item => item.occupied) || [],
        backgroundColor: 'rgba(244,63,94,0.85)',
        borderRadius: 4
      },
      {
        label: 'Available Beds',
        data: data?.bed_occupancy?.map(item => item.available) || [],
        backgroundColor: 'rgba(30,41,59,0.7)',
        borderRadius: 4
      }
    ]
  }

  // 4. Doughnut Chart: Disease Prevalence
  const diseasePrevalenceChart = {
    labels: data?.disease_trends?.map(item => item.disease) || [],
    datasets: [{
      data: data?.disease_trends?.map(item => item.count) || [],
      backgroundColor: [
        'rgba(244,63,94,0.8)', 'rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)',
        'rgba(245,158,11,0.8)', 'rgba(139,92,246,0.8)', 'rgba(6,182,212,0.8)',
        'rgba(14,165,233,0.8)', 'rgba(236,72,153,0.8)'
      ],
      borderWidth: 0,
      hoverOffset: 8
    }]
  }

  // 5. Polar Area Chart: Recovery Time by Severity
  const recoverySeverityChart = {
    labels: data?.recovery?.by_severity?.map(item => item.severity) || [],
    datasets: [{
      data: data?.recovery?.by_severity?.map(item => item.avg_days) || [],
      backgroundColor: [
        'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)',
        'rgba(244,63,94,0.7)', 'rgba(139,92,246,0.7)'
      ],
      borderWidth: 0
    }]
  }

  // 6. Bar Chart: Recovery Duration Breakdown Ranges
  const recoveryDurationChart = {
    labels: data?.recovery?.duration_breakdown?.map(item => item.range) || [],
    datasets: [{
      label: 'Resolved Patients Count',
      data: data?.recovery?.duration_breakdown?.map(item => item.count) || [],
      backgroundColor: 'rgba(16,185,129,0.8)',
      borderRadius: 4
    }]
  }

  // Weekly Heatmap Processing
  const heatmapData = data?.heatmap || []
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const timeBlocks = ['Morning', 'Afternoon', 'Night']

  // Find max count to normalize heat color density
  const maxHeatCount = Math.max(...heatmapData.map(d => d.count), 1)

  const getHeatColor = (count) => {
    if (count === 0) return 'bg-slate-900/40 text-slate-700'
    const ratio = count / maxHeatCount
    if (ratio < 0.25) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/10'
    if (ratio < 0.5) return 'bg-emerald-500/40 text-emerald-300 border border-emerald-500/25'
    if (ratio < 0.75) return 'bg-emerald-500/60 text-white font-bold border border-emerald-400/45'
    return 'bg-emerald-500/90 text-white font-black border border-emerald-300 shadow-md shadow-emerald-500/10'
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={24} />
            Executive Healthcare Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">Power BI dashboard aggregating financial, clinical, and clinical reports</p>
        </div>

        {/* Backfill seeding */}
        <button
          onClick={handleBackfill}
          disabled={seeding}
          className="btn btn-primary text-xs flex items-center gap-2 py-2"
        >
          <Database size={14} />
          Seeding Demo Data
        </button>
      </div>

      {/* Slicers Control Bar */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-center justify-between border-blue-500/10">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5 mr-1">
            <Filter size={12} className="text-blue-400" />
            Report Slicers:
          </span>

          {/* Date Slicer */}
          <div className="flex flex-col">
            <select
              className="select text-xs py-1.5 w-36 bg-slate-900 border border-white/5 text-slate-300"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
            >
              <option value="30">Last 30 Days</option>
              <option value="180">Last 6 Months</option>
              <option value="365">Last 1 Year</option>
            </select>
          </div>

          {/* Ward Slicer */}
          <div className="flex flex-col">
            <select
              className="select text-xs py-1.5 w-36 bg-slate-900 border border-white/5 text-slate-300"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            >
              <option value="">All Wards</option>
              {Object.keys(WARD_CAPACITIES).map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Severity Slicer */}
          <div className="flex flex-col">
            <select
              className="select text-xs py-1.5 w-40 bg-slate-900 border border-white/5 text-slate-300"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="mild">Mild Cases</option>
              <option value="moderate">Moderate Cases</option>
              <option value="severe">Severe Cases</option>
              <option value="critical">Critical Cases</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Button */}
        <button
          onClick={resetFilters}
          className="p-2 border border-white/10 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          title="Reset Slicers"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* KPI Tiles Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Patient Enrollment */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Patients</span>
            <Users className="text-blue-400" size={14} />
          </div>
          <div className="text-2xl font-black text-white mt-1">{kpis.total_patients}</div>
          <div className="text-[9px] text-slate-600 mt-1 flex items-center gap-1">
            <TrendingUp size={10} className="text-emerald-500" />
            +4.2% Growth (MoM)
          </div>
        </div>

        {/* KPI 2: Bed Occupancy */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Bed Occupancy</span>
            <Award className="text-rose-400" size={14} />
          </div>
          <div className="text-2xl font-black text-white mt-1">{kpis.occupancy_rate}%</div>
          <div className="text-[9px] text-slate-600 mt-1 flex items-center gap-1">
            Active ward utilization
          </div>
        </div>

        {/* KPI 3: Total Revenue */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Operational Revenue</span>
            <DollarSign className="text-emerald-400" size={14} />
          </div>
          <div className="text-2xl font-black text-white mt-1">${kpis.total_revenue?.toLocaleString()}</div>
          <div className="text-[9px] text-slate-600 mt-1">
            Invoiced stay charges
          </div>
        </div>

        {/* KPI 4: Average Length of Stay */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Stay (ALOS)</span>
            <Calendar className="text-amber-400" size={14} />
          </div>
          <div className="text-2xl font-black text-white mt-1">{kpis.avg_length_of_stay} Days</div>
          <div className="text-[9px] text-slate-600 mt-1">
            Clinical discharge mean
          </div>
        </div>

        {/* KPI 5: Recovery Rate */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recovery Rate</span>
            <TrendingUp className="text-emerald-400" size={14} />
          </div>
          <div className="text-2xl font-black text-white mt-1">{kpis.recovery_rate}%</div>
          <div className="text-[9px] text-slate-600 mt-1">
            Disease resolution ratio
          </div>
        </div>
      </div>

      {/* Advanced Power BI Reports Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REPORT 1: Financial Area Trend */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Monthly Billing Revenue</h3>
            <DollarSign size={14} className="text-slate-500" />
          </div>
          <div className="h-60">
            <Line
              data={monthlyRevenueChart}
              options={{
                ...chartBaseOptions,
                plugins: { legend: { display: false } }
              }}
            />
          </div>
        </div>

        {/* REPORT 2: Ward Revenue */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Billing Revenue by Ward</h3>
            <BarChart3 size={14} className="text-slate-500" />
          </div>
          <div className="h-60">
            <Bar
              data={wardRevenueChart}
              options={{
                ...chartBaseOptions,
                indexAxis: 'y',
                plugins: { legend: { display: false } }
              }}
            />
          </div>
        </div>

        {/* REPORT 3: Disease Prevalence */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Prevalences Distribution</h3>
            <Users size={14} className="text-slate-500" />
          </div>
          <div className="h-60 relative flex justify-center">
            <Doughnut
              data={diseasePrevalenceChart}
              options={{
                ...chartBaseOptions,
                scales: undefined,
                cutout: '65%'
              }}
            />
          </div>
        </div>
      </div>

      {/* OPERATIONAL SECTION: Occupancy and Admission heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REPORT 4: Bed Occupancy Capacity (Stacked Bar) */}
        <div className="glass-card p-5 space-y-4 lg:col-span-2">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Bed Capacity Utilizations</h3>
            <span className="text-[10px] text-slate-500">Occupied vs Available</span>
          </div>
          <div className="h-60">
            <Bar
              data={bedOccupancyChart}
              options={{
                ...chartBaseOptions,
                scales: {
                  x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b' } },
                  y: { stacked: true, grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#64748b' } }
                }
              }}
            />
          </div>
        </div>

        {/* REPORT 5: Weekly Admission Heatmap Matrix */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Admission Density Heatmap</h3>
            <HelpCircle size={13} className="text-slate-600 cursor-help" title="Weekly admissions density grouped by time shifts" />
          </div>
          
          <div className="flex flex-col h-60 justify-between">
            {/* Heat Matrix headers */}
            <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest pb-1 border-b border-white/5">
              <span>Day</span>
              <span>Morning</span>
              <span>After</span>
              <span>Night</span>
            </div>

            {/* Matrix Rows */}
            <div className="space-y-1.5 flex-1 overflow-y-auto pt-2">
              {daysOfWeek.map((day) => (
                <div key={day} className="grid grid-cols-4 gap-1 items-center">
                  <span className="text-[10px] font-semibold text-slate-400 text-center">{day}</span>
                  {timeBlocks.map((block) => {
                    const matched = heatmapData.find(h => h.day === day && h.time_block === block)
                    const count = matched ? matched.count : 0
                    return (
                      <div
                        key={block}
                        className={`py-1 rounded text-center text-xs font-black transition-all hover:scale-105 duration-150 ${getHeatColor(count)}`}
                        title={`${day} ${block}: ${count} admissions`}
                      >
                        {count}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CLINICAL OUTCOMES SECTION: Recovery profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* REPORT 6: Average Recovery Time by Severity (Polar Area) */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Mean Recovery (Days) by Severity</h3>
            <span className="text-[10px] text-slate-500">Resolved cases only</span>
          </div>
          <div className="h-60 flex justify-center">
            <PolarArea
              data={recoverySeverityChart}
              options={{
                ...chartBaseOptions,
                scales: {
                  r: {
                    grid: { color: 'rgba(255,255,255,0.02)' },
                    angleLines: { color: 'rgba(255,255,255,0.02)' },
                    ticks: { display: false }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* REPORT 7: Recovery Duration Breakdown Groups */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">Resolved Patients recovery duration</h3>
            <span className="text-[10px] text-slate-500">Days cohort breakdown</span>
          </div>
          <div className="h-60">
            <Bar
              data={recoveryDurationChart}
              options={{
                ...chartBaseOptions,
                plugins: { legend: { display: false } }
              }}
            />
          </div>
        </div>
      </div>

      {/* Warning message if database is unpopulated */}
      {data?.kpis?.total_patients === 0 && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-amber-500/80">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-sm text-white">Empty Report Dashboard</h5>
            <p className="text-xs leading-relaxed mt-1">
              Your SQLite database currently contains no historical admissions or patient data records, so all report graphics appear empty. Click the <strong>"Seeding Demo Data"</strong> button in the top right to populate ~100 records and see the Power BI widgets in action.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
