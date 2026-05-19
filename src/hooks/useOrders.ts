import { useEffect, useMemo, useState } from 'react'
import type { OrderRecord, OrderStatusHistoryRecord, PaymentRecord } from '@/lib/db/schema'
import { orderBalance } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapOrder, mapPayment, mapStatusHistory } from '@/lib/supabase/records'
import { karachiDateString } from '@/lib/time'

export type OrderFilter = 'all' | 'today' | 'overdue' | 'ready' | 'unassigned'

function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function fetchOrders(shopId: string, role: 'owner' | 'karigar', memberId?: string) {
  if (role === 'karigar' && !memberId) return []
  let query = (supabase as any)
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (role === 'karigar' && memberId) query = query.eq('assigned_to', memberId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapOrder)
}

export function useOrders(shopId: string | null, role: 'owner' | 'karigar', memberId?: string) {
  const [statusFilter, setStatusFilter] = useState<OrderRecord['status'] | 'all'>('all')
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const today = karachiDateString()

  useEffect(() => {
    if (!shopId) {
      setAllOrders([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const rows = await fetchOrders(shopId, role, memberId)
        if (!cancelled) setAllOrders(rows)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    const channel = supabase
      .channel(uniqueChannelName(`orders-list-${shopId}-${memberId ?? 'all'}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [shopId, role, memberId])

  const filtered = useMemo(() => {
    let list = allOrders
    if (activeFilter === 'overdue') list = list.filter(o => o.dueDate < today && !['delivered','cancelled'].includes(o.status))
    if (activeFilter === 'ready') list = list.filter(o => o.status === 'ready')
    if (activeFilter === 'today') list = list.filter(o => o.createdAt.startsWith(today))
    if (activeFilter === 'unassigned') list = list.filter(o => !o.assignedTo && !['delivered','cancelled'].includes(o.status))
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        String(o.orderNumber).includes(q) ||
        o.trackingCode?.toLowerCase().includes(q) ||
        o.customerPhone?.includes(q) ||
        o.orderForName?.toLowerCase().includes(q)
      )
    }
    return list
  }, [allOrders, activeFilter, statusFilter, searchQuery, today])

  const counts = useMemo(() => ({
    overdue: allOrders.filter(o => o.dueDate < today && !['delivered','cancelled'].includes(o.status)).length,
    ready: allOrders.filter(o => o.status === 'ready').length,
    today: allOrders.filter(o => o.createdAt.startsWith(today)).length,
    unassigned: allOrders.filter(o => !o.assignedTo && !['delivered','cancelled'].includes(o.status)).length,
  }), [allOrders, today])

  return {
    orders: filtered,
    total: allOrders.length,
    counts,
    isLoading,
    statusFilter, setStatusFilter,
    activeFilter, setActiveFilter,
    searchQuery, setSearchQuery,
  }
}

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<OrderRecord | undefined>()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [history, setHistory] = useState<OrderStatusHistoryRecord[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [{ data: orderData }, { data: paymentData }, { data: historyData }] = await Promise.all([
        (supabase as any).from('orders').select('*').eq('id', orderId).is('deleted_at', null).maybeSingle(),
        (supabase as any).from('payments').select('*').eq('order_id', orderId).is('deleted_at', null).order('paid_at'),
        (supabase as any).from('order_status_history').select('*').eq('order_id', orderId).order('changed_at', { ascending: false }),
      ])
      if (cancelled) return
      setOrder(orderData ? mapOrder(orderData) : undefined)
      setPayments((paymentData ?? []).map(mapPayment))
      setHistory((historyData ?? []).map(mapStatusHistory))
    }
    load()
    const channel = supabase
      .channel(uniqueChannelName(`order-detail-${orderId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `order_id=eq.${orderId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${orderId}` }, load)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return {
    order,
    payments,
    history,
    balance: order ? orderBalance(order) : 0,
  }
}
