import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbGet } from '@/lib/supabase/service'

const TABLES = ['customers', 'orders', 'payments', 'order_photos', 'measurements', 'team_members']

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Number(req.nextUrl.searchParams.get('days')) || 0
  const deletedFilter = days > 0
    ? `deleted_at=lt.${encodeURIComponent(new Date(Date.now() - days * 86400000).toISOString())}`
    : 'deleted_at=not.is.null'

  const counts: Record<string, number> = {}
  for (const table of TABLES) {
    try {
      const rows = await sbGet(`${table}?${deletedFilter}&select=id&limit=10001`)
      counts[table] = rows.length
    } catch {
      counts[table] = -1
    }
  }

  return NextResponse.json({ counts, days })
}
