import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { sbFetch } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0/, '92')
  return digits.startsWith('92') ? digits : `92${digits}`
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { targetPlan?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const targetPlan = body.targetPlan ?? 'all'
  if (!['all', 'starter', 'professional', 'business'].includes(targetPlan)) {
    return NextResponse.json({ error: 'Invalid target plan' }, { status: 400 })
  }

  const message = String(body.message ?? '').trim()
  if (message.length > 4096) {
    return NextResponse.json({ error: 'Message too long (max 4096 chars)' }, { status: 400 })
  }

  const [shopsRes, subsRes] = await Promise.all([
    sbFetch(`shops?is_active=eq.true&select=id,shop_name,owner_phone,whatsapp_number`),
    sbFetch(`subscriptions?select=shop_id,plan,status`),
  ])

  if (!shopsRes.ok || !subsRes.ok) {
    logger.warn('whatsapp', 'Could not load recipients')
    return NextResponse.json({ error: 'Could not load recipients' }, { status: 500 })
  }

  const shops = await shopsRes.json()
  const subs = await subsRes.json()
  const planByShop = new Map(subs.map((sub: { shop_id: string; plan: string }) => [sub.shop_id, sub.plan]))
  const text = encodeURIComponent(message)
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
