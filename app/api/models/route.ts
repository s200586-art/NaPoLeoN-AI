import { NextResponse } from 'next/server'

const DEFAULT_MODEL = process.env.OPENCLAW_MODEL || 'anthropic/claude-sonnet-4-6'

export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({
      models: [DEFAULT_MODEL],
      defaultModel: DEFAULT_MODEL,
      source: 'fallback',
    })
  }

  try {
    const base = gatewayUrl.replace(/\/$/, '')
    const upstream = await fetch(`${base}/v1/models`, {
      headers: {
        authorization: `Bearer ${gatewayToken}`,
      },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return NextResponse.json({
        models: [DEFAULT_MODEL],
        defaultModel: DEFAULT_MODEL,
        source: 'fallback',
      })
    }

    const data = await upstream.json()
    const models: string[] = Array.isArray(data?.data)
      ? data.data
          .map((item: { id?: string }) => item?.id)
          .filter((id: string | undefined): id is string => Boolean(id))
      : []

    const uniqueModels = Array.from(new Set(models))
    const normalizedModels = uniqueModels.length > 0 ? uniqueModels : [DEFAULT_MODEL]

    return NextResponse.json({
      models: normalizedModels,
      defaultModel: normalizedModels.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : normalizedModels[0],
      source: 'gateway',
    })
  } catch {
    return NextResponse.json({
      models: [DEFAULT_MODEL],
      defaultModel: DEFAULT_MODEL,
      source: 'fallback',
    })
  }
}
