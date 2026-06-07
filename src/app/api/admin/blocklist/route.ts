import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbGet } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

async function safeGet(url: string): Promise<any[]> {
  try { return await sbGet(url) } catch { return [] }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const items = await safeGet('ip_blocklist?order=blocked_at.desc&limit=100&select=*')
    return NextResponse.json({ data: items })
  } catch (e) {
    logger.error('admin', 'Blocklist API error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
