import { NextRequest, NextResponse } from 'next/server'
import { sbGet, sbPatch, sbDelete } from '@/lib/supabase/service'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { nowKarachiIso } from '@/lib/time'
import crypto from 'crypto'

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
    return res.ok && ['ok', 'not found'].includes(data.result)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = verifyMemberSessionToken(token)
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const ts = nowKarachiIso()
    const shopFilter = `shop_id=eq.${encodeURIComponent(session.shopId)}`
    const orderFilter = `id=eq.${encodeURIComponent(id)}`

    // 1. Delete Cloudinary photos for this order
    const publicIds: string[] = await sbGet(
      `order_photos?order_id=eq.${encodeURIComponent(id)}&${shopFilter}&select=public_id`
    ).then(rows => rows.map((r: any) => r.public_id).filter(Boolean)).catch(() => [])

    await Promise.all(publicIds.map(deleteCloudinaryAsset))

    // 2. Hard-delete order_photos rows
    await sbDelete(`order_photos?order_id=eq.${encodeURIComponent(id)}&${shopFilter}`).catch(() => {})

    // 3. Soft-delete payments for this order
    await sbPatch(
      `payments?order_id=eq.${encodeURIComponent(id)}&${shopFilter}`,
      { deleted_at: ts }
    )

    // 4. Get measurement_id from this order and soft-delete that measurement
    const orderRows: { measurement_id: string | null }[] = await sbGet<{ measurement_id: string | null }>(
      `orders?${orderFilter}&${shopFilter}&select=measurement_id`
    ).catch(() => [])
    const measurementId = orderRows[0]?.measurement_id
    if (measurementId) {
      await sbPatch(
        `measurements?id=eq.${encodeURIComponent(measurementId)}&${shopFilter}`,
        { deleted_at: ts }
      )
    }

    // 6. Soft-delete the order itself
    await sbPatch(
      `orders?${orderFilter}&${shopFilter}`,
      { deleted_at: ts, updated_at: ts }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API] orders/delete failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
