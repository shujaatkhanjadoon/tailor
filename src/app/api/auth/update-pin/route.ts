import { NextRequest, NextResponse } from 'next/server'
import { encryptPIN } from '@/lib/security/pin-crypto'
import { validate, schemas } from '@/lib/validation'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

async function validateMember(memberId: string, shopId: string): Promise<{ valid: boolean; error?: string }> {
  if (!SB_URL || !SB_KEY) return { valid: false, error: 'Server misconfigured' }
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/team_members?id=eq.${memberId}&shop_id=eq.${shopId}&is_active=eq.true&deleted_at=is.null&select=id&limit=1`,
      { headers: HEADERS, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return { valid: false, error: 'Member validation failed' }
    const rows = await res.json()
    if (!rows?.length) return { valid: false, error: 'Member not found or inactive' }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Member validation failed' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await validate(schemas.updatePin, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { memberId, shopId, pinHash } = parsed.data

    const auth = await validateMember(memberId, shopId)
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 })
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
          updated_at: new Date().toISOString(),
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
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
