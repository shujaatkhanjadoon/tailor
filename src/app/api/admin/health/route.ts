import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbGet } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

async function safeGet(url: string): Promise<any[]> {
  try { return await sbGet(url) as any[] } catch { return [] }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [cronLogs, subs] = await Promise.all([
      safeGet('cron_log?order=started_at.desc&limit=20'),
      safeGet('subscriptions?select=status'),
    ])

    const graceCount = subs.filter((s: any) => s.status === 'grace').length
    const expiringSoon = subs.filter((s: any) => s.status === 'active').length

    const cronSummary = (['expire-subscriptions', 'send-reminders', 'reset-usage', 'cleanup-photos'] as const).map(name => {
      const runs = cronLogs.filter((l: any) => l.name === name)
      const last = runs[0] ?? null
      const recentFailures = runs.filter((r: any) => r.status === 'failed').slice(0, 5)
      return {
        name,
        lastRun: last ? { status: last.status, startedAt: last.started_at, finishedAt: last.finished_at, error: last.error, durationMs: last.duration_ms } : null,
        recentFailures,
        totalRuns: runs.length,
      }
    })

    return NextResponse.json({
      data: {
        cron: cronSummary,
        subscriptions: {
          grace: graceCount,
          activeExpiring: expiringSoon,
        },
        lastUpdated: new Date().toISOString(),
      }
    })
  } catch (e) {
    logger.error('admin', 'Health API error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
