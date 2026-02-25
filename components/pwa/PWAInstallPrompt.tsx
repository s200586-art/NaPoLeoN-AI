'use client'

import React, { useEffect, useState } from 'react'
import { Download, Smartphone, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const PROMPT_DISMISS_KEY = 'napoleon_pwa_prompt_dismissed_v1'

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore registration errors, app works without PWA shell.
      })
    }

    const standaloneMode = window.matchMedia('(display-mode: standalone)').matches
    const iosStandalone = Boolean(
      'standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone
    )
    if (standaloneMode || iosStandalone) {
      setIsInstalled(true)
    }

    const dismissed = window.localStorage.getItem(PROMPT_DISMISS_KEY) === '1'
    if (dismissed) {
      setIsDismissed(true)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      setDeferredPrompt(installEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      window.localStorage.removeItem(PROMPT_DISMISS_KEY)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setIsInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROMPT_DISMISS_KEY, '1')
    }
  }

  const visible = Boolean(deferredPrompt) && !isDismissed && !isInstalled

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed bottom-4 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)]"
        >
          <div
            className={cn(
              'pointer-events-auto relative overflow-hidden rounded-2xl border border-sky-500/30',
              'bg-card/95 p-4 shadow-xl backdrop-blur dark:bg-zinc-900/90'
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/80 via-cyan-500/40 to-transparent" />
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
              aria-label="Скрыть подсказку установки"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div className="rounded-xl bg-sky-500/15 p-2 text-sky-500">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Установить на телефон</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Добавьте NaPoLeoN как приложение для более быстрого запуска.
                </p>
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className={cn(
                    'mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    isInstalling
                      ? 'cursor-not-allowed bg-sky-300/40 text-sky-700 dark:bg-sky-700/40 dark:text-sky-300'
                      : 'bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400'
                  )}
                >
                  <Download className="h-3.5 w-3.5" />
                  {isInstalling ? 'Устанавливаю...' : 'Установить'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
