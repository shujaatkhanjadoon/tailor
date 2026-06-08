import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const upsertMeasurementSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  orderForRelation: z.string().optional(),
  orderForName: z.string().nullable().optional(),
  recipientGender: z.string().nullable().optional(),
  garmentType: z.string(),
  values: z.record(z.string(), z.string()),
  notes: z.string().nullable().optional(),
  takenAt: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(upsertMeasurementSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { id, customerId, orderForRelation, orderForName, recipientGender, garmentType, values, notes, takenAt } = parsed.data

    const now = new Date().toISOString()

    // Check if measurement exists
    const checkRes = await sbFetch(`measurements?id=eq.${id}&select=id&limit=1`)
    const [existing] = await checkRes.json()

    if (existing) {
      const res = await sbFetch(`measurements?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          garment_type: garmentType,
          values,
          notes: notes ?? null,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        logger.error('measurements', 'Update failed', errText)
        return NextResponse.json({ error: 'Failed to update measurement' }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: { id } })
    }

    // Insert
    const insertPayload: Record<string, unknown> = {
      id,
      customer_id: customerId,
      shop_id: shopId,
      order_for_relation: orderForRelation ?? 'self',
      order_for_name: orderForName ?? null,
      recipient_gender: recipientGender ?? null,
      garment_type: garmentType,
      values,
      notes: notes ?? null,
      taken_at: takenAt ?? now,
    }

    const res = await sbFetch('measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(insertPayload),
    })
    if (!res.ok) {
      const errText = await res.text()
      logger.error('measurements', 'Insert failed', errText)
      return NextResponse.json({ error: 'Failed to create measurement' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } }, { status: 201 })
  } catch (e) {
    logger.error('measurements', 'Unexpected error', e)
    return NextResponse.json({ error: 'Measurement operation failed' }, { status: 500 })
  }
  })
}
