'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'
import { LivePanel } from '@/components/layout/LivePanel'
import { ChatCanvas } from '@/components/chat/ChatCanvas'
import { MultiAgentView } from '@/components/features/MultiAgentView'
import { DashboardView } from '@/components/features/DashboardView'

export default function Home() {
  const router = useRouter()
  const { 
    isAuthenticated, 
    setAuthenticated, 
    viewMode, 
    theme,
  } = useAppStore()

  useEffect(() => {
    // Check for existing auth
    const auth = localStorage.getItem('nexus-auth')
    if (auth) {
      setAuthenticated(true)
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
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
    </div>
  )
}
