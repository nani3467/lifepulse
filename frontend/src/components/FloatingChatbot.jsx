import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare, X, Send, Mic, MicOff, Volume2, VolumeX,
  Sparkles, CheckCircle2, ChevronRight, Stethoscope
} from 'lucide-react'
import { chatbotApi } from '@/services/chatbotApi'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export default function FloatingChatbot() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hello! I'm PulseAI, your LifePulse clinical assistant. I can suggest departments based on symptoms, provide health tips, or assist you in booking appointments. How can I help you today?"
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Voice support states
  const [isListening, setIsListening] = useState(false)
  const [speechEnabled, setSpeechEnabled] = useState(false)

  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const navigate = useNavigate()

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'en-US'

      rec.onstart = () => {
        setIsListening(true)
        toast.success("Listening... Speak your symptom.")
      }

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInputValue(transcript)
      }

      rec.onerror = (e) => {
        console.error('Speech recognition error', e)
        setIsListening(false)
      }

      rec.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = rec
    }
  }, [])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Browser Text-To-Speech Synthesis helper
  const speakReply = (text) => {
    if (!speechEnabled) return
    window.speechSynthesis.cancel() // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }

  const handleSend = async (textToSend) => {
    const msgText = textToSend || inputValue
    if (!msgText.trim()) return

    // Add user message
    const userMsg = { sender: 'user', text: msgText }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setLoading(true)

    try {
      const { data } = await chatbotApi.query(msgText)
      
      const botMsg = {
        sender: 'bot',
        text: data.reply,
        action: data.action
      }
      
      setMessages(prev => [...prev, botMsg])
      speakReply(data.reply)
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { sender: 'bot', text: "I'm sorry, I encountered an issue connecting to my diagnostic servers." }])
    } finally {
      setLoading(false)
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
    }
  }

  const handleActionClick = (action) => {
    if (action.type === 'route') {
      let targetPath = action.path
      if (user?.role === 'patient') {
        if (action.path === '/appointments') targetPath = '/patient/appointments'
        else if (action.path === '/bloodbank') targetPath = '/patient/bloodbank'
        else if (action.path === '/pharmacy') targetPath = '/patient/pharmacy'
        else if (action.path === '/predictions') targetPath = '/patient/symptoms'
      }
      navigate(targetPath)
      setIsOpen(false)
      toast.success(`Navigating to ${action.label}`)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Floating Toggle Bubble */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true)
            speakReply("Hello! I am PulseAI. How can I help you?")
          }}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-110"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            boxShadow: '0 8px 30px rgba(6,182,212,0.4)',
          }}
        >
          <MessageSquare className="text-white" size={24} />
          {/* Pulsing indicator */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
          </span>
        </button>
      )}

      {/* Expanded Chatbot Panel */}
      {isOpen && (
        <div className="chatbot-panel animate-fade-in">
          
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600/30 to-cyan-500/20 border-b border-white/5 flex items-center justify-between chatbot-header">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Stethoscope size={16} className="text-white" />
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  PulseAI Assistant
                  <Sparkles size={11} className="text-cyan-400 animate-pulse" />
                </div>
                <div className="text-[9px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Clinical Triage desk
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Vocal TTS Toggle */}
              <button
                onClick={() => {
                  setSpeechEnabled(!speechEnabled)
                  toast.success(`Voice response ${!speechEnabled ? 'Enabled' : 'Disabled'}`)
                }}
                className={`p-1.5 rounded-lg border transition-colors ${
                  speechEnabled ? 'bg-blue-600/20 border-blue-500/30 text-white' : 'text-slate-500 border-transparent hover:text-slate-400'
                }`}
                title="Vocal Responses"
              >
                {speechEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false)
                  window.speechSynthesis.cancel()
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Log Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none chatbot-bubble-user'
                    : 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none chatbot-bubble-bot'
                }`}>
                  {msg.text}
                  
                  {/* Embedded Triage Action redirects */}
                  {msg.action && (
                    <button
                      onClick={() => handleActionClick(msg.action)}
                      className="mt-2.5 w-full py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-500/40 text-blue-300 font-bold flex items-center justify-center gap-1 text-[10px] transition-colors"
                    >
                      {msg.action.label}
                      <ChevronRight size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {/* Loading / Typing indicator bubble */}
            {loading && (
              <div className="flex items-center gap-1 bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none max-w-[70px] chatbot-bubble-bot">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-4 py-2 border-t border-white/5 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none chatbot-chips-container">
            <button
              onClick={() => handleSend("Suggest a department for my chest pain")}
              className="px-2.5 py-1 text-[9px] rounded-lg bg-slate-800/80 border border-white/5 text-slate-400 hover:text-white transition-colors chatbot-chip"
            >
              Symptom Checker
            </button>
            <button
              onClick={() => handleSend("How do I book an appointment?")}
              className="px-2.5 py-1 text-[9px] rounded-lg bg-slate-800/80 border border-white/5 text-slate-400 hover:text-white transition-colors chatbot-chip"
            >
              Book Doctor
            </button>
            <button
              onClick={() => handleSend("Give me a healthy tip")}
              className="px-2.5 py-1 text-[9px] rounded-lg bg-slate-800/80 border border-white/5 text-slate-400 hover:text-white transition-colors chatbot-chip"
            >
              Health Tip
            </button>
            <button
              onClick={() => handleSend("What is the normal blood oxygen range?")}
              className="px-2.5 py-1 text-[9px] rounded-lg bg-slate-800/80 border border-white/5 text-slate-400 hover:text-white transition-colors chatbot-chip"
            >
              SpO2 Norm
            </button>
          </div>

          {/* Input Panel */}
          <div className="p-3 border-t border-white/5 flex gap-2 items-center chatbot-input-area">
            {/* Voice speech to text button */}
            <button
              onClick={toggleListening}
              className={`p-2 rounded-xl border transition-colors flex-shrink-0 ${
                isListening 
                  ? 'bg-rose-600/20 border-rose-500/40 text-rose-400 animate-pulse' 
                  : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
              }`}
              title="Voice Typing"
            >
              {isListening ? <Mic size={15} /> : <MicOff size={15} />}
            </button>

            <input
              type="text"
              placeholder="Ask a medical question..."
              className="input text-xs py-2 flex-1 chatbot-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
              }}
            />

            <button
              onClick={() => handleSend()}
              className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
