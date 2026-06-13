import { NextRequest, NextResponse } from 'next/server'
import { sbGet, sbDelete } from '@/lib/supabase/service'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
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
      return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
    }

    const shopFilter = `shop_id=eq.${encodeURIComponent(session.shopId)}`

    // Get all orders for this customer
    const orders: { id: string; measurement_id: string | null }[] = await sbGet<{ id: string; measurement_id: string | null }>(
      `orders?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}&select=id,measurement_id`
    ).catch(() => [])

    const orderIds = orders.map(o => o.id).filter(Boolean)

    if (orderIds.length > 0) {
      const publicIds: string[] = await sbGet(
        `order_photos?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}&select=public_id`
      ).then(rows => rows.map((r: any) => r.public_id).filter(Boolean)).catch(() => [])

      await Promise.all(publicIds.map(deleteCloudinaryAsset))

      await Promise.all([
        sbDelete(`order_photos?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}`).catch(() => {}),
        sbDelete(`payments?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}`).catch(() => {}),
      ])

      const measurementIds = orders.map(o => o.measurement_id).filter((id): id is string => id !== null)
      if (measurementIds.length > 0) {
        await sbDelete(
          `measurements?id=in.(${measurementIds.map(encodeURIComponent).join(',')})&${shopFilter}`
        ).catch(() => {})
      }

      await sbDelete(
        `orders?id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}`
      ).catch(() => {})
    }

    await sbDelete(
      `measurements?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}`
    ).catch(() => {})

    await sbDelete(
      `customers?id=eq.${encodeURIComponent(id)}&${shopFilter}`
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API] customers/purge failed:', err)
    return NextResponse.json({ error: 'Permanent delete failed' }, { status: 500 })
  }
}
