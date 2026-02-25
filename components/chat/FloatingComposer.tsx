'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Paperclip, Sparkles, X } from 'lucide-react'
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
}

interface FloatingComposerProps {
  onSend: (payload: ComposerPayload) => void
  selectedModel: string
  onModelChange: (model: string) => void
  models: string[]
  modelsLoading?: boolean
  disabled?: boolean
  className?: string
}

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

export function FloatingComposer({
  onSend,
  selectedModel,
  onModelChange,
  models,
  modelsLoading,
  disabled,
  className,
}: FloatingComposerProps) {
  const [message, setMessage] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    if ((message.trim() || attachments.length > 0) && !disabled) {
      onSend({
        message: message.trim(),
        attachments,
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
      handleSend()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

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
      className={cn(
        'w-full max-w-3xl mx-auto',
        className
      )}
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

        {/* Textarea */}
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

        {/* Actions Bar */}
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
              className="h-8 w-8 text-sky-500 hover:text-sky-600 dark:hover:text-sky-300"
              disabled={disabled}
              title="Быстрый режим"
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
            <span
              className="truncate text-[11px] text-muted-foreground"
              title={selectedModel}
            >
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
            onClick={handleSend}
            disabled={!canSend || disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground mt-2">
        ИИ может ошибаться. Проверяйте важные данные.
      </p>
    </motion.div>
  )
}
