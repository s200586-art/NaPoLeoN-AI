import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest } from '@/lib/auth'
import { getShareInboxItemsByIds, updateShareInboxItem } from '@/lib/share-inbox-store'

const ROOT_FOLDER_FALLBACK = 'root'

function readIntEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, Math.floor(raw)))
}

const REQUEST_TIMEOUT_MS = readIntEnv('GDRIVE_REQUEST_TIMEOUT_MS', 8000, 3000, 30000)

interface ExportShareResponse {
  ok: boolean
  exportedCount: number
  missingItemIds: string[]
  file?: {
    id: string
    name: string
    webViewLink?: string
    projectId: string
  }
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function toDriveDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ru-RU')
}

function buildMarkdownExport(params: {
  generatedAt: string
  projectId: string
  projectName?: string
  baseUrl: string
  itemIds: string[]
  items: Awaited<ReturnType<typeof getShareInboxItemsByIds>>
}) {
  const lines: string[] = []
  lines.push('# Share Inbox Export')
  lines.push('')
  lines.push(`- Сформировано: ${toDriveDate(params.generatedAt)}`)
  lines.push(`- Проект: ${params.projectName || params.projectId}`)
  lines.push(`- Количество карточек: ${params.items.length}`)
  lines.push(`- Источник: ${params.baseUrl}/`)
  lines.push('')

  params.items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.title}`)
    lines.push(`- ID: ${item.id}`)
    lines.push(`- Источник: ${item.source}`)
    lines.push(`- Статус: ${item.status}`)
    lines.push(`- Создано: ${toDriveDate(item.createdAt)}`)
    lines.push(`- Обновлено: ${toDriveDate(item.updatedAt)}`)
    if (item.author) lines.push(`- Автор: ${item.author}`)
    if (item.url) lines.push(`- Ссылка: ${item.url}`)
    if (item.tags.length > 0) lines.push(`- Теги: ${item.tags.join(', ')}`)
    lines.push('')
    lines.push(item.content.trim())
    lines.push('')
    if (item.history.length > 0) {
      lines.push('### История')
      item.history
        .slice(-8)
        .forEach((entry) => {
          const statusPart = entry.toStatus
            ? entry.fromStatus
              ? ` (${entry.fromStatus} -> ${entry.toStatus})`
              : ` (${entry.toStatus})`
            : ''
          const notePart = entry.note ? ` — ${entry.note}` : ''
          lines.push(`- ${toDriveDate(entry.at)}: ${entry.type}${statusPart}${notePart}`)
        })
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  })

  if (params.itemIds.length > params.items.length) {
    const found = new Set(params.items.map((item) => item.id))
    const missing = params.itemIds.filter((id) => !found.has(id))
    if (missing.length > 0) {
      lines.push('## Пропущенные ID')
      missing.forEach((id) => lines.push(`- ${id}`))
      lines.push('')
    }
  }

  return lines.join('\n').trim()
}

function buildMultipartBody(metadata: Record<string, unknown>, content: string, boundary: string) {
  const metadataPart = JSON.stringify(metadata)
  return (
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${metadataPart}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--`
  )
}

async function createDriveMarkdownFile(params: {
  token: string
  projectId: string
  filename: string
  markdown: string
}) {
  const boundary = `----napoleon-${Math.random().toString(16).slice(2)}`
  const body = buildMultipartBody(
    {
      name: params.filename,
      mimeType: 'text/markdown',
      parents: [params.projectId],
    },
    params.markdown,
    boundary
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${params.token}`,
          'content-type': `multipart/related; boundary=${boundary}`,
        },
        body,
        cache: 'no-store',
        signal: controller.signal,
      }
    )

    const raw = await response.text()
    const data = (() => {
      try {
        return JSON.parse(raw) as { id?: string; name?: string; webViewLink?: string; error?: { message?: string } }
      } catch {
        return null
      }
    })()

    if (!response.ok || !data?.id || !data.name) {
      const message = data?.error?.message || `Drive upload error (${response.status})`
      throw new Error(message)
    }

    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  const token = process.env.GDRIVE_ACCESS_TOKEN?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Не задан GDRIVE_ACCESS_TOKEN' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const itemIds = Array.from(
    new Set(
      asArray(payload.itemIds)
        .map((value) => asString(value))
        .filter(Boolean)
    )
  ).slice(0, 80)

  if (itemIds.length === 0) {
    return NextResponse.json({ error: 'Нужно передать itemIds' }, { status: 400 })
  }

  const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID?.trim() || ROOT_FOLDER_FALLBACK
  const projectId = asString(payload.projectId) || rootFolderId
  const projectName = asString(payload.projectName) || undefined

  const items = await getShareInboxItemsByIds(itemIds)
  if (items.length === 0) {
    return NextResponse.json({ error: 'Карточки для экспорта не найдены' }, { status: 404 })
  }

  const generatedAt = new Date().toISOString()
  const filename = `share-inbox-${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}.md`
  const markdown = buildMarkdownExport({
    generatedAt,
    projectId,
    projectName,
    baseUrl: req.nextUrl.origin,
    itemIds,
    items,
  })

  try {
    const file = await createDriveMarkdownFile({
      token,
      projectId,
      filename,
      markdown,
    })

    await Promise.allSettled(
      items.map((item) =>
        updateShareInboxItem(item.id, {
          status: item.status === 'new' ? 'in_progress' : item.status,
          historyEntry: {
            type: 'exported_to_project',
            note: `Экспортировано в ${projectName || projectId}: ${file.name}`,
          },
        })
      )
    )

    const foundIds = new Set(items.map((item) => item.id))
    const missingItemIds = itemIds.filter((id) => !foundIds.has(id))
    const response: ExportShareResponse = {
      ok: true,
      exportedCount: items.length,
      missingItemIds,
      file: {
        ...file,
        projectId,
      },
    }
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка экспорта'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
