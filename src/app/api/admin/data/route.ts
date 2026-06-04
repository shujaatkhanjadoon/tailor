// src/app/api/admin/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { PLANS } from '@/lib/billing/plans'
import { sbGet } from '@/lib/supabase/service'
import type {
  SubscriptionPaymentRow, SubscriptionRow, ShopRow, ShopUsageRow,
  OrderRow, AdminAuditLogRow, ShopVerificationRequestRow,
} from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const type  = req.nextUrl.searchParams.get('type')
  const limit = req.nextUrl.searchParams.get('limit') ?? '50'
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    switch (type) {

      case 'summary': {
        const [payments, subs] = await Promise.all([
          sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at') as Promise<SubscriptionPaymentRow[]>,
          sbGet('subscriptions?select=status,plan') as Promise<SubscriptionRow[]>,
        ])
        const thisMonth = new Date().toISOString().slice(0, 7)
        return NextResponse.json({
          data: {
            total:               payments.reduce((s, p) => s + Number(p.amount_pkr), 0),
            thisMonthRevenue:    payments
              .filter(p => p.paid_at?.startsWith(thisMonth))
              .reduce((s, p) => s + Number(p.amount_pkr), 0),
            activeSubscriptions: subs.filter(s => s.status === 'active').length,
            trialing:            subs.filter(s => s.status === 'trialing').length,
          }
        })
      }

      case 'pending': {
        const [payments, shops] = await Promise.all([
          sbGet('subscription_payments?status=eq.pending&method=neq.reminder&order=paid_at.desc&select=*') as Promise<SubscriptionPaymentRow[]>,
          sbGet('shops?select=id,shop_name,owner_phone,city') as Promise<ShopRow[]>,
        ])
        const shopMap = new Map(shops.map(s => [s.id, s]))
        return NextResponse.json({
          data: payments.map(p => ({ ...p, shops: shopMap.get(p.shop_id) ?? null }))
        })
      }

      case 'shops': {
        const safeLimit = /^\d+$/.test(limit) ? Math.min(parseInt(limit, 10), 1000) : 50
        const [shops, subs, usages, orders] = await Promise.all([
          sbGet(`shops?select=*&order=created_at.desc&limit=${safeLimit}`) as Promise<ShopRow[]>,
          sbGet('subscriptions?select=*') as Promise<SubscriptionRow[]>,
          sbGet('shop_usage?select=*') as Promise<ShopUsageRow[]>,
          sbGet('orders?select=id,shop_id,status,total_price,amount_paid,created_at,deleted_at') as Promise<OrderRow[]>,
        ])
        return NextResponse.json({
          data: shops.map(shop => ({
            ...shop,
            owner_pin_available: !!shop.encrypted_owner_pin,
            subscriptions: subs.filter(s => s.shop_id === shop.id),
            shop_usage:    usages.filter(u => u.shop_id === shop.id),
            order_stats: (() => {
              const shopOrders = orders.filter(o => o.shop_id === shop.id && !o.deleted_at)
              return {
                total_orders: shopOrders.length,
                active_orders: shopOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
                delivered_orders: shopOrders.filter(o => o.status === 'delivered').length,
                total_value: shopOrders.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0),
                received: shopOrders.reduce((sum, o) => sum + Number(o.amount_paid ?? 0), 0),
              }
            })(),
          })),
        })
      }

      case 'logs': {
        const logsLimit = req.nextUrl.searchParams.get('limit') ?? '200'
        const [logs, shops] = await Promise.all([
          sbGet(`admin_audit_log?order=performed_at.desc&limit=${logsLimit}&select=*`) as Promise<AdminAuditLogRow[]>,
          sbGet('shops?select=id,shop_name,owner_phone') as Promise<ShopRow[]>,
        ])
        const shopMap = new Map(shops.map(s => [s.id, s]))
        return NextResponse.json({
          data: logs.map(l => ({ ...l, shops: l.shop_id ? (shopMap.get(l.shop_id) ?? null) : null }))
        })
      }

      case 'analytics': {
        const [payments, shops, subs] = await Promise.all([
          sbGet('subscription_payments?status=eq.completed&select=amount_pkr,paid_at,plan,billing_cycle') as Promise<SubscriptionPaymentRow[]>,
          sbGet('shops?select=id,created_at') as Promise<ShopRow[]>,
          sbGet('subscriptions?select=plan,status,billing_cycle') as Promise<SubscriptionRow[]>,
        ])

        const now    = new Date()
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          return {
            key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
            label: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }),
          }
        })

        const activeSubs  = subs.filter(s => s.status === 'active')
        const mrr         = activeSubs.reduce((sum, s) => {
          const plan = PLANS[s.plan as keyof typeof PLANS]
          if (!plan || !plan.monthlyPkr) return sum
          if (s.billing_cycle === 'monthly') return sum + plan.monthlyPkr
          if (s.billing_cycle === 'yearly' && plan.yearlyPkr) return sum + Math.round(plan.yearlyPkr / 12)
          return sum
        }, 0)

        return NextResponse.json({
          data: {
            monthlyRevenue: months.map(m => ({
              label:    m.label,
              revenue:  payments.filter(p => p.paid_at?.startsWith(m.key))
                          .reduce((s, p) => s + Number(p.amount_pkr), 0),
              newShops: shops.filter(s => s.created_at?.startsWith(m.key)).length,
            })),
            mrr,
            totalRevenue: payments.reduce((s, p) => s + Number(p.amount_pkr), 0),
            totalShops:   shops.length,
            activeSubs:   activeSubs.length,
            revenueByPlan: {
              professional: payments.filter(p => p.plan === 'professional')
                .reduce((s, p) => s + Number(p.amount_pkr), 0),
              business: payments.filter(p => p.plan === 'business')
                .reduce((s, p) => s + Number(p.amount_pkr), 0),
            },
          }
        })
      }

      case 'pending_verifications': {
        const [verifications, shops] = await Promise.all([
          sbGet(
            'shop_verification_requests?status=eq.pending&order=requested_at.desc&select=*'
          ) as Promise<ShopVerificationRequestRow[]>,
          sbGet('shops?select=id') as Promise<ShopRow[]>,
        ])
        const activeShopIds = new Set(shops.map(s => s.id))
        return NextResponse.json({
          data: verifications.filter(v => activeShopIds.has(v.shop_id))
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (e) {
    logger.error('admin', 'Data API error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
