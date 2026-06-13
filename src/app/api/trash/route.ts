import { NextRequest, NextResponse } from 'next/server'
import { sbGet } from '@/lib/supabase/service'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = verifyMemberSessionToken(token)
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const shopFilter = `shop_id=eq.${encodeURIComponent(session.shopId)}`

    const [customers, orders] = await Promise.all([
      sbGet(
        `customers?${shopFilter}&deleted_at=not.is.null&select=id,name,phone,deleted_at&order=deleted_at.desc`
      ).catch(() => []),
      sbGet(
        `orders?${shopFilter}&deleted_at=not.is.null&select=id,order_number,customer_name,status,amount,deleted_at&order=deleted_at.desc`
      ).catch(() => []),
    ])

    return NextResponse.json({ customers, orders })
  } catch (err) {
    console.error('[API] trash GET failed:', err)
    return NextResponse.json({ error: 'Failed to fetch trash' }, { status: 500 })
  }
}
