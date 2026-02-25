'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Bot, Circle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useAppStore, Agent } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

interface AgentColumnProps {
  agent: Agent
  className?: string
}

const STATUS_THEME: Record<
  Agent['status'],
  { line: string; glow: string; accentText: string; button: string; buttonHover: string }
> = {
  idle: {
    line: 'from-zinc-500/60 via-zinc-400/30 to-transparent',
    glow: 'bg-zinc-500',
    accentText: 'text-zinc-500',
    button: 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
    buttonHover: 'hover:bg-zinc-800 dark:hover:bg-zinc-200',
  },
  thinking: {
    line: 'from-blue-500/70 via-cyan-500/30 to-transparent',
    glow: 'bg-blue-500',
    accentText: 'text-blue-500',
    button: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
    buttonHover: 'hover:bg-blue-500 dark:hover:bg-blue-400',
  },
  working: {
    line: 'from-amber-500/80 via-yellow-500/30 to-transparent',
    glow: 'bg-amber-500',
    accentText: 'text-amber-500',
    button: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-zinc-900',
    buttonHover: 'hover:bg-amber-500 dark:hover:bg-amber-400',
  },
  completed: {
    line: 'from-emerald-500/80 via-teal-500/30 to-transparent',
    glow: 'bg-emerald-500',
    accentText: 'text-emerald-500',
    button: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-900',
    buttonHover: 'hover:bg-emerald-500 dark:hover:bg-emerald-400',
  },
  planned: {
    line: 'from-violet-500/70 via-fuchsia-500/30 to-transparent',
    glow: 'bg-violet-500',
    accentText: 'text-violet-500',
    button: 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-not-allowed',
    buttonHover: '',
  },
}

function AgentColumn({ agent, className }: AgentColumnProps) {
  const theme = STATUS_THEME[agent.status]

  const getStatusIcon = () => {
    switch (agent.status) {
      case 'thinking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'working':
        return <Circle className="h-4 w-4 fill-amber-500 text-amber-500 animate-pulse" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'planned':
        return <AlertCircle className="h-4 w-4 text-zinc-400" />
      case 'idle':
        return <Circle className="h-4 w-4 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (agent.status) {
      case 'thinking':
        return 'Думает...'
      case 'working':
        return 'В работе...'
      case 'completed':
        return 'Готово'
      case 'planned':
        return 'Скоро'
      case 'idle':
        return 'Готов'
      default:
        return ''
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card dark:bg-zinc-900/50',
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r', theme.line)} />
      <div className={cn('pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl opacity-20', theme.glow)} />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar fallback={agent.name} className="h-10 w-10" />
          <div>
            <h3 className="font-medium text-sm">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={cn('text-xs', theme.accentText)}>{getStatusText()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {agent.lastMessage ? (
          <div className="text-sm text-muted-foreground">
            <p>{agent.lastMessage}</p>
          </div>
        ) : agent.status === 'planned' ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground">Агент в плане</p>
            <p className="text-xs text-muted-foreground mt-1">Подключишь позже в настройках OpenClaw</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">Готов к задачам</p>
            <p className="text-xs text-muted-foreground mt-1">Отправьте сообщение для запуска</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <button
            className={cn(
              'flex-1 py-2 px-3 text-xs font-medium rounded-lg',
              'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700',
              'transition-colors duration-150'
            )}
          >
            История
          </button>
          <button
            className={cn(
              'flex-1 py-2 px-3 text-xs font-medium rounded-lg',
              theme.button,
              theme.buttonHover,
              'transition-colors duration-150'
            )}
            disabled={agent.status === 'planned'}
          >
            {agent.status === 'planned' ? 'Скоро' : 'Запустить'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function MultiAgentView() {
  const { agents } = useAppStore()

  return (
    <div className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-6 shrink-0">
        <div className="mb-2 inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-300">
          Agent orchestration
        </div>
        <h1 className="text-2xl font-semibold">Мультиагент</h1>
        <p className="text-muted-foreground mt-1">Координация нескольких ИИ-агентов для сложных задач</p>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="min-h-0"
          >
            <AgentColumn agent={agent} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
