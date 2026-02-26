import type { Chat, Message } from '@/lib/store'

export type ChatImportSource = 'chatgpt' | 'claude' | 'gemini' | 'generic'

export interface ChatImportResult {
  source: ChatImportSource
  chats: Chat[]
  warnings: string[]
}

type Role = Message['role']

interface ParsedMessage {
  role: Role
  content: string
  timestamp: Date
}

interface ParsedConversation {
  title: string
  messages: ParsedMessage[]
  createdAt: Date
  updatedAt: Date
}

const MAX_IMPORTED_CHATS = 120
const MAX_MESSAGES_PER_CHAT = 600
const MAX_MESSAGE_LENGTH = 20_000
const MAX_WARNINGS = 40

function createId(prefix: 'chat' | 'msg') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeRole(value: unknown): Role | null {
  let raw: string | null = null

  if (typeof value === 'string') {
    raw = value
  } else if (isRecord(value)) {
    raw = asString(value.role) || asString(value.name) || asString(value.type)
  }

  if (!raw) return null

  const normalized = raw.toLowerCase()
  if (
    normalized.includes('assistant') ||
    normalized.includes('model') ||
    normalized.includes('claude') ||
    normalized.includes('gemini') ||
    normalized.includes('bard') ||
    normalized.includes('ai') ||
    normalized.includes('bot')
  ) {
    return 'assistant'
  }

  if (
    normalized.includes('user') ||
    normalized.includes('human') ||
    normalized.includes('customer') ||
    normalized.includes('client')
  ) {
    return 'user'
  }

  return null
}

function parseTimestamp(value: unknown, fallbackMs = Date.now()): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) return date
    return new Date(fallbackMs)
  }

  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) {
      const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
      const date = new Date(ms)
      if (!Number.isNaN(date.getTime())) return date
    }

    const asDate = new Date(value)
    if (!Number.isNaN(asDate.getTime())) {
      return asDate
    }
  }

  return new Date(fallbackMs)
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return value.slice(0, max)
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) return ''

  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    return value
      .map((item) => extractText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (!isRecord(value)) return ''

  const content = value

  const candidateCollections = [
    content.content,
    content.items,
    content.messages,
    content.blocks,
    content.data,
  ]
  for (const collection of candidateCollections) {
    if (!Array.isArray(collection)) continue
    const merged = collection
      .map((item) => extractText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim()
    if (merged) return merged
  }

  const parts = asArray(content.parts)
    .map((part) => extractText(part, depth + 1))
    .filter(Boolean)
  if (parts.length > 0) {
    return parts.join('\n').trim()
  }

  const primaryKeys = [
    'text',
    'content',
    'value',
    'body',
    'message',
    'response',
    'output',
    'result',
    'completion',
    'raw_text',
  ]

  for (const key of primaryKeys) {
    if (!(key in content)) continue
    const text = extractText(content[key], depth + 1)
    if (text) return text
  }

  return ''
}

function normalizeMessageText(value: string) {
  return truncate(value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), MAX_MESSAGE_LENGTH)
}

function compactMessages(messages: ParsedMessage[]) {
  const result: ParsedMessage[] = []

  for (const message of messages) {
    const content = normalizeMessageText(message.content)
    if (!content) continue

    const normalizedMessage = {
      role: message.role,
      content,
      timestamp: message.timestamp,
    }

    const previous = result[result.length - 1]
    if (
      previous &&
      previous.role === normalizedMessage.role &&
      previous.content === normalizedMessage.content
    ) {
      continue
    }

    result.push(normalizedMessage)
    if (result.length >= MAX_MESSAGES_PER_CHAT) {
      break
    }
  }

  return result
}

function normalizeSignatureText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9а-яё\s.,!?-]/gi, '')
    .trim()
}

function buildChatSignature(chat: Chat) {
  const first = chat.messages[0]
  const last = chat.messages[chat.messages.length - 1]
  const sample = chat.messages
    .slice(0, 3)
    .concat(chat.messages.slice(Math.max(chat.messages.length - 3, 3)))
    .map((message) => `${message.role}:${normalizeSignatureText(message.content).slice(0, 240)}`)
    .join('|')
  const createdBucket = Math.floor(chat.createdAt.getTime() / (1000 * 60))
  const updatedBucket = Math.floor(chat.updatedAt.getTime() / (1000 * 60))
  return [
    chat.messages.length,
    createdBucket,
    updatedBucket,
    `${first.role}:${normalizeSignatureText(first.content).slice(0, 240)}`,
    `${last.role}:${normalizeSignatureText(last.content).slice(0, 240)}`,
    sample,
  ].join('#')
}

function dedupeChats(chats: Chat[]) {
  const seen = new Set<string>()
  const unique: Chat[] = []
  let duplicates = 0

  for (const chat of chats) {
    const signature = buildChatSignature(chat)
    if (seen.has(signature)) {
      duplicates += 1
      continue
    }
    seen.add(signature)
    unique.push(chat)
  }

  return { chats: unique, duplicates }
}

function truncateWarnings(warnings: string[]) {
  if (warnings.length <= MAX_WARNINGS) return warnings
  return [...warnings.slice(0, MAX_WARNINGS), `…и ещё ${warnings.length - MAX_WARNINGS} предупреждений.`]
}

function looksLikeMessageRecord(record: Record<string, unknown>) {
  const roleCandidate = normalizeRole(
    record.role || record.sender || record.author || record.type || record.name
  )
  if (roleCandidate) return true

  return Boolean(
    asString(record.text) ||
    asString(record.content) ||
    asString(record.body) ||
    asString(record.message) ||
    asArray(record.parts).length > 0
  )
}

function toChat(conversation: ParsedConversation): Chat | null {
  const normalizedMessages = compactMessages(conversation.messages)
  if (normalizedMessages.length === 0) return null

  const firstTimestamp = normalizedMessages[0].timestamp
  const lastTimestamp = normalizedMessages[normalizedMessages.length - 1].timestamp
  const createdAt =
    conversation.createdAt.getTime() <= lastTimestamp.getTime()
      ? conversation.createdAt
      : firstTimestamp
  const updatedAt =
    conversation.updatedAt.getTime() >= createdAt.getTime()
      ? conversation.updatedAt
      : lastTimestamp

  return {
    id: createId('chat'),
    title: truncate(conversation.title.trim() || 'Импортированный чат', 120),
    createdAt,
    updatedAt,
    messages: normalizedMessages.map((message) => ({
      id: createId('msg'),
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      isStreaming: false,
    })),
  }
}

function selectConversationsPayload(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    const records = value.filter((item): item is Record<string, unknown> => isRecord(item))
    if (records.length === 0) return []

    const messageLikeCount = records.filter((record) => looksLikeMessageRecord(record)).length
    if (messageLikeCount >= Math.max(2, Math.ceil(records.length * 0.6))) {
      return [
        {
          title: 'Импортированный чат',
          messages: records,
        },
      ]
    }

    return records
  }

  if (!isRecord(value)) return []

  const directArrays = ['conversations', 'chats', 'items', 'data']
  for (const key of directArrays) {
    const next = value[key]
    if (Array.isArray(next)) {
      return next.filter((item): item is Record<string, unknown> => isRecord(item))
    }

    if (isRecord(next) && Array.isArray(next.items)) {
      return next.items.filter((item): item is Record<string, unknown> => isRecord(item))
    }
  }

  if (Array.isArray(value.messages)) {
    return [value]
  }

  return []
}

function parseChatGptConversation(
  conversation: Record<string, unknown>,
  index: number
): ParsedConversation | null {
  const mapping = asRecord(conversation.mapping)
  if (!mapping) return null

  const fallbackTime = parseTimestamp(conversation.update_time || conversation.create_time)
  const mappingEntries = Object.entries(mapping).filter((entry): entry is [string, Record<string, unknown>] =>
    isRecord(entry[1])
  )
  if (mappingEntries.length === 0) return null

  const orderedIds: string[] = []
  const currentNode = asString(conversation.current_node)

  if (currentNode && mapping[currentNode] && isRecord(mapping[currentNode])) {
    const visited = new Set<string>()
    let nodeId: string | null = currentNode

    while (nodeId && !visited.has(nodeId)) {
      visited.add(nodeId)
      orderedIds.push(nodeId)
      const node = asRecord(mapping[nodeId])
      nodeId = node ? asString(node.parent) : null
    }
    orderedIds.reverse()
  }

  if (orderedIds.length === 0) {
    orderedIds.push(
      ...mappingEntries
        .sort((a, b) => {
          const aNode = asRecord(a[1]) || {}
          const bNode = asRecord(b[1]) || {}
          const aMsg = asRecord(aNode.message)
          const bMsg = asRecord(bNode.message)
          return (
            parseTimestamp(aMsg?.create_time || aNode.create_time, 0).getTime() -
            parseTimestamp(bMsg?.create_time || bNode.create_time, 0).getTime()
          )
        })
        .map(([id]) => id)
    )
  }

  const messages: ParsedMessage[] = []
  for (const nodeId of orderedIds) {
    const node = asRecord(mapping[nodeId])
    if (!node) continue

    const message = asRecord(node.message)
    if (!message) continue

    const author = asRecord(message.author)
    const role = normalizeRole(author?.role || message.role)
    if (!role) continue

    const content = asRecord(message.content)
    const text =
      (content
        ? extractText(content.parts) || extractText(content.text) || extractText(content.result)
        : '') || extractText(message.text) || extractText(message.content)

    if (!text) continue

    messages.push({
      role,
      content: text,
      timestamp: parseTimestamp(
        message.create_time || node.create_time || conversation.update_time || conversation.create_time,
        fallbackTime.getTime()
      ),
    })
  }

  if (messages.length === 0) return null

  const title = asString(conversation.title) || `ChatGPT импорт #${index + 1}`
  return {
    title,
    messages,
    createdAt: parseTimestamp(conversation.create_time, messages[0].timestamp.getTime()),
    updatedAt: parseTimestamp(conversation.update_time, messages[messages.length - 1].timestamp.getTime()),
  }
}

function parseGenericMessage(
  messageRaw: Record<string, unknown>,
  fallbackRole: Role | null,
  fallbackTime: Date
): ParsedMessage | null {
  const nestedAuthor = asRecord(messageRaw.author)
  const nestedMessage = asRecord(messageRaw.message)
  const nestedContent = asRecord(messageRaw.content)

  const role =
    normalizeRole(
      messageRaw.role ||
        messageRaw.sender ||
        messageRaw.author ||
        nestedAuthor?.role ||
        nestedAuthor?.name ||
        nestedMessage?.role
    ) || fallbackRole

  if (!role) return null

  const text =
    extractText(messageRaw.text) ||
    extractText(messageRaw.content) ||
    extractText(messageRaw.body) ||
    extractText(messageRaw.parts) ||
    extractText(nestedContent?.parts) ||
    extractText(nestedContent?.text) ||
    extractText(messageRaw.response) ||
    extractText(messageRaw.output) ||
    extractText(messageRaw.value) ||
    extractText(messageRaw.candidates) ||
    extractText(nestedMessage?.content) ||
    extractText(nestedMessage?.text)

  if (!text) return null

  return {
    role,
    content: text,
    timestamp: parseTimestamp(
      messageRaw.created_at ||
        messageRaw.createdAt ||
        messageRaw.timestamp ||
        messageRaw.time ||
        messageRaw.updated_at ||
        messageRaw.updatedAt ||
        nestedMessage?.created_time ||
        nestedMessage?.create_time,
      fallbackTime.getTime()
    ),
  }
}

function parseConversationWithMessageArray(
  conversation: Record<string, unknown>,
  fallbackTitle: string,
  fallbackRole: Role | null = null
): ParsedConversation | null {
  const title =
    asString(conversation.title) ||
    asString(conversation.name) ||
    asString(conversation.chat_name) ||
    asString(conversation.topic) ||
    fallbackTitle

  const fallbackTime = parseTimestamp(
    conversation.updated_at ||
      conversation.updatedAt ||
      conversation.create_time ||
      conversation.created_at ||
      conversation.createdAt
  )

  const rawMessages =
    asArray(conversation.messages).length > 0
      ? asArray(conversation.messages)
      : asArray(conversation.chat_messages).length > 0
        ? asArray(conversation.chat_messages)
        : asArray(conversation.contents).length > 0
          ? asArray(conversation.contents)
          : asArray(conversation.turns)

  if (rawMessages.length === 0) return null

  const messages: ParsedMessage[] = []
  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue
    const parsed = parseGenericMessage(raw, fallbackRole, fallbackTime)
    if (parsed) messages.push(parsed)
  }

  if (messages.length === 0) return null

  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  return {
    title,
    messages,
    createdAt: parseTimestamp(conversation.created_at || conversation.createdAt, messages[0].timestamp.getTime()),
    updatedAt: parseTimestamp(
      conversation.updated_at || conversation.updatedAt,
      messages[messages.length - 1].timestamp.getTime()
    ),
  }
}

function parseChatGptPayload(payload: unknown): ChatImportResult | null {
  const conversations = Array.isArray(payload)
    ? payload.filter((item): item is Record<string, unknown> => isRecord(item))
    : isRecord(payload) && isRecord(payload.mapping)
      ? [payload]
      : isRecord(payload)
        ? selectConversationsPayload(payload).filter((item) => isRecord(item.mapping))
        : []

  if (!conversations.some((item) => isRecord(item.mapping))) return null

  const warnings: string[] = []
  const chats: Chat[] = []

  conversations.slice(0, MAX_IMPORTED_CHATS).forEach((item, index) => {
    const parsed = parseChatGptConversation(item, index)
    const chat = parsed ? toChat(parsed) : null
    if (chat) {
      chats.push(chat)
    } else {
      warnings.push(`ChatGPT: пропущен диалог #${index + 1} (нет поддерживаемых сообщений).`)
    }
  })

  return {
    source: 'chatgpt',
    chats,
    warnings,
  }
}

function parseClaudePayload(payload: unknown): ChatImportResult | null {
  const conversations = selectConversationsPayload(payload)
  if (!conversations.some((conversation) => Array.isArray(conversation.chat_messages))) return null

  const warnings: string[] = []
  const chats: Chat[] = []

  conversations.slice(0, MAX_IMPORTED_CHATS).forEach((conversation, index) => {
    const parsed = parseConversationWithMessageArray(conversation, `Claude импорт #${index + 1}`)
    const chat = parsed ? toChat(parsed) : null
    if (chat) {
      chats.push(chat)
    } else {
      warnings.push(`Claude: пропущен диалог #${index + 1}.`)
    }
  })

  return {
    source: 'claude',
    chats,
    warnings,
  }
}

function parseGeminiPayload(payload: unknown): ChatImportResult | null {
  const conversations = selectConversationsPayload(payload)
  const looksGemini =
    conversations.some((conversation) =>
      asArray(conversation.messages).some((message) => {
        if (!isRecord(message)) return false
        const role = normalizeRole(message.author || message.role)
        return role === 'assistant' || role === 'user'
      })
    ) ||
    (isRecord(payload) && Array.isArray(payload.contents))

  if (!looksGemini) return null

  const warnings: string[] = []
  const chats: Chat[] = []
  const normalizedConversations =
    conversations.length > 0
      ? conversations
      : isRecord(payload)
        ? [{ title: 'Gemini импорт', messages: asArray(payload.contents) }]
        : []

  normalizedConversations.slice(0, MAX_IMPORTED_CHATS).forEach((conversation, index) => {
    const parsed = parseConversationWithMessageArray(conversation, `Gemini импорт #${index + 1}`)
    const chat = parsed ? toChat(parsed) : null
    if (chat) {
      chats.push(chat)
    } else {
      warnings.push(`Gemini: пропущен диалог #${index + 1}.`)
    }
  })

  return {
    source: 'gemini',
    chats,
    warnings,
  }
}

function parseGenericPayload(payload: unknown): ChatImportResult | null {
  const conversations = selectConversationsPayload(payload)
  if (conversations.length === 0) return null

  const warnings: string[] = []
  const chats: Chat[] = []

  conversations.slice(0, MAX_IMPORTED_CHATS).forEach((conversation, index) => {
    const parsed = parseConversationWithMessageArray(conversation, `Импорт #${index + 1}`)
    const chat = parsed ? toChat(parsed) : null
    if (chat) {
      chats.push(chat)
    } else {
      warnings.push(`Пропущен диалог #${index + 1}: не удалось извлечь сообщения.`)
    }
  })

  return {
    source: 'generic',
    chats,
    warnings,
  }
}

export function parseChatImportFile(raw: string, filename: string): ChatImportResult {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Файл должен быть валидным JSON.')
  }

  const loweredFilename = filename.toLowerCase()

  const parserOrder = [
    parseChatGptPayload,
    parseClaudePayload,
    parseGeminiPayload,
    parseGenericPayload,
  ] as const

  const orderedParsers =
    loweredFilename.includes('chatgpt') || loweredFilename.includes('conversations')
      ? [parseChatGptPayload, parseClaudePayload, parseGeminiPayload, parseGenericPayload]
      : loweredFilename.includes('claude')
        ? [parseClaudePayload, parseChatGptPayload, parseGeminiPayload, parseGenericPayload]
        : loweredFilename.includes('gemini') || loweredFilename.includes('bard')
          ? [parseGeminiPayload, parseChatGptPayload, parseClaudePayload, parseGenericPayload]
          : parserOrder

  for (const parser of orderedParsers) {
    const result = parser(payload)
    if (!result) continue
    if (result.chats.length === 0) continue

    const { chats: uniqueChats, duplicates } = dedupeChats(result.chats)
    const warnings = [...result.warnings]
    if (duplicates > 0) {
      warnings.push(`Удалено дублирующихся диалогов: ${duplicates}.`)
    }

    return {
      ...result,
      chats: uniqueChats.slice(0, MAX_IMPORTED_CHATS),
      warnings: truncateWarnings(warnings),
    }
  }

  throw new Error(
    'Не удалось распознать формат. Поддерживаются ChatGPT, Claude, Gemini и JSON с массивом сообщений.'
  )
}
