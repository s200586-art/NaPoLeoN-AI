'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAppStore, ViewMode } from '@/lib/store'
import { cn } from '@/lib/utils'

interface MobileHeaderProps {
  className?: string
}

const NAV_ITEMS: Array<{ id: ViewMode; label: string; icon: React.ElementType }> = [
  { id: 'chat', icon: MessageSquare, label: 'Чат' },
  { id: 'agents', icon: Bot, label: 'Агенты' },
  { id: 'dashboard', icon: LayoutDashboard, label: 'Дашборд' },
  { id: 'projects', icon: FolderOpen, label: 'Проекты' },
  { id: 'inbox', icon: Inbox, label: 'Инбокс' },
]

const VIEW_TITLES: Record<ViewMode, string> = {
  chat: 'Чат',
  agents: 'Агенты',
  dashboard: 'Дашборд',
  projects: 'Проекты',
  inbox: 'Инбокс',
}

export function MobileHeader({ className }: MobileHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const {
    viewMode,
    setViewMode,
    chats,
    activeChat,
    setActiveChat,
    addChat,
    removeChat,
    theme,
    setTheme,
    setAuthenticated,
  } = useAppStore()

  const headerTitle = viewMode === 'chat' ? activeChat?.title || VIEW_TITLES.chat : VIEW_TITLES[viewMode]

  const handleNewChat = () => {
    const newChat = {
      id: Math.random().toString(36).slice(2),
      title: 'Новый чат',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    addChat(newChat)
    setViewMode('chat')
    setMenuOpen(false)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setAuthenticated(false)
      router.replace('/login')
    }
  }

  return (
    <>
      <header
        className={cn(
          'z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur',
          className
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setMenuOpen(true)}
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0 px-2 text-center">
          <p className="truncate text-sm font-semibold">{headerTitle}</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={handleNewChat}
          aria-label="Новый чат"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-label="Закрыть меню"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[360px] flex-col border-r border-border bg-card shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100">
                    <span className="text-sm font-bold text-white dark:text-zinc-900">N</span>
                  </div>
                  <span className="text-sm font-semibold">NaPoLeoN</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Закрыть меню"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 border-b border-border p-3">
                <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={handleNewChat}>
                  <Plus className="h-4 w-4" />
                  Новый чат
                </Button>

                <div className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon
                    const active = viewMode === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setViewMode(item.id)
                          setMenuOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors',
                          active
                            ? 'border-sky-500 bg-sky-500/10 text-foreground'
                            : 'border-transparent text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800/50'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Чаты
                </p>
                {chats.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                    Пока нет чатов
                  </p>
                ) : (
                  <div className="space-y-1">
                    {chats.map((chat) => (
                      <div key={chat.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChat(chat)
                            setViewMode('chat')
                            setMenuOpen(false)
                          }}
                          className={cn(
                            'w-full truncate rounded-lg px-3 py-2 pr-9 text-left text-sm transition-colors',
                            activeChat?.id === chat.id
                              ? 'bg-zinc-100 text-foreground dark:bg-zinc-800'
                              : 'text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800/50'
                          )}
                        >
                          {chat.title}
                        </button>
                        <button
                          type="button"
                          className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                          onClick={(event) => {
                            event.stopPropagation()
                            removeChat(chat.id)
                          }}
                          aria-label={`Удалить чат ${chat.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-border p-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                </Button>
                <Button type="button" variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Выход
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
