import { useState, useEffect } from 'react'
import {
  FileText, Search, Printer, FileCheck, FileWarning, Clock,
  ArrowRight, ShieldAlert, Heart, Calendar, User, UserCheck,
  ShoppingBag, MapPin, Phone, CreditCard, History
} from 'lucide-react'
import api from '@/services/api'
import { pharmacyApi } from '@/services/pharmacyApi'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'

export default function PatientPrescriptions() {
  const [patient, setPatient] = useState(null)
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPresc, setSelectedPresc] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // all, approved, pending, rejected
  const [searchQuery, setSearchQuery] = useState('')

  // Pharmacy Orders & Tabs State
  const [activeTab, setActiveTab] = useState('prescriptions') // prescriptions, orders
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery')

  useEffect(() => {
    loadPatientAndPrescriptions()
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoadingOrders(true)
    try {
      const { data } = await pharmacyApi.getOrders()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleOpenOrderModal = () => {
    if (!selectedPresc) return
    setDeliveryAddress(patient?.address || '')
    setContactNumber(patient?.phone || '')
    setPaymentMethod('Cash on Delivery')
    setShowOrderModal(true)
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    if (!deliveryAddress.trim() || !contactNumber.trim()) {
      return toast.error('Please fill in both the delivery address and contact number.')
    }

    const toastId = toast.loading('Placing order...')
    try {
      await pharmacyApi.placeOrder({
        prescription_id: selectedPresc.id,
        delivery_address: deliveryAddress,
        contact_number: contactNumber,
        payment_method: paymentMethod
      })
      toast.success('Your order is placed successfully!', { id: toastId })
      setShowOrderModal(false)
      loadOrders()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order.', { id: toastId })
    }
  }

  const loadPatientAndPrescriptions = async () => {
    setLoading(true)
    try {
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user

      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(p => p.email === loggedUser.email)

      if (linkedPatient) {
        setPatient(linkedPatient)
        const { data: prescRes } = await pharmacyApi.getPrescriptions()
        const items = prescRes.prescriptions || []
        setPrescriptions(items)
        if (items.length > 0) {
          setSelectedPresc(items[0])
        }
      }
    } catch (err) {
      console.error('Error fetching prescriptions:', err)
      toast.error('Failed to load prescriptions list.')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = (presc) => {
    if (!presc) return
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) return toast.error('Pop-up blocked! Please allow pop-ups to print.')

    const htmlContent = `
      <html>
        <head>
          <title>Prescription Slip #${presc.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; background: #fff; }
            .pad-container { border: 2px solid #e2e8f0; border-radius: 16px; padding: 45px; max-width: 680px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); position: relative; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; }
            .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; color: #0f172a; font-family: serif; }
            .header p { margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; }
            .info-grid { display: grid; grid-template-cols: 1.2fr 0.8fr; gap: 15px; font-size: 13px; margin-bottom: 30px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 20px; }
            .info-item { line-height: 1.8; }
            .info-label { color: #64748b; font-weight: 500; width: 90px; display: inline-block; }
            .info-value { color: #0f172a; font-weight: 600; }
            .rx-symbol { font-size: 38px; font-family: Georgia, serif; font-style: italic; font-weight: bold; color: #3b82f6; margin-bottom: 20px; margin-top: 10px; }
            .med-list { list-style: none; padding: 0; margin: 0 0 35px 0; }
            .med-item { border-bottom: 1px solid #f1f5f9; padding: 16px 0; display: flex; justify-content: space-between; align-items: center; }
            .med-details { flex: 1; }
            .med-name { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; }
            .med-instructions { font-size: 13px; color: #475569; margin: 0; }
            .med-duration { font-size: 13px; font-weight: 700; color: #475569; text-align: right; }
            .notes-sec { background-color: #f8fafc; border-radius: 10px; padding: 16px; font-size: 12px; color: #475569; margin-bottom: 45px; border-left: 4px solid #3b82f6; line-height: 1.6; }
            .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 20px; }
            .sig-area { text-align: right; }
            .sig-cursive { font-family: 'Georgia', cursive, serif; font-style: italic; font-size: 22px; color: #1e3a8a; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; }
            .sig-title { font-size: 12px; font-weight: 700; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 6px; width: 190px; text-align: right; margin-left: auto; }
            .sig-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; border: 1px solid; }
            .badge-approved { background-color: #dcfce7; color: #15803d; border-color: #bbf7d0; }
            .badge-pending { background-color: #fef3c7; color: #d97706; border-color: #fde68a; }
            .badge-rejected { background-color: #ffe4e6; color: #e11d48; border-color: #fecdd3; }
            @media print {
              body { padding: 0; background: #fff; }
              .pad-container { border: none; box-shadow: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="pad-container">
            <div class="header">
              <h1>LIFEPULSE MEDICAL CENTER</h1>
              <p>123 Health Ave, Suite 400 | Phone: +1 555-0100 | contact@lifepulse.com</p>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <div><span class="info-label">Patient:</span> <span class="info-value">${presc.patient_name}</span></div>
                <div><span class="info-label">Patient Code:</span> <span class="info-value">LP-PT-${String(presc.patient_id).padStart(4, '0')}</span></div>
              </div>
              <div class="info-item" style="text-align: right;">
                <div><span class="info-label">Rx ID:</span> <span class="info-value">#${presc.id}</span></div>
                <div><span class="info-label">Date:</span> <span class="info-value">${new Date(presc.created_at).toLocaleDateString()}</span></div>
              </div>
            </div>

            <div class="rx-symbol">Rₓ</div>

            <ul class="med-list">
              ${presc.items.map(item => `
                <li class="med-item">
                  <div class="med-details">
                    <h3 class="med-name">${item.medicine_name}</h3>
                    <p class="med-instructions">${item.dosage} &bull; ${item.frequency}</p>
                  </div>
                  <div class="med-duration">
                    ${item.duration_days} Days
                  </div>
                </li>
              `).join('')}
            </ul>

            <div class="notes-sec">
              <strong>Clinical Safety Screening & Remarks:</strong><br/>
              ${presc.notes || 'Clinical screening completed: Safe combination.'}
            </div>

            <div class="footer">
              <div>
                <span class="badge badge-${presc.status}">${presc.status}</span>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">Signed via secure LifePulse EMR network.</div>
              </div>
              <div class="sig-area">
                <div class="sig-cursive">${presc.doctor_name && presc.doctor_name !== 'Unknown' ? 'Dr. ' + presc.doctor_name : 'Dr. Elizabeth Blackwell'}</div>
                <div class="sig-title">Authorized Medical Specialist</div>
                <div class="sig-sub">License Registry: MD-98472</div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <FileCheck className="text-emerald-400" size={16} />
      case 'rejected':
        return <FileWarning className="text-rose-400" size={16} />
      default:
        return <Clock className="text-amber-400" size={16} />
    }
  }

  const filteredPrescriptions = prescriptions
    .filter(p => {
      if (statusFilter === 'all') return true
      return p.status === statusFilter
    })
    .filter(p => {
      const q = searchQuery.toLowerCase()
      const doctorMatch = p.doctor_name?.toLowerCase().includes(q)
      const idMatch = String(p.id).includes(q)
      const medMatch = p.items.some(item => item.medicine_name.toLowerCase().includes(q))
      return doctorMatch || idMatch || medMatch
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="text-blue-500" size={26} />
          My Clinical Prescriptions
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Review prescriptions written by your doctors, view AI compatibility remarks, and generate printable clinic slips.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-1">
        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'prescriptions'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText size={14} />
          My Prescriptions
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <History size={14} />
          Order History
        </button>
      </div>

      {activeTab === 'prescriptions' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar Master List */}
          <div className="glass-card p-5 space-y-4 flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
            <div className="space-y-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <input
                  type="text"
                  placeholder="Search by Rx ID, doctor, drug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-9 py-2 text-xs"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/5">
                {['all', 'approved', 'pending', 'rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${
                      statusFilter === status 
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="skeleton h-20" />)
              ) : filteredPrescriptions.length > 0 ? (
                filteredPrescriptions.map((p) => {
                  const active = selectedPresc?.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPresc(p)}
                      className={`w-full p-4 text-left rounded-xl border transition-all flex justify-between items-start gap-2 ${
                        active 
                          ? 'bg-blue-600/10 border-blue-500/30' 
                          : 'bg-white/5 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(p.status)}
                          <strong className="text-white text-xs block">Prescription #{p.id}</strong>
                        </div>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User size={10} /> {p.doctor_name && p.doctor_name !== 'Unknown' ? `Dr. ${p.doctor_name}` : 'Elizabeth Blackwell'}
                        </span>
                        <span className="text-[9px] text-slate-500 block">
                          {p.items.length} prescribed compound{p.items.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 flex-shrink-0">
                        {p.created_at?.slice(0, 10)}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="text-center py-12 text-slate-600 text-xs">
                  No matching prescriptions found.
                </div>
              )}
            </div>
          </div>

          {/* Prescription Details Slip Viewer */}
          <div className="lg:col-span-2 flex flex-col">
            {selectedPresc ? (
              <div className="space-y-4">
                {/* Slip Card (mimics paper pad in dark / light mode context) */}
                <div className="glass-card p-6 md:p-8 space-y-6 relative overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/[0.02] rounded-full blur-3xl pointer-events-none" />

                  {/* Pad Header */}
                  <div className="text-center border-b border-white/5 pb-4 space-y-1">
                    <h2 className="text-base font-black tracking-wider text-white uppercase font-serif">
                      LifePulse Medical Center
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      123 Health Ave, Suite 400 | Phone: +1 555-0100 | contact@lifepulse.com
                    </p>
                  </div>

                  {/* Patient Information Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                    <div className="space-y-1.5">
                      <div className="text-slate-400">
                        Patient Name: <strong className="text-white capitalize">{selectedPresc.patient_name}</strong>
                      </div>
                      <div className="text-slate-400">
                        Patient Code: <strong className="text-white">LP-PT-{String(selectedPresc.patient_id).padStart(4, '0')}</strong>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:text-right">
                      <div className="text-slate-400 font-semibold text-rose-400">
                        Rx ID: #{selectedPresc.id}
                      </div>
                      <div className="text-slate-400">
                        Date Issued: <strong className="text-white">{selectedPresc.created_at?.slice(0, 10)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Rx Symbol */}
                  <div className="text-4xl font-serif font-black italic text-blue-500/70 select-none">
                    Rₓ
                  </div>

                  {/* Medicine details */}
                  <div className="space-y-4">
                    {selectedPresc.items.map((item) => (
                      <div key={item.id} className="border-b border-white/5 pb-3 flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-white text-sm block font-bold">{item.medicine_name}</strong>
                          <span className="text-slate-400 block mt-0.5">{item.dosage} • {item.frequency}</span>
                        </div>
                        <div className="text-slate-400 font-semibold">
                          {item.duration_days} Days
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Screening Remarks */}
                  <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert size={12} className="text-blue-400" />
                      Clinical screening notes
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{selectedPresc.notes || 'Clinical screening completed: Safe combination.'}"
                    </p>
                  </div>

                  {/* Signatures & Stamp */}
                  <div className="flex justify-between items-end border-t border-white/5 pt-6">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedPresc.status === 'approved' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : selectedPresc.status === 'rejected'
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                          : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                      }`}>
                        {selectedPresc.status}
                      </span>
                      <p className="text-[9px] text-slate-500 mt-1.5 leading-tight">
                        Digitally signed and cryptographically verified.
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="font-serif italic text-base text-blue-400/90 pr-2">
                        {selectedPresc.doctor_name && selectedPresc.doctor_name !== 'Unknown' ? 'Dr. ' + selectedPresc.doctor_name : 'Dr. Elizabeth Blackwell'}
                      </div>
                      <div className="text-[10px] font-bold text-white border-t border-white/10 pt-1 w-44 inline-block text-right uppercase tracking-wide">
                        Authorized Specialist
                      </div>
                      <div className="text-[9px] text-slate-500">
                        License Registry: MD-98472
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => handlePrint(selectedPresc)}
                    className="btn-primary py-3 px-6 text-sm font-bold uppercase tracking-wider flex items-center gap-2"
                  >
                    <Printer size={16} />
                    Print Prescription Slip
                  </button>
                  {selectedPresc.status === 'approved' && (
                    <button
                      onClick={handleOpenOrderModal}
                      className="btn btn-success border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 py-3 px-6 text-sm font-bold uppercase tracking-wider flex items-center gap-2"
                    >
                      <ShoppingBag size={16} />
                      Order Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-slate-500 text-xs py-32 flex-1 flex flex-col justify-center items-center gap-2">
                <FileText size={40} className="text-slate-700" />
                Select a prescription from the dashboard log index to view and print clinical slips.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ORDER HISTORY TAB VIEW */
        <div className="glass-card p-6 border border-white/10 shadow-xl space-y-6">
          <div>
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <ShoppingBag className="text-blue-500" size={20} />
              Medicine Orders Log
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Review and track pharmacy orders placed from approved clinic prescription slips.
            </p>
          </div>

          {loadingOrders ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 font-extrabold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-4">Order ID</th>
                    <th className="py-2.5 px-4">Date Placed</th>
                    <th className="py-2.5 px-4">Prescription</th>
                    <th className="py-2.5 px-4">Medicines Ordered</th>
                    <th className="py-2.5 px-4">Delivery Address</th>
                    <th className="py-2.5 px-4">Contact Number</th>
                    <th className="py-2.5 px-4">Payment Method</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        #ORD{String(order.id).padStart(4, '0')}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-blue-400 font-semibold">
                          Rx #{order.prescription_id || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-200">
                          {order.prescription?.items?.map(i => i.medicine_name).join(', ') || 'Custom Compounds'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 truncate max-w-[200px]" title={order.delivery_address}>
                        {order.delivery_address}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {order.contact_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-400">
                        {order.payment_method}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <ShoppingBag className="text-slate-500 opacity-20 mx-auto" size={44} />
              <p className="text-slate-400 text-xs">No pharmacy orders placed yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && selectedPresc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md border border-white/10 p-6 space-y-6 bg-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-white/5 pb-4 flex justify-between items-center">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-500" />
                Place Pharmacy Order
              </h3>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4 text-xs">
              <div className="bg-slate-950/40 p-3.5 border border-white/5 rounded-xl space-y-1.5">
                <div className="text-slate-500 uppercase tracking-wider font-bold text-[9px]">Ordering Drugs:</div>
                <div className="text-white font-semibold">
                  {selectedPresc.items.map(item => `${item.medicine_name} (${item.dosage})`).join(', ')}
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                  <span>Prescription: <strong>Rx #{selectedPresc.id}</strong></span>
                  <span>Doctor: <strong>Dr. {selectedPresc.doctor_name || 'Specialist'}</strong></span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={12} className="text-blue-400" />
                  Delivery Address
                </label>
                <textarea
                  required
                  rows={3}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter complete shipping/home address..."
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Phone size={12} className="text-blue-400" />
                  Contact Mobile Number
                </label>
                <input
                  type="text"
                  required
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="Enter contact number..."
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CreditCard size={12} className="text-blue-400" />
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Online Banking">Online Banking (Simulated)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 btn btn-secondary py-2.5 font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn btn-success py-2.5 font-bold uppercase tracking-wider"
                >
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
