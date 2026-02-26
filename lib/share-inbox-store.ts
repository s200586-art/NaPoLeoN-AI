import fs from 'node:fs/promises'
import path from 'node:path'
import {
  appendShareHistory,
  CreateShareInboxItemInput,
  ShareInboxItem,
  ShareInboxStatus,
  UpdateShareInboxItemInput,
  createShareHistoryEntry,
  deriveShareTitle,
  inferShareTags,
  isShareInboxStatus,
  mergeShareTags,
  normalizeShareHistory,
  normalizeShareSource,
} from '@/lib/share-inbox'

const IS_SERVERLESS_RUNTIME = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
)

const DEFAULT_STORE_FILE = IS_SERVERLESS_RUNTIME
  ? path.join('/tmp', 'napoleon', 'share-inbox.json')
  : path.join(process.cwd(), 'data', 'share-inbox.json')

const STORE_FILE = process.env.NAPOLEON_SHARE_INBOX_FILE || DEFAULT_STORE_FILE
const MAX_CONTENT_LENGTH = readIntEnv('NAPOLEON_SHARE_INBOX_MAX_CONTENT', 20000, 2000, 100000)
const MAX_ITEMS = readIntEnv('NAPOLEON_SHARE_INBOX_MAX_ITEMS', 500, 20, 5000)

let loaded = false
let store: ShareInboxItem[] = []
let writeQueue: Promise<void> = Promise.resolve()

function readIntEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, Math.floor(raw)))
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeIso(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function normalizeItem(value: unknown): ShareInboxItem | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Partial<ShareInboxItem>
  const content = typeof raw.content === 'string' ? raw.content.trim() : ''
  if (!content) return null

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId()
  const createdAt = normalizeIso(raw.createdAt, new Date().toISOString())
  const updatedAt = normalizeIso(raw.updatedAt, createdAt)

  return {
    id,
    source: normalizeShareSource(raw.source),
    title: deriveShareTitle(raw.title, content),
    content: content.slice(0, MAX_CONTENT_LENGTH),
    url: typeof raw.url === 'string' ? raw.url.trim() || undefined : undefined,
    author: typeof raw.author === 'string' ? raw.author.trim() || undefined : undefined,
    tags: mergeShareTags(
      Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
      inferShareTags({
        source: normalizeShareSource(raw.source),
        title: typeof raw.title === 'string' ? raw.title : undefined,
        content,
        url: typeof raw.url === 'string' ? raw.url.trim() || undefined : undefined,
      })
    ),
    status: isShareInboxStatus(raw.status) ? raw.status : 'new',
    history: normalizeShareHistory(raw.history, createdAt, isShareInboxStatus(raw.status) ? raw.status : 'new'),
    createdAt,
    updatedAt,
  }
}

function sortByCreatedDesc(items: ShareInboxItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()
    return rightTime - leftTime
  })
}

function trimStore() {
  if (store.length <= MAX_ITEMS) return
  store = sortByCreatedDesc(store).slice(0, MAX_ITEMS)
}

async function ensureLoaded() {
  if (loaded) return

  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      store = sortByCreatedDesc(parsed.map((item) => normalizeItem(item)).filter(Boolean) as ShareInboxItem[])
    } else {
      store = []
    }
  } catch {
    store = []
  }

  loaded = true
}

async function persistStore() {
  const directory = path.dirname(STORE_FILE)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8')
}

function enqueuePersist() {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      trimStore()
      try {
        await persistStore()
      } catch {
        // In read-only/serverless runtime keep data in memory.
      }
    })
  return writeQueue
}

export async function listShareInboxItems(status?: ShareInboxStatus) {
  await ensureLoaded()
  const sorted = sortByCreatedDesc(store)
  if (!status) return sorted
  return sorted.filter((item) => item.status === status)
}

export async function getShareInboxItemsByIds(ids: string[]) {
  await ensureLoaded()
  const wanted = new Set(ids)
  return store.filter((item) => wanted.has(item.id))
}

export async function addShareInboxItem(input: CreateShareInboxItemInput) {
  await ensureLoaded()

  const now = new Date().toISOString()
  const source = normalizeShareSource(input.source)
  const content = input.content.trim().slice(0, MAX_CONTENT_LENGTH)
  const title = deriveShareTitle(input.title, content)
  const url = input.url?.trim() || undefined
  const item: ShareInboxItem = {
    id: generateId(),
    source,
    title,
    content,
    url,
    author: input.author?.trim() || undefined,
    tags: mergeShareTags(
      input.tags,
      inferShareTags({
        source,
        title,
        content,
        url,
      })
    ),
    status: 'new',
    history: [
      createShareHistoryEntry({
        type: 'created',
        at: now,
        toStatus: 'new',
      }),
    ],
    createdAt: now,
    updatedAt: now,
  }

  store = [item, ...store]
  await enqueuePersist()
  return item
}

export async function updateShareInboxItem(id: string, updates: UpdateShareInboxItemInput) {
  await ensureLoaded()

  let updatedItem: ShareInboxItem | null = null
  const now = new Date().toISOString()

  store = store.map((item) => {
    if (item.id !== id) return item

    const nextContent =
      typeof updates.content === 'string'
        ? updates.content.trim().slice(0, MAX_CONTENT_LENGTH)
        : item.content
    if (!nextContent) {
      updatedItem = item
      return item
    }

    const nextTitle = deriveShareTitle(
      typeof updates.title === 'string' ? updates.title : item.title,
      nextContent
    )

    const nextStatus = isShareInboxStatus(updates.status) ? updates.status : item.status
    let nextHistory = normalizeShareHistory(item.history, item.createdAt, item.status)

    if (nextStatus !== item.status) {
      nextHistory = appendShareHistory(nextHistory, {
        type: 'status_changed',
        fromStatus: item.status,
        toStatus: nextStatus,
        note: `Статус: ${item.status} → ${nextStatus}`,
      })
    }

    if (updates.historyEntry) {
      nextHistory = appendShareHistory(nextHistory, updates.historyEntry)
    }

    const nextItem: ShareInboxItem = {
      ...item,
      source: updates.source ? normalizeShareSource(updates.source) : item.source,
      title: nextTitle,
      content: nextContent,
      url: typeof updates.url === 'string' ? updates.url.trim() || undefined : item.url,
      author: typeof updates.author === 'string' ? updates.author.trim() || undefined : item.author,
      tags: updates.tags
        ? mergeShareTags(
            updates.tags,
            inferShareTags({
              source: updates.source ? normalizeShareSource(updates.source) : item.source,
              title: nextTitle,
              content: nextContent,
              url: typeof updates.url === 'string' ? updates.url.trim() || undefined : item.url,
            })
          )
        : item.tags,
      status: nextStatus,
      history: nextHistory,
      updatedAt: now,
    }

    updatedItem = nextItem
    return nextItem
  })

  if (!updatedItem) {
    return null
  }

  await enqueuePersist()
  return updatedItem
}

export async function removeShareInboxItem(id: string) {
  await ensureLoaded()
  const before = store.length
  store = store.filter((item) => item.id !== id)
  const removed = before !== store.length
  if (removed) {
    await enqueuePersist()
  }
  return removed
}
