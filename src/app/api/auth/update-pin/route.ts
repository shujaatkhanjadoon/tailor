// src/app/api/auth/update-pin/route.ts
import { NextRequest, NextResponse } from 'next/server'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const { memberId, pinHash, pinPlain } = await req.json()
  if (!memberId || !pinHash) {
    return NextResponse.json({ error: 'memberId and pinHash required' }, { status: 400 })
  }
  if (pinPlain && !/^\d{4}$|^\d{6}$/.test(String(pinPlain))) {
    return NextResponse.json({ error: 'PIN must be exactly 4 or 6 digits' }, { status: 400 })
  }

  const res = await fetch(
    `${SB_URL}/rest/v1/team_members?id=eq.${memberId}`,
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
        ...(pinPlain ? { pin_plain: pinPlain } : {}),
        updated_at: new Date().toISOString(),
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
