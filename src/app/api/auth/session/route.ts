import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { generateMemberSessionToken, verifyMemberSessionToken, MEMBER_SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { ok, badRequest, unauthorized, serverError } from '@/lib/api-response'

function safeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
  } catch {
    return false
  }
}

async function verifyPinHashServerSide(memberId: string, shopId: string, pinHash: string): Promise<boolean> {
  try {
    const res = await sbFetch(
      `team_members?id=eq.${encodeURIComponent(memberId)}&shop_id=eq.${encodeURIComponent(shopId)}&is_active=eq.true&deleted_at=is.null&select=pin_hash&limit=1`
    )
    if (!res.ok) return false
    const members = await res.json()
    if (!members?.length) return false
    const storedHash = String(members[0].pin_hash ?? '')
    return storedHash.startsWith('$2') && pinHash.startsWith('$2') && safeEqual(pinHash, storedHash)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { memberId, shopId, pinHash } = body

    if (!memberId || !shopId) {
      return badRequest('memberId and shopId required')
    }

    if (!pinHash) {
      return badRequest('PIN proof required')
    }

    const pinValid = await verifyPinHashServerSide(memberId, shopId, pinHash)
    if (!pinValid) {
      return unauthorized('Invalid credentials')
    }

    const token = generateMemberSessionToken(memberId, shopId)
    const res = ok({ authenticated: true })
    res.cookies.set(MEMBER_SESSION_COOKIE, token, getSessionCookieOptions())

    return res
  } catch (e) {
    console.error('[Session POST]', e)
    return serverError('Session creation failed')
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (!token) {
      return unauthorized('No session')
    }

    const session = verifyMemberSessionToken(token)
    if (!session) {
      const res = unauthorized('Session expired')
      res.cookies.set(MEMBER_SESSION_COOKIE, '', { ...getSessionCookieOptions(0), maxAge: 0 })
      return res
    }

    // Fetch full member info (return raw snake_case for mapTeamMember)
    const memberRes = await sbFetch(
      `team_members?id=eq.${session.memberId}&is_active=eq.true&deleted_at=is.null&select=id,shop_id,name,phone,role,pin_hash,speciality,pay_rate_type,pay_rate,email,email_verified,is_active,joined_at,created_at,deleted_at,updated_at&limit=1`
    )

    if (!memberRes.ok) {
      return serverError('Failed to fetch member')
    }

    const members = await memberRes.json()
    if (!members?.length) {
      const res = unauthorized('Member not found')
      res.cookies.set(MEMBER_SESSION_COOKIE, '', { ...getSessionCookieOptions(0), maxAge: 0 })
      return res
    }

    const member = members[0]
    // NOTE: Flat response — client code reads data.authenticated, data.memberId etc.
    return NextResponse.json({
      authenticated: true,
      memberId: session.memberId,
      shopId: session.shopId,
      member,
    })
  } catch (e) {
    console.error('[Session GET]', e)
    return serverError('Session check failed')
  }
}

export async function DELETE(_req: NextRequest) {
  const res = ok({ loggedOut: true })
  res.cookies.set(MEMBER_SESSION_COOKIE, '', { ...getSessionCookieOptions(0), maxAge: 0 })
  return res
}
