import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { authenticated: isAuthorizedRequest(req) },
    {
      headers: {
        'cache-control': 'no-store',
      },
    }
  )
}
