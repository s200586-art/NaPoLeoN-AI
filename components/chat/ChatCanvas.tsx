'use client'

import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { ComposerAttachment, FloatingComposer } from './FloatingComposer'
import { useAppStore, Message } from '@/lib/store'
import { cn } from '@/lib/utils'

interface ChatCanvasProps {
  className?: string
}

interface ModelsResponse {
  models?: string[]
  defaultModel?: string
}

export function ChatCanvas({ className }: ChatCanvasProps) {
  const {
    activeChat,
    addMessage,
    updateMessage,
    addChat,
    addLog,
    selectedModel,
    setSelectedModel,
  } = useAppStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isTyping, setIsTyping] = React.useState(false)
  const [models, setModels] = React.useState<string[]>([selectedModel])
  const [modelsLoading, setModelsLoading] = React.useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages])

  useEffect(() => {
    let active = true
    const loadModels = async () => {
      setModelsLoading(true)
      try {
        const res = await fetch('/api/models', { cache: 'no-store' })
        const data = (await res.json()) as ModelsResponse
        if (!active) return

        const incomingModels = Array.isArray(data.models)
          ? data.models.filter((model) => typeof model === 'string' && model.trim())
          : []

        const normalizedModels = incomingModels.length > 0 ? incomingModels : [selectedModel]
        const mergedModels = Array.from(new Set([...normalizedModels, selectedModel])).filter(Boolean)
        setModels(mergedModels)

        if (incomingModels.length > 0 && !incomingModels.includes(selectedModel)) {
          setSelectedModel(data.defaultModel || incomingModels[0])
        }
      } catch {
        if (!active) return
        setModels((prev) => (prev.length > 0 ? prev : [selectedModel]))
      } finally {
        if (active) {
          setModelsLoading(false)
        }
      }
    }

    loadModels()
    return () => {
      active = false
    }
  }, [selectedModel, setSelectedModel])

  const handleSend = async (payload: { message: string; attachments: ComposerAttachment[] }) => {
    const content = payload.message.trim()
    const attachments = payload.attachments
    let chat = activeChat

    const chatTitleSource = content || attachments[0]?.name || 'Новый чат'
    const userVisibleContent = content || 'Отправлено вложение'

    if (!chat) {
      chat = {
        id: Math.random().toString(36).slice(2),
        title: chatTitleSource.slice(0, 40) + (chatTitleSource.length > 40 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addChat(chat)
    }

    const userMessage: Message = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: userVisibleContent,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        type: attachment.type,
      })),
      timestamp: new Date(),
    }
    addMessage(chat.id, userMessage)

    const sentLabel = content || `${attachments.length} вложений`
    addLog({
      level: 'info',
      message: `Отправлено: "${sentLabel.slice(0, 50)}..." (${selectedModel})`,
    })
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
        body: JSON.stringify({
          message: content,
          sessionId,
          model: selectedModel,
          attachments: attachments.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            textContent: attachment.textContent,
          })),
        }),
      })

      const raw = await res.text()
      const data = (() => {
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      })()

      if (!res.ok) {
        throw new Error(
          data?.error ||
          `Ошибка запроса к OpenClaw (${res.status})${raw ? `: ${raw.slice(0, 180)}` : ''}`
        )
      }

      const fullResponse = data?.answer || 'Пустой ответ от Наполи.'
      // Save session ID if returned
      if (data?.sessionId && typeof window !== 'undefined') {
        localStorage.setItem('napoleon_session_id', data.sessionId)
      }
      updateMessage(chat.id, assistantMessageId, fullResponse)
      addLog({ level: 'success', message: `Ответ получен от Наполи (${selectedModel})` })
    } catch (e) {
      const errText = e instanceof Error ? e.message : 'Неизвестная ошибка'
      updateMessage(chat.id, assistantMessageId, `Ошибка: ${errText}`)
      addLog({ level: 'error', message: `Ошибка OpenClaw: ${errText}` })
    } finally {
      setIsTyping(false)
    }
  }

  const hasMessages = Boolean(activeChat && activeChat.messages.length > 0)

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {hasMessages ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            {activeChat?.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-10">
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
        </div>
      )}

      <div className="shrink-0 border-t border-border/70 bg-background/80 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
        <FloatingComposer
          onSend={handleSend}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          models={models}
          modelsLoading={modelsLoading}
          disabled={isTyping}
        />
      </div>
    </div>
  )
}
