'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { LivePanel } from '@/components/layout/LivePanel'
import { ChatCanvas } from '@/components/chat/ChatCanvas'
import { MultiAgentView } from '@/components/features/MultiAgentView'
import { DashboardView } from '@/components/features/DashboardView'
import { ProjectsView } from '@/components/features/ProjectsView'
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt'

export default function Home() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const { 
    isAuthenticated, 
    setAuthenticated, 
    viewMode, 
    theme,
  } = useAppStore()

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        const data = await res.json()
        if (!active) return
        setAuthenticated(Boolean(data?.authenticated))
      } catch {
        if (!active) return
        setAuthenticated(false)
      } finally {
        if (active) {
          setAuthChecked(true)
        }
      }
    }

    checkSession()

    return () => {
      active = false
    }
  }, [setAuthenticated])

  useEffect(() => {
    // Apply theme on mount
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    if (authChecked && !isAuthenticated) {
      router.replace('/login')
    }
  }, [authChecked, isAuthenticated, router])

  if (!authChecked || !isAuthenticated) {
    return null
  }

  const renderContent = () => {
    switch (viewMode) {
      case 'chat':
        return <ChatCanvas />
      case 'agents':
        return <MultiAgentView />
      case 'dashboard':
        return <DashboardView />
      case 'projects':
        return <ProjectsView />
      default:
        return <ChatCanvas />
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-background">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {renderContent()}
      </main>

      {/* Right Panel */}
      <LivePanel />

      <PWAInstallPrompt />
    </div>
  )
}
