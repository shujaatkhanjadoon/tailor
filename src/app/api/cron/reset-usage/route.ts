// src/app/api/cron/reset-usage/route.ts
// Resets monthly order counter on the 1st of each month

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now       = new Date()
  const monthYear = now.toISOString().slice(0, 7)   // "2025-05"

  try {
    const { error, count } = await adminSupabase
      .from('shop_usage')
      .update({
        orders_this_month: 0,
        month_year:        monthYear,
        updated_at:        now.toISOString(),
      })
      .neq('month_year', monthYear)   // only update if not already reset

    if (error) throw error

    console.log(`[Cron] reset-usage: ${count ?? 0} shops reset for ${monthYear}`)

    return NextResponse.json({
      success:   true,
      monthYear,
      shopsReset: count ?? 0,
    })
  } catch (e) {
    console.error('[Cron] reset-usage error:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}