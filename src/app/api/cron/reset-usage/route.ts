// src/app/api/cron/reset-usage/route.ts — replace entirely

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const now       = new Date().toISOString()
  const monthYear = now.slice(0, 7)

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/shop_usage?month_year=neq.${monthYear}`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          orders_this_month: 0,
          month_year:        monthYear,
          updated_at:        now,
        }),
      }
    )

    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)

    console.log('[Cron] reset-usage complete:', { monthYear, at: now })
    return NextResponse.json({ success: true, monthYear, timestamp: now })
  } catch (e) {
    console.error('[Cron] reset-usage error:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
