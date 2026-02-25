'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Inbox,
  Mail,
  Send,
  Twitter,
  Users,
  RefreshCw,
  Watch,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ServiceId = 'gmail' | 'telegram' | 'x' | 'fitbit'
type ServiceStatus = 'connected' | 'disconnected' | 'error'

interface ServiceSummary {
  id: ServiceId
  name: string
  status: ServiceStatus
  detail?: string
  lastSync?: string
}

interface ActivityItem {
  source: ServiceId
  title: string
  time: string
}

interface DashboardSummary {
  generatedAt: string
  metrics: {
    gmailUnread: number | null
    gmailTotal: number | null
    telegramSubscribers: number | null
    xFollowers: number | null
    xTweets: number | null
    fitbitSteps: number | null
    fitbitSleepMinutes: number | null
    fitbitRestingHeartRate: number | null
  }
  services: ServiceSummary[]
  activities: ActivityItem[]
}

function formatMetric(value: number | null | undefined) {
  if (typeof value !== 'number') return '—'
  return value.toLocaleString('ru-RU')
}

function formatRelativeTime(iso?: string) {
  if (!iso) return 'нет данных'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'нет данных'
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

function asErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Не удалось загрузить данные дашборда'
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DashboardSummary>
  return (
    typeof candidate.generatedAt === 'string' &&
    Boolean(candidate.metrics) &&
    Array.isArray(candidate.services) &&
    Array.isArray(candidate.activities)
  )
}

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  loading?: boolean
  accentClassName?: string
  glowClassName?: string
  iconClassName?: string
  iconColorClassName?: string
  className?: string
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading = false,
  accentClassName,
  glowClassName,
  iconClassName,
  iconColorClassName,
  className,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card p-5 dark:bg-zinc-900/50',
        'hover:border-zinc-300 dark:hover:border-zinc-700',
        'transition-colors duration-150',
        className
      )}
    >
      {accentClassName && (
        <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r', accentClassName)} />
      )}
      {glowClassName && (
        <div className={cn('pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl opacity-20', glowClassName)} />
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('rounded-lg p-2 bg-zinc-100 dark:bg-zinc-800', iconClassName)}>
          <Icon className={cn('h-5 w-5 text-muted-foreground', iconColorClassName)} />
        </div>
      </div>
    </motion.div>
  )
}

interface ServiceCardProps {
  name: string
  status: ServiceStatus
  detail?: string
  lastSync?: string
  icon: React.ElementType
  color: string
  className?: string
}

function ServiceCard({ name, status, detail, lastSync, icon: Icon, color, className }: ServiceCardProps) {
  const statusDotClass =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'error'
        ? 'bg-amber-500'
        : 'bg-zinc-300 dark:bg-zinc-600'

  const statusText =
    status === 'connected'
      ? detail || 'Подключено'
      : status === 'error'
        ? detail || 'Ошибка подключения'
        : detail || 'Не подключено'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-5 rounded-xl border border-border bg-card dark:bg-zinc-900/50',
        'hover:border-zinc-300 dark:hover:border-zinc-700',
        'transition-colors duration-150 cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl', color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{statusText}</p>
            {status === 'connected' && lastSync && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Синхр.: {formatRelativeTime(lastSync)}
              </p>
            )}
          </div>
        </div>
        <div className={cn('h-2 w-2 rounded-full', statusDotClass)} />
      </div>
    </motion.div>
  )
}

const FALLBACK_SERVICES: Record<ServiceId, ServiceSummary> = {
  gmail: { id: 'gmail', name: 'Gmail', status: 'disconnected', detail: 'Не подключено' },
  telegram: { id: 'telegram', name: 'Telegram', status: 'disconnected', detail: 'Не подключено' },
  x: { id: 'x', name: 'X (Twitter)', status: 'disconnected', detail: 'Не подключено' },
  fitbit: { id: 'fitbit', name: 'Fitbit', status: 'disconnected', detail: 'Не подключено' },
}

const SERVICE_ORDER: ServiceId[] = ['gmail', 'telegram', 'x', 'fitbit']
const SERVICE_COLORS: Record<ServiceId, string> = {
  gmail: 'bg-red-500',
  telegram: 'bg-blue-500',
  x: 'bg-zinc-700',
  fitbit: 'bg-emerald-500',
}

const SOURCE_ICONS: Record<ServiceId, React.ElementType> = {
  gmail: Mail,
  telegram: Send,
  x: Twitter,
  fitbit: Watch,
}

const SOURCE_ICON_COLORS: Record<ServiceId, string> = {
  gmail: 'text-red-500',
  telegram: 'text-blue-500',
  x: 'text-zinc-500',
  fitbit: 'text-emerald-500',
}

export function DashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/dashboard/summary', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await res.json().catch(() => null)

        if (!res.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error?: unknown }).error)
              : `HTTP ${res.status}`
          throw new Error(message)
        }

        if (!isDashboardSummary(payload)) {
          throw new Error('Некорректный ответ сервера')
        }

        if (active) {
          setSummary(payload)
        }
      } catch (loadError) {
        if (controller.signal.aborted) return
        if (active) {
          setError(asErrorMessage(loadError))
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [refreshKey])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshKey((value) => value + 1)
    }, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const servicesById = useMemo(() => {
    const map: Partial<Record<ServiceId, ServiceSummary>> = {}
    for (const service of summary?.services ?? []) {
      map[service.id] = service
    }
    return map
  }, [summary?.services])

  const activityItems = summary?.activities ?? []
  const metrics = summary?.metrics

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1)
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-600 dark:text-sky-300">
            Live widgets
          </div>
          <h1 className="text-2xl font-semibold">Дашборд</h1>
          <p className="mt-1 text-muted-foreground">Обзор подключённых сервисов и активности</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary ? `Обновлено ${formatRelativeTime(summary.generatedAt)}` : 'Данные не загружены'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
            isLoading
              ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
              : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Письма (Inbox)"
          value={formatMetric(metrics?.gmailTotal)}
          subtitle={
            typeof metrics?.gmailUnread === 'number'
              ? `${metrics.gmailUnread.toLocaleString('ru-RU')} непрочитанных`
              : 'Нет данных'
          }
          icon={Mail}
          loading={isLoading && !summary}
          accentClassName="from-red-500/70 via-rose-500/40 to-transparent"
          glowClassName="bg-red-500"
          iconClassName="bg-red-500/10 dark:bg-red-500/15"
          iconColorClassName="text-red-500"
        />
        <MetricCard
          title="Непрочитанные"
          value={formatMetric(metrics?.gmailUnread)}
          subtitle="Gmail"
          icon={Inbox}
          loading={isLoading && !summary}
          accentClassName="from-orange-500/70 via-amber-500/40 to-transparent"
          glowClassName="bg-orange-500"
          iconClassName="bg-orange-500/10 dark:bg-orange-500/15"
          iconColorClassName="text-orange-500"
        />
        <MetricCard
          title="Подписчики Telegram"
          value={formatMetric(metrics?.telegramSubscribers)}
          subtitle="Сумма по каналам"
          icon={Users}
          loading={isLoading && !summary}
          accentClassName="from-blue-500/70 via-cyan-500/40 to-transparent"
          glowClassName="bg-blue-500"
          iconClassName="bg-blue-500/10 dark:bg-blue-500/15"
          iconColorClassName="text-blue-500"
        />
        <MetricCard
          title="Подписчики X"
          value={formatMetric(metrics?.xFollowers)}
          subtitle={
            typeof metrics?.xTweets === 'number'
              ? `${metrics.xTweets.toLocaleString('ru-RU')} постов`
              : 'Нет данных'
          }
          icon={Twitter}
          loading={isLoading && !summary}
          accentClassName="from-zinc-500/70 via-zinc-400/40 to-transparent"
          glowClassName="bg-zinc-500"
          iconClassName="bg-zinc-500/10 dark:bg-zinc-500/15"
          iconColorClassName="text-zinc-500"
        />
        <MetricCard
          title="Шаги Fitbit"
          value={formatMetric(metrics?.fitbitSteps)}
          subtitle={
            typeof metrics?.fitbitSleepMinutes === 'number'
              ? `Сон ${(metrics.fitbitSleepMinutes / 60).toFixed(1)} ч`
              : 'Нет данных по сну'
          }
          icon={Watch}
          loading={isLoading && !summary}
          accentClassName="from-emerald-500/70 via-teal-500/40 to-transparent"
          glowClassName="bg-emerald-500"
          iconClassName="bg-emerald-500/10 dark:bg-emerald-500/15"
          iconColorClassName="text-emerald-500"
        />
        <MetricCard
          title="Пульс покоя"
          value={
            typeof metrics?.fitbitRestingHeartRate === 'number'
              ? `${metrics.fitbitRestingHeartRate.toLocaleString('ru-RU')} bpm`
              : '—'
          }
          subtitle="Fitbit за сегодня"
          icon={Heart}
          loading={isLoading && !summary}
          accentClassName="from-fuchsia-500/70 via-pink-500/40 to-transparent"
          glowClassName="bg-fuchsia-500"
          iconClassName="bg-fuchsia-500/10 dark:bg-fuchsia-500/15"
          iconColorClassName="text-fuchsia-500"
        />
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Подключённые сервисы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERVICE_ORDER.map((serviceId) => {
            const service = servicesById[serviceId] || FALLBACK_SERVICES[serviceId]
            const Icon = SOURCE_ICONS[serviceId]
            const colorClass = service.status === 'disconnected' ? 'bg-zinc-500' : SERVICE_COLORS[serviceId]
            return (
              <ServiceCard
                key={serviceId}
                name={service.name}
                status={service.status}
                detail={service.detail}
                lastSync={service.lastSync}
                icon={Icon}
                color={colorClass}
              />
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Последняя активность</h2>
        <div className="rounded-xl border border-border bg-card dark:bg-zinc-900/50 divide-y divide-border">
          {activityItems.length > 0 ? activityItems.map((item, index) => {
            const Icon = SOURCE_ICONS[item.source]
            return (
            <motion.div
              key={`${item.source}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-4"
            >
              <Icon className={cn('h-4 w-4', SOURCE_ICON_COLORS[item.source])} />
              <span className="flex-1 text-sm">{item.title}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(item.time)}</span>
            </motion.div>
            )
          }) : (
            <div className="p-4 text-sm text-muted-foreground">
              {isLoading ? 'Загружаю активность...' : 'Пока нет данных по последней активности'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
