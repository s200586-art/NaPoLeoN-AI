import { NextResponse } from 'next/server'

const KIMI_FALLBACK_MODEL = process.env.OPENCLAW_KIMI_MODEL || 'moonshotai/kimi-k2-instruct'
const MINIMAX_FALLBACK_MODEL = process.env.OPENCLAW_MINIMAX_MODEL || 'minimax/MiniMax-M2.5'

function isChatCandidate(modelId: string) {
  const id = modelId.toLowerCase()
  const blockedKeywords = [
    'embedding',
    'embeddings',
    'moderation',
    'rerank',
    'transcribe',
    'speech',
    'audio',
    'image',
    'vision',
    'whisper',
  ]
  return !blockedKeywords.some((keyword) => id.includes(keyword))
}

function rankModel(modelId: string) {
  const id = modelId.toLowerCase()
  let score = 0
  if (id.includes('chat')) score += 3
  if (id.includes('instruct')) score += 3
  if (id.includes('k2')) score += 2
  if (id.includes('reasoner')) score += 1
  if (id.includes('latest')) score += 1
  return score
}

function pickFamilyModel(models: string[], family: 'kimi' | 'minimax') {
  const familyKeywords =
    family === 'kimi'
      ? ['kimi', 'moonshot']
      : ['minimax']

  const candidates = models.filter((model) => {
    const lowered = model.toLowerCase()
    return familyKeywords.some((keyword) => lowered.includes(keyword)) && isChatCandidate(model)
  })

  if (candidates.length === 0) {
    return null
  }

  return [...candidates].sort((a, b) => rankModel(b) - rankModel(a))[0]
}

function buildFallbackModels() {
  return Array.from(new Set([KIMI_FALLBACK_MODEL, MINIMAX_FALLBACK_MODEL]))
}

export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN
  const fallbackModels = buildFallbackModels()

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({
      models: fallbackModels,
      defaultModel: fallbackModels[0],
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
        models: fallbackModels,
        defaultModel: fallbackModels[0],
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
    const kimiModel = pickFamilyModel(uniqueModels, 'kimi')
    const minimaxModel = pickFamilyModel(uniqueModels, 'minimax')
    const filteredModels = [kimiModel, minimaxModel].filter((model): model is string => Boolean(model))
    const normalizedModels = filteredModels.length > 0 ? filteredModels : fallbackModels

    return NextResponse.json({
      models: normalizedModels,
      defaultModel: normalizedModels[0],
      source: 'gateway',
    })
  } catch {
    return NextResponse.json({
      models: fallbackModels,
      defaultModel: fallbackModels[0],
      source: 'fallback',
    })
  }
}
