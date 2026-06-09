// src/app/api/admin/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/admin/auth'
import { PLANS } from '@/lib/billing/plans'
import { sbGet } from '@/lib/supabase/service'
import type {
  SubscriptionPaymentRow, SubscriptionRow, ShopRow, ShopUsageRow,
  OrderRow, AdminAuditLogRow, ShopVerificationRequestRow,
  TeamMemberRow, PaymentRow, StatusHistoryRow, AdminNotificationRow,
} from '@/lib/supabase/types'
import { logger } from '@/lib/logger'

function parseIntParam(value: string | null, defaultVal: number, maxVal: number): number {
  if (!value) return defaultVal
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, maxVal) : defaultVal
}

export async function GET(req: NextRequest) {
  const type   = req.nextUrl.searchParams.get('type')
  const limit  = parseIntParam(req.nextUrl.searchParams.get('limit'), 50, 1000)
  const offset = parseIntParam(req.nextUrl.searchParams.get('offset'), 0, 10000)
  const token  = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    switch (type) {

      case 'summary': {
        const thisMonth = new Date().toISOString().slice(0, 7)
        const thisMonthStart = `${thisMonth}-01T00:00:00Z`
        const [payments, monthPayments, subs] = await Promise.all([
          sbGet('subscription_payments?status=eq.completed&select=amount_pkr') as Promise<SubscriptionPaymentRow[]>,
          sbGet(`subscription_payments?status=eq.completed&paid_at=gte.${thisMonthStart}&select=amount_pkr,paid_at`) as Promise<SubscriptionPaymentRow[]>,
          sbGet('subscriptions?select=status,plan') as Promise<SubscriptionRow[]>,
        ])
        return NextResponse.json({
          data: {
            total:               payments.reduce((s, p) => s + Number(p.amount_pkr), 0),
            thisMonthRevenue:    monthPayments.reduce((s, p) => s + Number(p.amount_pkr), 0),
            activeSubscriptions: subs.filter(s => s.status === 'active').length,
            trialing:            subs.filter(s => s.status === 'trialing').length,
          }
        })
      }

      case 'pending': {
        const [payments, shops] = await Promise.all([
          sbGet(`subscription_payments?status=eq.pending&method=neq.reminder&order=paid_at.desc&limit=${limit}&offset=${offset}&select=*`) as Promise<SubscriptionPaymentRow[]>,
          sbGet('shops?select=id,shop_name,owner_phone,city') as Promise<ShopRow[]>,
        ])
        const shopMap = new Map(shops.map(s => [s.id, s]))
        return NextResponse.json({
          data: payments.map(p => ({ ...p, shops: shopMap.get(p.shop_id) ?? null }))
        })
      }

      case 'disputes': {
        const [refundedPayments, shops] = await Promise.all([
          sbGet(`subscription_payments?status=eq.refunded&order=paid_at.desc&limit=${limit}&select=*`) as Promise<SubscriptionPaymentRow[]>,
          sbGet('shops?select=id,shop_name,owner_phone,city') as Promise<ShopRow[]>,
        ])
        const shopMap = new Map(shops.map(s => [s.id, s]))
        return NextResponse.json({
          data: refundedPayments.map(p => ({ ...p, shops: shopMap.get(p.shop_id) ?? null }))
        })
      }

      case 'shops': {
        const [shops, subs, usages] = await Promise.all([
          sbGet(`shops?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`) as Promise<ShopRow[]>,
          sbGet(`subscriptions?select=shop_id,plan,status,billing_cycle,amount_pkr,expires_at,trial_ends_at&order=created_at.desc&limit=${Math.min(limit * 3, 1000)}`) as Promise<SubscriptionRow[]>,
          sbGet(`shop_usage?select=shop_id,orders_this_month,customers_total,karigar_count&limit=${Math.min(limit * 2, 1000)}`) as Promise<ShopUsageRow[]>,
        ])

        // Only fetch order stats for shops returned in this page (not ALL shops)
        const shopIds = shops.map(s => s.id)
        const shopIdsIn = shopIds.map(encodeURIComponent).join(',')
        const orders: OrderRow[] = shopIds.length > 0
          ? await sbGet(`orders?shop_id=in.(${shopIdsIn})&select=id,shop_id,status,total_price,amount_paid,deleted_at&order=created_at.desc&limit=${limit * 200}`) as OrderRow[]
          : []
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
        const logsLimit = parseIntParam(req.nextUrl.searchParams.get('limit'), 200, 1000)
        const logsOffset = parseIntParam(req.nextUrl.searchParams.get('offset'), 0, 10000)
        const [logs, shops] = await Promise.all([
          sbGet(`admin_audit_log?order=performed_at.desc&limit=${logsLimit}&offset=${logsOffset}&select=*`) as Promise<AdminAuditLogRow[]>,
          sbGet('shops?select=id,shop_name,owner_phone') as Promise<ShopRow[]>,
        ])
        const shopMap = new Map(shops.map(s => [s.id, s]))
        return NextResponse.json({
          data: logs.map(l => ({ ...l, shops: l.shop_id ? (shopMap.get(l.shop_id) ?? null) : null }))
        })
      }

      case 'analytics': {
        const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
        const [payments, shops, subs] = await Promise.all([
          sbGet(`subscription_payments?status=eq.completed&paid_at=gte.${twoYearsAgo}&select=amount_pkr,paid_at,plan,billing_cycle`) as Promise<SubscriptionPaymentRow[]>,
          sbGet(`shops?select=id,created_at&created_at=gte.${twoYearsAgo}`) as Promise<ShopRow[]>,
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
            `shop_verification_requests?status=eq.pending&order=requested_at.desc&limit=${limit}&select=*`
          ) as Promise<ShopVerificationRequestRow[]>,
          sbGet('shops?select=id') as Promise<ShopRow[]>,
        ])
        const activeShopIds = new Set(shops.map(s => s.id))
        return NextResponse.json({
          data: verifications.filter(v => activeShopIds.has(v.shop_id))
        })
      }

      case 'notification_history': {
        const logs: AdminNotificationRow[] = await sbGet(`admin_notifications?order=created_at.desc&limit=${limit}&select=*`)
        return NextResponse.json({ data: logs })
      }

      case 'shop_detail': {
        const shopId = req.nextUrl.searchParams.get('id')
        if (!shopId) return NextResponse.json({ error: 'id required' }, { status: 400 })

        const [shopRows, subs, subPayments, orders, shopPayments, team, statusHistory, usage, auditLogs] = await Promise.all([
          sbGet(`shops?id=eq.${shopId}&limit=1`) as Promise<ShopRow[]>,
          sbGet(`subscriptions?shop_id=eq.${shopId}&order=created_at.desc`) as Promise<SubscriptionRow[]>,
          sbGet(`subscription_payments?shop_id=eq.${shopId}&order=paid_at.desc&limit=50`) as Promise<SubscriptionPaymentRow[]>,
          sbGet(`orders?shop_id=eq.${shopId}&order=created_at.desc&limit=100`) as Promise<OrderRow[]>,
          sbGet(`payments?shop_id=eq.${shopId}&order=paid_at.desc&limit=50`) as Promise<PaymentRow[]>,
          sbGet(`team_members?shop_id=eq.${shopId}&select=*`) as Promise<TeamMemberRow[]>,
          sbGet(`order_status_history?shop_id=eq.${shopId}&order=changed_at.desc&limit=200`) as Promise<StatusHistoryRow[]>,
          sbGet(`shop_usage?shop_id=eq.${shopId}`) as Promise<ShopUsageRow[]>,
          sbGet(`admin_audit_log?shop_id=eq.${shopId}&order=performed_at.desc&limit=50`) as Promise<AdminAuditLogRow[]>,
        ])

        const shop = shopRows[0] ?? null
        if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

        return NextResponse.json({
          data: {
            ...shop,
            owner_pin_available: !!shop.encrypted_owner_pin,
            subscriptions: subs,
            subscription_payments: subPayments,
            orders,
            payments: shopPayments,
            team_members: team,
            order_status_history: statusHistory,
            shop_usage: usage,
            audit_logs: auditLogs,
            order_stats: (() => {
              const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status) && !o.deleted_at)
              return {
                total: orders.filter(o => !o.deleted_at).length,
                active: activeOrders.length,
                delivered: orders.filter(o => o.status === 'delivered').length,
                total_value: orders.reduce((s, o) => s + Number(o.total_price ?? 0), 0),
                received: orders.reduce((s, o) => s + Number(o.amount_paid ?? 0), 0),
              }
            })(),
          }
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
