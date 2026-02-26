import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest } from '@/lib/auth'

type ServiceStatus = 'connected' | 'disconnected' | 'error'

interface ServiceSummary {
  id: 'gmail' | 'telegram' | 'x' | 'fitbit'
  name: string
  status: ServiceStatus
  detail?: string
  lastSync?: string
}

interface ActivityItem {
  source: 'gmail' | 'telegram' | 'x' | 'fitbit'
  title: string
  time: string
}

interface DashboardSummaryResponse {
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
  fitbit: FitbitInsights
  services: ServiceSummary[]
  activities: ActivityItem[]
}

interface FitbitTrendDay {
  date: string
  steps: number | null
}

interface FitbitInsights {
  goalSteps: number | null
  goalSleepMinutes: number | null
  progressStepsPct: number | null
  progressSleepPct: number | null
  weeklySteps: FitbitTrendDay[]
  weeklyAverageSteps: number | null
  weeklyBestSteps: number | null
  weeklyGoalDays: number | null
}

interface GmailLoadResult {
  service: ServiceSummary & { id: 'gmail' }
  metrics: {
    unread: number | null
    total: number | null
  }
  activities: ActivityItem[]
}

interface TelegramLoadResult {
  service: ServiceSummary & { id: 'telegram' }
  metrics: {
    subscribers: number | null
  }
  activities: ActivityItem[]
}

interface XLoadResult {
  service: ServiceSummary & { id: 'x' }
  metrics: {
    followers: number | null
    tweets: number | null
  }
  activities: ActivityItem[]
}

interface FitbitLoadResult {
  service: ServiceSummary & { id: 'fitbit' }
  metrics: {
    steps: number | null
    sleepMinutes: number | null
    restingHeartRate: number | null
  }
  insights: FitbitInsights
  activities: ActivityItem[]
}

interface FitbitStepsResponse {
  'activities-steps'?: Array<{ dateTime?: string; value?: string }>
}

interface FitbitGoalsResponse {
  goals?: {
    steps?: number | string
    sleep?: number | string
  }
}

interface FitbitHeartResponse {
  'activities-heart'?: Array<{ value?: { restingHeartRate?: number } }>
}

interface FitbitSleepResponse {
  summary?: { totalMinutesAsleep?: number }
  sleep?: Array<{ duration?: number }>
}

const REQUEST_TIMEOUT_MS = Number(process.env.DASHBOARD_REQUEST_TIMEOUT_MS || 8000)
const FITBIT_SLEEP_GOAL_MINUTES = readOptionalIntEnv('FITBIT_SLEEP_GOAL_MINUTES', 120, 900)

function toIsoTime(value?: string) {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readOptionalIntEnv(name: string, min: number, max: number): number | null {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return null
  return Math.min(max, Math.max(min, Math.floor(raw)))
}

function toPercent(current: number | null, goal: number | null) {
  if (current === null || goal === null || goal <= 0) return null
  return Math.round((current / goal) * 100)
}

function toLocalizedDate(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (year && month && day) {
      return `${year}-${month}-${day}`
    }
  } catch {
    // ignore invalid timezone
  }

  return date.toISOString().slice(0, 10)
}

function getDateInTimeZone(timeZone: string) {
  return toLocalizedDate(new Date(), timeZone)
}

function getRecentDatesInTimeZone(timeZone: string, days: number) {
  const now = new Date()
  const dates: string[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - offset)
    dates.push(toLocalizedDate(date, timeZone))
  }

  return dates
}

function emptyFitbitInsights(overrides?: Partial<FitbitInsights>): FitbitInsights {
  return {
    goalSteps: null,
    goalSleepMinutes: FITBIT_SLEEP_GOAL_MINUTES,
    progressStepsPct: null,
    progressSleepPct: null,
    weeklySteps: [],
    weeklyAverageSteps: null,
    weeklyBestSteps: null,
    weeklyGoalDays: null,
    ...overrides,
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    const raw = await res.text()
    const data = (() => {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })()

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && 'error' in data && typeof data.error === 'object'
          ? (data.error as { message?: string }).message
          : null) ||
        (data &&
        typeof data === 'object' &&
        'errors' in data &&
        Array.isArray((data as { errors?: unknown }).errors) &&
        (data as { errors: Array<{ message?: string }> }).errors[0]?.message
          ? String((data as { errors: Array<{ message?: string }> }).errors[0]?.message)
          : null) ||
        (data && typeof data === 'object' && 'description' in data
          ? String((data as { description?: unknown }).description)
          : null) ||
        `HTTP ${res.status}`
      throw new Error(message)
    }

    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

async function loadGmail(): Promise<GmailLoadResult> {
  const token = process.env.GMAIL_ACCESS_TOKEN
  const userId = process.env.GMAIL_USER_ID || 'me'

  if (!token) {
    return {
      service: {
        id: 'gmail',
        name: 'Gmail',
        status: 'disconnected' as const,
        detail: 'Не настроен GMAIL_ACCESS_TOKEN',
      },
      metrics: { unread: null as number | null, total: null as number | null },
      activities: [] as ActivityItem[],
    }
  }

  try {
    const headers = { authorization: `Bearer ${token}` }
    const labels = await fetchJson<{
      labels?: Array<{ id?: string; name?: string; messagesUnread?: number; messagesTotal?: number }>
    }>(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userId)}/labels`, { headers })

    const inbox = (labels.labels || []).find((label) => label.id === 'INBOX' || label.name === 'INBOX')
    const unread = typeof inbox?.messagesUnread === 'number' ? inbox.messagesUnread : null
    const total = typeof inbox?.messagesTotal === 'number' ? inbox.messagesTotal : null

    const list = await fetchJson<{ messages?: Array<{ id: string }> }>(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userId)}/messages?maxResults=1&q=in:inbox`,
      { headers }
    )

    const activities: ActivityItem[] = []
    if (list.messages?.[0]?.id) {
      const message = await fetchJson<{
        internalDate?: string
        payload?: { headers?: Array<{ name?: string; value?: string }> }
      }>(
        `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userId)}/messages/${list.messages[0].id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers }
      )

      const subject =
        message.payload?.headers?.find((header) => header.name?.toLowerCase() === 'subject')?.value ||
        'Новое письмо'
      activities.push({
        source: 'gmail',
        title: `Gmail: ${subject}`,
        time: toIsoTime(message.internalDate ? new Date(Number(message.internalDate)).toISOString() : undefined),
      })
    }

    return {
      service: {
        id: 'gmail',
        name: 'Gmail',
        status: 'connected' as const,
        detail: unread !== null ? `${unread} непрочитанных` : 'Подключено',
        lastSync: new Date().toISOString(),
      },
      metrics: { unread, total },
      activities,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Ошибка Gmail API'
    return {
      service: { id: 'gmail', name: 'Gmail', status: 'error' as const, detail },
      metrics: { unread: null as number | null, total: null as number | null },
      activities: [] as ActivityItem[],
    }
  }
}

async function loadTelegram(): Promise<TelegramLoadResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const channelIds = (process.env.TELEGRAM_CHANNEL_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (!token || channelIds.length === 0) {
    return {
      service: {
        id: 'telegram',
        name: 'Telegram',
        status: 'disconnected' as const,
        detail: 'Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_IDS',
      },
      metrics: { subscribers: null as number | null },
      activities: [] as ActivityItem[],
    }
  }

  try {
    const base = `https://api.telegram.org/bot${token}`
    const counts = await Promise.allSettled(
      channelIds.map(async (chatId) => {
        const [countRes, chatRes] = await Promise.all([
          fetchJson<{ ok: boolean; result?: number }>(
            `${base}/getChatMemberCount?chat_id=${encodeURIComponent(chatId)}`
          ),
          fetchJson<{ ok: boolean; result?: { title?: string } }>(
            `${base}/getChat?chat_id=${encodeURIComponent(chatId)}`
          ),
        ])
        return {
          chatId,
          title: chatRes.result?.title || chatId,
          count: typeof countRes.result === 'number' ? countRes.result : 0,
        }
      })
    )

    const success = counts
      .filter((item): item is PromiseFulfilledResult<{ chatId: string; title: string; count: number }> => item.status === 'fulfilled')
      .map((item) => item.value)

    if (success.length === 0) {
      throw new Error('Не удалось получить данные по каналам')
    }

    const subscribers = success.reduce((sum, item) => sum + item.count, 0)
    const activities = success.slice(0, 3).map((item) => ({
      source: 'telegram' as const,
      title: `${item.title}: ${item.count.toLocaleString('ru-RU')} подписчиков`,
      time: new Date().toISOString(),
    }))

    return {
      service: {
        id: 'telegram',
        name: 'Telegram',
        status: 'connected' as const,
        detail: `${success.length} канал(ов)`,
        lastSync: new Date().toISOString(),
      },
      metrics: { subscribers },
      activities,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Ошибка Telegram API'
    return {
      service: { id: 'telegram', name: 'Telegram', status: 'error' as const, detail },
      metrics: { subscribers: null as number | null },
      activities: [] as ActivityItem[],
    }
  }
}

async function loadX(): Promise<XLoadResult> {
  const bearer = process.env.X_BEARER_TOKEN
  const username = process.env.X_USERNAME

  if (!bearer || !username) {
    return {
      service: {
        id: 'x',
        name: 'X (Twitter)',
        status: 'disconnected' as const,
        detail: 'Нужны X_BEARER_TOKEN и X_USERNAME',
      },
      metrics: { followers: null as number | null, tweets: null as number | null },
      activities: [] as ActivityItem[],
    }
  }

  try {
    const headers = { authorization: `Bearer ${bearer}` }
    const user = await fetchJson<{
      data?: { id?: string; public_metrics?: { followers_count?: number; tweet_count?: number } }
    }>(`https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics`, {
      headers,
    })

    const userId = user.data?.id
    const followers = user.data?.public_metrics?.followers_count ?? null
    const tweets = user.data?.public_metrics?.tweet_count ?? null
    const activities: ActivityItem[] = []

    if (userId) {
      const timeline = await fetchJson<{
        data?: Array<{ text?: string; created_at?: string }>
      }>(`https://api.twitter.com/2/users/${encodeURIComponent(userId)}/tweets?max_results=1&tweet.fields=created_at`, {
        headers,
      })

      if (timeline.data?.[0]?.text) {
        const title = timeline.data[0].text.replace(/\s+/g, ' ').slice(0, 110)
        activities.push({
          source: 'x',
          title: `X: ${title}${timeline.data[0].text.length > 110 ? '…' : ''}`,
          time: toIsoTime(timeline.data[0].created_at),
        })
      }
    }

    return {
      service: {
        id: 'x',
        name: 'X (Twitter)',
        status: 'connected' as const,
        detail: `@${username}`,
        lastSync: new Date().toISOString(),
      },
      metrics: { followers, tweets },
      activities,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Ошибка X API'
    return {
      service: { id: 'x', name: 'X (Twitter)', status: 'error' as const, detail },
      metrics: { followers: null as number | null, tweets: null as number | null },
      activities: [] as ActivityItem[],
    }
  }
}

async function loadFitbit(): Promise<FitbitLoadResult> {
  const token = process.env.FITBIT_ACCESS_TOKEN
  const userId = process.env.FITBIT_USER_ID || '-'
  const timeZone = process.env.FITBIT_TIMEZONE || 'UTC'
  const weekDates = getRecentDatesInTimeZone(timeZone, 7)
  const fallbackWeeklySteps = weekDates.map((day) => ({ date: day, steps: null as number | null }))
  const fallbackInsights = emptyFitbitInsights({ weeklySteps: fallbackWeeklySteps })

  if (!token) {
    return {
      service: {
        id: 'fitbit',
        name: 'Fitbit',
        status: 'disconnected' as const,
        detail: 'Нужен FITBIT_ACCESS_TOKEN',
      },
      metrics: {
        steps: null as number | null,
        sleepMinutes: null as number | null,
        restingHeartRate: null as number | null,
      },
      insights: fallbackInsights,
      activities: [] as ActivityItem[],
    }
  }

  const date = weekDates[weekDates.length - 1] || getDateInTimeZone(timeZone)
  const weekStartDate = weekDates[0] || date
  const encodedUserId = encodeURIComponent(userId)
  const headers = { authorization: `Bearer ${token}` }

  const [stepsResult, sleepResult, heartResult, goalsResult, weeklyStepsResult] = await Promise.allSettled([
    fetchJson<FitbitStepsResponse>(
      `https://api.fitbit.com/1/user/${encodedUserId}/activities/steps/date/${date}/${date}.json`,
      { headers }
    ),
    fetchJson<FitbitSleepResponse>(
      `https://api.fitbit.com/1.2/user/${encodedUserId}/sleep/date/${date}.json`,
      { headers }
    ),
    fetchJson<FitbitHeartResponse>(
      `https://api.fitbit.com/1/user/${encodedUserId}/activities/heart/date/${date}/${date}.json`,
      { headers }
    ),
    fetchJson<FitbitGoalsResponse>(
      `https://api.fitbit.com/1/user/${encodedUserId}/activities/goals/daily.json`,
      { headers }
    ),
    fetchJson<FitbitStepsResponse>(
      `https://api.fitbit.com/1/user/${encodedUserId}/activities/steps/date/${weekStartDate}/${date}.json`,
      { headers }
    ),
  ])

  const errors: string[] = []
  let steps: number | null = null
  let sleepMinutes: number | null = null
  let restingHeartRate: number | null = null
  let goalSteps: number | null = null
  let goalSleepMinutes: number | null = FITBIT_SLEEP_GOAL_MINUTES
  let weeklySteps = fallbackWeeklySteps

  if (stepsResult.status === 'fulfilled') {
    steps = toNumber(stepsResult.value['activities-steps']?.[0]?.value)
  } else {
    errors.push(stepsResult.reason instanceof Error ? stepsResult.reason.message : 'steps')
  }

  if (sleepResult.status === 'fulfilled') {
    sleepMinutes = toNumber(sleepResult.value.summary?.totalMinutesAsleep)
    if (sleepMinutes === null) {
      const durationMs = toNumber(sleepResult.value.sleep?.[0]?.duration)
      sleepMinutes = durationMs !== null ? Math.round(durationMs / 60000) : null
    }
  } else {
    errors.push(sleepResult.reason instanceof Error ? sleepResult.reason.message : 'sleep')
  }

  if (heartResult.status === 'fulfilled') {
    restingHeartRate = toNumber(heartResult.value['activities-heart']?.[0]?.value?.restingHeartRate)
  } else {
    errors.push(heartResult.reason instanceof Error ? heartResult.reason.message : 'heart')
  }

  if (goalsResult.status === 'fulfilled') {
    goalSteps = toNumber(goalsResult.value.goals?.steps)
    if (goalSleepMinutes === null) {
      goalSleepMinutes = toNumber(goalsResult.value.goals?.sleep)
    }
  } else {
    errors.push(goalsResult.reason instanceof Error ? goalsResult.reason.message : 'goals')
  }

  if (weeklyStepsResult.status === 'fulfilled') {
    const byDate = new Map<string, number | null>()
    for (const item of weeklyStepsResult.value['activities-steps'] || []) {
      if (typeof item.dateTime !== 'string') continue
      byDate.set(item.dateTime, toNumber(item.value))
    }
    weeklySteps = weekDates.map((day) => ({
      date: day,
      steps: byDate.has(day) ? byDate.get(day) ?? null : null,
    }))
  } else {
    errors.push(weeklyStepsResult.reason instanceof Error ? weeklyStepsResult.reason.message : 'weekly-steps')
  }

  if (weeklySteps.length > 0 && typeof steps === 'number') {
    const lastIndex = weeklySteps.length - 1
    if (weeklySteps[lastIndex].steps === null) {
      weeklySteps[lastIndex] = { ...weeklySteps[lastIndex], steps }
    }
  }

  const weeklyNumericSteps = weeklySteps
    .map((day) => day.steps)
    .filter((value): value is number => typeof value === 'number')
  const weeklyAverageSteps =
    weeklyNumericSteps.length > 0
      ? Math.round(weeklyNumericSteps.reduce((sum, value) => sum + value, 0) / weeklyNumericSteps.length)
      : null
  const weeklyBestSteps = weeklyNumericSteps.length > 0 ? Math.max(...weeklyNumericSteps) : null
  const weeklyGoalDays =
    goalSteps !== null
      ? weeklyNumericSteps.filter((value) => value >= goalSteps).length
      : null

  const progressStepsPct = toPercent(steps, goalSteps)
  const progressSleepPct = toPercent(sleepMinutes, goalSleepMinutes)

  const insights: FitbitInsights = {
    goalSteps,
    goalSleepMinutes,
    progressStepsPct,
    progressSleepPct,
    weeklySteps,
    weeklyAverageSteps,
    weeklyBestSteps,
    weeklyGoalDays,
  }

  const availableMetrics = [steps, sleepMinutes, restingHeartRate].filter(
    (value): value is number => typeof value === 'number'
  )

  const activities: ActivityItem[] = []
  if (steps !== null) {
    activities.push({
      source: 'fitbit',
      title: `Fitbit: ${steps.toLocaleString('ru-RU')} шагов`,
      time: new Date().toISOString(),
    })
  }
  if (sleepMinutes !== null) {
    activities.push({
      source: 'fitbit',
      title: `Fitbit: сон ${(sleepMinutes / 60).toFixed(1)} ч`,
      time: new Date().toISOString(),
    })
  }
  if (restingHeartRate !== null) {
    activities.push({
      source: 'fitbit',
      title: `Fitbit: пульс покоя ${restingHeartRate} bpm`,
      time: new Date().toISOString(),
    })
  }
  if (weeklyAverageSteps !== null) {
    activities.push({
      source: 'fitbit',
      title: `Fitbit: среднее за 7 дн ${weeklyAverageSteps.toLocaleString('ru-RU')} шагов`,
      time: new Date().toISOString(),
    })
  }

  if (availableMetrics.length === 0 && errors.length > 0) {
    return {
      service: {
        id: 'fitbit',
        name: 'Fitbit',
        status: 'error' as const,
        detail: errors[0],
      },
      metrics: { steps, sleepMinutes, restingHeartRate },
      insights,
      activities,
    }
  }

  const detailParts: string[] = []
  if (steps !== null) detailParts.push(`${steps.toLocaleString('ru-RU')} шагов`)
  if (progressStepsPct !== null) detailParts.push(`цель ${progressStepsPct}%`)
  if (sleepMinutes !== null) detailParts.push(`${(sleepMinutes / 60).toFixed(1)} ч сна`)
  if (restingHeartRate !== null) detailParts.push(`${restingHeartRate} bpm`)
  if (errors.length > 0) detailParts.push('частично')

  return {
    service: {
      id: 'fitbit',
      name: 'Fitbit',
      status: 'connected' as const,
      detail: detailParts.join(' • ') || 'Подключено',
      lastSync: new Date().toISOString(),
    },
    metrics: { steps, sleepMinutes, restingHeartRate },
    insights,
    activities,
  }
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  const [gmail, telegram, x, fitbit] = await Promise.all([
    loadGmail(),
    loadTelegram(),
    loadX(),
    loadFitbit(),
  ])

  const response: DashboardSummaryResponse = {
    generatedAt: new Date().toISOString(),
    metrics: {
      gmailUnread: gmail.metrics.unread,
      gmailTotal: gmail.metrics.total,
      telegramSubscribers: telegram.metrics.subscribers,
      xFollowers: x.metrics.followers,
      xTweets: x.metrics.tweets,
      fitbitSteps: fitbit.metrics.steps,
      fitbitSleepMinutes: fitbit.metrics.sleepMinutes,
      fitbitRestingHeartRate: fitbit.metrics.restingHeartRate,
    },
    fitbit: fitbit.insights,
    services: [gmail.service, telegram.service, x.service, fitbit.service],
    activities: [...gmail.activities, ...telegram.activities, ...x.activities, ...fitbit.activities]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8),
  }

  return NextResponse.json(response, {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
