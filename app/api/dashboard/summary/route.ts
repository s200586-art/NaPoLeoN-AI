import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest } from '@/lib/auth'

type ServiceStatus = 'connected' | 'disconnected' | 'error'

interface ServiceSummary {
  id: 'gmail' | 'telegram' | 'x'
  name: string
  status: ServiceStatus
  detail?: string
  lastSync?: string
}

interface ActivityItem {
  source: 'gmail' | 'telegram' | 'x'
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
  }
  services: ServiceSummary[]
  activities: ActivityItem[]
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

const REQUEST_TIMEOUT_MS = Number(process.env.DASHBOARD_REQUEST_TIMEOUT_MS || 8000)

function toIsoTime(value?: string) {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
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

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  const [gmail, telegram, x] = await Promise.all([loadGmail(), loadTelegram(), loadX()])

  const response: DashboardSummaryResponse = {
    generatedAt: new Date().toISOString(),
    metrics: {
      gmailUnread: gmail.metrics.unread,
      gmailTotal: gmail.metrics.total,
      telegramSubscribers: telegram.metrics.subscribers,
      xFollowers: x.metrics.followers,
      xTweets: x.metrics.tweets,
    },
    services: [gmail.service, telegram.service, x.service],
    activities: [...gmail.activities, ...telegram.activities, ...x.activities]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8),
  }

  return NextResponse.json(response, {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
