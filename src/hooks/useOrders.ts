import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OrderRecord, OrderStatusHistoryRecord, PaymentRecord } from '@/lib/db/schema'
import { orderBalance } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapOrder, mapPayment, mapStatusHistory } from '@/lib/supabase/records'
import { karachiDateString } from '@/lib/time'

export type OrderFilter = 'all' | 'today' | 'overdue' | 'ready' | 'unassigned'
const ORDER_LIST_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at'
const PAYMENT_COLUMNS = 'id,shop_id,order_id,amount,applied_to_balance,kind,method,recorded_by,paid_at,notes,deleted_at'
const HISTORY_COLUMNS = 'id,order_id,old_status,new_status,changed_by,changed_at'
const PAGE_SIZE = 50

let chanId = 0
function uniqueChannelName(name: string) {
  return `${name}-${chanId++}`
}

function applyOrderFilters(
  query: any,
  params: {
    today: string
    activeFilter: OrderFilter
    statusFilter: OrderRecord['status'] | 'all'
    searchQuery: string
  },
) {
  const { today, activeFilter, statusFilter, searchQuery } = params
  if (activeFilter === 'overdue') query = query.lt('due_date', today).not('status', 'in', '("delivered","cancelled")')
  if (activeFilter === 'ready') query = query.eq('status', 'ready')
  if (activeFilter === 'today') query = query.gte('created_at', `${today}T00:00:00`).lt('created_at', `${today}T23:59:59`)
  if (activeFilter === 'unassigned') query = query.is('assigned_to', null).not('status', 'in', '("delivered","cancelled")')
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)

  const q = searchQuery.trim()
  if (q) {
    const parts = [
      `customer_name.ilike.%${q}%`,
      `tracking_code.ilike.%${q}%`,
      `customer_phone.ilike.%${q}%`,
      `order_for_name.ilike.%${q}%`,
    ]
    const orderNumber = Number(q)
    if (Number.isInteger(orderNumber) && orderNumber > 0) parts.push(`order_number.eq.${orderNumber}`)
    query = query.or(parts.join(','))
  }

  return query
}

async function fetchOrders(
  shopId: string,
  role: 'owner' | 'karigar',
  memberId: string | undefined,
  params: {
    today: string
    activeFilter: OrderFilter
    statusFilter: OrderRecord['status'] | 'all'
    searchQuery: string
    page: number
    paginated: boolean
  },
) {
  if (role === 'karigar' && !memberId) return { rows: [], total: 0 }
  let query = (supabase as any)
    .from('orders')
    .select(ORDER_LIST_COLUMNS, { count: 'exact' })
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (role === 'karigar' && memberId) query = query.eq('assigned_to', memberId)
  query = applyOrderFilters(query, params)
  if (params.paginated) {
    query = query.range(params.page * PAGE_SIZE, params.page * PAGE_SIZE + PAGE_SIZE - 1)
  }
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { rows: (data ?? []).map(mapOrder), total: count ?? data?.length ?? 0 }
}

export function useOrders(
  shopId: string | null,
  role: 'owner' | 'karigar',
  memberId?: string,
  options: { paginated?: boolean } = {},
) {
  const [statusFilter, setStatusFilter] = useState<OrderRecord['status'] | 'all'>('all')
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const today = karachiDateString()
  const paginated = options.paginated ?? false

  const counts = useMemo(() => ({
    overdue: allOrders.filter(o => o.dueDate < today && !['delivered','cancelled'].includes(o.status)).length,
    ready: allOrders.filter(o => o.status === 'ready').length,
    today: allOrders.filter(o => o.createdAt?.startsWith(today)).length,
    unassigned: allOrders.filter(o => !o.assignedTo && !['delivered','cancelled'].includes(o.status)).length,
  }), [allOrders, today])

  useEffect(() => {
    setPage(0)
  }, [activeFilter, statusFilter, searchQuery])

  useEffect(() => {
    if (!shopId) {
      setAllOrders([])
      setTotal(0)
      setIsLoading(false)
      return
    }
    let cancelled = false

    const fetchAndSet = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true)
      try {
        const result = await fetchOrders(shopId, role, memberId, { today, activeFilter, statusFilter, searchQuery, page, paginated })
        if (!cancelled) {
          setAllOrders(prev => paginated && page > 0 ? [...prev, ...result.rows] : result.rows)
          setTotal(result.total)
        }
      } finally {
        if (!cancelled && showLoading) setIsLoading(false)
      }
    }

    const load = () => fetchAndSet(true)
    const refresh = () => fetchAndSet(false)

    load()
    const channel = supabase
      .channel(uniqueChannelName(`orders-list-${shopId}-${memberId ?? 'all'}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') {
          console.log('[useOrders] Realtime subscription status:', status)
        }
      })
    const interval = setInterval(refresh, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [shopId, role, memberId, today, activeFilter, statusFilter, searchQuery, page, paginated])

  return {
    orders: allOrders,
    total,
    counts,
    isLoading,
    hasMore: paginated && allOrders.length < total,
    loadMore: () => setPage(p => p + 1),
    statusFilter, setStatusFilter,
    activeFilter, setActiveFilter,
    searchQuery, setSearchQuery,
  }
}

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<OrderRecord | undefined>()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [history, setHistory] = useState<OrderStatusHistoryRecord[]>([])

  const fetchOrder = useCallback(async () => {
    const [{ data: orderData }, { data: paymentData }, { data: historyData }] = await Promise.all([
      (supabase as any).from('orders').select(ORDER_LIST_COLUMNS).eq('id', orderId).is('deleted_at', null).maybeSingle(),
      (supabase as any).from('payments').select(PAYMENT_COLUMNS).eq('order_id', orderId).is('deleted_at', null).order('paid_at'),
      (supabase as any).from('order_status_history').select(HISTORY_COLUMNS).eq('order_id', orderId).order('changed_at', { ascending: false }),
    ])
    return {
      order: orderData ? mapOrder(orderData) : undefined,
      payments: (paymentData ?? []).map(mapPayment),
      history: (historyData ?? []).map(mapStatusHistory),
    }
  }, [orderId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const result = await fetchOrder()
      if (cancelled) return
      setOrder(result.order)
      setPayments(result.payments)
      setHistory(result.history)
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
  }, [fetchOrder, orderId])

  const refresh = useCallback(async () => {
    const result = await fetchOrder()
    setOrder(result.order)
    setPayments(result.payments)
    setHistory(result.history)
  }, [fetchOrder])

  return {
    order,
    payments,
    history,
    balance: order ? orderBalance(order) : 0,
    refresh,
  }
}
