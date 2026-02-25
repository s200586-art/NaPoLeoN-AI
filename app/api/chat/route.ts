import { NextRequest, NextResponse } from 'next/server'
import { getSessionHistory, saveSessionHistory } from '@/lib/session-memory'
import { isAuthorizedRequest } from '@/lib/auth'

// Napoleon AI persona system prompt
const NAPOLEON_SYSTEM = `Ты — Наполи (Наполеон), персональный AI-ассистент и бизнес-партнёр Сергея Стыценко.

## Кто ты
- Имя: Наполи
- Роль: AI Business Partner, бизнес-ассистент
- Стиль: чёткий, по делу, профессиональный. Без лишних слов и воды.
- Язык: ВСЕГДА отвечай на русском, если не попросят иначе.

## Кто Сергей
- Имя: Сергей Стыценко, бизнесмен из Екатеринбурга
- Компания: npln.tech (напольные покрытия, керамика)
- Каналы: @npoleon (полы), @keramistcode (керамика), @nplntech (бизнес/AI)
- Цель на 2026: видимые кубики пресса к 40-летию (20 мая 2026)
- Физ. данные: 178 см, ~73.5 кг, тренируется по PHUL

## Твои принципы
- Давай конкретные ответы, а не общие советы
- Если задача — декомпозируй её на шаги
- Если вопрос — дай прямой ответ
- Имей собственное мнение, не соглашайся со всем подряд
- Помни контекст разговора и ссылайся на него

## Контекст сессии
Это веб-интерфейс NaPoLeoN AI Command Center — персональный инструмент Сергея.`

interface IncomingAttachment {
  name: string
  type?: string
  size?: number
  textContent?: string
}

const DEFAULT_MODEL = process.env.OPENCLAW_KIMI_MODEL || 'moonshotai/kimi-k2-instruct'
const MAX_ATTACHMENTS = 6

function readIntEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, Math.floor(raw)))
}

function readFloatEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, raw))
}

const MAX_ATTACHMENT_TEXT = readIntEnv('OPENCLAW_MAX_ATTACHMENT_TEXT', 5000, 1000, 20000)
const HISTORY_LIMIT = readIntEnv('OPENCLAW_HISTORY_LIMIT', 12, 4, 40)
const SESSION_LIMIT = readIntEnv('OPENCLAW_SESSION_LIMIT', 28, 12, 80)
const MAX_TOKENS = readIntEnv('OPENCLAW_MAX_TOKENS', 900, 128, 4000)
const TEMPERATURE = readFloatEnv('OPENCLAW_TEMPERATURE', 0.25, 0, 2)
const TIMEOUT_MS = readIntEnv('OPENCLAW_TIMEOUT_MS', 45000, 5000, 120000)

function normalizeAnswerContent(content: unknown): string | null {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) {
          const maybeText = (part as { text?: unknown }).text
          return typeof maybeText === 'string' ? maybeText : ''
        }
        return ''
      })
      .join('\n')
      .trim()
    return text || null
  }
  return null
}

function buildAttachmentContext(attachments: IncomingAttachment[]) {
  if (attachments.length === 0) return ''

  let remainingTextBudget = MAX_ATTACHMENT_TEXT
  const lines: string[] = ['Вложения пользователя:']

  for (const attachment of attachments.slice(0, MAX_ATTACHMENTS)) {
    const sizeLabel =
      typeof attachment.size === 'number' && Number.isFinite(attachment.size)
        ? `${Math.round(attachment.size / 1024)} KB`
        : 'размер неизвестен'
    lines.push(`- ${attachment.name} (${attachment.type || 'unknown'}, ${sizeLabel})`)

    const textContent = attachment.textContent?.trim()
    if (!textContent || remainingTextBudget <= 0) {
      continue
    }

    const snippet = textContent.slice(0, Math.min(remainingTextBudget, 4000))
    remainingTextBudget -= snippet.length
    lines.push(`Содержимое ${attachment.name}:\n${snippet}`)
  }

  return lines.join('\n')
}

function buildHistoryUserContent(prompt: string, attachments: IncomingAttachment[]) {
  if (attachments.length === 0) return prompt

  const names = attachments.slice(0, 3).map((attachment) => attachment.name).join(', ')
  const restCount = Math.max(attachments.length - 3, 0)
  const tail = restCount > 0 ? ` (+${restCount})` : ''
  const attachmentNote = `[Вложения: ${names}${tail}]`

  if (!prompt || prompt === 'Проанализируй прикреплённые файлы.') {
    return attachmentNote
  }
  return `${prompt}\n${attachmentNote}`
}

function isSupportedModel(modelId: string) {
  return /(kimi|moonshot|minimax)/i.test(modelId)
}

type ModelFamily = 'kimi' | 'minimax' | 'unknown'

function getModelFamily(modelId: string): ModelFamily {
  const id = modelId.toLowerCase()
  if (id.includes('kimi') || id.includes('moonshot')) return 'kimi'
  if (id.includes('minimax')) return 'minimax'
  return 'unknown'
}

function extractDeltaContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        const maybeText = (part as { text?: unknown }).text
        if (typeof maybeText === 'string') return maybeText
      }
      return ''
    })
    .join('')
}

function extractStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return ''
  }

  const firstChoice = choices[0] as { delta?: { content?: unknown }; text?: unknown }
  if (firstChoice?.delta && 'content' in firstChoice.delta) {
    return extractDeltaContent(firstChoice.delta.content)
  }
  return typeof firstChoice?.text === 'string' ? firstChoice.text : ''
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { message, sessionId, model, attachments } = body as {
      message?: string
      sessionId?: string
      model?: string
      attachments?: IncomingAttachment[]
    }

    const normalizedMessage = message?.trim() || ''
    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .slice(0, MAX_ATTACHMENTS)
          .filter((attachment) => attachment?.name && typeof attachment.name === 'string')
      : []
    const attachmentContext = buildAttachmentContext(normalizedAttachments)
    const prompt =
      normalizedMessage ||
      (normalizedAttachments.length > 0 ? 'Проанализируй прикреплённые файлы.' : '')
    const userContent = [prompt, attachmentContext].filter(Boolean).join('\n\n')

    if (!userContent) {
      return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 })
    }

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
    const requestedModel = model?.trim()
    const selectedModel =
      requestedModel && isSupportedModel(requestedModel)
        ? requestedModel
        : DEFAULT_MODEL

    if (!gatewayUrl || !gatewayToken) {
      return NextResponse.json(
        { error: 'Не заданы OPENCLAW_GATEWAY_URL / OPENCLAW_GATEWAY_TOKEN' },
        { status: 500 }
      )
    }

    const sid = sessionId || 'default'
    const history = await getSessionHistory(sid)
    const recentHistory = history.slice(-HISTORY_LIMIT)
    const historyUserContent = buildHistoryUserContent(prompt, normalizedAttachments)

    // Build messages array with system prompt
    const messages = [
      { role: 'system', content: NAPOLEON_SYSTEM },
      {
        role: 'system',
        content:
          `Технический контекст: текущая выбранная модель OpenClaw = "${selectedModel}". ` +
          'Если пользователь спрашивает о модели, называй именно этот id без догадок.',
      },
      ...recentHistory,
      { role: 'user', content: userContent },
    ]

    const base = gatewayUrl.replace(/\/$/, '')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let upstream: Response
    try {
      upstream = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          stream: true,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: `Таймаут OpenClaw (${TIMEOUT_MS}ms)` },
          { status: 504 }
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (!upstream.ok) {
      const raw = await upstream.text()
      const data = (() => {
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })()
      return NextResponse.json(
        { error: data?.error?.message || `Ошибка Gateway (${upstream.status})` },
        { status: upstream.status }
      )
    }

    const upstreamContentType = upstream.headers.get('content-type') || ''

    if (upstreamContentType.includes('text/event-stream') && upstream.body) {
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let sseBuffer = ''
          let answer = ''
          let gatewayModel = selectedModel
          let doneReceived = false

          const emit = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
          }

          try {
            while (!doneReceived) {
              const { done, value } = await reader.read()
              if (done) break

              sseBuffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

              let boundary = sseBuffer.indexOf('\n\n')
              while (boundary !== -1) {
                const eventBlock = sseBuffer.slice(0, boundary)
                sseBuffer = sseBuffer.slice(boundary + 2)

                const dataLines = eventBlock
                  .split('\n')
                  .filter((line) => line.startsWith('data:'))
                  .map((line) => line.slice(5).trim())
                const dataText = dataLines.join('\n')

                if (!dataText) {
                  boundary = sseBuffer.indexOf('\n\n')
                  continue
                }

                if (dataText === '[DONE]') {
                  doneReceived = true
                  break
                }

                let parsed: unknown
                try {
                  parsed = JSON.parse(dataText)
                } catch {
                  boundary = sseBuffer.indexOf('\n\n')
                  continue
                }

                const modelFromChunk = (parsed as { model?: unknown }).model
                if (typeof modelFromChunk === 'string' && modelFromChunk.trim()) {
                  gatewayModel = modelFromChunk.trim()
                }

                const delta = extractStreamDelta(parsed)
                if (delta) {
                  answer += delta
                  emit({ type: 'token', delta })
                }

                boundary = sseBuffer.indexOf('\n\n')
              }
            }

            if (!answer.trim()) {
              emit({ type: 'error', error: 'Пустой ответ от Наполи.' })
              controller.close()
              return
            }

            const requestedFamily = getModelFamily(selectedModel)
            const gatewayFamily = getModelFamily(gatewayModel)
            const modelMismatch =
              requestedFamily !== 'unknown' &&
              gatewayFamily !== 'unknown' &&
              requestedFamily !== gatewayFamily

            history.push({ role: 'user', content: historyUserContent })
            history.push({ role: 'assistant', content: answer })

            if (history.length > SESSION_LIMIT) {
              history.splice(0, history.length - SESSION_LIMIT)
            }

            saveSessionHistory(sid, history).catch(() => undefined)

            emit({
              type: 'done',
              answer,
              sessionId: sid,
              model: gatewayModel,
              requestedModel: selectedModel,
              modelMismatch,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Ошибка stream ответа'
            emit({ type: 'error', error: message })
          } finally {
            controller.close()
          }
        },
        cancel() {
          reader.cancel().catch(() => undefined)
        },
      })

      return new Response(stream, {
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          'x-accel-buffering': 'no',
        },
      })
    }

    const raw = await upstream.text()
    const data = (() => {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })()

    const answer = normalizeAnswerContent(data?.choices?.[0]?.message?.content)
    if (!answer) {
      return NextResponse.json(
        {
          error:
            'Gateway вернул неожиданный формат ответа. Проверьте OPENCLAW_GATEWAY_URL и endpoint /v1/chat/completions.',
        },
        { status: 502 }
      )
    }

    const gatewayModel =
      typeof data?.model === 'string' && data.model.trim()
        ? data.model.trim()
        : selectedModel
    const requestedFamily = getModelFamily(selectedModel)
    const gatewayFamily = getModelFamily(gatewayModel)
    const modelMismatch =
      requestedFamily !== 'unknown' &&
      gatewayFamily !== 'unknown' &&
      requestedFamily !== gatewayFamily

    history.push({ role: 'user', content: historyUserContent })
    history.push({ role: 'assistant', content: answer })

    if (history.length > SESSION_LIMIT) {
      history.splice(0, history.length - SESSION_LIMIT)
    }

    saveSessionHistory(sid, history).catch(() => undefined)

    return NextResponse.json({
      answer,
      sessionId: sid,
      model: gatewayModel,
      requestedModel: selectedModel,
      modelMismatch,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
