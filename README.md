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
- `FITBIT_ACCESS_TOKEN` — OAuth access token Fitbit API (шаги/сон/пульс)
- `FITBIT_USER_ID` — user id Fitbit (обычно `-` для текущего пользователя)
- `FITBIT_TIMEZONE` — таймзона для выборки дневной статистики (например `Asia/Yekaterinburg`)
- `GDRIVE_ACCESS_TOKEN` — OAuth access token Google Drive API для чтения папок/файлов
- `GDRIVE_ROOT_FOLDER_ID` — id корневой папки проектов в Google Drive (по умолчанию `root`)
- `GDRIVE_REQUEST_TIMEOUT_MS` — таймаут запросов к Google Drive (по умолчанию `8000`)
- `GDRIVE_PROJECTS_LIMIT` — сколько папок-проектов отдавать (по умолчанию `40`)
- `GDRIVE_FILES_LIMIT` — сколько файлов проекта отдавать (по умолчанию `100`)
- `NAPOLEON_SHARE_TOKEN` — токен для внешнего POST в Share Inbox (`Authorization: Bearer ...` или `x-share-token`)
- `NAPOLEON_SHARE_INBOX_FILE` — путь к JSON-файлу Share Inbox (если не задан, используется `data/share-inbox.json` или `/tmp/napoleon/share-inbox.json` в serverless)
- `NAPOLEON_SHARE_INBOX_MAX_ITEMS` — лимит сохранённых shared-записей (по умолчанию `500`)
- `NAPOLEON_SHARE_INBOX_MAX_CONTENT` — лимит длины текста одной shared-записи (по умолчанию `20000`)

## Стек
- Next.js 14
- TypeScript
- TailwindCSS
- Zustand
- Framer Motion

## Импорт чатов
- Кнопка `Импорт чатов` находится в левом меню.
- Поддерживаемые форматы JSON:
  - ChatGPT export (`conversations.json`)
  - Claude export (`chat_messages` / `messages`)
  - Gemini export (`conversations` / `messages` / `contents`)
  - generic JSON с массивом `messages` для каждого диалога

## Доска закрепов
- В чате у каждого сообщения есть кнопка pin.
- Закреплённые сообщения попадают в отдельную панель `Доска закрепов` справа от основного экрана.
- Из доски можно перейти в исходный чат или убрать запись из закрепов.
- Поддерживаются категории/теги закрепов и фильтр по ним (Все / Важное / Задача / Идея / Код / Контент / Личное).

## Share Inbox
- Вкладка `Инбокс` показывает входящие shared-элементы из внешних источников.
- API endpoint: `POST /api/share/inbox`.
- Для внешних сервисов используйте `Bearer NAPOLEON_SHARE_TOKEN` (или header `x-share-token`).
- Поддерживаются поля `source`, `title`, `content`/`text`/`message`, `url`, `author`, `tags`.
- Из UI можно помечать карточки статусами (`Новые`/`В работе`/`Готово`), удалять и отправлять карточку в чат.

### Мини-страница share
- Доступна по адресу `/share`.
- Есть пресеты источников (`ChatGPT / Claude / Gemini / Kimi / MiniMax / Web / Manual`).
- Поддерживает авто-заполнение через query:
  - `source`, `title`, `content` (или `text` / `message`), `url`, `author`, `tags`, `token`.
- Из страницы можно скопировать:
  - quick-link на форму;
  - bookmarklet-кнопку для браузера (берёт `title/url/выделенный текст` текущей страницы и открывает `/share`).

## PWA (Android)
- Приложение поддерживает установку как PWA через браузер Chrome на Android.
- Добавлены:
  - `app/manifest.ts` (`/manifest.webmanifest`)
  - `public/sw.js` (service worker)
  - `components/pwa/PWAInstallPrompt.tsx` (кнопка установки в интерфейсе)
- Для установки нужен HTTPS-домен и актуальный деплой.
