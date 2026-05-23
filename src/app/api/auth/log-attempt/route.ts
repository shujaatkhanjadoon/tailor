// src/app/api/auth/log-attempt/route.ts
import { NextRequest, NextResponse }  from 'next/server'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MAX_FAILED_ATTEMPTS_PER_WINDOW = 10
const FAILED_ATTEMPT_WINDOW_MS = 60 * 60 * 1000
const RETENTION_DAYS = 14

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    ...extra,
  }
}

function sevenBitPhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 20)
}

export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_KEY) {
    return NextResponse.json({ ok: false, error: 'Supabase service key missing' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true, skipped: true })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const raw = body as { phone?: unknown; success?: unknown; failureReason?: unknown }
  if (raw.failureReason !== undefined && (typeof raw.failureReason !== 'string' || raw.failureReason.length > 200)) {
    return NextResponse.json({ ok: true, skipped: true })
  }
  const { phone: rawPhone, success, failureReason } = raw
  const phone = sevenBitPhone(rawPhone)
  if (!phone) return NextResponse.json({ ok: true, skipped: true })

  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
               ??  req.headers.get('x-real-ip')
               ??  '127.0.0.1'
  const userAgent = req.headers.get('user-agent') ?? ''
  const now = Date.now()

  if (!success) {
    const since = new Date(now - FAILED_ATTEMPT_WINDOW_MS).toISOString()
    const recent = await fetch(
      `${SB_URL}/rest/v1/login_attempts` +
      `?phone=eq.${encodeURIComponent(phone)}` +
      `&success=eq.false&created_at=gte.${encodeURIComponent(since)}` +
      `&select=id&limit=${MAX_FAILED_ATTEMPTS_PER_WINDOW}`,
      { headers: sbHeaders(), signal: AbortSignal.timeout(5000) },
    ).then(res => res.ok ? res.json() : []).catch(() => [])

    if (Array.isArray(recent) && recent.length >= MAX_FAILED_ATTEMPTS_PER_WINDOW) {
      return NextResponse.json({ ok: true, skipped: true })
    }
  }

  // Fire and forget — don't block the login flow
  fetch(`${SB_URL}/rest/v1/login_attempts`, {
    method:  'POST',
    headers: sbHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify({
      phone,
      ip_address:     ip,
      user_agent:     userAgent.slice(0, 500),
      success,
      failure_reason: failureReason ?? null,
    }),
  }).catch(console.error)

  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  fetch(`${SB_URL}/rest/v1/login_attempts?created_at=lt.${encodeURIComponent(cutoff)}`, {
    method:  'DELETE',
    headers: sbHeaders({ 'Prefer': 'return=minimal' }),
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
