import { NextRequest, NextResponse } from 'next/server'
import { getSessionHistory, saveSessionHistory } from '@/lib/session-memory'

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
const MAX_ATTACHMENT_TEXT = 12000

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

function isSupportedModel(modelId: string) {
  return /(kimi|moonshot|minimax)/i.test(modelId)
}

export async function POST(req: NextRequest) {
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

    // Add user message to history
    history.push({ role: 'user', content: userContent })

    // Keep last 20 messages to avoid token overflow
    const recentHistory = history.slice(-20)

    // Build messages array with system prompt
    const messages = [
      { role: 'system', content: NAPOLEON_SYSTEM },
      ...recentHistory,
    ]

    const base = gatewayUrl.replace(/\/$/, '')
    const upstream = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    const raw = await upstream.text()
    const data = (() => {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })()

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error?.message || `Ошибка Gateway (${upstream.status})` },
        { status: upstream.status }
      )
    }

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

    // Save assistant response to session history
    history.push({ role: 'assistant', content: answer })

    // Trim session if too long (keep last 40 messages)
    if (history.length > 40) {
      history.splice(0, history.length - 40)
    }

    await saveSessionHistory(sid, history)

    return NextResponse.json({ answer, sessionId: sid, model: selectedModel })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
