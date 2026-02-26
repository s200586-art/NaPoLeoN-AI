'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { useAppStore, Agent } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface AgentColumnProps {
  agent: Agent
  isRunning: boolean
  canRun: boolean
  onRun: () => void
  onReset: () => void
  className?: string
}

interface ChatResponse {
  answer?: string
  model?: string
  error?: string
}

interface ChatTokenEvent {
  type: 'token'
  delta?: string
}

interface ChatDoneEvent {
  type: 'done'
  answer?: string
  model?: string
  error?: string
}

interface ChatErrorEvent {
  type: 'error'
  error?: string
}

type ChatStreamEvent = ChatTokenEvent | ChatDoneEvent | ChatErrorEvent

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
  error: {
    line: 'from-red-500/80 via-rose-500/30 to-transparent',
    glow: 'bg-red-500',
    accentText: 'text-red-500',
    button: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
    buttonHover: 'hover:bg-red-500 dark:hover:bg-red-400',
  },
}

const QUICK_PROMPTS = [
  'Собери короткий план задач на сегодня по текущим целям.',
  'Дай 3 варианта ускорения проекта без потери качества.',
  'Проверь риски перед деплоем и дай чеклист.',
]

async function parseErrorFromResponse(response: Response) {
  const raw = await response.text()
  try {
    const parsed = JSON.parse(raw) as ChatResponse
    if (parsed?.error) {
      return parsed.error
    }
  } catch {
    // ignored
  }
  if (raw.trim()) {
    return raw.slice(0, 240)
  }
  return `HTTP ${response.status}`
}

async function parseChatCompletion(response: Response) {
  if (!response.ok) {
    throw new Error(await parseErrorFromResponse(response))
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/x-ndjson') && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullAnswer = ''
    let resolvedModel = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      let lineBreakIndex = buffer.indexOf('\n')

      while (lineBreakIndex !== -1) {
        const rawLine = buffer.slice(0, lineBreakIndex).trim()
        buffer = buffer.slice(lineBreakIndex + 1)
        lineBreakIndex = buffer.indexOf('\n')

        if (!rawLine) continue

        let event: ChatStreamEvent
        try {
          event = JSON.parse(rawLine) as ChatStreamEvent
        } catch {
          continue
        }

        if (event.type === 'token' && event.delta) {
          fullAnswer += event.delta
        }

        if (event.type === 'done') {
          if (typeof event.answer === 'string' && event.answer.trim()) {
            fullAnswer = event.answer
          }
          if (typeof event.model === 'string') {
            resolvedModel = event.model
          }
          if (event.error) {
            throw new Error(event.error)
          }
        }

        if (event.type === 'error') {
          throw new Error(event.error || 'Ошибка stream ответа')
        }
      }
    }

    return {
      answer: fullAnswer.trim() || 'Пустой ответ',
      model: resolvedModel || null,
    }
  }

  const payload = (await response.json()) as ChatResponse
  return {
    answer: payload.answer?.trim() || 'Пустой ответ',
    model: payload.model || null,
  }
}

function AgentColumn({
  agent,
  isRunning,
  canRun,
  onRun,
  onReset,
  className,
}: AgentColumnProps) {
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
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'idle':
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
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
      case 'error':
        return 'Ошибка'
      case 'idle':
      default:
        return 'Готов'
    }
  }

  const runButtonText = agent.status === 'planned'
    ? 'Скоро'
    : isRunning
      ? 'Выполняется...'
      : 'Запустить'

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

      <div className="flex items-center justify-between border-b border-border p-4">
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

      <div className="flex-1 overflow-y-auto p-4">
        {agent.lastMessage ? (
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{agent.lastMessage}</p>
        ) : agent.status === 'planned' ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground opacity-60" />
            <p className="text-sm text-muted-foreground">Агент в плане</p>
            <p className="mt-1 text-xs text-muted-foreground">Подключишь позже в OpenClaw</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="mb-2 h-8 w-8 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">Готов к запуску</p>
            <p className="mt-1 text-xs text-muted-foreground">Введи промпт и жми запуск</p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={agent.status === 'planned' || isRunning}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150',
              agent.status === 'planned' || isRunning
                ? 'cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
            )}
          >
            Сброс
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={agent.status === 'planned' || !canRun || isRunning}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150',
              agent.status === 'planned' || !canRun || isRunning
                ? 'cursor-not-allowed bg-zinc-300 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                : cn(theme.button, theme.buttonHover)
            )}
          >
            {runButtonText}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function MultiAgentView() {
  const { agents, setAgentStatus, setAgentMessage, addLog } = useAppStore((state) => ({
    agents: state.agents,
    setAgentStatus: state.setAgentStatus,
    setAgentMessage: state.setAgentMessage,
    addLog: state.addLog,
  }))

  const [prompt, setPrompt] = useState('')
  const [runningIds, setRunningIds] = useState<string[]>([])
  const [runningAll, setRunningAll] = useState(false)

  const trimmedPrompt = prompt.trim()
  const runnableAgents = useMemo(
    () => agents.filter((agent) => agent.status !== 'planned'),
    [agents]
  )

  const markRunning = useCallback((id: string, running: boolean) => {
    setRunningIds((current) => {
      if (running) {
        return current.includes(id) ? current : [...current, id]
      }
      return current.filter((value) => value !== id)
    })
  }, [])

  const resetAgent = useCallback((agentId: string) => {
    setAgentStatus(agentId, 'idle')
    setAgentMessage(agentId, '')
  }, [setAgentMessage, setAgentStatus])

  const executeAgent = useCallback(
    async (agent: Agent, sourcePrompt: string) => {
      if (agent.status === 'planned') return

      markRunning(agent.id, true)
      setAgentStatus(agent.id, 'thinking')
      setAgentMessage(agent.id, '')

      const sessionRoot =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('napoleon_session_id') || 'main'
          : 'main'
      const sessionId = `${sessionRoot}:agent:${agent.id}`

      addLog({
        level: 'info',
        message: `Агент ${agent.name}: запуск (${agent.model})`,
      })

      try {
        setAgentStatus(agent.id, 'working')
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: sourcePrompt,
            sessionId,
            model: agent.model,
          }),
        })

        const { answer, model } = await parseChatCompletion(response)
        setAgentMessage(agent.id, answer)
        setAgentStatus(agent.id, 'completed')
        addLog({
          level: 'success',
          message: `Агент ${agent.name}: ответ получен${model ? ` (${model})` : ''}`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
        setAgentMessage(agent.id, `Ошибка: ${message}`)
        setAgentStatus(agent.id, 'error')
        addLog({
          level: 'error',
          message: `Агент ${agent.name}: ${message}`,
        })
      } finally {
        markRunning(agent.id, false)
      }
    },
    [addLog, markRunning, setAgentMessage, setAgentStatus]
  )

  const runAllAgents = useCallback(async () => {
    if (!trimmedPrompt) {
      addLog({ level: 'warn', message: 'Агенты: добавь промпт перед запуском' })
      return
    }
    if (runnableAgents.length === 0) {
      addLog({ level: 'warn', message: 'Агенты: нет доступных агентов для запуска' })
      return
    }

    setRunningAll(true)
    await Promise.allSettled(runnableAgents.map((agent) => executeAgent(agent, trimmedPrompt)))
    setRunningAll(false)
  }, [addLog, executeAgent, runnableAgents, trimmedPrompt])

  const resetAllAgents = () => {
    runnableAgents.forEach((agent) => resetAgent(agent.id))
    addLog({ level: 'info', message: 'Агенты: ответы очищены' })
  }

  const canRun = trimmedPrompt.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-4 shrink-0">
        <div className="mb-2 inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-300">
          Agent orchestration
        </div>
        <h1 className="text-2xl font-semibold">Мультиагент</h1>
        <p className="mt-1 text-muted-foreground">Параллельный запуск агентов на одном промпте</p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-4 overflow-hidden rounded-xl border border-border bg-card p-4 dark:bg-zinc-900/50"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-violet-500/70 via-fuchsia-500/30 to-transparent" />
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Промпт для всех активных агентов
          </div>
          <div className="text-xs text-muted-foreground">{runnableAgents.length} активных</div>
        </div>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Например: сделайте 3 варианта плана релиза с рисками и сроками..."
          rows={4}
          className="mb-3"
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((quickPrompt) => (
            <button
              key={quickPrompt}
              type="button"
              onClick={() => setPrompt(quickPrompt)}
              className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
            >
              {quickPrompt}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void runAllAgents()}
            disabled={!canRun || runningAll || runnableAgents.length === 0}
            className="h-9 gap-1.5 bg-violet-600 text-white hover:bg-violet-500"
          >
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Запустить всех
          </Button>
          <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={resetAllAgents}>
            <RotateCcw className="h-4 w-4" />
            Очистить ответы
          </Button>
        </div>
      </motion.section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="min-h-0"
          >
            <AgentColumn
              agent={agent}
              isRunning={runningIds.includes(agent.id)}
              canRun={canRun}
              onRun={() => {
                if (!canRun) {
                  addLog({ level: 'warn', message: `Агент ${agent.name}: добавь промпт` })
                  return
                }
                void executeAgent(agent, trimmedPrompt)
              }}
              onReset={() => resetAgent(agent.id)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
