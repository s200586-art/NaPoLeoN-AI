# NaPoLeoN Command Center.

Импортированная версия интерфейса из MiniMax (Nexus) с русской локализацией UI .

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Переменные окружения
- `OPENCLAW_GATEWAY_URL` — HTTPS URL gateway (например `https://npln.tech`)
- `OPENCLAW_GATEWAY_TOKEN` — токен из `/root/.openclaw/openclaw.json` → `gateway.auth.token`
- `OPENCLAW_KIMI_MODEL` — model id Kimi в OpenClaw (по умолчанию `moonshotai/kimi-k2-instruct`)
- `OPENCLAW_MINIMAX_MODEL` — model id MiniMax в OpenClaw (по умолчанию `minimax/MiniMax-M2.5`)
- `OPENCLAW_MAX_TOKENS` — ограничение длины ответа (меньше = быстрее, по умолчанию `900`)
- `OPENCLAW_HISTORY_LIMIT` — сколько последних сообщений отправлять в модель (меньше = быстрее, по умолчанию `12`)
- `OPENCLAW_TIMEOUT_MS` — таймаут запроса к OpenClaw (по умолчанию `45000`)

## Стек
- Next.js 14
- TypeScript
- TailwindCSS
- Zustand
- Framer Motion
