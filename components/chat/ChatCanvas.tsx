'use client'

import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { FloatingComposer } from './FloatingComposer'
import { useAppStore, Message, Chat } from '@/lib/store'
import { cn } from '@/lib/utils'

interface ChatCanvasProps {
  className?: string
}

export function ChatCanvas({ className }: ChatCanvasProps) {
  const {
    activeChat,
    addMessage,
    updateMessage,
    setActiveChat,
    addChat,
    addLog,
  } = useAppStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isTyping, setIsTyping] = React.useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages])

  const handleSend = async (content: string) => {
    let chat = activeChat
    if (!chat) {
      chat = {
        id: Math.random().toString(36).slice(2),
        title: content.slice(0, 40) + (content.length > 40 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addChat(chat)
    }

    const userMessage: Message = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    addMessage(chat.id, userMessage)

    addLog({ level: 'info', message: `Отправлено сообщение: "${content.slice(0, 50)}..."` })
    setIsTyping(true)
    addLog({ level: 'info', message: 'Отправляю запрос в OpenClaw...' })

    const assistantMessageId = Math.random().toString(36).slice(2)
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }
    addMessage(chat.id, assistantMessage)

    try {
      // Use persistent session ID stored in localStorage
      const sessionId = typeof window !== 'undefined'
        ? (localStorage.getItem('napoleon_session_id') || 'main')
        : 'main'

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Ошибка запроса к OpenClaw')
      }

      const fullResponse = data?.answer || 'Пустой ответ от Наполи.'
      // Save session ID if returned
      if (data?.sessionId && typeof window !== 'undefined') {
        localStorage.setItem('napoleon_session_id', data.sessionId)
      }
      updateMessage(chat.id, assistantMessageId, fullResponse)
      addLog({ level: 'success', message: 'Ответ получен от Наполи' })
    } catch (e) {
      const errText = e instanceof Error ? e.message : 'Неизвестная ошибка'
      updateMessage(chat.id, assistantMessageId, `Ошибка: ${errText}`)
      addLog({ level: 'error', message: `Ошибка OpenClaw: ${errText}` })
    } finally {
      setIsTyping(false)
    }
  }

  if (!activeChat || activeChat.messages.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full', className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Чем помочь сегодня?</h2>
          <p className="text-muted-foreground max-w-md">
            Начните диалог ниже. Помогу с кодом, аналитикой, контентом и рабочими задачами.
          </p>
        </motion.div>

        {/* Floating composer at bottom */}
        <div className="absolute bottom-6 left-6 right-6">
          <FloatingComposer onSend={handleSend} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {activeChat.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
              <span className="text-xs font-medium">AI</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating composer at bottom */}
      <div className="absolute bottom-6 left-6 right-6">
        <FloatingComposer onSend={handleSend} disabled={isTyping} />
      </div>
    </div>
  )
}
