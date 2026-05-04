// src/app/api/auth/log-attempt/route.ts
import { NextRequest, NextResponse }  from 'next/server'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const { phone, success, failureReason } = await req.json()

  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
               ??  req.headers.get('x-real-ip')
               ??  '127.0.0.1'
  const userAgent = req.headers.get('user-agent') ?? ''

  // Fire and forget — don't block the login flow
  fetch(`${SB_URL}/rest/v1/login_attempts`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      phone,
      ip_address:     ip,
      user_agent:     userAgent.slice(0, 500),
      success,
      failure_reason: failureReason ?? null,
    }),
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}