'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Message } from '@/lib/store'

interface MessageBubbleProps {
  message: Message
  className?: string
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const showTypingDots = Boolean(message.isStreaming && !message.content.trim())
  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0)
  const messageTime = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <React.Fragment key={lineIndex}>
          {parts.map((part, partIndex) => {
            if (/^\*\*[^*]+\*\*$/.test(part)) {
              return <strong key={`${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>
            }
            return <React.Fragment key={`${lineIndex}-${partIndex}`}>{part}</React.Fragment>
          })}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      )
    })
  }

  const formatBytes = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'flex w-full gap-3',
        isUser ? 'flex-row-reverse justify-end' : 'justify-start',
        className
      )}
    >
      {/* Avatar */}
      <div className={cn('shrink-0', isUser && 'order-2')}>
        <Avatar
          fallback={isUser ? 'S' : 'N'}
          size="default"
          className="h-8 w-8"
        />
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1',
          isUser ? 'items-end order-1' : 'items-start'
        )}
      >
        <div
          className={cn(
            'relative max-w-full break-words overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-md'
              : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
          )}
        >
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r',
              isUser
                ? 'from-sky-500/70 via-blue-500/35 to-transparent'
                : 'from-violet-500/45 via-fuchsia-500/20 to-transparent'
            )}
          />
          {showTypingDots ? (
            <span className="inline-flex items-center gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: '300ms' }} />
            </span>
          ) : (
            <p className="whitespace-pre-wrap break-words">{renderMessageContent(message.content)}</p>
          )}
          {hasAttachments && (
            <div className="mt-2 flex flex-col gap-1.5">
              {message.attachments?.map((attachment) => (
                <div
                  key={attachment.id}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px]',
                    isUser
                      ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-800'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                  )}
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                  <span className="opacity-75">({formatBytes(attachment.size)})</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {messageTime}
        </span>
      </div>
    </motion.div>
  )
}
