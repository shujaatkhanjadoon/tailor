import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0/, '92')
  return digits.startsWith('92') ? digits : `92${digits}`
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetPlan = 'all', message = '' } = await req.json()
  if (!['all', 'starter', 'professional', 'business'].includes(targetPlan)) {
    return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 })
  }

  const [shopsRes, subsRes] = await Promise.all([
    fetch(`${SB_URL()}/rest/v1/shops?is_active=eq.true&select=id,shop_name,owner_phone,whatsapp_number`, {
      headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` },
      cache: 'no-store',
    }),
    fetch(`${SB_URL()}/rest/v1/subscriptions?select=shop_id,plan,status`, {
      headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` },
      cache: 'no-store',
    }),
  ])

  if (!shopsRes.ok || !subsRes.ok) {
    return NextResponse.json({ error: 'Could not load recipients' }, { status: 500 })
  }

  const shops = await shopsRes.json()
  const subs = await subsRes.json()
  const planByShop = new Map(subs.map((sub: { shop_id: string; plan: string }) => [sub.shop_id, sub.plan]))
  const text = encodeURIComponent(String(message).trim())
  const recipients = shops
    .filter((shop: { id: string }) => targetPlan === 'all' || planByShop.get(shop.id) === targetPlan)
    .map((shop: { shop_name: string; owner_phone?: string; whatsapp_number?: string }) => {
      const phone = shop.whatsapp_number || shop.owner_phone
      if (!phone) return null
      const clean = cleanPhone(phone)
      return {
        shopName: shop.shop_name,
        phone: clean,
        url: `https://wa.me/${clean}${text ? `?text=${text}` : ''}`,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ data: recipients })
}
