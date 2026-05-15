// src/hooks/useOrders.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useMemo } from 'react'
import { db, OrderRecord } from '@/lib/db/schema'
import { orderBalance } from '@/lib/payments/calculations'

export type OrderFilter = 'all' | 'today' | 'overdue' | 'ready' | 'unassigned'

export function useOrders(shopId: string | null, role: 'owner' | 'karigar', memberId?: string) {
  const [statusFilter, setStatusFilter] = useState<OrderRecord['status'] | 'all'>('all')
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all')
  const [searchQuery,  setSearchQuery]  = useState('')

  const today = new Date().toISOString().split('T')[0]

  // ── Remove 3rd argument, return typed Promise instead ──────────
  const rawOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!shopId) return []
      const today = new Date().toISOString().split('T')[0]

      if (role === 'karigar' && memberId) {
        return db.orders
          .where('assignedTo').equals(memberId)
          .filter(o => o._deleted === 0)
          .reverse()
          .sortBy('createdAt')
      }

      return db.orders
        .where('shopId').equals(shopId)
        .filter(o => o._deleted === 0)
        .reverse()
        .sortBy('createdAt')
    },
    [shopId, role, memberId]
  )

  // ── isLoading: undefined means Dexie hasn't resolved yet ─────────
  const isLoading = rawOrders === undefined
  const allOrders = rawOrders ?? []

  const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0]


  const filtered = useMemo(() => {
    let list = allOrders

    // Quick filter
    if (activeFilter === 'overdue') {
      list = list.filter(o =>
        o.dueDate < today && !['delivered','cancelled'].includes(o.status)
      )
    } else if (activeFilter === 'ready') {
      list = list.filter(o => o.status === 'ready')
    } else if (activeFilter === 'today') {
      list = list.filter(o => o.createdAt.startsWith(today))
    } else if (activeFilter === 'unassigned') {
      list = list.filter(o =>
        !o.assignedTo && !['delivered','cancelled'].includes(o.status)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        String(o.orderNumber).includes(q) ||
        o.trackingCode?.toLowerCase().includes(q) ||
        o.customerPhone?.includes(q)
      )
    }

    return list
  }, [allOrders, activeFilter, statusFilter, searchQuery, today])

  const counts = useMemo(() => ({
    overdue:    allOrders.filter(o =>
      o.dueDate < today && !['delivered','cancelled'].includes(o.status)
    ).length,
    ready:      allOrders.filter(o => o.status === 'ready').length,
    today:      allOrders.filter(o => o.createdAt.startsWith(today)).length,
    unassigned: allOrders.filter(o =>
      !o.assignedTo && !['delivered','cancelled'].includes(o.status)
    ).length,
  }), [allOrders, today])

  return {
    orders:       filtered,
    total:        allOrders.length,
    counts,
    isLoading,                // ← expose this
    statusFilter,  setStatusFilter,
    activeFilter,  setActiveFilter,
    searchQuery,   setSearchQuery,
  }
}

export function useOrder(orderId: string) {
  const order = useLiveQuery(
    () => db.orders.get(orderId),
    [orderId]
  )

  const payments = useLiveQuery(
    async (): Promise<import('@/lib/db/schema').PaymentRecord[]> =>
      db.payments.where('orderId').equals(orderId).sortBy('paidAt'),
    [orderId]
  )

  const history = useLiveQuery(
    async (): Promise<import('@/lib/db/schema').OrderStatusHistoryRecord[]> =>
      db.orderStatusHistory.where('orderId').equals(orderId).reverse().sortBy('changedAt'),
    [orderId]
  )

  const balance = order ? orderBalance(order) : 0

  return {
    order,
    payments: payments ?? [],
    history:  history  ?? [],
    balance,
  }
}
