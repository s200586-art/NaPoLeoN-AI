# NaPoLeoN Command Center.

Импортированная версия интерфейса из MiniMax (Nexus) с русской локализацией UI.

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Переменные окружения
- `OPENCLAW_GATEWAY_URL` — HTTPS URL gateway (например `https://cv5547021.tail90a702.ts.net`)
- `OPENCLAW_GATEWAY_TOKEN` — токен из `/root/.openclaw/openclaw.json` → `gateway.auth.token`
- `OPENCLAW_MODEL` — модель для ответа (опционально)

## Стек
- Next.js 14
- TypeScript
- TailwindCSS
- Zustand
- Framer Motion
