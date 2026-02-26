'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Paperclip, Send, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { MessageAttachment } from '@/lib/store'

export interface ComposerAttachment extends MessageAttachment {
  textContent?: string
}

interface ComposerPayload {
  message: string
  attachments: ComposerAttachment[]
  quickMode: boolean
}

interface FloatingComposerProps {
  onSend: (payload: ComposerPayload) => void
  selectedModel: string
  onModelChange: (model: string) => void
  quickMode: boolean
  onQuickModeChange: (enabled: boolean) => void
  models: string[]
  modelsLoading?: boolean
  disabled?: boolean
  className?: string
}

interface BrowserSpeechRecognitionResult {
  isFinal?: boolean
  [index: number]: { transcript?: string }
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<BrowserSpeechRecognitionResult>
}

interface BrowserSpeechRecognitionErrorEvent {
  error?: string
}

interface BrowserSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition

const MAX_ATTACHMENTS = 6
const MAX_TEXT_ATTACHMENT_SIZE = 2 * 1024 * 1024
const MAX_TEXT_PREVIEW_CHARS = 4000

function isTextLikeFile(file: File) {
  const name = file.name.toLowerCase()
  const textExtensions = [
    '.txt',
    '.md',
    '.json',
    '.csv',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.css',
    '.html',
    '.xml',
    '.yml',
    '.yaml',
  ]
  return file.type.startsWith('text/') || textExtensions.some((ext) => name.endsWith(ext))
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function modelLabel(model: string) {
  const lowered = model.toLowerCase()
  if (lowered.includes('minimax')) return 'MiniMax'
  if (lowered.includes('kimi') || lowered.includes('moonshot')) return 'Kimi'
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

function mapVoiceError(code?: string) {
  if (!code) return 'Ошибка голосового ввода'
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Нет доступа к микрофону'
  if (code === 'network') return 'Ошибка сети при распознавании речи'
  if (code === 'audio-capture') return 'Микрофон не найден'
  if (code === 'no-speech') return 'Не удалось распознать речь'
  return `Ошибка голосового ввода: ${code}`
}

export function FloatingComposer({
  onSend,
  selectedModel,
  onModelChange,
  quickMode,
  onQuickModeChange,
  models,
  modelsLoading,
  disabled,
  className,
}: FloatingComposerProps) {
  const [message, setMessage] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const dictationBaseRef = useRef('')

  const handleSend = async () => {
    if ((message.trim() || attachments.length > 0) && !disabled) {
      if (isListening) {
        recognitionRef.current?.stop()
        setIsListening(false)
      }

      onSend({
        message: message.trim(),
        attachments,
        quickMode,
      })
      setMessage('')
      setAttachments([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const typedWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const SpeechRecognitionApi = typedWindow.SpeechRecognition || typedWindow.webkitSpeechRecognition

    if (!SpeechRecognitionApi) {
      setVoiceSupported(false)
      return
    }

    const recognition = new SpeechRecognitionApi()
    recognition.lang = 'ru-RU'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const phrase = event.results[i]?.[0]?.transcript
        if (phrase) transcript += phrase
      }

      if (!transcript.trim()) return
      const merged = `${dictationBaseRef.current}${transcript}`.replace(/ {2,}/g, ' ')
      setMessage(merged.trimStart())
    }

    recognition.onerror = (event) => {
      setVoiceError(mapVoiceError(event.error))
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setVoiceSupported(true)

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [])

  const toggleVoiceInput = () => {
    if (disabled) return

    if (!voiceSupported || !recognitionRef.current) {
      setVoiceError('Голосовой ввод не поддерживается в этом браузере')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    dictationBaseRef.current = message.trim() ? `${message.trim()} ` : ''
    setVoiceError(null)

    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch {
      setVoiceError('Не удалось запустить голосовой ввод')
      setIsListening(false)
    }
  }

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const remainingSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length)
    const pickedFiles = files.slice(0, remainingSlots)

    const nextAttachments = await Promise.all(
      pickedFiles.map(async (file) => {
        let textContent: string | undefined
        if (isTextLikeFile(file) && file.size <= MAX_TEXT_ATTACHMENT_SIZE) {
          try {
            const rawText = await file.text()
            textContent = rawText.slice(0, MAX_TEXT_PREVIEW_CHARS)
          } catch {
            textContent = undefined
          }
        }

        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          textContent,
        }
      })
    )

    setAttachments((prev) => [...prev, ...nextAttachments])
    event.target.value = ''
  }

  const canSend = Boolean(message.trim() || attachments.length > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('w-full max-w-3xl mx-auto', className)}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border transition-all duration-150',
          'bg-card dark:bg-zinc-900/80 backdrop-blur-xl',
          'shadow-lg shadow-zinc-900/10 dark:shadow-black/20',
          isFocused
            ? 'border-sky-400/60 dark:border-sky-700/80 ring-2 ring-sky-500/20 dark:ring-sky-500/20'
            : 'border-zinc-200 dark:border-zinc-800'
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/60 via-cyan-500/25 to-transparent" />

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFilePick}
          disabled={disabled}
        />

        <div className="p-3">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Напишите сообщение..."
            disabled={disabled}
            className="min-h-[24px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            rows={1}
          />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[180px]">{attachment.name}</span>
                <span className="text-zinc-500 dark:text-zinc-400">({formatBytes(attachment.size)})</span>
                <button
                  type="button"
                  className="text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => {
                    setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
                  }}
                  aria-label={`Удалить ${attachment.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить файл"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8',
                isListening
                  ? 'text-red-500 hover:text-red-400'
                  : voiceSupported
                    ? 'text-violet-500 hover:text-violet-400'
                    : 'text-muted-foreground'
              )}
              disabled={disabled || !voiceSupported}
              onClick={toggleVoiceInput}
              title={
                !voiceSupported
                  ? 'Голосовой ввод не поддерживается'
                  : isListening
                    ? 'Остановить диктовку'
                    : 'Голосовой ввод'
              }
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 transition-colors',
                quickMode
                  ? 'text-sky-500 bg-sky-500/10 hover:bg-sky-500/20 hover:text-sky-400'
                  : 'text-sky-500 hover:text-sky-600 dark:hover:text-sky-300'
              )}
              disabled={disabled}
              onClick={() => onQuickModeChange(!quickMode)}
              title={quickMode ? 'Быстрый режим: включен' : 'Быстрый режим: выключен'}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <label className="min-w-0">
              <span className="sr-only">Выбор модели</span>
              <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={disabled || modelsLoading}
                className={cn(
                  'h-8 max-w-[220px] rounded-lg border border-zinc-200 bg-transparent px-2 text-xs text-muted-foreground outline-none transition-colors',
                  'dark:border-zinc-800',
                  'focus:border-sky-400 focus:text-foreground dark:focus:border-sky-700'
                )}
                title={selectedModel}
              >
                {(models.length > 0 ? models : [selectedModel]).map((model) => (
                  <option key={model} value={model} className="bg-card text-foreground">
                    {modelLabel(model)}
                  </option>
                ))}
              </select>
            </label>
            {modelsLoading && (
              <span className="text-[11px] text-muted-foreground">Обновляю модели…</span>
            )}
            {quickMode && (
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-600 dark:text-sky-300">
                quick
              </span>
            )}
            {isListening && (
              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-300">
                слушаю...
              </span>
            )}
            <span className="truncate text-[11px] text-muted-foreground" title={selectedModel}>
              {selectedModel}
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-full transition-all duration-150',
              canSend
                ? 'bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400'
                : 'bg-zinc-200 dark:bg-zinc-800 text-muted-foreground cursor-not-allowed'
            )}
            onClick={() => void handleSend()}
            disabled={!canSend || disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {voiceError && (
          <p className="px-3 pb-2 text-[11px] text-amber-600 dark:text-amber-300">
            {voiceError}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2">
        ИИ может ошибаться. Проверяйте важные данные.
      </p>
    </motion.div>
  )
}
