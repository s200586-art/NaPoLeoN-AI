import fs from 'node:fs/promises'
import path from 'node:path'

type ChatMessage = { role: string; content: string }
type SessionMap = Record<string, ChatMessage[]>

const IS_SERVERLESS_RUNTIME = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
)
const DEFAULT_FILE = IS_SERVERLESS_RUNTIME
  ? path.join('/tmp', 'napoleon', 'sessions.json')
  : path.join(process.cwd(), 'data', 'sessions.json')
const STORE_FILE = process.env.NAPOLEON_MEMORY_FILE || DEFAULT_FILE
const MAX_SESSIONS = 200

let loaded = false
let store: SessionMap = {}
let writeQueue: Promise<void> = Promise.resolve()

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      store = parsed as SessionMap
    }
  } catch {
    store = {}
  }
  loaded = true
}

async function persistStore() {
  const dir = path.dirname(STORE_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(STORE_FILE, JSON.stringify(store), 'utf8')
}

function trimSessions() {
  const ids = Object.keys(store)
  if (ids.length <= MAX_SESSIONS) return
  const keep = ids.slice(-MAX_SESSIONS)
  const next: SessionMap = {}
  for (const id of keep) next[id] = store[id]
  store = next
}

function enqueuePersist() {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
    trimSessions()
      try {
        await persistStore()
      } catch {
        // In serverless/read-only filesystems keep in-memory history without crashing requests.
      }
    })
  return writeQueue
}

export async function getSessionHistory(sessionId: string) {
  await ensureLoaded()
  if (!store[sessionId]) {
    store[sessionId] = []
  }
  return store[sessionId]
}

export async function saveSessionHistory(sessionId: string, history: ChatMessage[]) {
  await ensureLoaded()
  store[sessionId] = history
  await enqueuePersist()
}
