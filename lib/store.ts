'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'chat' | 'agents' | 'dashboard'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface Agent {
  id: string
  name: string
  model: string
  status: 'idle' | 'thinking' | 'working' | 'completed'
  lastMessage?: string
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
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

  // View Mode
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  // Chat
  chats: Chat[]
  activeChat: Chat | null
  setActiveChat: (chat: Chat | null) => void
  addChat: (chat: Chat) => void
  updateChat: (id: string, updates: Partial<Chat>) => void
  addMessage: (chatId: string, message: Message) => void
  updateMessage: (chatId: string, messageId: string, content: string) => void

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

      // View Mode
      viewMode: 'chat',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Chat
      chats: [],
      activeChat: null,
      setActiveChat: (chat) => set({ activeChat: chat }),
      addChat: (chat) => set((state) => ({ 
        chats: [chat, ...state.chats],
        activeChat: chat 
      })),
      updateChat: (id, updates) => set((state) => ({
        chats: state.chats.map(c => c.id === id ? { ...c, ...updates } : c),
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
      updateMessage: (chatId, messageId, content) => set((state) => {
        const updatedChats = state.chats.map(chat => {
          if (chat.id === chatId) {
            return {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === messageId ? { ...msg, content } : msg
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
                  msg.id === messageId ? { ...msg, content } : msg
                )
              }
            : state.activeChat
        }
      }),

      // Agents
      agents: [
        { id: 'claude', name: 'Claude', model: 'Claude 3.5 Sonnet', status: 'idle' },
        { id: 'gemini', name: 'Gemini', model: 'Gemini 2.0 Flash', status: 'idle' },
        { id: 'codex', name: 'Codex', model: 'Codex 3', status: 'idle' },
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
        sidebarOpen: state.sidebarOpen,
        rightPanelOpen: state.rightPanelOpen,
      }),
    }
  )
)
