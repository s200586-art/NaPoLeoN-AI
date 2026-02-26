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

function parseTags(raw: unknown) {
  if (typeof raw === 'string') {
    return normalizeShareTags(raw.split(',').map((item) => item.trim()))
  }
  return normalizeShareTags(raw)
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

  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const source = normalizeShareSource(firstString(data.source, data.provider, data.from, data.app))
  const title = firstString(data.title, data.subject, data.name)
  const url = firstString(data.url, data.link, data.href)
  const author = firstString(data.author, data.user, data.username)
  const tags = parseTags(data.tags)

  const content =
    firstString(data.content, data.text, data.message, data.prompt) ||
    (url ? `Ссылка: ${url}` : '')

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
