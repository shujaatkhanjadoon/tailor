import { useEffect, useMemo, useState } from 'react'
import type { OrderRecord, OrderStatusHistoryRecord, PaymentRecord } from '@/lib/db/schema'
import { orderBalance } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapOrder, mapPayment, mapStatusHistory } from '@/lib/supabase/records'
import { karachiDateString } from '@/lib/time'

export type OrderFilter = 'all' | 'today' | 'overdue' | 'ready' | 'unassigned'
const ORDER_LIST_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at'
const PAYMENT_COLUMNS = 'id,shop_id,order_id,amount,applied_to_balance,kind,method,recorded_by,paid_at,notes,deleted_at'
const HISTORY_COLUMNS = 'id,order_id,old_status,new_status,changed_by,changed_at'

function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function fetchOrders(shopId: string, role: 'owner' | 'karigar', memberId?: string) {
  if (role === 'karigar' && !memberId) return []
  let query = (supabase as any)
    .from('orders')
    .select(ORDER_LIST_COLUMNS)
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
        (supabase as any).from('orders').select(ORDER_LIST_COLUMNS).eq('id', orderId).is('deleted_at', null).maybeSingle(),
        (supabase as any).from('payments').select(PAYMENT_COLUMNS).eq('order_id', orderId).is('deleted_at', null).order('paid_at'),
        (supabase as any).from('order_status_history').select(HISTORY_COLUMNS).eq('order_id', orderId).order('changed_at', { ascending: false }),
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
