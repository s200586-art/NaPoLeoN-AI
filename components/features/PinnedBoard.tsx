'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Pin, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface PinnedBoardProps {
  className?: string
}

function formatRelativeTime(value: Date) {
  const date = new Date(value)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 30) return 'только что'
  if (seconds < 60) return `${seconds} сек назад`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} мин назад`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`

  const days = Math.floor(hours / 24)
  return `${days} д назад`
}

function previewText(text: string, max = 240) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}...`
}

export function PinnedBoard({ className }: PinnedBoardProps) {
  const {
    pinnedBoardOpen,
    setPinnedBoardOpen,
    pinnedNotes,
    removePinnedMessage,
    clearPinnedMessages,
    chats,
    setActiveChat,
    setViewMode,
    addLog,
  } = useAppStore()

  const openPinned = (noteId: string, chatId: string) => {
    const chat = chats.find((item) => item.id === chatId)
    if (!chat) {
      removePinnedMessage(noteId)
      addLog({
        level: 'warn',
        message: 'Закреп ссылается на удалённый чат. Запись убрана.',
      })
      return
    }

    setActiveChat(chat)
    setViewMode('chat')
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: pinnedBoardOpen ? 340 : 48 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'relative hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-card dark:bg-zinc-900/50 xl:flex',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/70 via-cyan-500/30 to-transparent" />

      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {pinnedBoardOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Pin className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-medium">Доска закрепов</span>
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-600 dark:text-sky-300">
                  {pinnedNotes.length}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-1">
            {pinnedBoardOpen && pinnedNotes.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearPinnedMessages}
                className="h-7 w-7"
                title="Очистить доску"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPinnedBoardOpen(!pinnedBoardOpen)}
              className="h-8 w-8"
              title={pinnedBoardOpen ? 'Свернуть доску' : 'Открыть доску'}
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  pinnedBoardOpen && 'rotate-180'
                )}
              />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pinnedBoardOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 overflow-y-auto p-3"
          >
            {pinnedNotes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Pin className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">Пока нет закрепов</p>
                <p className="mt-1 text-xs">Нажми pin у сообщения в чате</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pinnedNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-xl border border-border bg-background/70 p-3 dark:bg-zinc-950/40"
                  >
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r',
                        note.role === 'user'
                          ? 'from-sky-500/70 via-cyan-500/30 to-transparent'
                          : 'from-violet-500/70 via-fuchsia-500/30 to-transparent'
                      )}
                    />

                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openPinned(note.id, note.chatId)}
                        className="truncate text-left text-xs font-medium text-sky-600 transition-colors hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                        title={note.chatTitle}
                      >
                        {note.chatTitle}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePinnedMessage(note.id)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                        title="Убрать из доски"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPinned(note.id, note.chatId)}
                      className="w-full text-left"
                    >
                      <p className="line-clamp-4 text-sm">{previewText(note.content, 260)}</p>
                    </button>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{note.role === 'user' ? 'S' : 'N'}</span>
                      <span>{formatRelativeTime(note.pinnedAt)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
