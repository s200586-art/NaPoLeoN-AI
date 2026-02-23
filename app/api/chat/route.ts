import { NextRequest, NextResponse } from 'next/server'

type InMsg = { role: 'user' | 'assistant' | 'system'; content: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages = (body?.messages || []) as InMsg[]

    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
    const model = process.env.OPENCLAW_MODEL || 'openai/gpt-4o-mini'

    if (!gatewayUrl || !gatewayToken) {
      return NextResponse.json(
        { error: 'Не заданы OPENCLAW_GATEWAY_URL / OPENCLAW_GATEWAY_TOKEN в Vercel.' },
        { status: 500 }
      )
    }

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
      }),
    })

    const data = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error?.message || data?.error || 'Ошибка ответа Gateway' },
        { status: upstream.status }
      )
    }

    const answer = data?.choices?.[0]?.message?.content || ''
    return NextResponse.json({ answer })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
