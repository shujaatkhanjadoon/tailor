import { NextRequest, NextResponse } from 'next/server'
import { sbGet } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Code required' }, { status: 400 })
  }

  try {
    const rows = await sbGet(
      `coupons?code=eq.${encodeURIComponent(code.toUpperCase())}&select=*&limit=1`
    )
    const coupon = rows?.[0]
    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Invalid coupon code' })
    }
    if (!coupon.is_active) {
      return NextResponse.json({ valid: false, error: 'This coupon is no longer active' })
    }
    if (new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'This coupon has expired' })
    }
    if (coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ valid: false, error: 'This coupon has reached its usage limit' })
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountPct: coupon.discount_pct,
        maxUsesPerShop: coupon.max_uses_per_shop,
        minAmountPkr: coupon.min_amount_pkr,
        appliesToPlan: coupon.applies_to_plan,
      },
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Failed to validate coupon' })
  }
}
