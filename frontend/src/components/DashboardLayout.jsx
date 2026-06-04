import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import FloatingChatbot from '@/components/FloatingChatbot'
import { useTheme } from '@/contexts/ThemeContext'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className={isDark ? 'dark' : ''}>
      {/* Animated ECG Health Pulse Background Tracer */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-[0.03] dark:opacity-[0.015] select-none">
        <svg className="w-full h-full text-blue-600 dark:text-blue-400" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <path
            d="M 0 500 L 150 500 L 160 480 L 170 520 L 180 430 L 195 570 L 205 490 L 215 510 L 230 500 L 450 500 L 460 480 L 470 520 L 480 430 L 495 570 L 505 490 L 515 510 L 530 500 L 750 500 L 760 480 L 770 520 L 780 430 L 795 570 L 805 490 L 815 510 L 830 500 L 1000 500"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="ecg-line"
          />
        </svg>
      </div>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Topbar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        darkMode={isDark}
        onToggleDark={toggleTheme}
      />
      <main
        className="transition-all duration-300 min-h-screen pt-16"
        style={{ marginLeft: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      >
        <div className="p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
      <FloatingChatbot />
    </div>
  )
}


