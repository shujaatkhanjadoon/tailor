import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const headers = () => ({
  'Content-Type': 'application/json',
  apikey: SB_KEY(),
  Authorization: `Bearer ${SB_KEY()}`,
})

function authorized(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  return !!token && verifySessionToken(token)
}

async function sbGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function cleanupExpired() {
  await fetch(`${SB_URL()}/rest/v1/admin_notifications?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'DELETE',
    headers: { ...headers(), Prefer: 'return=minimal' },
  })
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await cleanupExpired()
    const rows = await sbGet('admin_notifications?order=created_at.desc&limit=100&select=*')
    return NextResponse.json({ data: rows })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const targetPlan = body.targetPlan === 'all' ? 'all' : body.targetPlan
  const title = String(body.title ?? '').trim()
  const message = String(body.message ?? '').trim()
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

  if (!['all', 'starter', 'professional', 'business'].includes(targetPlan)) {
    return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 })
  }
  if (!title || !message || !expiresAt || Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: 'Title, message, and expiry are required' }, { status: 400 })
  }
  if (expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Expiry must be in the future' }, { status: 400 })
  }

  try {
    const res = await fetch(`${SB_URL()}/rest/v1/admin_notifications`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=representation' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        title,
        message,
        target_plan: targetPlan,
        expires_at: expiresAt.toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`POST notification: ${res.status} ${await res.text()}`)
    const [row] = await res.json()
    return NextResponse.json({ data: row })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
