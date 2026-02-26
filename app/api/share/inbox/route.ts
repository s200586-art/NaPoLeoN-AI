import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest } from '@/lib/auth'
import {
  addShareInboxItem,
  listShareInboxItems,
  removeShareInboxItem,
  updateShareInboxItem,
} from '@/lib/share-inbox-store'
import {
  SHARE_INBOX_STATUSES,
  ShareInboxStatus,
  mergeShareTags,
  isShareInboxStatus,
  normalizeShareSource,
  normalizeShareTags,
} from '@/lib/share-inbox'

export const dynamic = 'force-dynamic'

const SHARE_TOKEN = process.env.NAPOLEON_SHARE_TOKEN || ''
const SHARE_CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-share-token',
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : null
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (!isRecord(value)) return ''

  const parts = asArray(value.parts)
    .map((part) => extractText(part, depth + 1))
    .filter(Boolean)
  if (parts.length > 0) {
    return parts.join('\n').trim()
  }

  const keys = [
    'text',
    'content',
    'message',
    'body',
    'summary',
    'note',
    'selection',
    'value',
    'output',
    'response',
    'result',
    'raw_text',
  ]

  for (const key of keys) {
    if (!(key in value)) continue
    const text = extractText(value[key], depth + 1)
    if (text) return text
  }

  return ''
}

function normalizeRole(raw: unknown): 'user' | 'assistant' | 'system' | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.toLowerCase()
  if (/(assistant|model|bot|ai|claude|gemini|chatgpt)/.test(normalized)) return 'assistant'
  if (/(user|human|client|customer)/.test(normalized)) return 'user'
  if (/(system|developer)/.test(normalized)) return 'system'
  return null
}

function roleLabel(role: 'user' | 'assistant' | 'system' | null) {
  if (role === 'assistant') return 'Ассистент'
  if (role === 'system') return 'Система'
  if (role === 'user') return 'Пользователь'
  return ''
}

function parseTags(raw: unknown) {
  if (typeof raw === 'string') {
    return normalizeShareTags(raw.split(',').map((item) => item.trim()))
  }
  return normalizeShareTags(raw)
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = extractText(value)
    if (text) return text
  }
  return ''
}

function getMessageArrays(record: Record<string, unknown>) {
  const conversation = asRecord(record.conversation)
  return [
    asArray(record.messages),
    asArray(record.chat_messages),
    asArray(record.contents),
    asArray(record.turns),
    asArray(record.entries),
    asArray(record.items),
    asArray(record.transcript),
    asArray(conversation?.messages),
    asArray(conversation?.chat_messages),
    asArray(conversation?.contents),
    asArray(asRecord(record.data)?.messages),
  ].filter((list) => list.length > 0)
}

function parseTime(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) {
      return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
    }
    const asDate = new Date(value)
    if (!Number.isNaN(asDate.getTime())) return asDate.getTime()
  }
  return Date.now()
}

function buildTranscriptFromMessages(rawMessages: unknown[]) {
  const lines: string[] = []

  for (const raw of rawMessages.slice(0, 40)) {
    const record = asRecord(raw)
    if (record) {
      const role = normalizeRole(
        record.role ||
          record.sender ||
          record.author ||
          asRecord(record.author)?.role ||
          asRecord(record.author)?.name
      )
      const text = firstText(
        record.text,
        record.content,
        record.body,
        record.message,
        record.parts,
        asRecord(record.message)?.content,
        asRecord(record.message)?.text,
        record.candidates
      )
      if (!text) continue
      const normalizedText = text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 4000)
      const label = roleLabel(role)
      lines.push(label ? `${label}: ${normalizedText}` : normalizedText)
      continue
    }

    const text = extractText(raw)
    if (text) {
      lines.push(text.slice(0, 4000))
    }
  }

  return lines.join('\n\n').trim()
}

function buildTranscriptFromChatGptMapping(record: Record<string, unknown>) {
  const mapping = asRecord(record.mapping)
  if (!mapping) return ''

  const nodes = Object.values(mapping)
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => Boolean(value))
    .map((node) => {
      const message = asRecord(node.message)
      if (!message) return null
      const role = normalizeRole(message.role || asRecord(message.author)?.role)
      const content = firstText(message.content, asRecord(message.content)?.parts, message.text)
      if (!content) return null
      return {
        role,
        content: content.slice(0, 4000),
        time: parseTime(message.create_time || node.create_time || record.update_time || record.create_time),
      }
    })
    .filter((value): value is { role: 'user' | 'assistant' | 'system' | null; content: string; time: number } => Boolean(value))

  if (nodes.length === 0) return ''

  nodes.sort((left, right) => left.time - right.time)
  return nodes
    .slice(0, 40)
    .map((node) => {
      const label = roleLabel(node.role)
      return label ? `${label}: ${node.content}` : node.content
    })
    .join('\n\n')
    .trim()
}

function inferSourceFromPayload(
  explicitSource: string,
  root: Record<string, unknown>,
  payload: Record<string, unknown> | null
) {
  if (explicitSource && explicitSource !== 'manual') {
    return explicitSource
  }

  const urlHint = firstString(
    root.url,
    root.link,
    root.href,
    payload?.url,
    payload?.link,
    asRecord(root.conversation)?.url,
    asRecord(payload?.conversation)?.url
  ).toLowerCase()

  if (isRecord(root.mapping) || isRecord(payload?.mapping) || urlHint.includes('chatgpt.com') || urlHint.includes('openai.com')) {
    return 'chatgpt'
  }
  if (asArray(root.chat_messages).length > 0 || asArray(payload?.chat_messages).length > 0 || urlHint.includes('claude.ai')) {
    return 'claude'
  }
  if (asArray(root.contents).length > 0 || asArray(payload?.contents).length > 0 || urlHint.includes('gemini.google.com')) {
    return 'gemini'
  }

  return explicitSource || 'manual'
}

function normalizeIncomingShareBody(body: unknown) {
  const root = asRecord(body) || {}
  const payload =
    asRecord(root.payload) ||
    asRecord(root.data) ||
    asRecord(root.share) ||
    asRecord(root.item) ||
    null

  const rootConversation = asRecord(root.conversation)
  const payloadConversation = asRecord(payload?.conversation)
  const meta = asRecord(root.meta) || asRecord(payload?.meta)

  const explicitSource = normalizeShareSource(
    firstString(root.source, root.provider, root.from, root.app, payload?.source, payload?.provider)
  )
  const source = inferSourceFromPayload(explicitSource, root, payload)

  const title = firstString(
    root.title,
    root.subject,
    root.name,
    payload?.title,
    payload?.subject,
    rootConversation?.title,
    payloadConversation?.title
  )

  const url = firstString(
    root.url,
    root.link,
    root.href,
    root.share_url,
    payload?.url,
    payload?.link,
    payload?.href,
    rootConversation?.url,
    rootConversation?.share_url,
    payloadConversation?.url,
    payloadConversation?.share_url
  )

  const author = firstString(
    root.author,
    root.user,
    root.username,
    payload?.author,
    payload?.user,
    meta?.author,
    meta?.user
  )

  const providedTags = mergeShareTags(
    parseTags(root.tags),
    parseTags(payload?.tags),
    parseTags(meta?.tags)
  )

  const directContent = firstText(
    root.content,
    root.text,
    root.message,
    root.prompt,
    root.body,
    root.summary,
    root.selection,
    payload?.content,
    payload?.text,
    payload?.message,
    payload?.prompt,
    payload?.summary,
    rootConversation?.content,
    rootConversation?.summary,
    payloadConversation?.content,
    payloadConversation?.summary
  )

  const transcript =
    buildTranscriptFromChatGptMapping(root) ||
    (payload ? buildTranscriptFromChatGptMapping(payload) : '') ||
    (() => {
      const messageArrays = [
        ...getMessageArrays(root),
        ...(payload ? getMessageArrays(payload) : []),
        ...(rootConversation ? getMessageArrays(rootConversation) : []),
        ...(payloadConversation ? getMessageArrays(payloadConversation) : []),
      ]
      for (const list of messageArrays) {
        const text = buildTranscriptFromMessages(list)
        if (text) return text
      }
      return ''
    })()

  const content = directContent || transcript || (url ? `Ссылка: ${url}` : '')

  return {
    source,
    title,
    url,
    author,
    tags: providedTags,
    content,
  }
}

function readShareToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }
  return (
    req.headers.get('x-share-token')?.trim() ||
    req.nextUrl.searchParams.get('token')?.trim() ||
    ''
  )
}

function canWriteFromRequest(req: NextRequest) {
  if (isAuthorizedRequest(req)) {
    return true
  }
  if (!SHARE_TOKEN) {
    return false
  }
  const token = readShareToken(req)
  if (!token) {
    return false
  }
  return safeCompare(token, SHARE_TOKEN)
}

function parseStatusFilter(raw: string | null) {
  if (!raw || raw === 'all') {
    return null
  }
  if (isShareInboxStatus(raw)) {
    return raw
  }
  return 'invalid'
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  const statusFilter = parseStatusFilter(req.nextUrl.searchParams.get('status'))
  if (statusFilter === 'invalid') {
    return NextResponse.json(
      { error: `Некорректный статус. Используйте: all, ${SHARE_INBOX_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const allItems = await listShareInboxItems()
  const items =
    statusFilter === null
      ? allItems
      : allItems.filter((item) => item.status === (statusFilter as ShareInboxStatus))

  const counts = {
    all: allItems.length,
    new: allItems.filter((item) => item.status === 'new').length,
    in_progress: allItems.filter((item) => item.status === 'in_progress').length,
    done: allItems.filter((item) => item.status === 'done').length,
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    counts,
    items,
    shareEndpoint: '/api/share/inbox',
    tokenEnabled: Boolean(SHARE_TOKEN),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: SHARE_CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  if (!canWriteFromRequest(req)) {
    return NextResponse.json(
      { error: 'Нет доступа. Нужен login-cookie или Bearer/x-share-token' },
      { status: 401, headers: SHARE_CORS_HEADERS }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400, headers: SHARE_CORS_HEADERS })
  }

  const normalized = normalizeIncomingShareBody(body)
  const { source, title, url, author, tags, content } = normalized

  if (!content) {
    return NextResponse.json(
      { error: 'Нужно передать хотя бы content/text/message или url' },
      { status: 400, headers: SHARE_CORS_HEADERS }
    )
  }

  const item = await addShareInboxItem({
    source,
    title: title || undefined,
    content,
    url: url || undefined,
    author: author || undefined,
    tags,
  })

  return NextResponse.json({ ok: true, item }, { status: 201, headers: SHARE_CORS_HEADERS })
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const id = firstString(data.id)
  if (!id) {
    return NextResponse.json({ error: 'Нужно передать id' }, { status: 400 })
  }

  const statusRaw = data.status
  if (typeof statusRaw !== 'undefined' && !isShareInboxStatus(statusRaw)) {
    return NextResponse.json(
      { error: `Некорректный status. Разрешены: ${SHARE_INBOX_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const updates = {
    source: firstString(data.source) || undefined,
    title: typeof data.title === 'string' ? data.title : undefined,
    content: typeof data.content === 'string' ? data.content : undefined,
    url: typeof data.url === 'string' ? data.url : undefined,
    author: typeof data.author === 'string' ? data.author : undefined,
    tags: typeof data.tags !== 'undefined' ? parseTags(data.tags) : undefined,
    status: statusRaw as ShareInboxStatus | undefined,
  }

  const item = await updateShareInboxItem(id, updates)
  if (!item) {
    return NextResponse.json({ error: 'Элемент не найден' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, item })
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  const queryId = req.nextUrl.searchParams.get('id')
  let bodyId = ''

  if (!queryId) {
    try {
      const body = await req.json()
      if (body && typeof body === 'object' && 'id' in body && typeof body.id === 'string') {
        bodyId = body.id.trim()
      }
    } catch {
      bodyId = ''
    }
  }

  const id = (queryId || bodyId || '').trim()
  if (!id) {
    return NextResponse.json({ error: 'Нужно передать id' }, { status: 400 })
  }

  const removed = await removeShareInboxItem(id)
  if (!removed) {
    return NextResponse.json({ error: 'Элемент не найден' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
