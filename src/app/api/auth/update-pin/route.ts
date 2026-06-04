import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { validate, schemas } from '@/lib/validation'
import { getAPIRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { sbPatch } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const limiter = getAPIRatelimiter()
  const rl      = await checkRateLimit(limiter, `update-pin:${getRateLimitId(req)}`, 'sensitive')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada requests. Kuch der mein dobara try karein.' },
      { status: 429 }
    )
  }

  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const parsed = await validate(schemas.updatePin, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { memberId, shopId, pinHash } = parsed.data
    const { memberId: sessionMemberId, shopId: sessionShopId } = session

    if (memberId !== sessionMemberId || shopId !== sessionShopId) {
      return NextResponse.json({ error: 'Cannot update another member\'s PIN' }, { status: 403 })
    }

    await sbPatch(
      `team_members?id=eq.${encodeURIComponent(memberId)}`,
      { pin_hash: pinHash, updated_at: new Date().toISOString() }
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[update-pin]', e)
    return NextResponse.json(
      { error: 'PIN update failed' },
      { status: 500 }
    )
  }
}
