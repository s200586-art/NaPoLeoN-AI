'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Message } from '@/lib/store'

interface MessageBubbleProps {
  message: Message
  className?: string
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'flex gap-3 max-w-4xl',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto',
        className
      )}
    >
      {/* Avatar */}
      <div className={cn('shrink-0', isUser && 'order-2')}>
        <Avatar
          fallback={isUser ? 'Вы' : 'AI'}
          size="default"
          className="h-8 w-8"
        />
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-1',
          isUser ? 'items-end order-1' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%]',
            isUser
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-md'
              : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-bl-md'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-zinc-500 dark:bg-zinc-400 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  )
}
