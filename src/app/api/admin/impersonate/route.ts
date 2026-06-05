import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, verifyTOTP, ADMIN_SESSION_COOKIE } from '@/lib/admin/auth'
import { generateMemberSessionToken, MEMBER_SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'
import { sbGet } from '@/lib/supabase/service'
import { logAdminAction } from '@/lib/admin/audit'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let shopId: string
  let totpCode: string

  try {
    const body = await req.json()
    shopId = body.shopId
    totpCode = body.totpCode
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!shopId || typeof shopId !== 'string') {
    return NextResponse.json({ error: 'shopId required' }, { status: 400 })
  }

  const totpSecret = process.env.ADMIN_TOTP_SECRET
  if (totpSecret) {
    if (!totpCode || !verifyTOTP(totpCode, totpSecret)) {
      return NextResponse.json(
        { error: 'Is action ke liye Google Authenticator code chahiye', requiresTOTP: true },
        { status: 401 },
      )
    }
  }

  try {
    const members = await sbGet(
      `team_members?shop_id=eq.${encodeURIComponent(shopId)}&role=eq.owner&is_active=eq.true&select=id,shop_id&limit=1`,
    )

    if (!members || members.length === 0) {
      return NextResponse.json({ error: 'No active owner found for this shop' }, { status: 404 })
    }

    const memberId = String(members[0].id)
    const memberShopId = String(members[0].shop_id)
    const sessionToken = generateMemberSessionToken(memberId, memberShopId)

    logAdminAction('impersonated_login', 'shop', shopId, shopId, {
      impersonated_member_id: memberId,
    }).catch((e) => logger.warn('admin', 'audit log failed', e))

    const res = NextResponse.json({ success: true })
    res.cookies.set(MEMBER_SESSION_COOKIE, sessionToken, getSessionCookieOptions())

    return res
  } catch (e) {
    logger.error('admin', 'Impersonation error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
