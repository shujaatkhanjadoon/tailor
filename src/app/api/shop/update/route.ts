import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateShopSchema = z.object({
  shopName: z.string().min(2).max(100).trim(),
  ownerName: z.string().min(2).max(100).trim(),
  whatsapp: z.string().nullable().optional(),
  stateProvince: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  addressLine: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  brandName: z.string().nullable().optional(),
  brandColor: z.string().nullable().optional(),
  brandLogoUrl: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(updateShopSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { shopName, ownerName, whatsapp, stateProvince, city, addressLine, postalCode, brandName, brandColor, brandLogoUrl } = parsed.data

    const now = new Date().toISOString()

    const updateData: Record<string, unknown> = {
      shop_name: shopName,
      owner_name: ownerName,
      whatsapp_number: whatsapp?.trim() || null,
      state_province: stateProvince?.trim() || null,
      city: city?.trim() || null,
      address_line: addressLine?.trim() || null,
      postal_code: postalCode?.trim() || null,
      brand_name: brandName?.trim() || null,
      brand_color: brandColor || null,
      brand_logo_url: brandLogoUrl || null,
      updated_at: now,
    }

    const res = await sbFetch(`shops?id=eq.${encodeURIComponent(shopId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(updateData),
    })
    if (!res.ok) {
      const errText = await res.text()
      logger.error('shop-update', 'Update failed', errText)
      return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('shop-update', 'Unexpected error', e)
    return NextResponse.json({ error: 'Shop update failed' }, { status: 500 })
  }
}
