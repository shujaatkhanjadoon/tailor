import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { generateMemberSessionToken, verifyMemberSessionToken, MEMBER_SESSION_COOKIE, getSessionCookieOptions } from '@/lib/auth/session'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

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
    const res = await fetch(
      `${SB_URL}/rest/v1/team_members?id=eq.${encodeURIComponent(memberId)}&shop_id=eq.${encodeURIComponent(shopId)}&is_active=eq.true&deleted_at=is.null&select=pin_hash&limit=1`,
      { headers: HEADERS, signal: AbortSignal.timeout(5000) }
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
      return NextResponse.json({ error: 'memberId and shopId required' }, { status: 400 })
    }

    if (!pinHash) {
      return NextResponse.json({ error: 'PIN proof required' }, { status: 400 })
    }

    const pinValid = await verifyPinHashServerSide(memberId, shopId, pinHash)
    if (!pinValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = generateMemberSessionToken(memberId, shopId)
    const res = NextResponse.json({ success: true })
    res.cookies.set(MEMBER_SESSION_COOKIE, token, getSessionCookieOptions())

    return res
  } catch (e) {
    console.error('[Session POST]', e)
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const session = verifyMemberSessionToken(token)
    if (!session) {
      const res = NextResponse.json({ authenticated: false }, { status: 401 })
      res.cookies.set(MEMBER_SESSION_COOKIE, '', { ...getSessionCookieOptions(0), maxAge: 0 })
      return res
    }

    // Fetch full member info (return raw snake_case for mapTeamMember)
    const memberRes = await fetch(
      `${SB_URL}/rest/v1/team_members?id=eq.${session.memberId}&is_active=eq.true&deleted_at=is.null&select=id,shop_id,name,phone,role,pin_hash,speciality,pay_rate_type,pay_rate,email,email_verified,is_active,joined_at,created_at,deleted_at,updated_at&limit=1`,
      { headers: HEADERS, signal: AbortSignal.timeout(10000) }
    )

    if (!memberRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch member' }, { status: 500 })
    }

    const members = await memberRes.json()
    if (!members?.length) {
      const res = NextResponse.json({ authenticated: false }, { status: 401 })
      res.cookies.set(MEMBER_SESSION_COOKIE, '', { ...getSessionCookieOptions(0), maxAge: 0 })
      return res
    }

    const member = members[0]
    return NextResponse.json({
      authenticated: true,
      memberId: session.memberId,
      shopId: session.shopId,
      member, // raw Supabase row — mapTeamMember expects snake_case
    })
  } catch (e) {
    console.error('[Session GET]', e)
    return NextResponse.json({ error: 'Session check failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ success: true })
  res.cookies.set(MEMBER_SESSION_COOKIE, '', { ...getSessionCookieOptions(0), maxAge: 0 })
  return res
}
