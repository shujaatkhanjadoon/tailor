// src/app/api/cron/reset-usage/route.ts — replace entirely

import { NextRequest, NextResponse } from 'next/server'
import { sbPatch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  return POST(req)
}
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now       = new Date().toISOString()
  const monthYear = now.slice(0, 7)

  try {
    await sbPatch(`shop_usage?or=(month_year.neq.${monthYear},month_year.is.null)`, {
      orders_this_month: 0,
      month_year:        monthYear,
      updated_at:        now,
    })

    return NextResponse.json({ success: true, monthYear, timestamp: now })
  } catch (e) {
    logger.error('reset-usage', 'error', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
