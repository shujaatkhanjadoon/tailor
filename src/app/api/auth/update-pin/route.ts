import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { validate, schemas } from '@/lib/validation'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

export async function POST(req: NextRequest) {
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

    const res = await fetch(
      `${SB_URL}/rest/v1/team_members?id=eq.${encodeURIComponent(memberId)}`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          pin_hash:   pinHash,
          updated_at: new Date().toISOString(),
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[update-pin] DB error:', err)
      return NextResponse.json({ error: 'PIN update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[update-pin]', e)
    return NextResponse.json(
      { error: 'PIN update failed' },
      { status: 500 }
    )
  }
}
