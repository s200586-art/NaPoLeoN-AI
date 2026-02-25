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
- `NAPOLEON_LOGIN_PASSWORD` — пароль входа в веб-интерфейс (обязательно для закрытого доступа)
- `NAPOLEON_AUTH_SECRET` — секрет для подписи auth-cookie (обязательно в проде)
- `OPENCLAW_KIMI_MODEL` — model id Kimi в OpenClaw (по умолчанию `moonshotai/kimi-k2-instruct`)
- `OPENCLAW_MINIMAX_MODEL` — model id MiniMax в OpenClaw (по умолчанию `minimax/MiniMax-M2.5`)
- `OPENCLAW_MAX_TOKENS` — ограничение длины ответа (меньше = быстрее, по умолчанию `900`)
- `OPENCLAW_HISTORY_LIMIT` — сколько последних сообщений отправлять в модель (меньше = быстрее, по умолчанию `12`)
- `OPENCLAW_TIMEOUT_MS` — таймаут запроса к OpenClaw (по умолчанию `45000`)
- `GMAIL_ACCESS_TOKEN` — OAuth access token Gmail API для чтения inbox
- `GMAIL_USER_ID` — user id для Gmail API (обычно `me`)
- `TELEGRAM_BOT_TOKEN` — токен Telegram-бота, добавленного админом в каналы
- `TELEGRAM_CHANNEL_IDS` — список chat_id каналов через запятую (например `@my_channel,-1001234567890`)
- `X_BEARER_TOKEN` — Bearer token Twitter/X API v2
- `X_USERNAME` — username аккаунта X без `@`
- `DASHBOARD_REQUEST_TIMEOUT_MS` — таймаут внешних запросов дашборда (по умолчанию `8000`)
- `GDRIVE_ACCESS_TOKEN` — OAuth access token Google Drive API для чтения папок/файлов
- `GDRIVE_ROOT_FOLDER_ID` — id корневой папки проектов в Google Drive (по умолчанию `root`)
- `GDRIVE_REQUEST_TIMEOUT_MS` — таймаут запросов к Google Drive (по умолчанию `8000`)
- `GDRIVE_PROJECTS_LIMIT` — сколько папок-проектов отдавать (по умолчанию `40`)
- `GDRIVE_FILES_LIMIT` — сколько файлов проекта отдавать (по умолчанию `100`)

## Стек
- Next.js 14
- TypeScript
- TailwindCSS
- Zustand
- Framer Motion
