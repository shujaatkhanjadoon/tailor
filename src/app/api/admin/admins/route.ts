import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbGet } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import type { AdminAccountRow } from '@/lib/supabase/types'

async function safeGet(url: string): Promise<any[]> {
  try { return await sbGet(url) as any[] } catch { return [] }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const raw: AdminAccountRow[] = await safeGet('admin_accounts?order=created_at.desc&select=*') as AdminAccountRow[]
    const safe = raw.map(a => ({
      id: a.id, username: a.username, role: a.role, is_active: a.is_active,
      last_login: a.last_login, created_at: a.created_at, created_by: a.created_by,
    }))
    return NextResponse.json({ data: safe })
  } catch (e) {
    logger.error('admin', 'Admins API error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
