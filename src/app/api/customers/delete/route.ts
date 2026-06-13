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
      return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
    }

    const shopFilter = `shop_id=eq.${encodeURIComponent(session.shopId)}`

    // ── Validation: check active orders + pending balance ───
    const allOrders: { id: string; order_number: number; status: string; amount: number }[] = await sbGet(
      `orders?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}&select=id,order_number,status,amount`
    ).catch(() => [])
    const cancelled = new Set(['cancelled'])
    const active = allOrders.filter(o => !cancelled.has(o.status) && o.status !== 'delivered')
    const delivered = allOrders.filter(o => o.status === 'delivered')

    if (active.length > 0) {
      return NextResponse.json({
        error: `Is customer ke ${active.length} active order(s) hain (#${active.map(o => o.order_number).join(', #')}). Pehle orders deliver ya cancel karein.`,
      }, { status: 409 })
    }

    if (delivered.length > 0) {
      const delOrderIds = delivered.map(o => o.id)
      const payments: { order_id: string; amount: number }[] = await sbGet(
        `payments?order_id=in.(${delOrderIds.map(encodeURIComponent).join(',')})&${shopFilter}&deleted_at=is.null&select=order_id,amount`
      ).catch(() => [])

      const paidByOrder: Record<string, number> = {}
      for (const p of payments) paidByOrder[p.order_id] = (paidByOrder[p.order_id] || 0) + Number(p.amount)

      const dueOrders = delivered.filter(o => (paidByOrder[o.id] || 0) < Number(o.amount))
      if (dueOrders.length > 0) {
        return NextResponse.json({
          error: `Is customer ke ${dueOrders.length} delivered order(s) par baqi raqam hai (#${dueOrders.map(o => o.order_number).join(', #')}). Pehle payment clear karein.`,
        }, { status: 409 })
      }
    }

    const ts = nowKarachiIso()

    // Get all orders for cascade
    const orders: { id: string; measurement_id: string | null }[] = await sbGet(
      `orders?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}&select=id,measurement_id`
    ).catch(() => [])

    const orderIds = orders.map(o => o.id).filter(Boolean)

    // Cascade delete each order's data
    if (orderIds.length > 0) {
      const publicIds: string[] = await sbGet(
        `order_photos?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}&select=public_id`
      ).then(rows => rows.map((r: any) => r.public_id).filter(Boolean)).catch(() => [])

      await Promise.all(publicIds.map(deleteCloudinaryAsset))

      await Promise.all([
        sbDelete(`order_photos?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}`).catch(() => {}),
        sbPatch(`payments?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}`, { deleted_at: ts }),
      ])

      const measurementIds = orders.map(o => o.measurement_id).filter(Boolean)
      if (measurementIds.length > 0) {
        await sbPatch(
          `measurements?id=in.(${measurementIds.map(encodeURIComponent).join(',')})&${shopFilter}`,
          { deleted_at: ts }
        )
      }

      await sbPatch(
        `orders?id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}`,
        { deleted_at: ts, updated_at: ts }
      )
    }

    await sbPatch(
      `measurements?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}`,
      { deleted_at: ts }
    )

    await sbPatch(
      `customers?id=eq.${encodeURIComponent(id)}&${shopFilter}`,
      { deleted_at: ts, updated_at: ts }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API] customers/delete failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
