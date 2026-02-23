import { NextRequest, NextResponse } from 'next/server'

// Server-side session store (survives multiple requests within same deployment instance)
const sessionStore = new Map<string, Array<{ role: string; content: string }>>()

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, sessionId } = body as { message: string; sessionId?: string }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 })
    }

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
    const model = process.env.OPENCLAW_MODEL || 'anthropic/claude-sonnet-4-6'

    if (!gatewayUrl || !gatewayToken) {
      return NextResponse.json(
        { error: 'Не заданы OPENCLAW_GATEWAY_URL / OPENCLAW_GATEWAY_TOKEN' },
        { status: 500 }
      )
    }

    // Get or create session history
    const sid = sessionId || 'default'
    if (!sessionStore.has(sid)) {
      sessionStore.set(sid, [])
    }
    const history = sessionStore.get(sid)!

    // Add user message to history
    history.push({ role: 'user', content: message })

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
        model,
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

    const answer = data?.choices?.[0]?.message?.content
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

    return NextResponse.json({ answer, sessionId: sid })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
