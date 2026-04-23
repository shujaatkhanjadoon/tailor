// src/hooks/useOrders.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useMemo } from 'react'
import { db, OrderRecord } from '@/lib/db/schema'

export type OrderFilter = 'all' | 'today' | 'overdue' | 'ready' | 'unassigned'

export function useOrders(shopId: string | null, role: 'owner' | 'karigar', memberId?: string) {
  const [statusFilter, setStatusFilter] = useState<OrderRecord['status'] | 'all'>('all')
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all')
  const [searchQuery,  setSearchQuery]  = useState('')

  const today = new Date().toISOString().split('T')[0]

  // ── Remove 3rd argument, return typed Promise instead ──────────
  const allOrders = useLiveQuery(
    async (): Promise<OrderRecord[]> => {
      if (!shopId) return []
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
    [shopId, role, memberId]   // ← only 2 args
  )

  const filtered = useMemo((): OrderRecord[] => {
    // allOrders is OrderRecord[] | undefined — guard with ?? []
    let list: OrderRecord[] = allOrders ?? []

    if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter)
    }

    switch (activeFilter) {
      case 'today':
        list = list.filter(o => o.createdAt.startsWith(today))
        break
      case 'overdue':
        list = list.filter(o =>
          o.dueDate < today &&
          !['delivered', 'cancelled'].includes(o.status)
        )
        break
      case 'ready':
        list = list.filter(o => o.status === 'ready')
        break
      case 'unassigned':
        list = list.filter(o =>
          !o.assignedTo &&
          !['delivered', 'cancelled'].includes(o.status)
        )
        break
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        String(o.orderNumber).includes(q)
      )
    }

    return list
  }, [allOrders, statusFilter, activeFilter, searchQuery, today])

  const counts = useMemo(() => {
    const all: OrderRecord[] = allOrders ?? []
    return {
      overdue:    all.filter(o => o.dueDate < today && !['delivered','cancelled'].includes(o.status)).length,
      ready:      all.filter(o => o.status === 'ready').length,
      unassigned: all.filter(o => !o.assignedTo && !['delivered','cancelled'].includes(o.status)).length,
      today:      all.filter(o => o.createdAt.startsWith(today)).length,
    }
  }, [allOrders, today])

  return {
    orders: filtered,          // OrderRecord[] — never undefined
    total: allOrders?.length ?? 0,
    counts,
    statusFilter, setStatusFilter,
    activeFilter, setActiveFilter,
    searchQuery,  setSearchQuery,
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

  const balance = order ? Math.max(0, order.totalPrice - order.amountPaid) : 0

  return {
    order,
    payments: payments ?? [],
    history:  history  ?? [],
    balance,
  }
}