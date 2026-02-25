'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

type Provider = 'google-drive'

interface ProjectFolder {
  id: string
  name: string
  createdTime?: string
  modifiedTime?: string
  webViewLink?: string
}

interface ProjectFile {
  id: string
  name: string
  mimeType: string
  size: number | null
  modifiedTime?: string
  webViewLink?: string
  iconLink?: string
}

interface ProjectsDriveResponse {
  provider: Provider
  connected: boolean
  generatedAt: string
  rootFolderId: string
  activeProjectId: string | null
  projects: ProjectFolder[]
  files: ProjectFile[]
  error?: string
}

function isProjectsDriveResponse(value: unknown): value is ProjectsDriveResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ProjectsDriveResponse>
  return (
    typeof candidate.provider === 'string' &&
    typeof candidate.connected === 'boolean' &&
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.rootFolderId === 'string' &&
    Array.isArray(candidate.projects) &&
    Array.isArray(candidate.files)
  )
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Не удалось загрузить проекты'
}

function formatRelativeTime(iso?: string) {
  if (!iso) return 'нет данных'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'нет данных'

  const deltaSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (deltaSeconds < 30) return 'только что'
  if (deltaSeconds < 60) return `${deltaSeconds} сек назад`

  const deltaMinutes = Math.floor(deltaSeconds / 60)
  if (deltaMinutes < 60) return `${deltaMinutes} мин назад`

  const deltaHours = Math.floor(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours} ч назад`

  const deltaDays = Math.floor(deltaHours / 24)
  return `${deltaDays} д назад`
}

function formatBytes(value: number | null) {
  if (typeof value !== 'number' || value < 0) return '—'
  if (value < 1024) return `${value} B`
  const kb = value / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function normalizeMimeLabel(mimeType: string) {
  if (mimeType === 'application/vnd.google-apps.folder') return 'Папка'
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc'
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet'
  if (mimeType === 'application/vnd.google-apps.presentation') return 'Google Slides'
  if (mimeType.startsWith('image/')) return 'Изображение'
  if (mimeType.startsWith('video/')) return 'Видео'
  if (mimeType.startsWith('audio/')) return 'Аудио'
  if (mimeType.startsWith('text/')) return 'Текст'
  return mimeType
}

export function ProjectsView() {
  const { addLog } = useAppStore()

  const [data, setData] = useState<ProjectsDriveResponse | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const loadProjects = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const refresh = opts?.refresh ?? false
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      try {
        const url = new URL('/api/projects/drive', window.location.origin)
        if (selectedProjectId) {
          url.searchParams.set('projectId', selectedProjectId)
        }

        const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error?: unknown }).error)
              : `HTTP ${response.status}`
          throw new Error(message)
        }

        if (!isProjectsDriveResponse(payload)) {
          throw new Error('Некорректный ответ API проектов')
        }

        if (requestId !== requestIdRef.current) {
          return
        }

        setData(payload)
        setError(payload.error || null)

        if (!payload.connected) {
          addLog({
            level: 'warn',
            message: payload.error || 'Google Drive не подключен',
          })
        } else if (payload.error) {
          addLog({
            level: 'warn',
            message: `Проекты: ${payload.error}`,
          })
        }
      } catch (loadError) {
        if (requestId !== requestIdRef.current) {
          return
        }

        const message = toErrorMessage(loadError)
        setError(message)
        addLog({ level: 'error', message: `Ошибка проектов: ${message}` })
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [addLog, selectedProjectId]
  )

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const activeProjectId = selectedProjectId || data?.activeProjectId || null
  const activeProject = useMemo(
    () => data?.projects.find((project) => project.id === activeProjectId) || null,
    [data?.projects, activeProjectId]
  )

  const handleSelectProject = (projectId: string) => {
    if (projectId === activeProjectId) return
    setSelectedProjectId(projectId)
  }

  const handleRefresh = () => {
    void loadProjects({ refresh: true })
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
            Google Drive
          </div>
          <h1 className="text-2xl font-semibold">Проекты</h1>
          <p className="mt-1 text-muted-foreground">Google Drive папки проекта и документы</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data ? `Обновлено ${formatRelativeTime(data.generatedAt)}` : 'Данные не загружены'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
            isRefreshing || isLoading
              ? 'cursor-not-allowed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500'
              : 'border-sky-300/60 text-sky-700 hover:bg-sky-50 dark:border-sky-700/60 dark:text-sky-300 dark:hover:bg-sky-900/20'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', (isRefreshing || isLoading) && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!isLoading && data && !data.connected && (
        <div className="mb-5 rounded-xl border border-border bg-card p-4 dark:bg-zinc-900/50">
          <p className="text-sm text-muted-foreground">
            Подключите Google Drive, задав `GDRIVE_ACCESS_TOKEN`. Опционально укажите `GDRIVE_ROOT_FOLDER_ID`.
          </p>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card dark:bg-zinc-900/50"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500/70 via-yellow-500/40 to-transparent" />
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-4">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-medium">Папки проектов</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-11 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : (data?.projects.length || 0) === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Папки проектов не найдены</div>
            ) : (
              <div className="space-y-1">
                {data?.projects.map((project) => {
                  const isActive = project.id === activeProjectId
                  return (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={cn(
                        'w-full rounded-lg border-l-2 px-3 py-2 text-left transition-colors',
                        isActive
                          ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/10'
                          : 'border-transparent hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60'
                      )}
                    >
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {project.modifiedTime
                          ? `Изм. ${formatRelativeTime(project.modifiedTime)}`
                          : 'нет даты изменения'}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card dark:bg-zinc-900/50"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/70 via-cyan-500/40 to-transparent" />
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-sky-500" />
              <div>
                <h2 className="text-sm font-medium">
                  {activeProject ? activeProject.name : 'Файлы проекта'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data ? `${data.files.length} файлов` : 'Нет данных'}
                </p>
              </div>
            </div>
            {activeProject?.webViewLink && (
              <a
                href={activeProject.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-sky-300/60 px-2 py-1 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-700/60 dark:text-sky-300 dark:hover:bg-sky-900/20"
              >
                Открыть
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
            ) : data && data.files.length > 0 ? (
              <div className="divide-y divide-border">
                {data.files.map((file) => {
                  const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sky-500/5 dark:hover:bg-sky-500/10"
                    >
                      {isFolder ? (
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{file.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {normalizeMimeLabel(file.mimeType)} • {formatBytes(file.size)} •{' '}
                          {formatRelativeTime(file.modifiedTime)}
                        </p>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                          title="Открыть в Google Drive"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                {activeProject
                  ? 'В этой папке пока нет файлов'
                  : 'Выберите проект слева, чтобы посмотреть документы'}
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
