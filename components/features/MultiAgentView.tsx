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

function AgentColumn({ agent, className }: AgentColumnProps) {
  const getStatusIcon = () => {
    switch (agent.status) {
      case 'thinking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'working':
        return <Circle className="h-4 w-4 fill-amber-500 text-amber-500 animate-pulse" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
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
        'flex flex-col h-full rounded-xl border border-border bg-card dark:bg-zinc-900/50',
        className
      )}
    >
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
          <span className="text-xs text-muted-foreground">{getStatusText()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {agent.lastMessage ? (
          <div className="text-sm text-muted-foreground">
            <p>{agent.lastMessage}</p>
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
              'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
              'hover:bg-zinc-800 dark:hover:bg-zinc-200',
              'transition-colors duration-150'
            )}
          >
Запустить
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
