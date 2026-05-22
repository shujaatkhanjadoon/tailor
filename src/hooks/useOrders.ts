import { useEffect, useState } from 'react'
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

function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

async function countOrders(
  shopId: string,
  role: 'owner' | 'karigar',
  memberId: string | undefined,
  params: Omit<Parameters<typeof applyOrderFilters>[1], 'activeFilter' | 'statusFilter' | 'searchQuery'> & {
    activeFilter: OrderFilter
  },
) {
  if (role === 'karigar' && !memberId) return 0
  let query = (supabase as any)
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .is('deleted_at', null)
  if (role === 'karigar' && memberId) query = query.eq('assigned_to', memberId)
  query = applyOrderFilters(query, {
    today: params.today,
    activeFilter: params.activeFilter,
    statusFilter: 'all',
    searchQuery: '',
  })
  const { count } = await query
  return count ?? 0
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
  const [counts, setCounts] = useState({ overdue: 0, ready: 0, today: 0, unassigned: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const today = karachiDateString()
  const paginated = options.paginated ?? false

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
    const load = async () => {
      setIsLoading(true)
      try {
        const [result, nextCounts] = await Promise.all([
          fetchOrders(shopId, role, memberId, { today, activeFilter, statusFilter, searchQuery, page, paginated }),
          Promise.all([
            countOrders(shopId, role, memberId, { today, activeFilter: 'overdue' }),
            countOrders(shopId, role, memberId, { today, activeFilter: 'ready' }),
            countOrders(shopId, role, memberId, { today, activeFilter: 'today' }),
            countOrders(shopId, role, memberId, { today, activeFilter: 'unassigned' }),
          ]),
        ])
        if (!cancelled) {
          setAllOrders(prev => paginated && page > 0 ? [...prev, ...result.rows] : result.rows)
          setTotal(result.total)
          setCounts({
            overdue: nextCounts[0],
            ready: nextCounts[1],
            today: nextCounts[2],
            unassigned: nextCounts[3],
          })
        }
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
