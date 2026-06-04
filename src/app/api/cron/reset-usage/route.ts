// src/app/api/cron/reset-usage/route.ts — replace entirely

import { NextRequest, NextResponse } from 'next/server'
import { sbPatch } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now       = new Date().toISOString()
  const monthYear = now.slice(0, 7)

  try {
    await sbPatch(`shop_usage?month_year=neq.${monthYear}`, {
      orders_this_month: 0,
      month_year:        monthYear,
      updated_at:        now,
    })

    return NextResponse.json({ success: true, monthYear, timestamp: now })
  } catch (e) {
    console.error('[Cron] reset-usage error:', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
