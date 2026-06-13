import { NextRequest, NextResponse } from 'next/server'
import { sbGet, sbPatch } from '@/lib/supabase/service'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { nowKarachiIso } from '@/lib/time'

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
    const ts = nowKarachiIso()

    // Fetch all orders for this customer (including non-deleted ones)
    const orders: { id: string; measurement_id: string | null }[] = await sbGet<{ id: string; measurement_id: string | null }>(
      `orders?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}&select=id,measurement_id`
    ).catch(() => [])

    const orderIds = orders.map(o => o.id).filter(Boolean)

    if (orderIds.length > 0) {
      await sbPatch(
        `payments?order_id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}&deleted_at=not.is.null`,
        { deleted_at: null }
      ).catch(() => {})

      const measurementIds = orders.map(o => o.measurement_id).filter((id): id is string => id !== null)
      if (measurementIds.length > 0) {
        await sbPatch(
          `measurements?id=in.(${measurementIds.map(encodeURIComponent).join(',')})&${shopFilter}&deleted_at=not.is.null`,
          { deleted_at: null }
        )
      }

      await sbPatch(
        `orders?id=in.(${orderIds.map(encodeURIComponent).join(',')})&${shopFilter}&deleted_at=not.is.null`,
        { deleted_at: null, updated_at: ts }
      )
    }

    await sbPatch(
      `measurements?customer_id=eq.${encodeURIComponent(id)}&${shopFilter}&deleted_at=not.is.null`,
      { deleted_at: null }
    )

    await sbPatch(
      `customers?id=eq.${encodeURIComponent(id)}&${shopFilter}&deleted_at=not.is.null`,
      { deleted_at: null, updated_at: ts }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API] customers/recover failed:', err)
    return NextResponse.json({ error: 'Recover failed' }, { status: 500 })
  }
}
