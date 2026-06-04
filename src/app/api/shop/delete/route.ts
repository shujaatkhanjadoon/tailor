import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { validate, schemas } from '@/lib/validation'
import { sbFetch, sbGet, sbDelete } from '@/lib/supabase/service'

async function tryDelete(table: string, filter: string, warnings: string[]) {
  try {
    await sbDelete(`${table}?${filter}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnings.push(`${table}: ${message}`)
    console.warn(`[shop-delete] ${table}:`, message)
  }
}

async function deleteCloudinaryAsset(publicId: string, warnings: string[]) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY ?? process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return

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
      warnings.push(`cloudinary:${publicId}: ${data.result ?? res.status}`)
    }
  } catch (error) {
    warnings.push(`cloudinary:${publicId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function inFilter(column: string, ids: string[]) {
  return `${column}=in.(${ids.map(encodeURIComponent).join(',')})`
}

export async function POST(req: NextRequest) {
  const parsed = await validate(schemas.deleteShop, req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { shopId, memberId } = parsed.data

  try {
    const owner = await sbGet(
      `team_members?id=eq.${encodeURIComponent(memberId)}` +
      `&shop_id=eq.${encodeURIComponent(shopId)}` +
      `&role=eq.owner&is_active=eq.true&select=id&limit=1`,
    )
    if (owner.length === 0) {
      return NextResponse.json({ error: 'Only the active shop owner can permanently delete this shop' }, { status: 403 })
    }

    const warnings: string[] = []
    const [orders, photos] = await Promise.all([
      sbGet(`orders?shop_id=eq.${encodeURIComponent(shopId)}&select=id`).catch(() => []),
      sbGet(`order_photos?shop_id=eq.${encodeURIComponent(shopId)}&select=public_id`).catch(() => []),
    ])
    const orderIds = orders.map((o: any) => o.id).filter(Boolean)
    const publicIds = photos.map((p: any) => p.public_id).filter(Boolean)

    await Promise.all(publicIds.map(async (publicId: string) => {
      try {
        await deleteCloudinaryAsset(publicId, warnings)
      } catch {
        warnings.push(`Failed to delete Cloudinary asset: ${publicId}`)
      }
    }))

    for (let i = 0; i < orderIds.length; i += 100) {
      await tryDelete('order_status_history', inFilter('order_id', orderIds.slice(i, i + 100)), warnings)
    }

    const shopFilter = `shop_id=eq.${encodeURIComponent(shopId)}`
    await tryDelete('order_photos', shopFilter, warnings)
    await tryDelete('payments', shopFilter, warnings)
    await tryDelete('measurements', shopFilter, warnings)
    await tryDelete('orders', shopFilter, warnings)
    await tryDelete('customers', shopFilter, warnings)
    await tryDelete('team_members', shopFilter, warnings)
    await tryDelete('subscription_payments', shopFilter, warnings)
    await tryDelete('subscriptions', shopFilter, warnings)
    await tryDelete('shop_usage', shopFilter, warnings)
    await tryDelete('shop_verification_requests', shopFilter, warnings)

    await sbDelete(`shops?id=eq.${encodeURIComponent(shopId)}`)

    return NextResponse.json({ success: true, warnings })
  } catch (error) {
    console.error('[shop-delete] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
