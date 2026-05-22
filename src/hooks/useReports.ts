import { useEffect, useMemo, useState } from 'react'
import type { CustomerRecord, OrderRecord, PaymentRecord, TeamMemberRecord } from '@/lib/db/schema'
import { orderBalance, sumPayments } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapOrder, mapPayment, mapTeamMember } from '@/lib/supabase/records'

export type ReportPeriod = '7d' | '30d' | '90d' | '365d' | 'all'

function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function periodStart(period: ReportPeriod): string | null {
  if (period === 'all') return null
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period]
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Generate last N months as labels
function lastNMonths(n: number): { key: string; label: string }[] {
  const result = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    result.push({
      key:   d.toISOString().slice(0, 7),   // "2025-04"
      label: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }),
    })
  }
  return result
}

export function useReports(shopId: string | null) {
  const [period, setPeriod] = useState<ReportPeriod>('30d')
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([])
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([])
  const [allCustomers, setAllCustomers] = useState<CustomerRecord[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!shopId) {
      setAllOrders([])
      setAllPayments([])
      setAllCustomers([])
      setTeamMembers([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const [ordersRes, paymentsRes, customersRes, teamRes] = await Promise.all([
          (supabase as any)
            .from('orders')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          (supabase as any)
            .from('payments')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('paid_at', { ascending: true }),
          (supabase as any)
            .from('customers')
            .select('*')
            .eq('shop_id', shopId)
            .is('deleted_at', null),
          (supabase as any)
            .from('team_members')
            .select('*')
            .eq('shop_id', shopId)
            .eq('is_active', true)
            .is('deleted_at', null),
        ])

        const error = ordersRes.error ?? paymentsRes.error ?? customersRes.error ?? teamRes.error
        if (error) throw new Error(error.message)
        if (!cancelled) {
          setAllOrders((ordersRes.data ?? []).map(mapOrder))
          setAllPayments((paymentsRes.data ?? []).map(mapPayment))
          setAllCustomers((customersRes.data ?? []).map(mapCustomer))
          setTeamMembers((teamRes.data ?? []).map(mapTeamMember))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    const channel = supabase
      .channel(uniqueChannelName(`reports-${shopId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [shopId])

  // ── Filtered by period ──────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const orders = allOrders
    const start  = periodStart(period)
    if (!start) return orders
    return orders.filter(o => o.createdAt >= start)
  }, [allOrders, period])

  const filteredPayments = useMemo(() => {
    const payments = allPayments
    const start    = periodStart(period)
    const validOrderIds = new Set(allOrders.filter(o => o.status !== 'cancelled').map(o => o.id))
    const scoped = payments.filter(p => validOrderIds.has(p.orderId))
    if (!start) return scoped
    return scoped.filter(p => p.paidAt >= start)
  }, [allPayments, allOrders, period])

  const reportPayments = useMemo(() => {
    const validOrderIds = new Set(allOrders.filter(o => o.status !== 'cancelled').map(o => o.id))
    return allPayments.filter(p => validOrderIds.has(p.orderId))
  }, [allOrders, allPayments])

  // ── Summary stats ───────────────────────────────────────────────
  const summary = useMemo(() => {
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

    // Compare to previous period
    const prevStart = (() => {
      if (period === 'all') return null
      const days = { '7d':7,'30d':30,'90d':90,'365d':365 }[period]
      const d = new Date(periodStart(period)!)
      d.setDate(d.getDate() - days)
      return d.toISOString()
    })()

    const validOrderIds = new Set(allOrders.filter(o => o.status !== 'cancelled').map(o => o.id))
    const prevPayments = allPayments.filter(p =>
      validOrderIds.has(p.orderId) &&
      prevStart && p.paidAt >= prevStart && p.paidAt < (periodStart(period) ?? '')
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
      totalCustomers: allCustomers.length,
    }
  }, [filteredOrders, filteredPayments, allOrders, allPayments, allCustomers, period])

  // ── Monthly income chart data (last 12 months) ──────────────────
  const monthlyIncome = useMemo(() => {
    const months   = lastNMonths(12)
    const payments = reportPayments

    return months.map(({ key, label }) => {
      const monthPayments = payments.filter(p => p.paidAt.startsWith(key))
      const income        = sumPayments(monthPayments).received
      const cash          = monthPayments.filter(p => p.method === 'cash').reduce((s,p) => s+p.amount, 0)
      const digital       = income - cash
      return { key, label, income, cash, digital }
    })
  }, [reportPayments])

  // ── Weekly income (last 8 weeks) ─────────────────────────────────
  const weeklyIncome = useMemo(() => {
    const payments = reportPayments
    const result   = []

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date()
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
  }, [reportPayments])

  // ── Order status distribution ───────────────────────────────────
  const statusDistribution = useMemo(() => {
    const orders = filteredOrders.filter(o => o.status !== 'cancelled')
    const groups: Record<string, number> = {}
    orders.forEach(o => {
      groups[o.status] = (groups[o.status] || 0) + 1
    })
    return Object.entries(groups).map(([status, count]) => ({ status, count }))
  }, [filteredOrders])

  // ── Garment breakdown ───────────────────────────────────────────
  const garmentBreakdown = useMemo(() => {
    const orders = filteredOrders.filter(o => o.status !== 'cancelled')
    const groups: Record<string, { count: number; revenue: number }> = {}
    orders.forEach(o => {
      if (!groups[o.garmentType]) groups[o.garmentType] = { count: 0, revenue: 0 }
      groups[o.garmentType].count++
      groups[o.garmentType].revenue += o.totalPrice
    })
    return Object.entries(groups)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count)
  }, [filteredOrders])

  // ── Top customers ────────────────────────────────────────────────
  const topCustomers = useMemo(() => {
    const orders   = filteredOrders.filter(o => o.status !== 'cancelled')
    const customers: Record<string, {
      name: string; id: string
      orders: number; revenue: number; paid: number
    }> = {}

    orders.forEach(o => {
      if (!customers[o.customerId]) {
        customers[o.customerId] = {
          name: o.customerName, id: o.customerId,
          orders: 0, revenue: 0, paid: 0,
        }
      }
      customers[o.customerId].orders++
      customers[o.customerId].revenue += o.totalPrice
      customers[o.customerId].paid    += o.amountPaid
    })

    return Object.values(customers)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [filteredOrders])

  // ── Karigar productivity ─────────────────────────────────────────
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

  // ── Payment method breakdown ─────────────────────────────────────
  const paymentMethods = useMemo(() => {
    const payments = filteredPayments
    const total    = sumPayments(payments).received
    const groups: Record<string, number> = {}
    payments.forEach(p => {
      groups[p.method] = (groups[p.method] || 0) + p.amount
    })
    return Object.entries(groups)
      .map(([method, amount]) => ({
        method,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [filteredPayments])

  const paymentSummary = useMemo(() => sumPayments(filteredPayments), [filteredPayments])

  // ── Daily heatmap (last 30 days) ─────────────────────────────────
  const dailyActivity = useMemo(() => {
    const orders   = allOrders
    const payments = reportPayments
    const result   = []

    for (let i = 29; i >= 0; i--) {
      const d = new Date()
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
  }, [allOrders, reportPayments])

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
