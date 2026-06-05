import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const insertPhotoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  type: z.string(),
  cloudUrl: z.string(),
  publicId: z.string(),
  cloudSizeKb: z.number(),
  sizeKb: z.number(),
  takenAt: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(insertPhotoSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { id, orderId, type, cloudUrl, publicId, cloudSizeKb, sizeKb, takenAt } = parsed.data

    const now = new Date().toISOString()

    const insertPayload = {
      id,
      order_id: orderId,
      shop_id: shopId,
      type,
      cloud_url: cloudUrl,
      public_id: publicId,
      cloud_size_kb: cloudSizeKb,
      size_kb: sizeKb,
      taken_at: takenAt ?? now,
      deleted_at: null,
    }

    const res = await sbFetch('order_photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(insertPayload),
    })
    if (!res.ok) {
      const errText = await res.text()
      logger.error('order-photos', 'Insert failed', errText)
      return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    logger.error('order-photos', 'Unexpected error', e)
    return NextResponse.json({ error: 'Photo save failed' }, { status: 500 })
  }
}
