import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbFetch } from '@/lib/supabase/service'
import { subscriptionExpiresAt } from '@/lib/billing/cycles'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subs = await sbFetch(
      "subscriptions?plan=neq.starter&status=eq.active&expires_at=is.null&select=id,shop_id,billing_cycle"
    ).then(r => r.json()) as { id: string; shop_id: string; billing_cycle: string | null }[]

    let updated = 0
    for (const sub of subs) {
      const expiresAt = subscriptionExpiresAt(sub.billing_cycle ?? 'monthly')
      if (!expiresAt) continue
      await sbFetch(`subscriptions?id=eq.${sub.id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal', 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_at: expiresAt }),
      })
      updated++
    }

    logger.info('admin', `Backfill expiry: ${updated}/${subs.length} subscriptions updated`)
    return NextResponse.json({ success: true, total: subs.length, updated })
  } catch (e) {
    logger.error('admin', 'Backfill expiry error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
