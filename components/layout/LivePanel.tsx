'use client'

import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Terminal, Trash2, Copy, Check } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface LivePanelProps {
  className?: string
}

export function LivePanel({ className }: LivePanelProps) {
  const { rightPanelOpen, setRightPanelOpen, logs, clearLogs } = useAppStore()
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState(false)

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const copyLogs = () => {
    const logText = logs.map(l => `[${formatDate(l.timestamp)}] [${l.level.toUpperCase()}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(logText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-zinc-500 dark:text-zinc-400'
      case 'warn':
        return 'text-amber-500'
      case 'error':
        return 'text-red-500'
      case 'success':
        return 'text-emerald-500'
      default:
        return 'text-zinc-500'
    }
  }

  return (
    <motion.div
      initial={false}
      animate={{ width: rightPanelOpen ? 320 : 48 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-card dark:bg-zinc-900/50',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500/60 via-teal-500/25 to-transparent" />
      {/* Header */}
      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {rightPanelOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Terminal className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">Живые логи</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-1">
            {rightPanelOpen && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyLogs}
                  className="h-7 w-7"
                  title="Копировать логи"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearLogs}
                  className="h-7 w-7"
                  title="Очистить логи"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="h-8 w-8"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  rightPanelOpen && 'rotate-180'
                )}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Logs Content */}
      <AnimatePresence>
        {rightPanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-xs"
          >
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Логи пока пусты</p>
                <p className="text-xs mt-1">Начните диалог, чтобы увидеть события</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'flex gap-2 rounded-md border-l-2 py-1 pl-2',
                      log.level === 'success' && 'border-emerald-500/70',
                      log.level === 'warn' && 'border-amber-500/70',
                      log.level === 'error' && 'border-red-500/70',
                      log.level === 'info' && 'border-sky-500/40'
                    )}
                  >
                    <span className="text-muted-foreground shrink-0">
                      {formatDate(log.timestamp)}
                    </span>
                    <span className={cn('uppercase shrink-0 w-12', getLevelColor(log.level))}>
                      {log.level}
                    </span>
                    <span className="text-foreground break-all">{log.message}</span>
                  </motion.div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
