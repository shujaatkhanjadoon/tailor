import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { validate, schemas } from '@/lib/validation'
import { getAPIRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { sbPatch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

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

    // Fetch current token_version so we can increment it to revoke all existing sessions
    let nextVersion = 2
    try {
      const tvLookup = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/team_members?id=eq.${encodeURIComponent(memberId)}&select=token_version&limit=1`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
          },
        }
      )
      if (tvLookup.ok) {
        const tvData = await tvLookup.json()
        if (tvData?.length && typeof tvData[0].token_version === 'number') {
          nextVersion = tvData[0].token_version + 1
        }
      }
    } catch { /* use default nextVersion=2 */ }

    await sbPatch(
      `team_members?id=eq.${encodeURIComponent(memberId)}`,
      {
        pin_hash: pinHash,
        token_version: nextVersion,
        updated_at: new Date().toISOString(),
      }
    )

    // Issue a fresh session token with the new token_version so the
    // user stays logged in after changing their PIN.
    const { generateMemberSessionToken } = await import('@/lib/auth/session')
    const newToken = generateMemberSessionToken(memberId, shopId, undefined, nextVersion)
    const response = NextResponse.json({ success: true })
    response.cookies.set(MEMBER_SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })
    return response
  } catch (e) {
    logger.error('update-pin', 'PIN update error', e)
    return NextResponse.json(
      { error: 'PIN update failed' },
      { status: 500 }
    )
  }
}
