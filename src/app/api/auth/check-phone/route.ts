import { NextRequest, NextResponse } from 'next/server'
import { sbFetch } from '@/lib/supabase/service'
import { badRequest, serverError } from '@/lib/api-response'
import { getAPIRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const limiter = getAPIRatelimiter()
  const rl = await checkRateLimit(limiter, `check-phone:${getRateLimitId(req)}`, 'sensitive')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada requests. Kuch der mein dobara try karein.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const rawPhone = String(body?.phone ?? '')
    const cleaned = rawPhone.replace(/\D/g, '')

    if (cleaned.length < 10) {
      return badRequest('Invalid phone number')
    }

    const memberRes = await sbFetch(
      `team_members` +
      `?phone=eq.${encodeURIComponent(cleaned)}` +
      `&is_active=eq.true` +
      `&deleted_at=is.null` +
      `&select=id,shop_id,name,role,locked_until` +
      `&limit=1`
    )

    if (!memberRes.ok) {
      return serverError('Database error')
    }

    const members = await memberRes.json()
    const member = members?.[0]

    if (!member) {
      return NextResponse.json({ found: false })
    }

    let shopName = ''
    if (member.shop_id) {
      try {
        const shopRes = await sbFetch(
          `shops?id=eq.${encodeURIComponent(member.shop_id)}&select=shop_name&limit=1`
        )
        if (shopRes.ok) {
          const shops = await shopRes.json()
          shopName = shops?.[0]?.shop_name ?? ''
        }
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      found: true,
      role: member.role,
      lockedUntil: member.locked_until ?? null,
      shopName,
      memberId: member.id,
      shopId: member.shop_id,
    })
  } catch (e) {
    logger.error('check-phone', 'POST error', e)
    return serverError('Phone lookup failed')
  }
}
