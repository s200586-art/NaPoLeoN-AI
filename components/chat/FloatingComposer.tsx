'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Paperclip, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface FloatingComposerProps {
  onSend: (message: string) => void
  disabled?: boolean
  className?: string
}

export function FloatingComposer({ onSend, disabled, className }: FloatingComposerProps) {
  const [message, setMessage] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
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
          'relative rounded-2xl border transition-all duration-150',
          'bg-card dark:bg-zinc-900/80 backdrop-blur-xl',
          'shadow-lg shadow-zinc-900/10 dark:shadow-black/20',
          isFocused
            ? 'border-zinc-300 dark:border-zinc-700 ring-2 ring-zinc-200 dark:ring-zinc-800'
            : 'border-zinc-200 dark:border-zinc-800'
        )}
      >
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

        {/* Actions Bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground h-8"
              disabled={disabled}
            >
              <span className="text-xs">Модель</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          <Button
            size="icon"
            className={cn(
              'h-8 w-8 rounded-full transition-all duration-150',
              message.trim()
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                : 'bg-zinc-200 dark:bg-zinc-800 text-muted-foreground cursor-not-allowed'
            )}
            onClick={handleSend}
            disabled={!message.trim() || disabled}
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
