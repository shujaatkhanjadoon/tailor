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
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const ts = nowKarachiIso()
    const shopFilter = `shop_id=eq.${encodeURIComponent(session.shopId)}`
    const orderFilter = `id=eq.${encodeURIComponent(id)}`

    await sbPatch(
      `payments?order_id=eq.${encodeURIComponent(id)}&${shopFilter}&deleted_at=not.is.null`,
      { deleted_at: null }
    )

    const orderRows: { measurement_id: string | null }[] = await sbGet<{ measurement_id: string | null }>(
      `orders?${orderFilter}&${shopFilter}&select=measurement_id`
    ).catch(() => [])
    const measurementId = orderRows[0]?.measurement_id
    if (measurementId) {
      await sbPatch(
        `measurements?id=eq.${encodeURIComponent(measurementId)}&${shopFilter}&deleted_at=not.is.null`,
        { deleted_at: null }
      )
    }

    await sbPatch(
      `orders?${orderFilter}&${shopFilter}&deleted_at=not.is.null`,
      { deleted_at: null, updated_at: ts }
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API] orders/recover failed:', err)
    return NextResponse.json({ error: 'Recover failed' }, { status: 500 })
  }
}
