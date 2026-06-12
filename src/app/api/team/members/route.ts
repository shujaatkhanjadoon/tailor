import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { SALT_ROUNDS, validateKarigarPIN } from '@/lib/security/pin'

const upsertMemberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100).trim(),
  phone: z.string().regex(/^\d{10,13}$/),
  pin: z.string().min(1).optional(),
  speciality: z.string().optional(),
  payRateType: z.enum(['daily', 'per_order', 'monthly']).optional(),
  payRate: z.number().min(0).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(upsertMemberSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { id, name, phone, pin, speciality, payRateType, payRate } = parsed.data

    // Validate PIN strength server-side (prevent bypassing client-side validation)
    if (pin) {
      const pinCheck = validateKarigarPIN(pin)
      if (!pinCheck.valid) {
        return NextResponse.json({ error: pinCheck.error ?? 'Kamzor PIN. Mazboot PIN chunein.' }, { status: 400 })
      }
    }

    const now = new Date().toISOString()
    const today = now.split('T')[0]
    const isUpdate = !!id

    if (isUpdate) {
      const updateData: Record<string, unknown> = {
        name,
        phone,
        speciality: speciality ?? null,
        pay_rate_type: payRateType ?? null,
        pay_rate: payRate ?? 0,
        updated_at: now,
      }
      if (pin) {
        updateData.pin_hash = bcrypt.hashSync(pin, SALT_ROUNDS)
      }

      const res = await sbFetch(`team_members?id=eq.${id}&shop_id=eq.${encodeURIComponent(shopId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(updateData),
      })
      if (!res.ok) {
        const errText = await res.text()
        logger.error('team-members', 'Update failed', errText)
        return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: { id } })
    }

    // Check phone uniqueness globally
    const dupeRes = await sbFetch(
      `team_members?phone=eq.${phone}&is_active=eq.true&deleted_at=is.null&select=id,shop_id,name,role&limit=1`,
    )
    if (dupeRes.ok) {
      const dupe = await dupeRes.json() as { id: string; shop_id: string; name: string; role: string }[]
      if (dupe.length && dupe[0].id !== id) {
        const member = dupe[0]
        if (member.shop_id === shopId) {
          return NextResponse.json({
            error: `Yeh number pehle se registered hai (${member.name} — ${member.role})`,
          }, { status: 409 })
        }
        return NextResponse.json({
          error: 'Yeh number pehle se kisi aur dukaan par registered hai',
        }, { status: 409 })
      }
    }

    // Create
    const memberId = id ?? crypto.randomUUID()

    const insertData: Record<string, unknown> = {
      id: memberId,
      shop_id: shopId,
      name,
      phone,
      role: 'karigar',
      pin_hash: pin ? bcrypt.hashSync(pin, SALT_ROUNDS) : '',
      speciality: speciality ?? null,
      pay_rate_type: payRateType ?? null,
      pay_rate: payRate ?? 0,
      is_active: true,
      failed_attempts: 0,
      joined_at: today,
      created_at: now,
    }

    const res = await sbFetch('team_members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(insertData),
    })
    if (!res.ok) {
      const errText = await res.text()
      logger.error('team-members', 'Insert failed', errText)
      return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
    }

    const [newMember] = await res.json()
    return NextResponse.json({ success: true, data: newMember }, { status: 201 })
  } catch (e) {
    logger.error('team-members', 'Unexpected error', e)
    return NextResponse.json({ error: 'Team member operation failed' }, { status: 500 })
  }
}
