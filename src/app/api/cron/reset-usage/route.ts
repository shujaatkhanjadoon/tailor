// src/app/api/cron/reset-usage/route.ts — replace entirely

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate env vars exist
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      error: 'Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    }, { status: 500 })
  }

  const now       = new Date().toISOString()
  const monthYear = now.slice(0, 7)

  try {
    // Use fetch directly instead of createClient (avoids DNS issues locally)
    const res = await fetch(
      `${supabaseUrl}/rest/v1/shop_usage?month_year=neq.${monthYear}`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          orders_this_month: 0,
          month_year:        monthYear,
          updated_at:        now,
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Supabase error ${res.status}: ${errText}`)
    }

    console.log(`[Cron] reset-usage: done for ${monthYear}`)
    return NextResponse.json({ success: true, monthYear, timestamp: now })

  } catch (e) {
    console.error('[Cron] reset-usage error:', String(e))
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    )
  }
}