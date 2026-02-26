'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'chat' | 'agents' | 'dashboard' | 'projects'

export interface MessageAttachment {
  id: string
  name: string
  size: number
  type: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  attachments?: MessageAttachment[]
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface PinnedNote {
  id: string
  chatId: string
  chatTitle: string
  messageId: string
  role: Message['role']
  content: string
  tags: string[]
  timestamp: Date
  pinnedAt: Date
}

export interface Agent {
  id: string
  name: string
  model: string
  status: 'idle' | 'thinking' | 'working' | 'completed' | 'planned'
  lastMessage?: string
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

const DEFAULT_SELECTED_MODEL = 'moonshotai/kimi-k2-instruct'
export const PINNED_TAGS = [
  'Важное',
  'Задача',
  'Идея',
  'Код',
  'Контент',
  'Личное',
] as const

function inferPinnedTags(content: string) {
  const text = content.toLowerCase()
  const tags: string[] = []

  if (/(важно|срочно|критич|приоритет)/i.test(text)) tags.push('Важное')
  if (/(задач|todo|сделать|нужно|надо|план|этап)/i.test(text)) tags.push('Задача')
  if (/(идея|гипотез|концепт|придум|вариант)/i.test(text)) tags.push('Идея')
  if (/(код|bug|ошибк|fix|api|deploy|build|ts|js|next|refactor)/i.test(text)) tags.push('Код')
  if (/(контент|пост|статья|текст|реклама|канал|письм|twitter|x )/i.test(text)) tags.push('Контент')

  if (tags.length === 0) {
    tags.push('Личное')
  }

  return Array.from(new Set(tags)).slice(0, 3)
}

interface AppState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Auth
  isAuthenticated: boolean
  setAuthenticated: (value: boolean) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (value: boolean) => void

  // Right Panel
  rightPanelOpen: boolean
  setRightPanelOpen: (value: boolean) => void

  // Pinned Board
  pinnedBoardOpen: boolean
  setPinnedBoardOpen: (value: boolean) => void

  // View Mode
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // Chat
  chats: Chat[]
  activeChat: Chat | null
  setActiveChat: (chat: Chat | null) => void
  addChat: (chat: Chat) => void
  importChats: (chats: Chat[]) => void
  removeChat: (id: string) => void
  updateChat: (id: string, updates: Partial<Chat>) => void
  addMessage: (chatId: string, message: Message) => void
  updateMessage: (chatId: string, messageId: string, content: string, isStreaming?: boolean) => void
  pinnedNotes: PinnedNote[]
  togglePinnedMessage: (chatId: string, message: Message) => void
  togglePinnedTag: (id: string, tag: string) => void
  removePinnedMessage: (id: string) => void
  clearPinnedMessages: () => void

  // Model
  selectedModel: string
  setSelectedModel: (model: string) => void

  // Agents
  agents: Agent[]
  setAgentStatus: (id: string, status: Agent['status']) => void
  setAgentMessage: (id: string, message: string) => void

  // Logs
  logs: LogEntry[]
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme })
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark')
        } else {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          document.documentElement.classList.toggle('dark', isDark)
        }
      },

      // Auth
      isAuthenticated: false,
      setAuthenticated: (value) => set({ isAuthenticated: value }),

      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (value) => set({ sidebarOpen: value }),

      // Right Panel
      rightPanelOpen: true,
      setRightPanelOpen: (value) => set({ rightPanelOpen: value }),

      // Pinned Board
      pinnedBoardOpen: true,
      setPinnedBoardOpen: (value) => set({ pinnedBoardOpen: value }),

      // View Mode
      viewMode: 'chat',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Chat
      chats: [],
      activeChat: null,
      pinnedNotes: [],
      setActiveChat: (chat) => set({ activeChat: chat }),
      addChat: (chat) => set((state) => ({ 
        chats: [chat, ...state.chats],
        activeChat: chat 
      })),
      importChats: (incomingChats) =>
        set((state) => {
          const normalizedChats = incomingChats
            .filter((chat) => chat && Array.isArray(chat.messages) && chat.messages.length > 0)
            .map((chat) => ({
              ...chat,
              title: chat.title?.trim() || 'Импортированный чат',
              createdAt: new Date(chat.createdAt),
              updatedAt: new Date(chat.updatedAt),
              messages: chat.messages
                .filter((message) => message.content?.trim())
                .map((message) => ({
                  ...message,
                  timestamp: new Date(message.timestamp),
                  isStreaming: false,
                })),
            }))
            .filter((chat) => chat.messages.length > 0)

          if (normalizedChats.length === 0) {
            return {}
          }

          return {
            chats: [...normalizedChats, ...state.chats],
            activeChat: normalizedChats[0] || state.activeChat,
          }
        }),
      removeChat: (id) => set((state) => {
        const nextChats = state.chats.filter((chat) => chat.id !== id)
        const activeRemoved = state.activeChat?.id === id
        return {
          chats: nextChats,
          pinnedNotes: state.pinnedNotes.filter((note) => note.chatId !== id),
          activeChat: activeRemoved ? (nextChats[0] ?? null) : state.activeChat,
        }
      }),
      updateChat: (id, updates) => set((state) => ({
        chats: state.chats.map(c => c.id === id ? { ...c, ...updates } : c),
        pinnedNotes: state.pinnedNotes.map((note) =>
          note.chatId === id && typeof updates.title === 'string'
            ? { ...note, chatTitle: updates.title }
            : note
        ),
        activeChat: state.activeChat?.id === id 
          ? { ...state.activeChat, ...updates }
          : state.activeChat
      })),
      addMessage: (chatId, message) => set((state) => {
        const updatedChats = state.chats.map(chat => {
          if (chat.id === chatId) {
            return {
              ...chat,
              messages: [...chat.messages, message],
              updatedAt: new Date()
            }
          }
          return chat
        })
        return {
          chats: updatedChats,
          activeChat: state.activeChat?.id === chatId
            ? { ...state.activeChat, messages: [...state.activeChat.messages, message] }
            : state.activeChat
        }
      }),
      updateMessage: (chatId, messageId, content, isStreaming = false) => set((state) => {
        const updatedChats = state.chats.map(chat => {
          if (chat.id === chatId) {
            return {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === messageId ? { ...msg, content, isStreaming } : msg
              )
            }
          }
          return chat
        })
        return {
          chats: updatedChats,
          activeChat: state.activeChat?.id === chatId
            ? {
                ...state.activeChat,
                messages: state.activeChat.messages.map(msg =>
                  msg.id === messageId ? { ...msg, content, isStreaming } : msg
                )
              }
            : state.activeChat,
          pinnedNotes: state.pinnedNotes.map((note) =>
            note.chatId === chatId && note.messageId === messageId && content.trim()
              ? { ...note, content: content.trim() }
              : note
          ),
        }
      }),
      togglePinnedMessage: (chatId, message) =>
        set((state) => {
          const existing = state.pinnedNotes.find(
            (note) => note.chatId === chatId && note.messageId === message.id
          )
          if (existing) {
            return {
              pinnedNotes: state.pinnedNotes.filter((note) => note.id !== existing.id),
            }
          }

          const content = message.content.trim()
          if (!content) {
            return {}
          }

          const chat = state.chats.find((candidate) => candidate.id === chatId)
          const note: PinnedNote = {
            id: `${chatId}:${message.id}`,
            chatId,
            chatTitle: chat?.title || 'Чат',
            messageId: message.id,
            role: message.role,
            content,
            tags: inferPinnedTags(content),
            timestamp: new Date(message.timestamp),
            pinnedAt: new Date(),
          }

          return {
            pinnedNotes: [note, ...state.pinnedNotes].slice(0, 120),
            pinnedBoardOpen: true,
          }
        }),
      togglePinnedTag: (id, tag) =>
        set((state) => {
          if (!PINNED_TAGS.includes(tag as (typeof PINNED_TAGS)[number])) {
            return {}
          }

          const nextPinnedNotes = state.pinnedNotes.map((note) => {
            if (note.id !== id) return note

            const currentTags = Array.isArray(note.tags) ? note.tags : []
            const hasTag = currentTags.includes(tag)
            const nextTags = hasTag
              ? currentTags.filter((item) => item !== tag)
              : [...currentTags, tag].slice(0, 4)

            return {
              ...note,
              tags: nextTags,
            }
          })

          return {
            pinnedNotes: nextPinnedNotes,
          }
        }),
      removePinnedMessage: (id) =>
        set((state) => ({
          pinnedNotes: state.pinnedNotes.filter((note) => note.id !== id),
        })),
      clearPinnedMessages: () => set({ pinnedNotes: [] }),

      // Model
      selectedModel: DEFAULT_SELECTED_MODEL,
      setSelectedModel: (model) => set({ selectedModel: model }),

      // Agents
      agents: [
        { id: 'kimi', name: 'Kimi', model: 'moonshotai/kimi-k2-instruct', status: 'idle' },
        { id: 'minimax', name: 'MiniMax', model: 'minimax/MiniMax-M2.5', status: 'idle' },
        { id: 'glm', name: 'GLM', model: 'Будет добавлен позже', status: 'planned' },
      ],
      setAgentStatus: (id, status) => set((state) => ({
        agents: state.agents.map(a => a.id === id ? { ...a, status } : a)
      })),
      setAgentMessage: (id, message) => set((state) => ({
        agents: state.agents.map(a => a.id === id ? { ...a, lastMessage: message } : a)
      })),

      // Logs
      logs: [],
      addLog: (entry) => set((state) => ({
        logs: [...state.logs, { ...entry, id: Math.random().toString(36).slice(2), timestamp: new Date() }]
      })),
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'nexus-storage',
      partialize: (state) => ({
        theme: state.theme,
        chats: state.chats,
        pinnedNotes: state.pinnedNotes,
        pinnedBoardOpen: state.pinnedBoardOpen,
        sidebarOpen: state.sidebarOpen,
        rightPanelOpen: state.rightPanelOpen,
        selectedModel: state.selectedModel,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<AppState>
        const normalizedChats = (typedState.chats ?? []).map((chat) => ({
          ...chat,
          messages: (chat.messages ?? []).map((message) => ({
            ...message,
            isStreaming: false,
            attachments: (message.attachments ?? []).map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              size: attachment.size,
              type: attachment.type,
            })),
          })),
        }))

        const rawPinnedNotes = Array.isArray(typedState.pinnedNotes) ? typedState.pinnedNotes : []
        const normalizedPinnedNotes = rawPinnedNotes.map((note) => ({
          ...note,
          tags: Array.isArray(note.tags)
            ? note.tags.filter((tag): tag is string => typeof tag === 'string')
            : inferPinnedTags(String(note.content || '')),
          timestamp: new Date(note.timestamp),
          pinnedAt: new Date(note.pinnedAt),
        }))

        return {
          ...currentState,
          ...typedState,
          chats: normalizedChats,
          pinnedNotes: normalizedPinnedNotes,
          pinnedBoardOpen:
            typeof typedState.pinnedBoardOpen === 'boolean'
              ? typedState.pinnedBoardOpen
              : currentState.pinnedBoardOpen,
          selectedModel:
            typeof typedState.selectedModel === 'string' &&
            /(kimi|moonshot|minimax)/i.test(typedState.selectedModel)
              ? typedState.selectedModel
              : DEFAULT_SELECTED_MODEL,
        }
      },
    }
  )
)
