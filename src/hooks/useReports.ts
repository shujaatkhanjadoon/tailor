import { useEffect, useMemo, useState } from 'react'
import type { OrderRecord, PaymentRecord, TeamMemberRecord } from '@/lib/db/schema'
import { orderBalance, sumPayments } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapOrder, mapPayment, mapTeamMember } from '@/lib/supabase/records'

export type ReportPeriod = '7d' | '30d' | '90d' | '365d' | 'all'

const ORDER_COLUMNS = 'id,shop_id,customer_id,customer_name,garment_type,status,assigned_to,total_price,amount_paid,is_urgent,created_at'
const PAYMENT_COLUMNS = 'id,shop_id,order_id,amount,method,paid_at'
const TEAM_COLUMNS = 'id,shop_id,name,role,speciality,pay_rate_type,pay_rate,is_active,deleted_at'

let chanId = 0
function uniqueChannelName(name: string) {
  return `${name}-${chanId++}`
}

function periodStart(now: Date, period: ReportPeriod): string | null {
  if (period === 'all') return null
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period]
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function lastNMonths(now: Date, n: number): { key: string; label: string }[] {
  const result = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    result.push({
      key:   d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }),
    })
  }
  return result
}

function prevPeriodStart(now: Date, period: ReportPeriod): string | null {
  if (period === 'all') return null
  const days = { '7d':7,'30d':30,'90d':90,'365d':365 }[period]
  const d = new Date(now)
  d.setDate(d.getDate() - days * 2)
  return d.toISOString()
}

export function useReports(shopId: string | null) {
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([])
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cacheBust, setCacheBust] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setCacheBust(c => c + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const [statusDistribution, setStatusDistribution] = useState<{status: string; count: number}[]>([])
  const [garmentBreakdown, setGarmentBreakdown] = useState<{type: string; count: number; revenue: number}[]>([])
  const [topCustomers, setTopCustomers] = useState<{name: string; id: string; orders: number; revenue: number; paid: number}[]>([])
  const [paymentMethods, setPaymentMethods] = useState<{method: string; amount: number; pct: number}[]>([])
  const [totalCustomers, setTotalCustomers] = useState(0)

  useEffect(() => {
    if (!shopId) {
      setAllOrders([])
      setAllPayments([])
      setTeamMembers([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    const fetchAndSet = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true)
      try {
        const now = new Date()
        const rangeStart = period === 'all' ? periodStart(now, '365d') : periodStart(now, period)

        const [ordersRes, paymentsRes, teamRes, customersCountRes,
          garmentRes] = await Promise.all([
          (() => {
            let q = supabase.from('orders').select(ORDER_COLUMNS).eq('shop_id', shopId).is('deleted_at', null).order('created_at', { ascending: false })
            if (rangeStart) q = q.gte('created_at', rangeStart)
            return q
          })(),
          (() => {
            let q = supabase.from('payments').select(PAYMENT_COLUMNS).eq('shop_id', shopId).is('deleted_at', null).order('paid_at', { ascending: true })
            if (rangeStart) q = q.gte('paid_at', rangeStart)
            return q
          })(),
          supabase.from('team_members').select(TEAM_COLUMNS).eq('shop_id', shopId).eq('is_active', true).is('deleted_at', null),
          supabase.from('customers').select('id', { count: 'exact' }).eq('shop_id', shopId).is('deleted_at', null),
          (() => {
            let q = supabase.from('orders').select('garment_type, count(*), total_price.sum()').eq('shop_id', shopId).is('deleted_at', null).not('status', 'eq', 'cancelled')
            if (rangeStart) q = q.gte('created_at', rangeStart)
            return q
          })(),
        ])

        if (!cancelled) {
          const mappedOrders = (ordersRes.data ?? []).map(mapOrder)
          setAllOrders(mappedOrders)
          setAllPayments((paymentsRes.data ?? []).map(mapPayment))
          setTeamMembers((teamRes.data ?? []).map(mapTeamMember))
          setTotalCustomers(customersCountRes.count ?? 0)

          // Compute status distribution locally
          const statusMap = new Map<string, number>()
          for (const o of mappedOrders) {
            if (o.status === 'cancelled') continue
            statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1)
          }
          setStatusDistribution(
            [...statusMap.entries()].map(([status, count]) => ({ status, count }))
          )

          setGarmentBreakdown(((garmentRes.data ?? []) as any[]).map((d) => ({ type: d.garment_type, count: d.count, revenue: d.sum })))

          // Compute top customers locally from fetched orders
          const customerMap = new Map<string, { name: string; orders: number; revenue: number; paid: number }>()
          for (const o of mappedOrders) {
            if (o.status === 'cancelled') continue
            const c = customerMap.get(o.customerId)
            if (c) {
              c.orders++
              c.revenue += o.totalPrice
              c.paid += o.amountPaid
            } else {
              customerMap.set(o.customerId, {
                name: o.customerName,
                orders: 1,
                revenue: o.totalPrice,
                paid: o.amountPaid,
              })
            }
          }
          setTopCustomers(
            [...customerMap.entries()]
              .map(([id, data]) => ({ id, ...data }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 8)
          )

          // Compute payment methods locally
          const methodMap = new Map<string, number>()
          for (const p of (paymentsRes.data ?? [])) {
            methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + p.amount)
          }
          const rawMethods = [...methodMap.entries()].map(([method, amount]) => ({ method, amount }))
          const totalMethodAmount = rawMethods.reduce((s, m) => s + m.amount, 0)
          setPaymentMethods(rawMethods.map((m) => ({ ...m, pct: totalMethodAmount > 0 ? Math.round((m.amount / totalMethodAmount) * 100) : 0 })).sort((a, b) => b.amount - a.amount))
        }
      } finally {
        if (!cancelled && showLoading) setIsLoading(false)
      }
    }

    const load = () => fetchAndSet(true)
    const refresh = () => fetchAndSet(false)

    load()
    const channel = supabase
      .channel(uniqueChannelName(`reports-${shopId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()

    const interval = setInterval(refresh, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [shopId, period])

  const filteredOrders = useMemo(() => {
    const start = periodStart(new Date(), period)
    if (!start) return allOrders
    return allOrders.filter(o => o.createdAt >= start)
  }, [allOrders, period, cacheBust])

  const filteredPayments = useMemo(() => {
    const start = periodStart(new Date(), period)
    const validOrderIds = new Set(allOrders.filter(o => o.status !== 'cancelled').map(o => o.id))
    const scoped = allPayments.filter(p => validOrderIds.has(p.orderId))
    if (!start) return scoped
    return scoped.filter(p => p.paidAt >= start)
  }, [allPayments, allOrders, period, cacheBust])

  const reportPayments = useMemo(() => {
    const validOrderIds = new Set(allOrders.filter(o => o.status !== 'cancelled').map(o => o.id))
    return allPayments.filter(p => validOrderIds.has(p.orderId))
  }, [allOrders, allPayments])

  const summary = useMemo(() => {
    const now = new Date()
    const orders   = filteredOrders.filter(o => o.status !== 'cancelled')
    const payments = filteredPayments
    const allO     = allOrders.filter(o => o.status !== 'cancelled')

    const paymentTotals  = sumPayments(payments)
    const totalRevenue   = paymentTotals.received
    const totalOrders    = orders.length
    const completedOrders = orders.filter(o => o.status === 'delivered').length
    const pendingBalance = allO
      .filter(o => o.status !== 'delivered')
      .reduce((s, o) => s + orderBalance(o), 0)

    const avgOrderValue = totalOrders > 0
      ? Math.round(orders.reduce((s, o) => s + o.totalPrice, 0) / totalOrders)
      : 0

    const completionRate = totalOrders > 0
      ? Math.round((completedOrders / totalOrders) * 100)
      : 0

    const urgentOrders = orders.filter(o => o.isUrgent === 1).length

    const pStart = prevPeriodStart(now, period)
    const validOrderIds = new Set(allOrders.filter(o => o.status !== 'cancelled').map(o => o.id))
    const currentPeriodStart = periodStart(now, period)
    const prevPayments = allPayments.filter(p =>
      validOrderIds.has(p.orderId) &&
      pStart && p.paidAt >= pStart && p.paidAt < (currentPeriodStart ?? '')
    )
    const prevRevenue = sumPayments(prevPayments).received
    const revenueGrowth = prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : null

    return {
      totalRevenue,
      totalOrders,
      completedOrders,
      pendingBalance,
      avgOrderValue,
      completionRate,
      urgentOrders,
      revenueGrowth,
      appliedRevenue: paymentTotals.applied,
      tips: paymentTotals.tips,
      overpayments: paymentTotals.overpayments,
      totalCustomers,
    }
  }, [filteredOrders, filteredPayments, allOrders, allPayments, totalCustomers, period, cacheBust])

  const monthlyIncome = useMemo(() => {
    const now = new Date()
    const months   = lastNMonths(now, 12)
    const payments = reportPayments
    return months.map(({ key, label }) => {
      const monthPayments = payments.filter(p => p.paidAt.startsWith(key))
      const income        = sumPayments(monthPayments).received
      const cash          = monthPayments.filter(p => p.method === 'cash').reduce((s,p) => s+p.amount, 0)
      const digital       = income - cash
      return { key, label, income, cash, digital }
    })
  }, [reportPayments, cacheBust])

  const weeklyIncome = useMemo(() => {
    const now = new Date()
    const payments = reportPayments
    const result   = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 7 * i))
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const weekP   = payments.filter(p => {
        const t = new Date(p.paidAt)
        return t >= weekStart && t < weekEnd
      })
      const income  = sumPayments(weekP).received
      const label   = `W${8 - i}`
      result.push({ label, income })
    }
    return result
  }, [reportPayments, cacheBust])

  const karigarStats = useMemo(() => {
    const orders  = filteredOrders.filter(o => o.status !== 'cancelled')
    const members = teamMembers
    return members
      .filter(m => m.role === 'karigar')
      .map(m => {
        const assigned  = orders.filter(o => o.assignedTo === m.id)
        const completed = assigned.filter(o => o.status === 'delivered')
        const pending   = assigned.filter(o => !['delivered','cancelled'].includes(o.status))
        const revenue   = assigned.reduce((s, o) => s + o.totalPrice, 0)
        return {
          id:           m.id,
          name:         m.name,
          speciality:   m.speciality,
          payRateType:  m.payRateType,
          payRate:      m.payRate,
          totalAssigned: assigned.length,
          completed:    completed.length,
          pending:      pending.length,
          revenue,
          completionRate: assigned.length > 0
            ? Math.round((completed.length / assigned.length) * 100)
            : 0,
        }
      })
      .sort((a, b) => b.totalAssigned - a.totalAssigned)
  }, [filteredOrders, teamMembers])

  const paymentSummary = useMemo(() => sumPayments(filteredPayments), [filteredPayments])

  const dailyActivity = useMemo(() => {
    const now = new Date()
    const orders   = allOrders
    const payments = reportPayments
    const result   = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key      = d.toISOString().split('T')[0]
      const dayOrders  = orders.filter(o => o.createdAt.startsWith(key)).length
      const dayIncome  = payments
        .filter(p => p.paidAt.startsWith(key))
        .reduce((s, p) => s + p.amount, 0)
      result.push({
        date:   key,
        label:  d.toLocaleDateString('en-PK', { day:'numeric', month:'short' }),
        orders: dayOrders,
        income: dayIncome,
      })
    }
    return result
  }, [allOrders, reportPayments, cacheBust])

  return {
    period, setPeriod,
    summary,
    monthlyIncome,
    weeklyIncome,
    statusDistribution,
    garmentBreakdown,
    topCustomers,
    karigarStats,
    paymentMethods,
    paymentSummary,
    dailyActivity,
    isLoading,
  }
}
