import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { validate, schemas } from '@/lib/validation'
import { sbGet, sbFetch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

function authorized(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  return !!token && verifySessionToken(token)
}

async function cleanupExpired() {
  await sbFetch(`admin_notifications?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await cleanupExpired()
    const rows = await sbGet('admin_notifications?order=created_at.desc&limit=100&select=*')
    return NextResponse.json({ data: rows })
  } catch (e) {
    logger.error('admin', 'Notifications GET error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await validate(schemas.adminNotificationPost, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { title, message, type, targetPlan, expiresAt: expiresAtStr } = parsed.data
  const expiresAt = new Date(expiresAtStr)

  if (expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Expiry must be in the future' }, { status: 400 })
  }

  try {
    const res = await sbFetch('admin_notifications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        title,
        message,
        type,
        target_plan: targetPlan,
        expires_at: expiresAt.toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`POST notification: ${res.status} ${await res.text()}`)
    const [row] = await res.json()
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}


export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await validate(schemas.adminNotificationPatch, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { id, title, message, type, targetPlan, expiresAt: expiresAtStr } = parsed.data
  const expiresAt = new Date(expiresAtStr)

  if (expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Expiry must be in the future' }, { status: 400 })
  }

  try {
    const res = await sbFetch(`admin_notifications?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        title,
        message,
        type,
        target_plan: targetPlan,
        expires_at: expiresAt.toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`PATCH notification: ${res.status} ${await res.text()}`)
    const [row] = await res.json()
    return NextResponse.json({ data: row })
  } catch (e) {
    logger.error('admin', 'Notifications PATCH error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Notification id required' }, { status: 400 })

  try {
    const res = await sbFetch(`admin_notifications?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
    if (!res.ok) throw new Error(`DELETE notification: ${res.status} ${await res.text()}`)
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('admin', 'Notifications DELETE error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
