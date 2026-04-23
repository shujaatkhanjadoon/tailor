// src/hooks/useReports.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, OrderRecord, PaymentRecord } from '@/lib/db/schema'

export type ReportPeriod = '7d' | '30d' | '90d' | '365d' | 'all'

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

  // ── Raw data ────────────────────────────────────────────────────
  const allOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!shopId) return []
      return db.orders
        .where('shopId').equals(shopId)
        .filter(o => o._deleted === 0)
        .toArray()
    },
    [shopId]
  )

  const allPayments = useLiveQuery(
    async (): Promise<PaymentRecord[]> => {
      if (!shopId) return []
      return db.payments
        .where('shopId').equals(shopId)
        .filter(p => p._deleted === 0)
        .toArray()
    },
    [shopId]
  )

  const allCustomers = useLiveQuery(
    async () => {
      if (!shopId) return []
      return db.customers
        .where('shopId').equals(shopId)
        .filter(c => c._deleted === 0)
        .toArray()
    },
    [shopId]
  )

  const teamMembers = useLiveQuery(
    async () => {
      if (!shopId) return []
      return db.teamMembers
        .where('shopId').equals(shopId)
        .filter(m => m.isActive === 1 && m._deleted === 0)
        .toArray()
    },
    [shopId]
  )

  // ── Filtered by period ──────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const orders = allOrders ?? []
    const start  = periodStart(period)
    if (!start) return orders
    return orders.filter(o => o.createdAt >= start)
  }, [allOrders, period])

  const filteredPayments = useMemo(() => {
    const payments = allPayments ?? []
    const start    = periodStart(period)
    if (!start) return payments
    return payments.filter(p => p.paidAt >= start)
  }, [allPayments, period])

  // ── Summary stats ───────────────────────────────────────────────
  const summary = useMemo(() => {
    const orders   = filteredOrders
    const payments = filteredPayments
    const allO     = allOrders ?? []

    const totalRevenue   = payments.reduce((s, p) => s + p.amount, 0)
    const totalOrders    = orders.length
    const completedOrders = orders.filter(o => o.status === 'delivered').length
    const pendingBalance = allO
      .filter(o => !['delivered','cancelled'].includes(o.status))
      .reduce((s, o) => s + Math.max(0, o.totalPrice - o.amountPaid), 0)

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

    const prevPayments = (allPayments ?? []).filter(p =>
      prevStart && p.paidAt >= prevStart && p.paidAt < (periodStart(period) ?? '')
    )
    const prevRevenue = prevPayments.reduce((s, p) => s + p.amount, 0)
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
      totalCustomers: (allCustomers ?? []).length,
    }
  }, [filteredOrders, filteredPayments, allOrders, allPayments, allCustomers, period])

  // ── Monthly income chart data (last 12 months) ──────────────────
  const monthlyIncome = useMemo(() => {
    const months   = lastNMonths(12)
    const payments = allPayments ?? []

    return months.map(({ key, label }) => {
      const monthPayments = payments.filter(p => p.paidAt.startsWith(key))
      const income        = monthPayments.reduce((s, p) => s + p.amount, 0)
      const cash          = monthPayments.filter(p => p.method === 'cash').reduce((s,p) => s+p.amount, 0)
      const digital       = income - cash
      return { key, label, income, cash, digital }
    })
  }, [allPayments])

  // ── Weekly income (last 8 weeks) ─────────────────────────────────
  const weeklyIncome = useMemo(() => {
    const payments = allPayments ?? []
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
      const income  = weekP.reduce((s, p) => s + p.amount, 0)
      const label   = `W${8 - i}`

      result.push({ label, income })
    }
    return result
  }, [allPayments])

  // ── Order status distribution ───────────────────────────────────
  const statusDistribution = useMemo(() => {
    const orders = filteredOrders
    const groups: Record<string, number> = {}
    orders.forEach(o => {
      groups[o.status] = (groups[o.status] || 0) + 1
    })
    return Object.entries(groups).map(([status, count]) => ({ status, count }))
  }, [filteredOrders])

  // ── Garment breakdown ───────────────────────────────────────────
  const garmentBreakdown = useMemo(() => {
    const orders = filteredOrders
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
    const orders   = filteredOrders
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
    const orders  = filteredOrders
    const members = teamMembers ?? []

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
    const total    = payments.reduce((s, p) => s + p.amount, 0)
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

  // ── Daily heatmap (last 30 days) ─────────────────────────────────
  const dailyActivity = useMemo(() => {
    const orders   = allOrders ?? []
    const payments = allPayments ?? []
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
  }, [allOrders, allPayments])

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
    dailyActivity,
    isLoading: allOrders === undefined || allPayments === undefined,
  }
}