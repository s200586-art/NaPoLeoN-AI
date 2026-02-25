import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest } from '@/lib/auth'

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

interface DriveListFilesResponse {
  files?: Array<{
    id?: string
    name?: string
    mimeType?: string
    size?: string
    modifiedTime?: string
    createdTime?: string
    webViewLink?: string
    iconLink?: string
  }>
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const ROOT_FOLDER_FALLBACK = 'root'

function readIntEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, Math.floor(raw)))
}

const REQUEST_TIMEOUT_MS = readIntEnv('GDRIVE_REQUEST_TIMEOUT_MS', 8000, 3000, 30000)
const PROJECTS_LIMIT = readIntEnv('GDRIVE_PROJECTS_LIMIT', 40, 1, 200)
const FILES_LIMIT = readIntEnv('GDRIVE_FILES_LIMIT', 100, 1, 400)

function noStoreJson(data: ProjectsDriveResponse, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return 'Ошибка Google Drive API'
}

function escapeDriveValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function buildParentsQuery(parentId: string, onlyFolders = false) {
  const parts = [`'${escapeDriveValue(parentId)}' in parents`, 'trashed = false']
  if (onlyFolders) {
    parts.push(`mimeType = '${FOLDER_MIME}'`)
  }
  return parts.join(' and ')
}

function buildDriveUrl(query: Record<string, string>) {
  const url = new URL(`${DRIVE_API_BASE}/files`)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function fetchDriveJson<T>(url: string, token: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    const raw = await response.text()
    const data = (() => {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })()

    if (!response.ok) {
      const message =
        (data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'object' &&
        data.error &&
        'message' in data.error
          ? String((data.error as { message?: unknown }).message)
          : null) || `HTTP ${response.status}`
      throw new Error(message)
    }

    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeProjectFolder(item: NonNullable<DriveListFilesResponse['files']>[number]): ProjectFolder | null {
  if (!item.id || !item.name) return null
  return {
    id: item.id,
    name: item.name,
    createdTime: item.createdTime,
    modifiedTime: item.modifiedTime,
    webViewLink: item.webViewLink,
  }
}

function normalizeProjectFile(item: NonNullable<DriveListFilesResponse['files']>[number]): ProjectFile | null {
  if (!item.id || !item.name) return null
  const size =
    typeof item.size === 'string' && item.size.trim() && Number.isFinite(Number(item.size))
      ? Number(item.size)
      : null
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType || 'application/octet-stream',
    size,
    modifiedTime: item.modifiedTime,
    webViewLink: item.webViewLink,
    iconLink: item.iconLink,
  }
}

async function listProjectFolders(token: string, rootFolderId: string) {
  const url = buildDriveUrl({
    q: buildParentsQuery(rootFolderId, true),
    orderBy: 'modifiedTime desc',
    pageSize: String(PROJECTS_LIMIT),
    fields: 'files(id,name,mimeType,createdTime,modifiedTime,webViewLink)',
    corpora: 'allDrives',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  const payload = await fetchDriveJson<DriveListFilesResponse>(url, token)
  return (payload.files || [])
    .map((file) => normalizeProjectFolder(file))
    .filter((file): file is ProjectFolder => Boolean(file))
}

async function listProjectFiles(token: string, projectFolderId: string) {
  const url = buildDriveUrl({
    q: buildParentsQuery(projectFolderId),
    orderBy: 'folder,name_natural,modifiedTime desc',
    pageSize: String(FILES_LIMIT),
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)',
    corpora: 'allDrives',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  const payload = await fetchDriveJson<DriveListFilesResponse>(url, token)
  return (payload.files || [])
    .map((file) => normalizeProjectFile(file))
    .filter((file): file is ProjectFile => Boolean(file))
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
  }

  const token = process.env.GDRIVE_ACCESS_TOKEN?.trim()
  const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID?.trim() || ROOT_FOLDER_FALLBACK
  const requestedProjectId = req.nextUrl.searchParams.get('projectId')?.trim() || null

  const disconnectedResponse: ProjectsDriveResponse = {
    provider: 'google-drive',
    connected: false,
    generatedAt: new Date().toISOString(),
    rootFolderId,
    activeProjectId: null,
    projects: [],
    files: [],
    error: 'Не задан GDRIVE_ACCESS_TOKEN',
  }

  if (!token) {
    return noStoreJson(disconnectedResponse)
  }

  try {
    const projects = await listProjectFolders(token, rootFolderId)
    const activeProjectId = requestedProjectId || projects[0]?.id || null
    let files: ProjectFile[] = []
    let partialError: string | undefined

    if (activeProjectId) {
      try {
        files = await listProjectFiles(token, activeProjectId)
      } catch (error) {
        partialError = normalizeErrorMessage(error)
      }
    }

    return noStoreJson({
      provider: 'google-drive',
      connected: true,
      generatedAt: new Date().toISOString(),
      rootFolderId,
      activeProjectId,
      projects,
      files,
      error: partialError,
    })
  } catch (error) {
    return noStoreJson({
      provider: 'google-drive',
      connected: false,
      generatedAt: new Date().toISOString(),
      rootFolderId,
      activeProjectId: null,
      projects: [],
      files: [],
      error: normalizeErrorMessage(error),
    })
  }
}
