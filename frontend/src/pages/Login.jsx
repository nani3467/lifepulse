import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Stethoscope, Eye, EyeOff, Mail, Lock, ArrowRight, Shield, User, Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register } = useAuth()
  
  const isRegister = location.pathname === '/register'
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'patient'
  })
  
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  // Sync form state on route change
  useEffect(() => {
    if (isRegister) {
      setForm({ name: '', email: '', password: '', phone: '', role: 'patient' })
    } else {
      setForm({ name: '', email: 'admin@lifepulse.com', password: 'Admin@123', phone: '', role: 'patient' })
    }
  }, [isRegister])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (isRegister) {
      if (!form.name || !form.email || !form.password) {
        return toast.error('Please fill name, email, and password fields')
      }
      setLoading(true)
      console.log('Sending registration request to backend...', {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone
      })
      try {
        const user = await register(form.name, form.email, form.password, form.role, form.phone)
        console.log('Registration successful:', user)
        toast.success(`Welcome to LifePulse, ${user.name}!`)
        navigate('/dashboard')
      } catch (err) {
        console.error('Registration failed:', err)
        toast.error(err?.response?.data?.error || 'Registration failed')
      } finally {
        setLoading(false)
      }
    } else {
      if (!form.email || !form.password) {
        return toast.error('Please fill all fields')
      }
      setLoading(true)
      console.log('Sending login request to backend...', { email: form.email })
      try {
        const user = await login(form.email, form.password)
        console.log('Login successful:', user)
        toast.success(`Welcome back, ${user.name}!`)
        navigate('/dashboard')
      } catch (err) {
        console.error('Login failed:', err)
        toast.error(err?.response?.data?.error || 'Login failed')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />

      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}>
            <Stethoscope size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">LifePulse</h1>
          <p className="text-slate-400 text-sm">Hospital Management Analytics System</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">{isRegister ? 'Create Account' : 'Sign In'}</h2>
            <p className="text-slate-400 text-sm mt-1">
              {isRegister ? 'Join LifePulse healthcare network' : 'Access your healthcare dashboard'}
            </p>
          </div>

          {/* Demo creds hint (only for login) */}
          {!isRegister && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Shield size={14} className="text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-300">
                Demo: <strong>admin@lifepulse.com</strong> / <strong>Admin@123</strong>
              </p>
            </div>
          )}

          <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (register only) */}
            {isRegister && (
              <div>
                <label className="label-text">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    className="input-field pl-10"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Email / Doctor ID */}
            <div>
              <label className="label-text">{isRegister ? 'Email Address' : 'Email Address or Doctor ID'}</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="auth-email"
                  type="text"
                  required
                  className="input-field pl-10"
                  placeholder={isRegister ? "you@hospital.com" : "you@hospital.com or DOC001"}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
 
            {/* Phone Number (register only) */}
            {isRegister && (
              <div>
                <label className="label-text">Phone Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="register-phone"
                    type="tel"
                    className="input-field pl-10"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
            )}
 
            {/* Password */}
            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
 
            {/* Role selection (register only) */}
            {isRegister && (
              <div className="space-y-4">
                <div>
                  <label className="label-text">Account Role</label>
                  <div className="relative">
                    <Shield size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <select
                      id="register-role"
                      className="input-field pl-10 appearance-none bg-slate-900"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="patient" className="bg-slate-900 text-white">Patient</option>
                      <option value="receptionist" className="bg-slate-900 text-white">Receptionist</option>
                      <option value="admin" className="bg-slate-900 text-white">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col gap-1.5 mt-2">
                  <p className="text-[10px] text-blue-300 leading-normal">
                    🏥 <strong>Are you a Doctor?</strong> To join the LifePulse Hospital network, please submit a credential verification request.
                  </p>
                  <Link to="/doctor-register" className="text-xs text-blue-400 font-bold hover:underline self-start uppercase tracking-wider">
                    Go to Doctor Onboarding &rarr;
                  </Link>
                </div>
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>{isRegister ? 'Register' : 'Sign In'} <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            {isRegister ? (
              <Link to="/login" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Already have an account? Sign In
              </Link>
            ) : (
              <Link to="/register" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Don't have an account? Register
              </Link>
            )}
          </div>
        </div>

        {/* Roles list */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {['Admin', 'Doctor', 'Receptionist', 'Patient'].map((role) => (
            <div key={role}
              className="glass-card px-2 py-2 text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {role}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
