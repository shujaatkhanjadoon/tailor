import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { validate, schemas } from '@/lib/validation'
import { sbGet, sbPatch, sbDelete } from '@/lib/supabase/service'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'

async function tryDelete(table: string, filter: string): Promise<boolean> {
  try {
    await sbDelete(`${table}?${filter}`)
    return true
  } catch (error) {
    console.warn(`[shop-delete] ${table}:`, error instanceof Error ? error.message : String(error))
    return false
  }
}

async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return true

  try {
    const timestamp = Math.round(Date.now() / 1000)
    const signString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash('sha256').update(signString).digest('hex')
    const formData = new FormData()
    formData.append('public_id', publicId)
    formData.append('timestamp', String(timestamp))
    formData.append('api_key', apiKey)
    formData.append('signature', signature)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !['ok', 'not found'].includes(data.result)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

function inFilter(column: string, ids: string[]) {
  return `${column}=in.(${ids.map(encodeURIComponent).join(',')})`
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
  const session = token ? verifyMemberSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await validate(schemas.deleteShop, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { shopId, memberId } = parsed.data

  if (session.memberId !== memberId || session.shopId !== shopId) {
    return NextResponse.json({ error: 'Session does not match request' }, { status: 403 })
  }

  try {
    // Phase 1: Immediately mark shop as inactive to prevent further access
    const now = new Date().toISOString()
    // Try with deleted_at first (post-migration), fall back without it
    try {
      await sbPatch(`shops?id=eq.${encodeURIComponent(shopId)}`, {
        is_active: false,
        deleted_at: now,
        updated_at: now,
      })
    } catch {
      await sbPatch(`shops?id=eq.${encodeURIComponent(shopId)}`, {
        is_active: false,
        updated_at: now,
      })
    }

    let failures = 0
    const [orders, photos, teamPhones] = await Promise.all([
      sbGet(`orders?shop_id=eq.${encodeURIComponent(shopId)}&select=id`).catch(() => []),
      sbGet(`order_photos?shop_id=eq.${encodeURIComponent(shopId)}&select=public_id`).catch(() => []),
      sbGet(`team_members?shop_id=eq.${encodeURIComponent(shopId)}&select=phone`).catch(() => []),
    ])
    const orderIds = orders.map((o: any) => o.id).filter(Boolean)
    const publicIds = photos.map((p: any) => p.public_id).filter(Boolean)
    const phones = [...new Set(teamPhones.map((t: any) => t.phone).filter(Boolean))] as string[]

    // Phase 2: Delete Cloudinary assets in parallel
    const photoResults = await Promise.all(publicIds.map(async (publicId: string) => {
      return deleteCloudinaryAsset(publicId)
    }))
    failures += photoResults.filter(r => r === false).length

    // Phase 3: Delete phone-based records (email_verifications, login_attempts use phone, not shop_id)
    if (phones.length > 0) {
      const phoneFilter = inFilter('phone', phones)
      const phoneCleanup = await Promise.all([
        tryDelete('email_verifications', phoneFilter),
        tryDelete('login_attempts', phoneFilter),
      ])
      failures += phoneCleanup.filter(r => !r).length
    }

    // Phase 4: Batch-delete order status history
    const historyResults = await Promise.all(
      Array.from({ length: Math.ceil(orderIds.length / 100) }, (_, i) =>
        tryDelete('order_status_history', inFilter('order_id', orderIds.slice(i * 100, (i + 1) * 100)))
      )
    )
    failures += historyResults.filter(r => !r).length

    // Phase 5: Delete tables respecting FK dependency order (sequentially by dependency group)
    const shopFilter = `shop_id=eq.${encodeURIComponent(shopId)}`

    // Group A: tables that reference only shops (no FK dependencies on other deletable tables)
    const groupA = await Promise.all([
      tryDelete('order_photos', shopFilter),
      tryDelete('payments', shopFilter),
    ])
    failures += groupA.filter(r => !r).length

    // Group B: orders + customers (orders FK → measurements, so null out measurement_id first)
    const nullMeasurement = await sbPatch(
      `orders?shop_id=eq.${encodeURIComponent(shopId)}`,
      { measurement_id: null },
    ).then(() => true).catch(() => false)
    if (!nullMeasurement) failures++

    const groupB = await Promise.all([
      tryDelete('orders', shopFilter),
      tryDelete('measurements', shopFilter),
      tryDelete('customers', shopFilter),
    ])
    failures += groupB.filter(r => !r).length

    // Group C: subscription_payments references subscriptions — sequential within group
    const c1 = await tryDelete('subscription_payments', shopFilter)
    if (!c1) failures++

    // Group D: subscriptions references shops — run after subscription_payments
    const d1 = await tryDelete('subscriptions', shopFilter)
    if (!d1) failures++

    // Group E: remaining tables that reference shops (parallel-safe among themselves)
    const groupE = await Promise.all([
      tryDelete('team_members', shopFilter),
      tryDelete('shop_verification_requests', shopFilter),
      tryDelete('coupon_redemptions', shopFilter),
      tryDelete('admin_audit_log', shopFilter),
    ])
    failures += groupE.filter(r => !r).length

    // Phase 6: Final cleanup — ensure shop_usage is deleted (no CASCADE, may need retry)
    for (let attempt = 0; attempt < 3; attempt++) {
      const ok = await tryDelete('shop_usage', shopFilter)
      if (ok) break
      await new Promise(r => setTimeout(r, 500))
    }

    // Phase 7: Finally remove the shop record itself (all referencing tables must be empty first)
    await sbDelete(`shops?id=eq.${encodeURIComponent(shopId)}`)

    return NextResponse.json({
      success: true,
      ...(failures > 0 && { warning: `${failures} cleanup task(s) failed` }),
    })
  } catch (error) {
    console.error('[shop-delete] error:', error)
    return NextResponse.json(
      { error: 'Shop delete failed. Please try again or contact support.' },
      { status: 500 },
    )
  }
}
