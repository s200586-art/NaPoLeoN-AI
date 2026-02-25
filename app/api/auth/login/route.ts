import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, buildAuthCookieValue, isAuthConfigured, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: 'Авторизация не настроена: задайте NAPOLEON_LOGIN_PASSWORD' },
        { status: 500 }
      )
    }

    if (!verifyPassword(password)) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: buildAuthCookieValue(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }
}
