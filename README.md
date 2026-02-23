# AI Command Center (MVP)

Веб-панель в стиле ChatGPT + Manus + Claude + OpenClaw .

## Что есть
- 3-колоночный layout: Sidebar / Chat / Live Log
- Тёмная и светлая тема
- Вкладка Multi-Agent (Claude / Gemini / Codex, mock parallel)
- Вкладка Dashboard (Gmail/Fitbit/Telegram/Twitter mock cards)
- Login + middleware защита по `GATEWAY_TOKEN`
- API routes:
  - `POST /api/chat`
  - `GET /api/live-log` (SSE)
  - `POST /api/multi-agent`

## Запуск
```bash
cd apps/ai-command-center
cp .env.example .env.local
# отредактируй GATEWAY_TOKEN
npm install
npm run dev
```

Открой `http://localhost:3000`.

## Env
- `GATEWAY_TOKEN` — токен для входа (вводится на /login)

## Дальше (следующий этап)
- Подключить реальный OpenClaw gateway API вместо mock routes
- Подтянуть Google Drive/Sheets проекты
- Сохранение истории чатов в БД
- PWA + deploy на поддомен
