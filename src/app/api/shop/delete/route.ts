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
    const owner = await sbGet(
      `team_members?id=eq.${encodeURIComponent(memberId)}` +
      `&shop_id=eq.${encodeURIComponent(shopId)}` +
      `&role=eq.owner&is_active=eq.true&select=id&limit=1`,
    )
    if (owner.length === 0) {
      return NextResponse.json({ error: 'Only the active shop owner can permanently delete this shop' }, { status: 403 })
    }

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
    const [orders, photos] = await Promise.all([
      sbGet(`orders?shop_id=eq.${encodeURIComponent(shopId)}&select=id`).catch(() => []),
      sbGet(`order_photos?shop_id=eq.${encodeURIComponent(shopId)}&select=public_id`).catch(() => []),
    ])
    const orderIds = orders.map((o: any) => o.id).filter(Boolean)
    const publicIds = photos.map((p: any) => p.public_id).filter(Boolean)

    // Phase 2: Delete Cloudinary assets in parallel
    const photoResults = await Promise.all(publicIds.map(async (publicId: string) => {
      return deleteCloudinaryAsset(publicId)
    }))
    failures += photoResults.filter(r => r === false).length

    // Phase 3: Batch-delete order status history
    const historyResults = await Promise.all(
      Array.from({ length: Math.ceil(orderIds.length / 100) }, (_, i) =>
        tryDelete('order_status_history', inFilter('order_id', orderIds.slice(i * 100, (i + 1) * 100)))
      )
    )
    failures += historyResults.filter(r => !r).length

    // Phase 4: Delete remaining tables in parallel (independent of each other)
    const shopFilter = `shop_id=eq.${encodeURIComponent(shopId)}`
    const deleteOrder = ['order_photos', 'payments', 'measurements', 'orders', 'customers']
    const deleteShop = ['team_members', 'subscription_payments', 'subscriptions', 'shop_usage', 'shop_verification_requests']

    // Delete order-related data first (FK dependencies), then shop-level data
    const orderDeleteResults = await Promise.all(deleteOrder.map(table => tryDelete(table, shopFilter)))
    failures += orderDeleteResults.filter(r => !r).length

    const shopDeleteResults = await Promise.all(deleteShop.map(table => tryDelete(table, shopFilter)))
    failures += shopDeleteResults.filter(r => !r).length

    // Phase 5: Finally remove the shop record itself
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
