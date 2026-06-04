import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Stethoscope, User, Mail, Lock, Phone, Calendar, Shield, 
  DollarSign, Upload, AlertCircle, CheckCircle2, ChevronRight, 
  ChevronLeft, Award, Building, Clock, FileText, Check, Heart, Globe
} from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useTheme } from '@/contexts/ThemeContext'

const SPECIALIZATIONS = [
  'General Medicine', 'Cardiology', 'Neurology', 'Orthopedics', 'Dermatology',
  'Pulmonology', 'Pediatrics', 'ENT', 'Gynecology', 'Oncology', 'Psychiatry'
]

const EXISTING_HOSPITALS = [
  'Apollo Hospital', 'Fortis Hospital', 'Care Hospital', 'AIIMS Hospital'
]

const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', 
  '12:00 - 13:00', '14:00 - 15:00', '15:00 - 16:00', 
  '16:00 - 17:00', '17:00 - 18:00'
]

const DAYS_OF_WEEK = [
  { label: 'Mon', value: 'Mon' },
  { label: 'Tue', value: 'Tue' },
  { label: 'Wed', value: 'Wed' },
  { label: 'Thu', value: 'Thu' },
  { label: 'Fri', value: 'Fri' },
  { label: 'Sat', value: 'Sat' },
  { label: 'Sun', value: 'Sun' }
]

export default function DoctorRegister() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    dob: '',
    gender: 'male',
    profile_photo: '',
    
    medical_reg_number: '',
    medical_council_reg_id: '',
    qualification: '',
    highest_degree: '',
    university_name: '',
    graduation_year: '',
    experience_years: '',
    
    specializations: [], // will join with comma on submit
    
    hospital_type: 'existing', // 'existing' or 'new'
    hospital_name: EXISTING_HOSPITALS[0],
    hospital_address: '',
    hospital_city: '',
    hospital_state: '',
    hospital_pincode: '',
    hospital_phone: '',
    
    consultation_fee: '',
    available_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    available_slots: [],
    consultation_types: ['in_person'],
    supports_video: 'yes',
    
    license_file: '',
    certificate_file: '',
    gov_id_file: '',
    experience_cert_file: '',
    additional_cert_file: '',
    
    bio: ''
  })

  // Track original uploaded file names for display
  const [fileNames, setFileNames] = useState({
    profile_photo: '',
    license_file: '',
    certificate_file: '',
    gov_id_file: '',
    experience_cert_file: '',
    additional_cert_file: ''
  })

  // Handles client-side file upload and server storage
  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0]
    if (!file) return

    // 5MB validation
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds maximum size limit of 5MB.')
      return
    }

    // Extension check
    const ext = file.name.split('.').pop().toLowerCase()
    const allowed = fieldName === 'profile_photo' ? ['png', 'jpg', 'jpeg'] : ['pdf', 'png', 'jpg', 'jpeg']
    if (!allowed.includes(ext)) {
      toast.error(`Invalid file type. Allowed: ${allowed.join(', ').toUpperCase()}`)
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    const uploadToast = toast.loading(`Uploading ${file.name}...`)
    try {
      const res = await api.post('/auth/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setForm(prev => ({ ...prev, [fieldName]: res.data.filename }))
      setFileNames(prev => ({ ...prev, [fieldName]: file.name }))
      toast.success(`${file.name} uploaded successfully!`, { id: uploadToast })
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Upload failed.', { id: uploadToast })
    }
  }

  // Toggles item in arrays
  const toggleItem = (field, value) => {
    setForm(prev => {
      const arr = prev[field]
      const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
      return { ...prev, [field]: next }
    })
  }

  // Next Step validation
  const validateStep = () => {
    if (step === 1) {
      if (!form.name || !form.email || !form.password || !form.phone || !form.dob || !form.gender) {
        toast.error('Please fill in all personal information fields.')
        return false
      }
    }
    if (step === 2) {
      if (!form.medical_reg_number || !form.medical_council_reg_id || !form.qualification || !form.highest_degree || !form.university_name || !form.graduation_year || !form.experience_years) {
        toast.error('Please fill in all professional credentials.')
        return false
      }
    }
    if (step === 3) {
      if (form.specializations.length === 0) {
        toast.error('Please select at least one specialization.')
        return false
      }
    }
    if (step === 4) {
      if (form.hospital_type === 'new') {
        if (!form.hospital_name || !form.hospital_address || !form.hospital_city || !form.hospital_state || !form.hospital_pincode) {
          toast.error('Please complete all requested hospital facility details.')
          return false
        }
      }
    }
    if (step === 5) {
      if (!form.consultation_fee || form.available_days.length === 0 || form.available_slots.length === 0 || form.consultation_types.length === 0) {
        toast.error('Please setup fees, working days, consultation formats, and time slots.')
        return false
      }
    }
    if (step === 6) {
      if (!form.license_file || !form.certificate_file || !form.gov_id_file) {
        toast.error('Please upload all mandatory documents for verification.')
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    setStep(prev => prev - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep()) return
    if (!form.bio) {
      return toast.error('Please write a brief clinical biography.')
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        specialization: form.specializations.join(', '),
        available_days: form.available_days.join(','),
        available_slots: form.available_slots.join(','),
        consultation_types: form.consultation_types.join(','),
        supports_video: form.consultation_types.includes('video') ? 'yes' : 'no'
      }

      await api.post('/auth/doctor-register', payload)
      setSubmitted(true)
      toast.success('Registration request submitted successfully!')
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Registration failed. Check uniqueness of email/mobile.')
    } finally {
      setLoading(false)
    }
  }

  const stepsLabel = [
    'Personal Info',
    'Credentials',
    'Specialty',
    'Hospital',
    'Settings',
    'Verification',
    'Biography'
  ]

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
        
        <div className="w-full max-w-lg glass-card p-10 text-center space-y-6 animate-scale-up border-emerald-500/20">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <CheckCircle2 size={40} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white uppercase tracking-wide">Request Submitted</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your clinician registration request is under review.
            </p>
            <p className="text-slate-500 text-xs leading-relaxed mt-2 bg-slate-900/60 p-4 rounded-xl border border-white/5">
              💡 The system administrator will verify your medical registration credentials, university graduation certificates, and hospital affiliations. Upon approval, your login account will be activated, and you will receive a Welcoming notification.
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <Link to="/login" className="btn btn-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider">
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 relative overflow-hidden bg-slate-950">
      {/* Ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

      <div className="w-full max-w-3xl animate-slide-up space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}>
            <Stethoscope size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Clinician Registration Portal</h1>
          <p className="text-slate-400 text-xs mt-0.5">Submit your professional credentials to join the LifePulse Hospital Management network</p>
        </div>

        {/* Progress Tracker */}
        <div className="glass-card p-4 flex justify-between items-center overflow-x-auto gap-4">
          {stepsLabel.map((label, idx) => {
            const stepNum = idx + 1
            const isCompleted = step > stepNum
            const isActive = step === stepNum
            return (
              <div key={label} className="flex items-center gap-2 flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isCompleted 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : isActive 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    : 'bg-white/5 border border-white/5 text-slate-500'
                }`}>
                  {isCompleted ? <Check size={12} /> : stepNum}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold ${
                  isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {label}
                </span>
                {idx < stepsLabel.length - 1 && (
                  <ChevronRight size={12} className="text-slate-600" />
                )}
              </div>
            )
          })}
        </div>

        {/* Wizard Form Body */}
        <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 space-y-6">
          
          {/* STEP 1: Personal Details */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <User size={14} /> Step 1: Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Full Name *</label>
                  <input
                    type="text" required placeholder="Dr. Sophia Patel" className="input-field mt-1 text-xs py-2"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Email Address *</label>
                  <input
                    type="email" required placeholder="sophia.patel@hospital.com" className="input-field mt-1 text-xs py-2"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Password *</label>
                  <input
                    type="password" required placeholder="••••••••" className="input-field mt-1 text-xs py-2"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Mobile Number *</label>
                  <input
                    type="tel" required placeholder="+1 (555) 019-2834" className="input-field mt-1 text-xs py-2"
                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Date of Birth *</label>
                  <input
                    type="date" required className="input-field mt-1 text-xs py-2"
                    value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Gender *</label>
                  <select
                    className="input-field mt-1 text-xs py-2 bg-slate-900 border-white/5 cursor-pointer"
                    value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label-text block mb-2">Profile Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border border-white/10 bg-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {form.profile_photo ? (
                        <img 
                          src={`${api.defaults.baseURL}/admin/doctor-requests/documents/${form.profile_photo}`} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={28} className="text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="btn btn-secondary py-1.5 px-4 text-xs font-bold uppercase inline-flex items-center gap-1.5 cursor-pointer">
                        <Upload size={14} /> Upload Image
                        <input 
                          type="file" className="hidden" accept="image/png, image/jpeg, image/jpg"
                          onChange={e => handleFileUpload(e, 'profile_photo')}
                        />
                      </label>
                      <span className="text-[10px] text-slate-500 block truncate max-w-xs">{fileNames.profile_photo || 'PNG, JPG or JPEG. Max 5MB.'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Professional Information */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <Award size={14} /> Step 2: Professional Credentials
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Medical Registration Number *</label>
                  <input
                    type="text" required placeholder="MCI-98234-A" className="input-field mt-1 text-xs py-2"
                    value={form.medical_reg_number} onChange={e => setForm({ ...form, medical_reg_number: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Medical Council Registration ID *</label>
                  <input
                    type="text" required placeholder="KMC/2018/00234" className="input-field mt-1 text-xs py-2"
                    value={form.medical_council_reg_id} onChange={e => setForm({ ...form, medical_council_reg_id: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Qualification Details *</label>
                  <input
                    type="text" required placeholder="MD Internal Medicine, DNB Cardiology" className="input-field mt-1 text-xs py-2"
                    value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">Highest Degree *</label>
                  <input
                    type="text" required placeholder="DM Cardiology" className="input-field mt-1 text-xs py-2"
                    value={form.highest_degree} onChange={e => setForm({ ...form, highest_degree: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label-text">University / Institute *</label>
                  <input
                    type="text" required placeholder="Harvard Medical School" className="input-field mt-1 text-xs py-2"
                    value={form.university_name} onChange={e => setForm({ ...form, university_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Year of Graduation *</label>
                    <input
                      type="number" required placeholder="2016" className="input-field mt-1 text-xs py-2"
                      value={form.graduation_year} onChange={e => setForm({ ...form, graduation_year: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-text">Years of Experience *</label>
                    <input
                      type="number" required placeholder="9" className="input-field mt-1 text-xs py-2"
                      value={form.experience_years} onChange={e => setForm({ ...form, experience_years: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Specializations */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <Heart size={14} /> Step 3: Medical Specializations
              </h3>
              
              <p className="text-slate-400 text-xs">Select your specialized departments. You may choose multiple fields.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SPECIALIZATIONS.map(spec => {
                  const selected = form.specializations.includes(spec)
                  return (
                    <button
                      key={spec} type="button"
                      onClick={() => toggleItem('specializations', spec)}
                      className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all flex items-center justify-between text-left ${
                        selected 
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                          : 'bg-slate-900/60 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <span>{spec}</span>
                      {selected && <Check size={14} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Hospital Affiliation */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <Building size={14} /> Step 4: Hospital Affiliation
              </h3>
              
              {/* Type Switcher */}
              <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 max-w-sm">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, hospital_type: 'existing', hospital_name: EXISTING_HOSPITALS[0] })}
                  className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                    form.hospital_type === 'existing' 
                      ? 'bg-blue-600/25 border border-blue-500/20 text-blue-400' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Existing Hospital
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, hospital_type: 'new', hospital_name: '' })}
                  className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                    form.hospital_type === 'new' 
                      ? 'bg-blue-600/25 border border-blue-500/20 text-blue-400' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Request New Hospital
                </button>
              </div>

              {form.hospital_type === 'existing' ? (
                <div className="space-y-3 pt-2">
                  <label className="label-text">Select Affiliated Hospital Facility *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {EXISTING_HOSPITALS.map(hosp => {
                      const selected = form.hospital_name === hosp
                      return (
                        <div
                          key={hosp}
                          onClick={() => setForm({ ...form, hospital_name: hosp })}
                          className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between min-h-[100px] ${
                            selected 
                              ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                              : 'bg-slate-900/60 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div>
                            <strong className={`text-sm block ${selected ? 'text-blue-400' : 'text-white'}`}>{hosp}</strong>
                            <span className="text-[10px] text-slate-500 mt-1 block">Registered LifePulse Medical Facility</span>
                          </div>
                          {selected && (
                            <div className="self-end text-blue-400">
                              <CheckCircle2 size={16} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label-text">Hospital Name *</label>
                      <input
                        type="text" required placeholder="LifePulse Metro Clinic" className="input-field mt-1 text-xs py-2"
                        value={form.hospital_name} onChange={e => setForm({ ...form, hospital_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label-text">Contact Number</label>
                      <input
                        type="tel" placeholder="+1 (555) 091-2831" className="input-field mt-1 text-xs py-2"
                        value={form.hospital_phone} onChange={e => setForm({ ...form, hospital_phone: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label-text">Hospital Address *</label>
                      <input
                        type="text" required placeholder="55 Hospital Drive, Sector 7" className="input-field mt-1 text-xs py-2"
                        value={form.hospital_address} onChange={e => setForm({ ...form, hospital_address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label-text">City *</label>
                      <input
                        type="text" required placeholder="Metro City" className="input-field mt-1 text-xs py-2"
                        value={form.hospital_city} onChange={e => setForm({ ...form, hospital_city: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-text">State *</label>
                        <input
                          type="text" required placeholder="CA" className="input-field mt-1 text-xs py-2"
                          value={form.hospital_state} onChange={e => setForm({ ...form, hospital_state: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="label-text">Pincode *</label>
                        <input
                          type="text" required placeholder="90001" className="input-field mt-1 text-xs py-2"
                          value={form.hospital_pincode} onChange={e => setForm({ ...form, hospital_pincode: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Consultation Settings */}
          {step === 5 && (
            <div className="space-y-5 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <Clock size={14} /> Step 5: Consultation Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Fee & Formats */}
                <div className="space-y-4">
                  <div>
                    <label className="label-text">Consultation Fee (INR) *</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
                      <input
                        type="number" required placeholder="500" className="input-field pl-7 text-xs py-2"
                        value={form.consultation_fee} onChange={e => setForm({ ...form, consultation_fee: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-text block mb-2">Available Formats *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => toggleItem('consultation_types', 'in_person')}
                        className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all flex items-center justify-between ${
                          form.consultation_types.includes('in_person')
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                            : 'bg-slate-900/60 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        <span>🏥 In-Person</span>
                        {form.consultation_types.includes('in_person') && <Check size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleItem('consultation_types', 'video')}
                        className={`p-3 rounded-xl border text-xs font-bold uppercase transition-all flex items-center justify-between ${
                          form.consultation_types.includes('video')
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                            : 'bg-slate-900/60 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        <span>📹 Video Call</span>
                        {form.consultation_types.includes('video') && <Check size={12} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label-text block mb-2">Available Days *</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(d => {
                        const selected = form.available_days.includes(d.value)
                        return (
                          <button
                            key={d.value} type="button"
                            onClick={() => toggleItem('available_days', d.value)}
                            className={`w-10 h-10 rounded-xl border text-xs font-black uppercase transition-all flex items-center justify-center ${
                              selected 
                                ? 'bg-blue-600/25 border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.1)]' 
                                : 'bg-slate-900/60 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
                            }`}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Available Slots */}
                <div>
                  <label className="label-text block mb-2">Available Work Slots *</label>
                  <p className="text-slate-500 text-[10px] mb-3">Select the consultation time windows you wish to configure.</p>
                  
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {TIME_SLOTS.map(slot => {
                      const selected = form.available_slots.includes(slot)
                      return (
                        <button
                          key={slot} type="button"
                          onClick={() => toggleItem('available_slots', slot)}
                          className={`p-2.5 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-between ${
                            selected 
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                              : 'bg-slate-900/60 border-white/5 text-slate-400 hover:border-white/10'
                          }`}
                        >
                          <span>{slot}</span>
                          {selected && <Check size={10} />}
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 6: Document Verification */}
          {step === 6 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <FileText size={14} /> Step 6: Verify Credentials
              </h3>
              
              <p className="text-slate-400 text-xs leading-relaxed">
                Provide documentation scans for verification. PDFs, JPEGs and PNGs are supported up to a maximum size of 5MB per file.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                
                {/* Medical License */}
                <div className="p-4 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl text-center space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Medical License *</span>
                    <span className="text-[9px] text-slate-500 block">Certify registration status</span>
                  </div>
                  <div className="space-y-2">
                    <label className="btn btn-primary py-1.5 px-3 text-[10px] uppercase font-black inline-flex items-center gap-1 cursor-pointer">
                      <Upload size={12} /> {form.license_file ? 'Change Scan' : 'Upload File'}
                      <input type="file" className="hidden" accept=".pdf, image/png, image/jpeg" onChange={e => handleFileUpload(e, 'license_file')} />
                    </label>
                    <span className="text-[9px] text-slate-400 block truncate max-w-full">{fileNames.license_file || 'No document chosen'}</span>
                  </div>
                </div>

                {/* Degree Certificate */}
                <div className="p-4 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl text-center space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Degree Certificate *</span>
                    <span className="text-[9px] text-slate-500 block">Scan of MBBS / Highest PG</span>
                  </div>
                  <div className="space-y-2">
                    <label className="btn btn-primary py-1.5 px-3 text-[10px] uppercase font-black inline-flex items-center gap-1 cursor-pointer">
                      <Upload size={12} /> {form.certificate_file ? 'Change Scan' : 'Upload File'}
                      <input type="file" className="hidden" accept=".pdf, image/png, image/jpeg" onChange={e => handleFileUpload(e, 'certificate_file')} />
                    </label>
                    <span className="text-[9px] text-slate-400 block truncate max-w-full">{fileNames.certificate_file || 'No document chosen'}</span>
                  </div>
                </div>

                {/* Govt ID */}
                <div className="p-4 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl text-center space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Government ID *</span>
                    <span className="text-[9px] text-slate-500 block">Passport, Aadhaar or driving license</span>
                  </div>
                  <div className="space-y-2">
                    <label className="btn btn-primary py-1.5 px-3 text-[10px] uppercase font-black inline-flex items-center gap-1 cursor-pointer">
                      <Upload size={12} /> {form.gov_id_file ? 'Change Scan' : 'Upload ID'}
                      <input type="file" className="hidden" accept=".pdf, image/png, image/jpeg" onChange={e => handleFileUpload(e, 'gov_id_file')} />
                    </label>
                    <span className="text-[9px] text-slate-400 block truncate max-w-full">{fileNames.gov_id_file || 'No document chosen'}</span>
                  </div>
                </div>

                {/* Experience Cert (Optional) */}
                <div className="p-4 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl text-center space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Experience Certificate</span>
                    <span className="text-[9px] text-slate-500 block">Optional record of work</span>
                  </div>
                  <div className="space-y-2">
                    <label className="btn btn-secondary py-1.5 px-3 text-[10px] uppercase font-bold inline-flex items-center gap-1 cursor-pointer">
                      <Upload size={12} /> {form.experience_cert_file ? 'Change Scan' : 'Upload File'}
                      <input type="file" className="hidden" accept=".pdf, image/png, image/jpeg" onChange={e => handleFileUpload(e, 'experience_cert_file')} />
                    </label>
                    <span className="text-[9px] text-slate-500 block truncate max-w-full">{fileNames.experience_cert_file || 'Optional'}</span>
                  </div>
                </div>

                {/* Additional Cert (Optional) */}
                <div className="p-4 bg-slate-900/60 border border-dashed border-white/10 rounded-2xl text-center space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Add. Certifications</span>
                    <span className="text-[9px] text-slate-500 block">Optional diplomas / records</span>
                  </div>
                  <div className="space-y-2">
                    <label className="btn btn-secondary py-1.5 px-3 text-[10px] uppercase font-bold inline-flex items-center gap-1 cursor-pointer">
                      <Upload size={12} /> {form.additional_cert_file ? 'Change Scan' : 'Upload File'}
                      <input type="file" className="hidden" accept=".pdf, image/png, image/jpeg" onChange={e => handleFileUpload(e, 'additional_cert_file')} />
                    </label>
                    <span className="text-[9px] text-slate-500 block truncate max-w-full">{fileNames.additional_cert_file || 'Optional'}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 7: Biography & Submit */}
          {step === 7 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1.5">
                <Globe size={14} /> Step 7: Biography
              </h3>
              
              <div>
                <label className="label-text">Clinical Biography & Description *</label>
                <p className="text-slate-500 text-[10px] mb-2">Write a detailed clinical overview including specialty focus area, treatment approaches and general history.</p>
                <textarea
                  rows="6"
                  required
                  placeholder="Dr. Sophia Patel is a double board-certified cardiologist with over 9 years of medical experience. Specializes in advanced coronary care, structural heart interventions, and preventive healthcare. Has authored numerous articles in peer-reviewed cardiovascular journals..."
                  className="input-field mt-1 text-xs resize-none"
                  value={form.bio}
                  onChange={e => setForm({ ...form, bio: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Controls Footer */}
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-white/5">
            {step > 1 ? (
              <button
                type="button" onClick={handlePrev}
                className="btn btn-secondary text-xs uppercase font-bold tracking-wide flex items-center gap-1.5 px-5 py-2.5 w-full sm:w-auto justify-center"
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <Link to="/login" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Already registered? Sign In
              </Link>
            )}

            {step < 7 ? (
              <button
                type="button" onClick={handleNext}
                className="btn btn-primary text-xs uppercase font-black tracking-wider flex items-center gap-1.5 px-6 py-2.5 w-full sm:w-auto justify-center"
              >
                Next Step <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="submit" disabled={loading}
                className="btn btn-primary text-xs uppercase font-black tracking-wider flex items-center gap-1.5 px-8 py-3 w-full sm:w-auto justify-center"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Submit Registration Request <CheckCircle2 size={16} /></>
                )}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  )
}
