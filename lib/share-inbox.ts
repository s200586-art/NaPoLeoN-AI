export const SHARE_INBOX_STATUSES = ['new', 'in_progress', 'done'] as const

export type ShareInboxStatus = (typeof SHARE_INBOX_STATUSES)[number]
export const SHARE_HISTORY_TYPES = [
  'created',
  'status_changed',
  'moved_to_chat',
  'exported_to_project',
  'note',
] as const
export type ShareInboxHistoryType = (typeof SHARE_HISTORY_TYPES)[number]

export interface ShareInboxHistoryEntry {
  id: string
  type: ShareInboxHistoryType
  at: string
  note?: string
  fromStatus?: ShareInboxStatus
  toStatus?: ShareInboxStatus
}

export interface ShareInboxItem {
  id: string
  source: string
  title: string
  content: string
  url?: string
  author?: string
  tags: string[]
  status: ShareInboxStatus
  history: ShareInboxHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface CreateShareInboxItemInput {
  source: string
  title?: string
  content: string
  url?: string
  author?: string
  tags?: string[]
}

export interface UpdateShareInboxItemInput {
  source?: string
  title?: string
  content?: string
  url?: string
  author?: string
  tags?: string[]
  status?: ShareInboxStatus
  historyEntry?: {
    type: ShareInboxHistoryType
    note?: string
    fromStatus?: ShareInboxStatus
    toStatus?: ShareInboxStatus
  }
}

const SOURCE_ALIASES: Record<string, string> = {
  gpt: 'chatgpt',
  'chat-gpt': 'chatgpt',
  'gpt-4': 'chatgpt',
  'gpt4': 'chatgpt',
  openai: 'chatgpt',
  chatgpt: 'chatgpt',
  claudeai: 'claude',
  'claude.ai': 'claude',
  anthropic: 'claude',
  claude: 'claude',
  bard: 'gemini',
  'google-gemini': 'gemini',
  google: 'gemini',
  gemini: 'gemini',
  moonshot: 'kimi',
  moonshotai: 'kimi',
  kimi: 'kimi',
  minimaxai: 'minimax',
  minimax: 'minimax',
}

export function isShareInboxStatus(value: unknown): value is ShareInboxStatus {
  return typeof value === 'string' && SHARE_INBOX_STATUSES.includes(value as ShareInboxStatus)
}

export function isShareHistoryType(value: unknown): value is ShareInboxHistoryType {
  return typeof value === 'string' && SHARE_HISTORY_TYPES.includes(value as ShareInboxHistoryType)
}

export function normalizeShareSource(value: unknown): string {
  if (typeof value !== 'string') return 'manual'
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'manual'
  return SOURCE_ALIASES[normalized] || normalized
}

export function normalizeShareTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 8)
}

export function mergeShareTags(...groups: Array<string[] | undefined>) {
  const merged: string[] = []
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    merged.push(...group)
  }
  return normalizeShareTags(merged)
}

function generateHistoryId() {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeIso(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

export function createShareHistoryEntry(input: {
  type: ShareInboxHistoryType
  note?: string
  fromStatus?: ShareInboxStatus
  toStatus?: ShareInboxStatus
  at?: string
}): ShareInboxHistoryEntry {
  const now = new Date().toISOString()
  return {
    id: generateHistoryId(),
    type: input.type,
    at: normalizeIso(input.at, now),
    note: input.note?.trim() || undefined,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
  }
}

export function normalizeShareHistory(value: unknown, fallbackCreatedAt: string, status: ShareInboxStatus) {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      createShareHistoryEntry({
        type: 'created',
        at: fallbackCreatedAt,
        toStatus: status,
      }),
    ]
  }

  const entries = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Partial<ShareInboxHistoryEntry>
      if (!isShareHistoryType(raw.type)) return null
      return createShareHistoryEntry({
        type: raw.type,
        note: typeof raw.note === 'string' ? raw.note : undefined,
        fromStatus: isShareInboxStatus(raw.fromStatus) ? raw.fromStatus : undefined,
        toStatus: isShareInboxStatus(raw.toStatus) ? raw.toStatus : undefined,
        at: raw.at,
      })
    })
    .filter((entry): entry is ShareInboxHistoryEntry => Boolean(entry))

  if (entries.length === 0) {
    return [
      createShareHistoryEntry({
        type: 'created',
        at: fallbackCreatedAt,
        toStatus: status,
      }),
    ]
  }

  return entries.sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
}

export function appendShareHistory(
  history: ShareInboxHistoryEntry[] | undefined,
  entryInput: {
    type: ShareInboxHistoryType
    note?: string
    fromStatus?: ShareInboxStatus
    toStatus?: ShareInboxStatus
    at?: string
  }
) {
  const base = Array.isArray(history) ? history : []
  const nextEntry = createShareHistoryEntry(entryInput)
  const next = [...base, nextEntry]
  if (next.length <= 40) return next
  return next.slice(next.length - 40)
}

export function inferShareTags(input: {
  source: string
  title?: string
  content: string
  url?: string
}) {
  const source = normalizeShareSource(input.source)
  const text = `${input.title || ''}\n${input.content}`.toLowerCase()
  const tags: string[] = []

  if (source && source !== 'manual') {
    tags.push(source)
  }
  if (input.url) {
    tags.push('ссылка')
  }

  if (/(важно|срочно|critical|urgent|asap|приоритет)/i.test(text)) tags.push('важно')
  if (/(задач|todo|сделать|надо|нужно|план|roadmap|этап)/i.test(text)) tags.push('задача')
  if (/(идея|гипотез|концепт|вариант|brainstorm)/i.test(text)) tags.push('идея')
  if (/(код|bug|fix|api|deploy|build|рефактор|ошибк|ts|js|next)/i.test(text)) tags.push('код')
  if (/(контент|пост|статья|канал|twitter|youtube|video|reel|shorts)/i.test(text)) tags.push('контент')
  if (/(продаж|лид|клиент|бизнес|выручк|прибыл|маржин)/i.test(text)) tags.push('бизнес')

  return mergeShareTags(tags)
}

export function deriveShareTitle(title: string | undefined, content: string): string {
  const cleanTitle = typeof title === 'string' ? title.trim() : ''
  if (cleanTitle) {
    return cleanTitle.slice(0, 140)
  }

  const singleLine = content.replace(/\s+/g, ' ').trim()
  if (!singleLine) return 'Shared item'
  if (singleLine.length <= 72) return singleLine
  return `${singleLine.slice(0, 72)}…`
}
