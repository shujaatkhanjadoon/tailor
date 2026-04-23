// src/hooks/usePayments.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, PaymentRecord, OrderRecord } from '@/lib/db/schema'

export type PaymentFilter = 'all' | 'today' | 'this_week' | 'this_month'
export type PaymentMethod = 'all' | 'cash' | 'easypaisa' | 'jazzcash' | 'bank'

export interface PaymentWithOrder extends PaymentRecord {
  orderNumber:  number
  customerName: string
  garmentType:  string
  orderTotal:   number
  orderBalance: number
}

function startOf(unit: 'day' | 'week' | 'month'): string {
  const d = new Date()
  if (unit === 'day') {
    d.setHours(0, 0, 0, 0)
  } else if (unit === 'week') {
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

export function usePayments(shopId: string | null) {
  const [filter,        setFilter]        = useState<PaymentFilter>('all')
  const [methodFilter,  setMethodFilter]  = useState<PaymentMethod>('all')
  const [searchQuery,   setSearchQuery]   = useState('')

  // All payments joined with order data
  const enriched = useLiveQuery(
    async (): Promise<PaymentWithOrder[]> => {
      if (!shopId) return []

      const payments = await db.payments
        .where('shopId').equals(shopId)
        .filter(p => p._deleted === 0)
        .reverse()
        .sortBy('paidAt')

      // Batch fetch orders
      const orderIds  = [...new Set(payments.map(p => p.orderId))]
      const orders    = await db.orders.bulkGet(orderIds)
      const orderMap  = new Map<string, OrderRecord>()
      orders.forEach(o => { if (o) orderMap.set(o.id, o) })

      return payments.map(p => {
        const order = orderMap.get(p.orderId)
        return {
          ...p,
          orderNumber:  order?.orderNumber  ?? 0,
          customerName: order?.customerName ?? 'Unknown',
          garmentType:  order?.garmentType  ?? '',
          orderTotal:   order?.totalPrice   ?? 0,
          orderBalance: order
            ? Math.max(0, order.totalPrice - order.amountPaid)
            : 0,
        }
      })
    },
    [shopId]
  )

  const safe = enriched ?? []

  // Filtered list
  const filtered = useMemo((): PaymentWithOrder[] => {
    let list = safe

    // Date filter
    if (filter === 'today') {
      const start = startOf('day')
      list = list.filter(p => p.paidAt >= start)
    } else if (filter === 'this_week') {
      const start = startOf('week')
      list = list.filter(p => p.paidAt >= start)
    } else if (filter === 'this_month') {
      const start = startOf('month')
      list = list.filter(p => p.paidAt >= start)
    }

    // Method filter
    if (methodFilter !== 'all') {
      list = list.filter(p => p.method === methodFilter)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.customerName.toLowerCase().includes(q) ||
        String(p.orderNumber).includes(q)
      )
    }

    return list
  }, [safe, filter, methodFilter, searchQuery])

  // Summary stats
  const stats = useMemo(() => {
    const todayStart     = startOf('day')
    const weekStart      = startOf('week')
    const monthStart     = startOf('month')

    const sum = (arr: PaymentWithOrder[]) =>
      arr.reduce((s, p) => s + p.amount, 0)

    const todayPayments  = safe.filter(p => p.paidAt >= todayStart)
    const weekPayments   = safe.filter(p => p.paidAt >= weekStart)
    const monthPayments  = safe.filter(p => p.paidAt >= monthStart)

    // Method breakdown for filtered period
    const byMethod = (arr: PaymentWithOrder[]) => ({
      cash:      arr.filter(p => p.method === 'cash').reduce((s,p) => s+p.amount, 0),
      easypaisa: arr.filter(p => p.method === 'easypaisa').reduce((s,p) => s+p.amount, 0),
      jazzcash:  arr.filter(p => p.method === 'jazzcash').reduce((s,p) => s+p.amount, 0),
      bank:      arr.filter(p => p.method === 'bank').reduce((s,p) => s+p.amount, 0),
    })

    return {
      todayTotal:    sum(todayPayments),
      todayCount:    todayPayments.length,
      weekTotal:     sum(weekPayments),
      monthTotal:    sum(monthPayments),
      allTimeTotal:  sum(safe),
      filteredTotal: sum(filtered),
      filteredCount: filtered.length,
      methodBreakdown: byMethod(filter === 'all' ? monthPayments : filtered),
    }
  }, [safe, filtered, filter])

  return {
    payments: filtered,
    stats,
    filter,        setFilter,
    methodFilter,  setMethodFilter,
    searchQuery,   setSearchQuery,
    isLoading: enriched === undefined,
  }
}

// Hook for pending balances — orders with money still owed
export function usePendingBalances(shopId: string | null) {
  const pendingOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!shopId) return []
      return db.orders
        .where('shopId').equals(shopId)
        .filter(o =>
          o._deleted === 0 &&
          !['delivered', 'cancelled'].includes(o.status) &&
          o.totalPrice > o.amountPaid
        )
        .reverse()
        .sortBy('dueDate')
    },
    [shopId]
  )

  const safe = pendingOrders ?? []
  const totalPending = safe.reduce(
    (sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid), 0
  )

  return {
    pendingOrders: safe,
    totalPending,
    isLoading: pendingOrders === undefined,
  }
}