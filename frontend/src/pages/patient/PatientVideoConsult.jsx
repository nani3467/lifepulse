import { useState, useEffect, useRef } from 'react'
import {
  Video, VideoOff, Mic, MicOff, MessageSquare, Send, Paperclip,
  PhoneOff, ScreenShare, Sparkles, User, RefreshCw, Clock, FileText,
  ShieldCheck, ArrowUpRight, ShoppingCart, Download
} from 'lucide-react'
import api from '@/services/api'
import { patientApi } from '@/services/patientApi'
import toast from 'react-hot-toast'
import { format, differenceInMinutes } from 'date-fns'

export default function PatientVideoConsult() {
  const [patient, setPatient] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [loading, setLoading] = useState(true)

  // Call Controls State
  const [inCall, setInCall] = useState(false)
  const [audioMute, setAudioMute] = useState(false)
  const [videoMute, setVideoMute] = useState(false)
  const [duration, setDuration] = useState(0)

  // Chat State
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const chatEndRef = useRef(null)

  // Prescription Alerts State
  const [activePrescription, setActivePrescription] = useState(null)
  const [prescriptionsHistory, setPrescriptionsHistory] = useState([])

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, inCall])

  // Call duration counter
  useEffect(() => {
    let interval = null
    if (inCall) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    } else {
      setDuration(0)
    }
    return () => clearInterval(interval)
  }, [inCall])

  // Poll for prescription updates during active call
  useEffect(() => {
    let pollInterval = null
    if (inCall && selectedAppt) {
      pollInterval = setInterval(async () => {
        try {
          const { data } = await api.get('/pharmacy/prescriptions')
          const linkedPresc = (data.prescriptions || []).find(p => p.appointment_id === selectedAppt.id)
          if (linkedPresc && (!activePrescription || activePrescription.id !== linkedPresc.id)) {
            setActivePrescription(linkedPresc)
            toast.success('📋 New Prescription Available from Dr. ' + (selectedAppt.doctor_name || 'Clinician'))
            // Push system chat message
            setChatMessages(prev => [
              ...prev,
              { sender: 'system', text: `✨ Dr. dispatched a digital prescription record: ID #${linkedPresc.id}` }
            ])
          }
        } catch (e) {
          console.error(e)
        }
      }, 3000)
    }
    return () => clearInterval(pollInterval)
  }, [inCall, selectedAppt, activePrescription])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const { data: usersRes } = await api.get('/auth/me')
      const loggedUser = usersRes.user

      const { data: patientsRes } = await patientApi.list({ limit: 100 })
      const linkedPatient = patientsRes.patients.find(p => p.email === loggedUser.email)
      
      if (linkedPatient) {
        setPatient(linkedPatient)
        fetchTelehealthBookings()
        fetchPrescriptionLogs(linkedPatient.id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTelehealthBookings = async () => {
    try {
      const { data } = await api.get('/appointments')
      // Filter for online (video) appointments
      const onlineAppts = (data.appointments || []).filter(a => a.consultation_type === 'video')
      setAppointments(onlineAppts)
      if (onlineAppts.length > 0) {
        setSelectedAppt(onlineAppts[0])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchPrescriptionLogs = async (patientId) => {
    try {
      const { data } = await api.get('/pharmacy/prescriptions')
      const pLogs = (data.prescriptions || []).filter(p => p.patient_id === patientId && p.status === 'approved')
      setPrescriptionsHistory(pLogs)
    } catch (err) {
      console.error(err)
    }
  }

  const handleJoinCall = () => {
    if (!selectedAppt) return
    
    // Check if appointment is confirmed
    if (selectedAppt.status !== 'confirmed') {
      return toast.error('Only approved video consultation bookings can be joined.')
    }

    // Check 10 minutes timing logic
    const apptDate = new Date(selectedAppt.appointment_date + 'T' + selectedAppt.appointment_time)
    const minutesDiff = differenceInMinutes(apptDate, new Date())
    if (minutesDiff > 10) {
      return toast.error(`Meeting joins are restricted to 10 minutes prior to scheduled start (${selectedAppt.appointment_time}).`)
    }

    setInCall(true)
    setChatMessages([
      { sender: 'system', text: 'Secure WebRTC consultation channel established.' },
      { sender: 'doctor', text: `Hello ${patient?.full_name || 'Patient'}! I am review your symptom records now. How can I help you today?`, time: format(new Date(), 'hh:mm a') }
    ])
    toast.success('Secure consultation stream successfully loaded!')
  }

  const handleSendMessage = (e) => {
    e?.preventDefault()
    if (!chatInput.trim()) return

    const newMsg = {
      sender: 'patient',
      text: chatInput,
      time: format(new Date(), 'hh:mm a')
    }
    setChatMessages([...chatMessages, newMsg])
    setChatInput('')

    // Sim doctor reply
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'doctor',
          text: 'Understood. Let me analyze your clinical indicators and generate the prescription sheet.',
          time: format(new Date(), 'hh:mm a')
        }
      ])
    }, 1500)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    toast.success(`Uploading file: ${file.name}`)
    
    const fileMsg = {
      sender: 'patient',
      text: `Sent report attachment: 📄 ${file.name}`,
      time: format(new Date(), 'hh:mm a'),
      isFile: true
    }
    setChatMessages(prev => [...prev, fileMsg])
  }

  const formatCallTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Video className="text-blue-500" size={26} />
          Telehealth Video Room
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Virtual clinical consulting room. Join secure audio/video tele-health channels directly with doctors.
        </p>
      </div>

      {!inCall ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Main selection card */}
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              Telemedicine Call Dashboard
            </h2>

            {loading ? (
              <div className="skeleton h-40" />
            ) : selectedAppt ? (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedAppt.doctor_name || 'Clinician Officer'}</h3>
                    <p className="text-xs text-slate-400">{selectedAppt.department_name} • {selectedAppt.appointment_code}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                    selectedAppt.status === 'confirmed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {selectedAppt.status === 'confirmed' ? 'Approved & Ready' : selectedAppt.status}
                  </span>
                </div>

                <div className="flex gap-4 text-xs text-slate-300">
                  <span>📅 Date: <strong>{selectedAppt.appointment_date}</strong></span>
                  <span>⏰ Time: <strong>{selectedAppt.appointment_time}</strong></span>
                </div>

                <button
                  onClick={handleJoinCall}
                  className="btn btn-primary w-full justify-center py-3 text-xs font-bold uppercase tracking-wider"
                >
                  <Video size={14} /> Join Video Consultation
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-white/5 rounded-2xl">
                No active video consultation appointments scheduled.
              </div>
            )}
          </div>

          {/* Guidelines info */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" />
              Video Call Guidelines
            </h3>
            <ul className="text-xs text-slate-400 space-y-3 leading-relaxed">
              <li>• Connect from a quiet, well-lit environment.</li>
              <li>• Grant web camera & microphone permissions when prompted.</li>
              <li>• Upload scan/blood reports inside the chat window for live review.</li>
              <li>• All telehealth streams use secured WebRTC encryption pathways.</li>
            </ul>
          </div>

          {/* Prescription History after consultations */}
          <div className="lg:col-span-3 glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase border-b border-white/5 pb-2">Completed Prescription Records</h3>
            {prescriptionsHistory.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prescriptionsHistory.map((p) => (
                  <div key={p.id} className="p-4 bg-slate-900/60 border border-white/5 rounded-xl flex justify-between items-center text-xs text-slate-300">
                    <div className="space-y-1">
                      <strong className="text-white block font-bold">Prescription #{p.id}</strong>
                      <span className="text-[10px] text-slate-500 block">Doctor: Dr. {p.doctor_name}</span>
                      <span className="text-[10px] text-blue-400 block mt-1 italic">Instructions: "{p.instructions || 'Take as directed'}"</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toast.success(`Starting Pharmacy Checkout for Presc #${p.id}`)}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl"
                        title="Buy Medicines"
                      >
                        <ShoppingCart size={14} />
                      </button>
                      <button
                        onClick={() => toast.success(`Initiated PDF generation & download for prescription #${p.id}`)}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl"
                        title="Download PDF"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                No archived prescriptions records found. Digital prescriptions appear here once consultations end.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Video call UI layout */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[550px] animate-slide-up">
          
          {/* LEFT PANEL: Patient Information */}
          <div className="glass-card p-4 space-y-4 overflow-y-auto text-xs text-slate-300">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider border-b border-white/5 pb-2">Patient Records</h3>
            
            <div className="space-y-2.5">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Full Name</span>
                <strong className="text-white">{patient?.full_name}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Gender</span>
                  <strong className="text-white">{patient?.gender || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Date of Birth</span>
                  <strong className="text-white">{patient?.date_of_birth || 'N/A'}</strong>
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Diagnosed Symptoms</span>
                <p className="text-slate-400 italic">"{selectedAppt?.symptoms || 'General Symptom Check request'}"</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Chronic Illnesses</span>
                <p className="text-slate-400">{patient?.chronic_conditions || 'None documented'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-bold">Allergies Info</span>
                <p className="text-rose-400 font-semibold">{patient?.allergies || 'No known allergies'}</p>
              </div>
            </div>

            {/* Live Prescription Widget overlay when sent */}
            {activePrescription && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-xs">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">📋 Prescription Received</span>
                <p className="text-slate-300 text-[10px]">Instructions: "{activePrescription.instructions}"</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.success('Cart Checkout simulation initiated')}
                    className="flex-1 py-1 bg-emerald-600 text-white rounded text-[9px] font-black uppercase hover:bg-emerald-500 transition-colors"
                  >
                    Buy Meds
                  </button>
                  <button
                    onClick={() => toast.success('Downloaded prescription PDF')}
                    className="p-1 bg-white/5 border border-white/5 text-slate-300 rounded hover:text-white"
                  >
                    <Download size={10} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CENTER PANEL: Stream Display */}
          <div className="lg:col-span-2 glass-card bg-slate-950 overflow-hidden relative flex flex-col justify-between p-4 h-full">
            {/* Header overlay */}
            <div className="absolute top-4 left-4 z-10 p-2 rounded-xl bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1.5 border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Doctor Room: <strong className="text-blue-400">{selectedAppt?.doctor_name}</strong>
            </div>

            <div className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-black/60 backdrop-blur-md text-[10px] text-white font-mono border border-white/5">
              Duration: {formatCallTime(duration)}
            </div>

            {/* Doctor Feed Mock Screen */}
            <div className="flex-1 flex items-center justify-center relative">
              <div className="text-center space-y-3 z-10 bg-slate-900/60 p-6 rounded-2xl border border-white/5 backdrop-blur-md">
                <div className="w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 mx-auto flex items-center justify-center animate-bounce">
                  <User size={32} />
                </div>
                <h4 className="text-sm font-bold text-white">{selectedAppt?.doctor_name}</h4>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">WebRTC Tunnel Secure • Online</p>
              </div>
            </div>

            {/* Patient PIP feed overlay */}
            {!videoMute && (
              <div className="absolute bottom-20 right-4 w-28 h-36 rounded-xl border border-white/10 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-1">
                    <User size={14} />
                  </div>
                  <span className="text-[8px] text-slate-500 uppercase">You (Live feed)</span>
                </div>
              </div>
            )}

            {/* Call Control Center Panel */}
            <div className="h-14 flex items-center justify-center gap-4 bg-black/40 border border-white/5 rounded-2xl px-4 backdrop-blur-md">
              <button
                onClick={() => setAudioMute(!audioMute)}
                className={`p-2.5 rounded-xl border transition-all ${
                  audioMute ? 'bg-rose-600/20 border-rose-500/40 text-rose-400' : 'bg-white/5 border-white/5 text-slate-300 hover:text-white'
                }`}
                title={audioMute ? 'Unmute Audio' : 'Mute Audio'}
              >
                {audioMute ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                onClick={() => setVideoMute(!videoMute)}
                className={`p-2.5 rounded-xl border transition-all ${
                  videoMute ? 'bg-rose-600/20 border-rose-500/40 text-rose-400' : 'bg-white/5 border-white/5 text-slate-300 hover:text-white'
                }`}
                title={videoMute ? 'Start Camera' : 'Stop Camera'}
              >
                {videoMute ? <VideoOff size={16} /> : <Video size={16} />}
              </button>

              <button
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-300 hover:text-white transition-colors"
                title="Share Screen"
                onClick={() => toast.success('Screen share request triggered')}
              >
                <ScreenShare size={16} />
              </button>

              <button
                onClick={() => {
                  setInCall(false)
                  setActivePrescription(null)
                  toast.error('Telehealth Video consultation terminated')
                }}
                className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                title="End Consultation"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Live Chat */}
          <div className="glass-card flex flex-col justify-between overflow-hidden h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-slate-900/40">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare size={12} /> Live Consult Chat
              </span>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.sender === 'patient' ? 'items-end' : m.sender === 'system' ? 'items-center' : 'items-start'}`}>
                  {m.sender === 'system' ? (
                    <span className="text-[9px] text-slate-500 italic block text-center max-w-[95%]">{m.text}</span>
                  ) : (
                    <>
                      <div className={`p-2.5 rounded-xl max-w-[85%] text-[11px] leading-relaxed ${
                        m.sender === 'patient'
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none'
                      }`}>
                        {m.text}
                      </div>
                      <span className="text-[8px] text-slate-500 mt-0.5">{m.time}</span>
                    </>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 flex gap-2 items-center bg-slate-900/20">
              <label className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-500 hover:text-white cursor-pointer transition-colors">
                <Paperclip size={14} />
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>

              <input
                type="text" className="input text-[11px] py-1.5 flex-1" placeholder="Type a message..."
                value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              />

              <button type="submit" className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
