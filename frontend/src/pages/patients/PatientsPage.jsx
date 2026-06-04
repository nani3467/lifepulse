import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Filter, ChevronLeft, ChevronRight,
  User, Phone, Droplets, Calendar, Trash2, Edit, Eye, RefreshCw
} from 'lucide-react'
import { patientApi } from '@/services/patientApi'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import PatientFormModal from '@/components/patients/PatientFormModal'

const STATUS_OPTIONS = ['', 'active', 'admitted', 'discharged', 'critical']
const GENDER_OPTIONS = ['', 'male', 'female', 'other']
const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [filters, setFilters] = useState({ search: '', status: '', gender: '', blood_group: '' })
  const [showFilters, setShowFilters] = useState(false)

  const fetchPatients = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await patientApi.list({ ...filters, page, per_page: perPage })
      setPatients(data.patients)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      toast.error('Failed to load patients')
    } finally {
      setLoading(false)
    }
  }, [filters, page, perPage])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete patient "${name}"? This cannot be undone.`)) return
    try {
      await patientApi.delete(id)
      toast.success('Patient deleted')
      fetchPatients()
    } catch { toast.error('Failed to delete patient') }
  }

  const handleSaved = () => { setShowModal(false); setEditPatient(null); fetchPatients() }

  const filterInput = (key) => ({
    value: filters[key],
    onChange: (e) => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1) }
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Patients</h1>
          <p className="text-slate-400 text-sm">{total} total records</p>
        </div>
        <div className="flex items-center gap-2">
          <button id="btn-refresh" onClick={fetchPatients} className="btn-secondary">
            <RefreshCw size={15} />
          </button>
          <button id="btn-add-patient" onClick={() => { setEditPatient(null); setShowModal(true) }}
            className="btn-primary">
            <Plus size={16} /> Add Patient
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="search-bar flex-1 min-w-48">
            <Search size={15} className="text-slate-500" />
            <input id="patient-search" type="text" placeholder="Search by name, code, phone..."
              value={filters.search}
              onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }} />
          </div>
          <button id="btn-filters" onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${showFilters ? 'border-blue-500/50 text-blue-400' : ''}`}>
            <Filter size={15} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1 animate-fade-in">
            <div>
              <label className="label-text">Status</label>
              <select className="input-field" {...filterInput('status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-slate-900">{s || 'All Status'}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Gender</label>
              <select className="input-field" {...filterInput('gender')}>
                {GENDER_OPTIONS.map(g => <option key={g} value={g} className="bg-slate-900">{g || 'All Genders'}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Blood Group</label>
              <select className="input-field" {...filterInput('blood_group')}>
                {BLOOD_GROUPS.map(b => <option key={b} value={b} className="bg-slate-900">{b || 'All Groups'}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn-secondary w-full justify-center"
                onClick={() => { setFilters({ search: '', status: '', gender: '', blood_group: '' }); setPage(1) }}>
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Code</th>
                <th>Age / Gender</th>
                <th>Blood</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Registered</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j}><div className="skeleton h-8 rounded-lg" /></td>
                    ))}
                  </tr>
                ))
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-500">
                    <User size={40} className="mx-auto mb-3 opacity-20" />
                    <p>No patients found</p>
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} onClick={() => navigate(`/patients/${patient.id}`)}
                    className="cursor-pointer">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${genderColor(patient.gender)})` }}>
                          {patient.full_name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{patient.full_name}</div>
                          <div className="text-xs text-slate-500">{patient.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="font-mono text-xs text-slate-400">{patient.patient_code}</span></td>
                    <td className="text-slate-300">
                      {patient.age}y <span className="text-slate-500 capitalize">/ {patient.gender}</span>
                    </td>
                    <td>
                      {patient.blood_group ? (
                        <span className="badge badge-active">{patient.blood_group}</span>
                      ) : '—'}
                    </td>
                    <td className="text-slate-300 text-sm">{patient.phone}</td>
                    <td><span className={`badge badge-${patient.status}`}>{patient.status}</span></td>
                    <td className="text-slate-400 text-sm">
                      {format(new Date(patient.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <Link to={`/patients/${patient.id}`}
                          className="p-1.5 rounded-lg hover:bg-blue-500/15 text-slate-400 hover:text-blue-400 transition-colors">
                          <Eye size={15} />
                        </Link>
                        <button
                          id={`btn-edit-${patient.id}`}
                          onClick={() => { setEditPatient(patient); setShowModal(true) }}
                          className="p-1.5 rounded-lg hover:bg-amber-500/15 text-slate-400 hover:text-amber-400 transition-colors">
                          <Edit size={15} />
                        </button>
                        <button
                          id={`btn-delete-${patient.id}`}
                          onClick={() => handleDelete(patient.id, patient.full_name)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-slate-400">
                <ChevronLeft size={16} />
              </button>
              {[...Array(Math.min(pages, 5))].map((_, i) => {
                const p = i + 1
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                      ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                    {p}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-slate-400">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <PatientFormModal
          patient={editPatient}
          onClose={() => { setShowModal(false); setEditPatient(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function genderColor(gender) {
  if (gender === 'female') return '#8b5cf6, #ec4899'
  if (gender === 'male') return '#3b82f6, #06b6d4'
  return '#64748b, #475569'
}
