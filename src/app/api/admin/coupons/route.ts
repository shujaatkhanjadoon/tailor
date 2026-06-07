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
    const [rows, redemptions] = await Promise.all([
      safeGet('coupons?order=created_at.desc&select=*'),
      safeGet('coupon_redemptions?select=coupon_id,shop_id,discounted_amount,redeemed_at&order=redeemed_at.desc&limit=500'),
    ])
    return NextResponse.json({ data: rows, redemptions })
  } catch (e) {
    logger.error('admin', 'Coupons GET error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { code, discountPct, maxUses, maxUsesPerShop, minAmountPkr, appliesToPlan, expiresAt } = body
    if (!code || discountPct == null) {
      return NextResponse.json({ error: 'code and discountPct required' }, { status: 400 })
    }
    if (discountPct < 1 || discountPct > 100) {
      return NextResponse.json({ error: 'discountPct must be 1-100' }, { status: 400 })
    }
    const existing = await sbGet(`coupons?code=eq.${encodeURIComponent(code)}&select=id&limit=1`)
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    }
    const res = await sbFetch('coupons', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        code: code.toUpperCase(),
        discount_pct: discountPct,
        max_uses: maxUses ?? 100,
        used_count: 0,
        max_uses_per_shop: maxUsesPerShop ?? 1,
        min_amount_pkr: minAmountPkr ?? null,
        applies_to_plan: appliesToPlan ?? null,
        expires_at: expiresAt ?? new Date(Date.now() + 365 * 86400000).toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
      }),
    })
    if (!res.ok) throw new Error(`POST coupon: ${res.status}`)
    const [row] = await res.json()
    return NextResponse.json({ data: row })
  } catch (e) {
    logger.error('admin', 'Coupons POST error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { id, code, discountPct, maxUses, maxUsesPerShop, minAmountPkr, appliesToPlan, expiresAt, isActive } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (code !== undefined) updates.code = code.toUpperCase()
    if (discountPct !== undefined) updates.discount_pct = discountPct
    if (maxUses !== undefined) updates.max_uses = maxUses
    if (maxUsesPerShop !== undefined) updates.max_uses_per_shop = maxUsesPerShop
    if (minAmountPkr !== undefined) updates.min_amount_pkr = minAmountPkr
    if (appliesToPlan !== undefined) updates.applies_to_plan = appliesToPlan
    if (expiresAt !== undefined) updates.expires_at = expiresAt
    if (isActive !== undefined) updates.is_active = isActive
    await sbFetch(`coupons?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(updates),
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('admin', 'Coupons PATCH error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await sbFetch(`coupons?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('admin', 'Coupons DELETE error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
