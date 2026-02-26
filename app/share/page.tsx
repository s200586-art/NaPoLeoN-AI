'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Link2,
  Rocket,
  Send,
  Shield,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const FORM_STORAGE_KEY = 'napoleon_share_form_v1'

type PresetId = 'chatgpt' | 'claude' | 'gemini' | 'kimi' | 'minimax' | 'web' | 'manual'

interface ShareDraft {
  token: string
  source: PresetId | string
  title: string
  content: string
  url: string
  author: string
  tags: string
}

interface ShareResultState {
  ok: boolean
  message: string
  itemId?: string
}

interface SourcePreset {
  id: PresetId
  label: string
  description: string
  defaultTags: string[]
  accentClassName: string
}

interface PayloadTemplate {
  id: 'chatgpt' | 'claude' | 'gemini'
  label: string
  description: string
  build: (values: {
    title: string
    content: string
    url: string
    author: string
    tags: string[]
  }) => Record<string, unknown>
}

const PRESETS: SourcePreset[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    description: 'импорт из OpenAI',
    defaultTags: ['chatgpt'],
    accentClassName: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'claude',
    label: 'Claude',
    description: 'импорт из Anthropic',
    defaultTags: ['claude'],
    accentClassName: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'импорт из Google',
    defaultTags: ['gemini'],
    accentClassName: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    description: 'импорт из Kimi',
    defaultTags: ['kimi'],
    accentClassName: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    description: 'импорт из MiniMax',
    defaultTags: ['minimax'],
    accentClassName: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  {
    id: 'web',
    label: 'Web',
    description: 'страница/ссылка',
    defaultTags: ['web'],
    accentClassName: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  {
    id: 'manual',
    label: 'Manual',
    description: 'ручной ввод',
    defaultTags: ['manual'],
    accentClassName: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  },
]

const PRESET_IDS = new Set(PRESETS.map((preset) => preset.id))

const PAYLOAD_TEMPLATES: PayloadTemplate[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    description: 'conversation + messages',
    build: ({ title, content, url, author, tags }) => ({
      source: 'chatgpt',
      title: title || 'ChatGPT share',
      conversation: {
        title: title || 'ChatGPT share',
        url: url || 'https://chatgpt.com/share/xxxx',
        messages: [
          { role: 'user', content: 'Сформируй план запуска' },
          { role: 'assistant', content: content || 'План запуска по этапам...' },
        ],
      },
      author: author || undefined,
      tags,
    }),
  },
  {
    id: 'claude',
    label: 'Claude',
    description: 'chat_messages',
    build: ({ title, content, url, author, tags }) => ({
      provider: 'claude',
      title: title || 'Claude share',
      url: url || 'https://claude.ai/chat/xxxx',
      chat_messages: [
        { sender: 'human', text: 'Что улучшить в продукте?' },
        { sender: 'assistant', text: content || 'Три улучшения: ...' },
      ],
      author: author || undefined,
      tags,
    }),
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'contents/parts',
    build: ({ title, content, url, author, tags }) => ({
      provider: 'gemini',
      title: title || 'Gemini share',
      url: url || 'https://gemini.google.com/app/xxxx',
      contents: [
        { role: 'user', parts: [{ text: 'Собери summary диалога' }] },
        { role: 'model', parts: [{ text: content || 'Краткое summary: ...' }] },
      ],
      author: author || undefined,
      tags,
    }),
  },
]

const INITIAL_DRAFT: ShareDraft = {
  token: '',
  source: 'manual',
  title: '',
  content: '',
  url: '',
  author: '',
  tags: '',
}

function parseTagsString(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 8)
}

function mergeTags(current: string, incoming: string[]) {
  const merged = Array.from(new Set([...parseTagsString(current), ...incoming]))
  return merged.join(', ')
}

function getFirst(params: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = params.get(key)
    if (value && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function safeLoadDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FORM_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ShareDraft>
    return {
      token: typeof parsed.token === 'string' ? parsed.token : '',
      source: typeof parsed.source === 'string' ? parsed.source : 'manual',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
      url: typeof parsed.url === 'string' ? parsed.url : '',
      author: typeof parsed.author === 'string' ? parsed.author : '',
      tags: typeof parsed.tags === 'string' ? parsed.tags : '',
    } satisfies ShareDraft
  } catch {
    return null
  }
}

export default function SharePage() {
  const [draft, setDraft] = useState<ShareDraft>(INITIAL_DRAFT)
  const [isMounted, setIsMounted] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<ShareResultState | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const activePreset = useMemo(
    () => PRESETS.find((preset) => preset.id === draft.source) || PRESETS[PRESETS.length - 1],
    [draft.source]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const fromStorage = safeLoadDraft() || INITIAL_DRAFT
    const params = new URLSearchParams(window.location.search)

    const sourceCandidate = getFirst(params, 'source', 'from', 'provider')
    const source = sourceCandidate && PRESET_IDS.has(sourceCandidate as PresetId)
      ? sourceCandidate
      : fromStorage.source

    const nextDraft: ShareDraft = {
      token: getFirst(params, 'token') || fromStorage.token,
      source,
      title: getFirst(params, 'title', 'subject') || fromStorage.title,
      content: getFirst(params, 'content', 'text', 'message') || fromStorage.content,
      url: getFirst(params, 'url', 'link', 'href') || fromStorage.url,
      author: getFirst(params, 'author', 'user') || fromStorage.author,
      tags: getFirst(params, 'tags') || fromStorage.tags,
    }

    setDraft(nextDraft)
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return
    window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(draft))
  }, [draft, isMounted])

  const endpointUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/share/inbox'
    return `${window.location.origin}/api/share/inbox`
  }, [])

  const quickShareLink = useMemo(() => {
    if (typeof window === 'undefined') return '/share'
    const url = new URL('/share', window.location.origin)
    if (draft.source) url.searchParams.set('source', draft.source)
    if (draft.token.trim()) url.searchParams.set('token', draft.token.trim())
    return url.toString()
  }, [draft.source, draft.token])

  const bookmarklet = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const baseUrl = `${window.location.origin}/share`
    const tokenSnippet = draft.token.trim()
      ? `p.set('token', ${JSON.stringify(draft.token.trim())});`
      : ''

    return (
      `javascript:(()=>{` +
      `const p=new URLSearchParams();` +
      `p.set('source','web');` +
      `p.set('title',document.title||'');` +
      `p.set('url',location.href||'');` +
      `const s=(window.getSelection?String(window.getSelection()):'').trim();` +
      `if(s){p.set('content',s);}` +
      tokenSnippet +
      `window.open(${JSON.stringify(baseUrl)}+'?'+p.toString(),'_blank','noopener,noreferrer');` +
      `})();`
    )
  }, [draft.token])

  const canSubmit = Boolean(draft.content.trim() || draft.url.trim())

  const templatePayloadValues = useMemo(
    () => ({
      title: draft.title.trim(),
      content: draft.content.trim(),
      url: draft.url.trim(),
      author: draft.author.trim(),
      tags: parseTagsString(draft.tags),
    }),
    [draft.title, draft.content, draft.url, draft.author, draft.tags]
  )

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  const applyPreset = (preset: SourcePreset) => {
    setDraft((current) => ({
      ...current,
      source: preset.id,
      tags: mergeTags(current.tags, preset.defaultTags),
    }))
  }

  const applyPayloadTemplate = (templateId: PayloadTemplate['id']) => {
    const preset = PRESETS.find((item) => item.id === templateId)
    setDraft((current) => ({
      ...current,
      source: templateId,
      title: current.title || `${templateId.toUpperCase()} share`,
      content: current.content || 'Вставьте ключевой фрагмент диалога...',
      tags: mergeTags(current.tags, preset?.defaultTags || [templateId]),
    }))
  }

  const resetForm = () => {
    setDraft((current) => ({
      ...current,
      title: '',
      content: '',
      url: '',
      author: '',
      tags: '',
    }))
    setResult(null)
  }

  const submitShare = async () => {
    if (isSending || !canSubmit) return

    const token = draft.token.trim()
    const normalizedContent =
      draft.content.trim() || (draft.url.trim() ? `Ссылка: ${draft.url.trim()}` : '')
    const payload = {
      source: draft.source.trim() || 'manual',
      title: draft.title.trim() || undefined,
      content: normalizedContent,
      url: draft.url.trim() || undefined,
      author: draft.author.trim() || undefined,
      tags: parseTagsString(draft.tags),
    }

    setIsSending(true)
    setResult(null)
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (token) {
        headers.authorization = `Bearer ${token}`
      }

      const response = await fetch('/api/share/inbox', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: unknown }).error)
            : `HTTP ${response.status}`
        setResult({ ok: false, message })
        return
      }

      const itemId =
        data && typeof data === 'object' && 'item' in data && data.item && typeof data.item === 'object'
          ? String((data.item as { id?: unknown }).id || '')
          : ''
      setResult({
        ok: true,
        message: 'Материал отправлен в Share Inbox',
        itemId: itemId || undefined,
      })
      setDraft((current) => ({
        ...current,
        title: '',
        content: '',
        url: '',
        tags: '',
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка отправки'
      setResult({ ok: false, message })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-500/10 via-background to-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-zinc-900/60 sm:p-6"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/70 via-cyan-500/35 to-transparent" />

          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                Quick Share
              </div>
              <h1 className="text-2xl font-semibold">Поделиться в NaPoLeoN</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Мини-страница для отправки заметок, ссылок и фрагментов текста в общий инбокс.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300/70 px-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть приложение
              </Link>
            </div>
          </div>

          <section className="mb-5 rounded-xl border border-border bg-background/80 p-4 dark:bg-zinc-950/20">
            <p className="mb-2 text-sm font-medium">Пресеты источника</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const active = preset.id === draft.source
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? preset.accentClassName
                        : 'border-zinc-300/70 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    )}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Сейчас выбран: <span className="font-medium">{activePreset.label}</span> ({activePreset.description})
            </p>
          </section>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Share token (опционально)</span>
              <Input
                value={draft.token}
                onChange={(event) => setDraft((current) => ({ ...current, token: event.target.value }))}
                placeholder="NAPOLEON_SHARE_TOKEN"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Автор</span>
              <Input
                value={draft.author}
                onChange={(event) => setDraft((current) => ({ ...current, author: event.target.value }))}
                placeholder="например: Sergey"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Заголовок</span>
              <Input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Короткое название заметки"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Текст (главное поле)</span>
              <Textarea
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                placeholder="Вставьте фрагмент диалога, идею, задачу или вывод..."
                rows={8}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Ссылка</span>
              <Input
                value={draft.url}
                onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Теги (через запятую)</span>
              <Input
                value={draft.tags}
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                placeholder="важное, идея, запуск"
              />
            </label>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={submitShare}
              disabled={!canSubmit || isSending}
              className="h-10 gap-2 bg-sky-600 text-white hover:bg-sky-500"
            >
              <Send className="h-4 w-4" />
              {isSending ? 'Отправка...' : 'Отправить в Share Inbox'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Очистить поля
            </Button>
            <a
              href="/api/share/inbox"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-300/70 px-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Link2 className="h-4 w-4" />
              Проверить API
            </a>
          </div>

          {result && (
            <div
              className={cn(
                'mb-5 rounded-xl border px-3 py-2 text-sm',
                result.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
              )}
            >
              <div className="flex items-center gap-2">
                {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                <span>{result.message}</span>
                {result.itemId && <code className="text-[11px] opacity-80">id: {result.itemId}</code>}
              </div>
            </div>
          )}

          <section className="mb-5 rounded-xl border border-border bg-background/80 p-4 dark:bg-zinc-950/20">
            <div className="mb-2 flex items-center gap-2">
              <Send className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-medium">Готовые payload-шаблоны</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Для кнопок share из ChatGPT / Claude / Gemini можно использовать готовые JSON структуры.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PAYLOAD_TEMPLATES.map((template) => {
                const json = JSON.stringify(template.build(templatePayloadValues), null, 2)
                return (
                  <div
                    key={template.id}
                    className="rounded-lg border border-border bg-card/70 p-3 dark:bg-zinc-900/30"
                  >
                    <p className="text-sm font-medium">{template.label}</p>
                    <p className="mb-2 text-[11px] text-muted-foreground">{template.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyPayloadTemplate(template.id)}
                        className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-700 transition-colors hover:bg-sky-500/20 dark:text-sky-300"
                      >
                        Заполнить форму
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(`payload-${template.id}`, json)}
                        className="rounded-md border border-zinc-300/70 px-2 py-1 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {copied === `payload-${template.id}` ? 'JSON скопирован' : 'Копировать JSON'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-background/80 p-4 dark:bg-zinc-950/20">
            <div className="mb-2 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-medium">Быстрая кнопка Share</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Можно копировать ссылку на мини-форму или bookmarklet для браузера.
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText('link', quickShareLink)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
              >
                <Clipboard className="h-3.5 w-3.5" />
                {copied === 'link' ? 'Ссылка скопирована' : 'Копировать quick-link'}
              </button>
              <button
                type="button"
                onClick={() => void copyText('bookmarklet', bookmarklet)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-500/20 dark:text-cyan-300"
              >
                <Rocket className="h-3.5 w-3.5" />
                {copied === 'bookmarklet' ? 'Bookmarklet скопирован' : 'Копировать bookmarklet'}
              </button>
            </div>

            <p className="mb-2 text-[11px] text-muted-foreground">
              Endpoint: <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{endpointUrl}</code>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Для внешнего доступа передайте `Bearer token` в header или заполните поле token выше.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  )
}
