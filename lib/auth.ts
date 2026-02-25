import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'

export const AUTH_COOKIE_NAME = 'napoleon_auth'

const AUTH_PASSWORD = process.env.NAPOLEON_LOGIN_PASSWORD || process.env.OPENCLAW_GATEWAY_TOKEN || ''
const AUTH_SECRET = process.env.NAPOLEON_AUTH_SECRET || process.env.OPENCLAW_GATEWAY_TOKEN || 'napoleon-local-secret'

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function isAuthConfigured() {
  return Boolean(AUTH_PASSWORD)
}

export function verifyPassword(password: string) {
  if (!isAuthConfigured()) {
    return false
  }

  return safeCompare(password, AUTH_PASSWORD)
}

export function buildAuthCookieValue() {
  return createHash('sha256')
    .update(`${AUTH_SECRET}|${AUTH_PASSWORD}|v1`)
    .digest('hex')
}

export function isAuthorizedRequest(req: NextRequest) {
  const cookieValue = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!cookieValue) {
    return false
  }

  return safeCompare(cookieValue, buildAuthCookieValue())
}
