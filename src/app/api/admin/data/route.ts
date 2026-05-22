// src/app/api/admin/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
// Direct Supabase REST calls — avoids createClient DNS issues
const SB_URL  = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_HDRS = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return {
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
    'Content-Type':  'application/json',
  }
}

async function sbGet(path: string): Promise<any[]> {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: SB_HDRS(),
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function GET(req: NextRequest) {
  const type  = req.nextUrl.searchParams.get('type')
  const limit = req.nextUrl.searchParams.get('limit') ?? '50'
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    switch (type) {

      case 'summary': {
        const [payments, subs] = await Promise.all([
          sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at'),
          sbGet('subscriptions?select=status,plan'),
        ])
        const thisMonth = new Date().toISOString().slice(0, 7)
        return NextResponse.json({
          data: {
            total:               payments.reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
            thisMonthRevenue:    payments
              .filter((p: any) => p.paid_at?.startsWith(thisMonth))
              .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
            activeSubscriptions: subs.filter((s: any) => s.status === 'active').length,
            trialing:            subs.filter((s: any) => s.status === 'trialing').length,
          }
        })
      }

      case 'pending': {
        const [payments, shops] = await Promise.all([
          sbGet('subscription_payments?status=eq.pending&method=neq.reminder&order=paid_at.desc&select=*'),
          sbGet('shops?select=id,shop_name,owner_phone,city'),
        ])
        const shopMap = new Map(shops.map((s: any) => [s.id, s]))
        return NextResponse.json({
          data: payments.map((p: any) => ({ ...p, shops: shopMap.get(p.shop_id) ?? null }))
        })
      }

      case 'shops': {
        const [shops, subs, usages, orders] = await Promise.all([
          sbGet(`shops?select=*&order=created_at.desc&limit=${limit}`),
          sbGet('subscriptions?select=*'),
          sbGet('shop_usage?select=*'),
          sbGet('orders?select=id,shop_id,status,total_price,amount_paid,created_at,deleted_at'),
        ])
        return NextResponse.json({
          data: shops.map((shop: any) => ({
            ...shop,
            subscriptions: subs.filter((s: any) => s.shop_id === shop.id),
            shop_usage:    usages.filter((u: any) => u.shop_id === shop.id),
            order_stats: (() => {
              const shopOrders = orders.filter((o: any) => o.shop_id === shop.id && !o.deleted_at)
              return {
                total_orders: shopOrders.length,
                active_orders: shopOrders.filter((o: any) => !['delivered', 'cancelled'].includes(o.status)).length,
                delivered_orders: shopOrders.filter((o: any) => o.status === 'delivered').length,
                total_value: shopOrders.reduce((sum: number, o: any) => sum + Number(o.total_price ?? 0), 0),
                received: shopOrders.reduce((sum: number, o: any) => sum + Number(o.amount_paid ?? 0), 0),
              }
            })(),
          }))
        })
      }

      case 'logs': {
        const logsLimit = req.nextUrl.searchParams.get('limit') ?? '200'
        const [logs, shops] = await Promise.all([
          sbGet(`admin_audit_log?order=performed_at.desc&limit=${logsLimit}&select=*`),
          sbGet('shops?select=id,shop_name,owner_phone'),
        ])
        const shopMap = new Map(shops.map((s: any) => [s.id, s]))
        return NextResponse.json({
          data: logs.map((l: any) => ({ ...l, shops: shopMap.get(l.shop_id) ?? null }))
        })
      }

      case 'analytics': {
        const [payments, shops, subs] = await Promise.all([
          sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at,plan,billing_cycle'),
          sbGet('shops?select=id,created_at'),
          sbGet('subscriptions?select=plan,status,billing_cycle'),
        ])

        const now    = new Date()
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          return {
            key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
            label: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }),
          }
        })

        const activeSubs  = subs.filter((s: any) => s.status === 'active')
        const mrr         = activeSubs.reduce((sum: number, s: any) => {
          if (s.plan === 'professional' && s.billing_cycle === 'monthly') return sum + 999
          if (s.plan === 'professional' && s.billing_cycle === 'yearly')  return sum + Math.round(9500/12)
          if (s.plan === 'business'     && s.billing_cycle === 'monthly') return sum + 2499
          if (s.plan === 'business'     && s.billing_cycle === 'yearly')  return sum + Math.round(23999/12)
          return sum
        }, 0)

        return NextResponse.json({
          data: {
            monthlyRevenue: months.map(m => ({
              label:    m.label,
              revenue:  payments.filter((p: any) => p.paid_at?.startsWith(m.key))
                          .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
              newShops: shops.filter((s: any) => s.created_at?.startsWith(m.key)).length,
            })),
            mrr,
            totalRevenue: payments.reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
            totalShops:   shops.length,
            activeSubs:   activeSubs.length,
            revenueByPlan: {
              professional: payments.filter((p: any) => p.plan === 'professional')
                .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
              business: payments.filter((p: any) => p.plan === 'business')
                .reduce((s: number, p: any) => s + Number(p.amount_pkr), 0),
            },
          }
        })
      }

      case 'pending_verifications': {
        const [verifications, shops] = await Promise.all([
          sbGet(
            'shop_verification_requests?status=eq.pending&order=requested_at.desc&select=*'
          ),
          sbGet('shops?select=id'),
        ])
        const activeShopIds = new Set(shops.map((s: any) => s.id))
        return NextResponse.json({
          data: verifications.filter((v: any) => activeShopIds.has(v.shop_id))
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (e) {
    console.error('[Admin Data API]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
