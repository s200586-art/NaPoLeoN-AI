'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Inbox,
  RefreshCw,
  Send,
  Trash2,
  UserCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Message, useAppStore } from '@/lib/store'
import { ShareInboxItem, ShareInboxStatus, isShareInboxStatus } from '@/lib/share-inbox'

interface ShareInboxResponse {
  generatedAt: string
  counts: Record<'all' | ShareInboxStatus, number>
  items: ShareInboxItem[]
  shareEndpoint: string
  tokenEnabled: boolean
}

type StatusFilter = 'all' | ShareInboxStatus

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Все',
  new: 'Новые',
  in_progress: 'В работе',
  done: 'Готово',
}

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  minimax: 'MiniMax',
  kimi: 'Kimi',
  openclaw: 'OpenClaw',
  manual: 'Ручной',
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Не удалось загрузить Share Inbox'
}

function isShareInboxItem(value: unknown): value is ShareInboxItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ShareInboxItem>
  return (
    typeof item.id === 'string' &&
    typeof item.source === 'string' &&
    typeof item.title === 'string' &&
    typeof item.content === 'string' &&
    Array.isArray(item.tags) &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    isShareInboxStatus(item.status)
  )
}

function isShareInboxResponse(value: unknown): value is ShareInboxResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ShareInboxResponse>
  if (
    typeof candidate.generatedAt !== 'string' ||
    !candidate.counts ||
    !Array.isArray(candidate.items) ||
    typeof candidate.shareEndpoint !== 'string' ||
    typeof candidate.tokenEnabled !== 'boolean'
  ) {
    return false
  }

  return candidate.items.every((item) => isShareInboxItem(item))
}

function formatRelativeTime(iso?: string) {
  if (!iso) return 'нет даты'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'нет даты'

  const deltaSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (deltaSeconds < 30) return 'только что'
  if (deltaSeconds < 60) return `${deltaSeconds} сек назад`

  const deltaMinutes = Math.floor(deltaSeconds / 60)
  if (deltaMinutes < 60) return `${deltaMinutes} мин назад`

  const deltaHours = Math.floor(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours} ч назад`

  const deltaDays = Math.floor(deltaHours / 24)
  return `${deltaDays} д назад`
}

function sourceLabel(source: string) {
  const key = source.trim().toLowerCase()
  return SOURCE_LABELS[key] || source
}

function statusBadgeClass(status: ShareInboxStatus) {
  if (status === 'new') return 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300'
  if (status === 'in_progress') return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
}

export function ShareInboxView() {
  const { addLog, addChat, addMessage, setViewMode } = useAppStore()

  const [response, setResponse] = useState<ShareInboxResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchInbox = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      try {
        const url = new URL('/api/share/inbox', window.location.origin)
        if (statusFilter !== 'all') {
          url.searchParams.set('status', statusFilter)
        }

        const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error?: unknown }).error)
              : `HTTP ${res.status}`
          throw new Error(message)
        }

        if (!isShareInboxResponse(payload)) {
          throw new Error('Некорректный ответ Share Inbox API')
        }

        setResponse(payload)
      } catch (loadError) {
        const message = toErrorMessage(loadError)
        setError(message)
        addLog({ level: 'error', message: `Share Inbox: ${message}` })
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [addLog, statusFilter]
  )

  useEffect(() => {
    void fetchInbox(false)
  }, [fetchInbox])

  const endpointUrl = useMemo(() => {
    if (typeof window === 'undefined') return response?.shareEndpoint || '/api/share/inbox'
    const endpoint = response?.shareEndpoint || '/api/share/inbox'
    if (endpoint.startsWith('http')) return endpoint
    return `${window.location.origin}${endpoint}`
  }, [response?.shareEndpoint])

  const updateStatus = async (itemId: string, status: ShareInboxStatus) => {
    setBusyItemId(itemId)
    try {
      const res = await fetch('/api/share/inbox', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: itemId, status }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error?: unknown }).error)
            : `HTTP ${res.status}`
        throw new Error(message)
      }

      await fetchInbox(true)
    } catch (statusError) {
      const message = toErrorMessage(statusError)
      addLog({ level: 'error', message: `Share Inbox: ${message}` })
    } finally {
      setBusyItemId(null)
    }
  }

  const deleteItem = async (itemId: string) => {
    setBusyItemId(itemId)
    try {
      const res = await fetch(`/api/share/inbox?id=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error?: unknown }).error)
            : `HTTP ${res.status}`
        throw new Error(message)
      }

      addLog({ level: 'success', message: 'Share Inbox: элемент удалён' })
      await fetchInbox(true)
    } catch (removeError) {
      const message = toErrorMessage(removeError)
      addLog({ level: 'error', message: `Share Inbox: ${message}` })
    } finally {
      setBusyItemId(null)
    }
  }

  const moveToChat = async (item: ShareInboxItem) => {
    const chatId = `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const chatTitle = item.title.trim() || 'Share Inbox'
    const chat = {
      id: chatId,
      title: chatTitle.slice(0, 40) + (chatTitle.length > 40 ? '...' : ''),
      messages: [] as Message[],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const lines = [
      `Источник: ${sourceLabel(item.source)}`,
      item.author ? `Автор: ${item.author}` : '',
      item.url ? `Ссылка: ${item.url}` : '',
      item.tags.length > 0 ? `Теги: ${item.tags.join(', ')}` : '',
      '',
      item.content,
    ].filter(Boolean)

    addChat(chat)
    addMessage(chat.id, {
      id: `share-msg-${Math.random().toString(36).slice(2, 10)}`,
      role: 'user',
      content: lines.join('\n'),
      timestamp: new Date(),
    })
    setViewMode('chat')
    addLog({ level: 'info', message: `Share Inbox: перенесено в чат "${chat.title}"` })

    if (item.status === 'new') {
      await updateStatus(item.id, 'in_progress')
    }
  }

  const counts = response?.counts || { all: 0, new: 0, in_progress: 0, done: 0 }
  const items = response?.items || []

  return (
    <div className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
            Share Inbox
          </div>
          <h1 className="text-2xl font-semibold">Общий инбокс</h1>
          <p className="mt-1 text-muted-foreground">
            Сюда складываются материалы из ChatGPT/Claude/Gemini и внешних интеграций.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {response ? `Обновлено ${formatRelativeTime(response.generatedAt)}` : 'Данные не загружены'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchInbox(true)}
          disabled={isLoading || isRefreshing}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
            isLoading || isRefreshing
              ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
              : 'border-indigo-300/70 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700/60 dark:text-indigo-300 dark:hover:bg-indigo-900/20'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', (isLoading || isRefreshing) && 'animate-spin')} />
          Обновить
        </button>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-4 overflow-hidden rounded-xl border border-border bg-card p-4 dark:bg-zinc-900/50"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500/70 via-cyan-500/35 to-transparent" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300/60 px-2 py-1 dark:border-zinc-700">
            <Inbox className="h-3.5 w-3.5" />
            endpoint
          </span>
          <code className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {endpointUrl}
          </code>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300/70 px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => {
              void navigator.clipboard.writeText(endpointUrl)
            }}
          >
            <Clipboard className="h-3.5 w-3.5" />
            Копировать URL
          </button>
          <span
            className={cn(
              'rounded-full border px-2 py-1 text-[11px]',
              response?.tokenEnabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
            )}
          >
            {response?.tokenEnabled ? 'token включен' : 'token не задан'}
          </span>
        </div>
      </motion.section>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              statusFilter === status
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-zinc-300/60 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            )}
          >
            {STATUS_LABELS[status]} ({counts[status] || 0})
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-xl border border-border bg-card dark:bg-zinc-900/50"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center dark:bg-zinc-900/20">
            <Inbox className="mb-3 h-8 w-8 text-muted-foreground/70" />
            <p className="text-sm text-muted-foreground">Пока пусто. Отправьте первый share в endpoint выше.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const busy = busyItemId === item.id
              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-xl border border-border bg-card p-4 dark:bg-zinc-900/50"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/60 via-indigo-500/30 to-transparent" />
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-zinc-300/70 px-2 py-0.5 dark:border-zinc-700">
                          {sourceLabel(item.source)}
                        </span>
                        {item.author && (
                          <span className="inline-flex items-center gap-1">
                            <UserCircle2 className="h-3.5 w-3.5" />
                            {item.author}
                          </span>
                        )}
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                    <span className={cn('rounded-full border px-2 py-1 text-[11px] font-medium', statusBadgeClass(item.status))}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.content}</p>

                  {(item.tags.length > 0 || item.url) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.tags.map((tag) => (
                        <span
                          key={`${item.id}-${tag}`}
                          className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-700 dark:text-cyan-300"
                        >
                          #{tag}
                        </span>
                      ))}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-300/70 px-2 py-0.5 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          открыть ссылку
                        </a>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void moveToChat(item)}
                      disabled={busy}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        busy
                          ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
                          : 'border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
                      )}
                    >
                      <Send className="h-3.5 w-3.5" />
                      В чат
                    </button>
                    {item.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => void updateStatus(item.id, item.status === 'new' ? 'in_progress' : 'done')}
                        disabled={busy}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                          busy
                            ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {item.status === 'new' ? 'В работу' : 'Отметить готовым'}
                      </button>
                    )}
                    {item.status === 'done' && (
                      <button
                        type="button"
                        onClick={() => void updateStatus(item.id, 'new')}
                        disabled={busy}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                          busy
                            ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                        )}
                      >
                        Снова в новые
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteItem(item.id)}
                      disabled={busy}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        busy
                          ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
                          : 'border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300'
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить
                    </button>
                  </div>
                </motion.article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
