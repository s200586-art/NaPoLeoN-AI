export const SHARE_INBOX_STATUSES = ['new', 'in_progress', 'done'] as const

export type ShareInboxStatus = (typeof SHARE_INBOX_STATUSES)[number]

export interface ShareInboxItem {
  id: string
  source: string
  title: string
  content: string
  url?: string
  author?: string
  tags: string[]
  status: ShareInboxStatus
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
}

const SOURCE_ALIASES: Record<string, string> = {
  gpt: 'chatgpt',
  'chat-gpt': 'chatgpt',
  openai: 'chatgpt',
  anthropic: 'claude',
  google: 'gemini',
}

export function isShareInboxStatus(value: unknown): value is ShareInboxStatus {
  return typeof value === 'string' && SHARE_INBOX_STATUSES.includes(value as ShareInboxStatus)
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
