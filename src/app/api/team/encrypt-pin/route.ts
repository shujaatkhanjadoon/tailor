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
    const parsed = await validate(schemas.encryptPin, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }
    const { pin, memberId, shopId } = parsed.data

    const auth = await validateMember(memberId, shopId)
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 })
    }

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    }

    if (!/^\d{4}$|^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 or 6 digits' }, { status: 400 })
    }

    const encrypted = encryptPIN(pin)
    return NextResponse.json({ encrypted })
  } catch (e) {
    console.error('[encrypt-pin]', e)
    return NextResponse.json({ error: 'Encryption failed' }, { status: 500 })
  }
}
