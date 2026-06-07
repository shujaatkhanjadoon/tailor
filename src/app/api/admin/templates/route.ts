import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbGet, sbFetch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

function authorized(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  return !!token && verifySessionToken(token)
}

async function safeGet(url: string): Promise<any[]> {
  try { return await sbGet(url) as any[] } catch { return [] }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const rows = await safeGet('message_templates?order=key.asc&select=*')
    return NextResponse.json({ data: rows })
  } catch (e) {
    logger.error('admin', 'Templates GET error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { templates } = body
    if (!Array.isArray(templates)) {
      return NextResponse.json({ error: 'templates array required' }, { status: 400 })
    }
    const errors: string[] = []
    for (const t of templates) {
      if (!t.key || !t.body || !t.channel) {
        errors.push(`Invalid template: ${t.key ?? 'unknown'}`)
        continue
      }
      try {
        const existing = await safeGet(`message_templates?key=eq.${t.key}&select=id&limit=1`)
        if (existing.length > 0) {
          await sbFetch(`message_templates?key=eq.${encodeURIComponent(t.key)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              label: t.label ?? t.key,
              subject: t.subject ?? '',
              body: t.body,
              variables: t.variables ?? [],
              channel: t.channel ?? 'email',
              updated_at: new Date().toISOString(),
            }),
          })
        } else {
          await sbFetch('message_templates', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              id: crypto.randomUUID(),
              key: t.key,
              label: t.label ?? t.key,
              subject: t.subject ?? '',
              body: t.body,
              variables: t.variables ?? [],
              channel: t.channel ?? 'email',
              updated_at: new Date().toISOString(),
            }),
          })
        }
      } catch (e) {
        errors.push(`Failed to save ${t.key}: ${String(e)}`)
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('admin', 'Templates PUT error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { key, subject, body: messageBody, variables, channel, label } = body
    if (!key || !messageBody) {
      return NextResponse.json({ error: 'key and body required' }, { status: 400 })
    }
    const res = await sbFetch('message_templates', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        key,
        label: label ?? key,
        subject: subject ?? '',
        body: messageBody,
        variables: variables ?? [],
        channel: channel ?? 'email',
        updated_at: new Date().toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`POST template: ${res.status}`)
    const [row] = await res.json()
    return NextResponse.json({ data: row })
  } catch (e) {
    logger.error('admin', 'Templates POST error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
