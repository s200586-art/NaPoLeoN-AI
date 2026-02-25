'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  Bot,
  LayoutDashboard,
  FolderOpen,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, ViewMode } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const router = useRouter()
  const {
    sidebarOpen,
    setSidebarOpen,
    viewMode,
    setViewMode,
    theme,
    setTheme,
    chats,
    activeChat,
    setActiveChat,
    addChat,
    removeChat,
    setAuthenticated,
  } = useAppStore()

  const handleNewChat = () => {
    const newChat = {
      id: Math.random().toString(36).slice(2),
      title: 'Новый чат',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    addChat(newChat)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setAuthenticated(false)
      router.replace('/login')
    }
  }

  const navItems: { id: ViewMode; icon: React.ElementType; label: string }[] = [
    { id: 'chat', icon: MessageSquare, label: 'Чат' },
    { id: 'agents', icon: Bot, label: 'Агенты' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Дашборд' },
    { id: 'projects', icon: FolderOpen, label: 'Проекты' },
  ]

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 260 : 72 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-card dark:bg-zinc-900/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                <span className="text-lg font-bold text-white dark:text-zinc-900">N</span>
              </div>
              <span className="font-semibold text-sm">NaPoLeoN</span>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-8 w-8"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          variant="outline"
          className={cn('w-full justify-start gap-2', !sidebarOpen && 'justify-center')}
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          {sidebarOpen && <span>Новый чат</span>}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="shrink-0 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = viewMode === item.id
          return (
            <button
              key={item.id}
              onClick={() => setViewMode(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'border-sky-500 bg-sky-500/10 dark:bg-sky-500/10 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-foreground',
                !sidebarOpen && 'justify-center'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-zinc-900 dark:text-zinc-100')} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Chat History */}
      {sidebarOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Последние чаты
          </p>
          <div className="space-y-1">
            {chats.map((chat) => (
              <div key={chat.id} className="group relative">
                <button
                  onClick={() => {
                    setActiveChat(chat)
                    setViewMode('chat')
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 pr-10 rounded-lg text-sm text-left transition-all duration-150 truncate',
                    activeChat?.id === chat.id
                      ? 'bg-zinc-100 dark:bg-zinc-800'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChat(chat.id)
                  }}
                  title="Удалить чат"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start gap-2', !sidebarOpen && 'justify-center')}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {sidebarOpen && <span>{theme === 'dark' ? 'Светлая' : 'Тёмная'}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start gap-2', !sidebarOpen && 'justify-center')}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {sidebarOpen && <span>Выход</span>}
        </Button>
      </div>
    </motion.aside>
  )
}
