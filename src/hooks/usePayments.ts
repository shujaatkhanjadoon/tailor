import { useEffect, useMemo, useState } from 'react'
import type { OrderRecord, PaymentRecord } from '@/lib/db/schema'
import { orderBalance, paymentAppliedAmount, paymentSurplusAmount, sumPayments } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapOrder, mapPayment } from '@/lib/supabase/records'

const PAYMENT_COLUMNS = 'id,shop_id,order_id,amount,applied_to_balance,kind,method,recorded_by,paid_at,notes,deleted_at'
const PAYMENT_ORDER_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at'

function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export type PaymentFilter = 'all' | 'today' | 'this_week' | 'this_month'
export type PaymentMethod = 'all' | 'cash' | 'easypaisa' | 'jazzcash' | 'bank'

export interface PaymentWithOrder extends PaymentRecord {
  orderNumber: number
  customerName: string
  garmentType: string
  orderTotal: number
  orderBalance: number
  appliedAmount: number
  surplusAmount: number
}

function startOf(unit: 'day' | 'week' | 'month'): string {
  const d = new Date()
  if (unit === 'day') d.setHours(0, 0, 0, 0)
  else if (unit === 'week') {
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

export function usePayments(shopId: string | null) {
  const [filter, setFilter] = useState<PaymentFilter>('all')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [enriched, setEnriched] = useState<PaymentWithOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!shopId) {
      setEnriched([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const [{ data: paymentRows }, { data: orderRows }] = await Promise.all([
        (supabase as any).from('payments').select(PAYMENT_COLUMNS).eq('shop_id', shopId).is('deleted_at', null).order('paid_at', { ascending: false }),
        (supabase as any).from('orders').select(PAYMENT_ORDER_COLUMNS).eq('shop_id', shopId).is('deleted_at', null),
      ])
      const orders = new Map<string, OrderRecord>((orderRows ?? []).map((row: any) => {
        const order = mapOrder(row)
        return [order.id, order]
      }))
      const rows = (paymentRows ?? []).map((row: any) => {
        const payment = mapPayment(row)
        const order = orders.get(payment.orderId)
        return {
          ...payment,
          orderNumber: order?.orderNumber ?? 0,
          customerName: order?.customerName ?? 'Unknown',
          garmentType: order?.garmentType ?? '',
          orderTotal: order?.totalPrice ?? 0,
          orderBalance: order ? orderBalance(order) : 0,
          appliedAmount: paymentAppliedAmount(payment),
          surplusAmount: paymentSurplusAmount(payment),
        }
      })
      if (!cancelled) {
        setEnriched(rows)
        setIsLoading(false)
      }
    }
    load()
    const channel = supabase
      .channel(uniqueChannelName(`payments-${shopId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [shopId])

  const filtered = useMemo((): PaymentWithOrder[] => {
    let list = enriched
    if (filter === 'today') list = list.filter(p => p.paidAt >= startOf('day'))
    if (filter === 'this_week') list = list.filter(p => p.paidAt >= startOf('week'))
    if (filter === 'this_month') list = list.filter(p => p.paidAt >= startOf('month'))
    if (methodFilter !== 'all') list = list.filter(p => p.method === methodFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p => p.customerName.toLowerCase().includes(q) || String(p.orderNumber).includes(q))
    }
    return list
  }, [enriched, filter, methodFilter, searchQuery])

  const stats = useMemo(() => {
    const todayPayments = enriched.filter(p => p.paidAt >= startOf('day'))
    const weekPayments = enriched.filter(p => p.paidAt >= startOf('week'))
    const monthPayments = enriched.filter(p => p.paidAt >= startOf('month'))
    const sum = (arr: PaymentWithOrder[]) => sumPayments(arr).received
    const byMethod = (arr: PaymentWithOrder[]) => ({
      cash: arr.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
      easypaisa: arr.filter(p => p.method === 'easypaisa').reduce((s, p) => s + p.amount, 0),
      jazzcash: arr.filter(p => p.method === 'jazzcash').reduce((s, p) => s + p.amount, 0),
      bank: arr.filter(p => p.method === 'bank').reduce((s, p) => s + p.amount, 0),
    })
    return {
      todayTotal: sum(todayPayments),
      todayCount: todayPayments.length,
      weekTotal: sum(weekPayments),
      monthTotal: sum(monthPayments),
      allTimeTotal: sum(enriched),
      filteredTotal: sum(filtered),
      filteredCount: filtered.length,
      filteredApplied: sumPayments(filtered).applied,
      filteredTips: sumPayments(filtered).tips,
      filteredOverpayments: sumPayments(filtered).overpayments,
      methodBreakdown: byMethod(filter === 'all' ? monthPayments : filtered),
    }
  }, [enriched, filtered, filter])

  return { payments: filtered, stats, filter, setFilter, methodFilter, setMethodFilter, searchQuery, setSearchQuery, isLoading }
}

export function usePendingBalances(shopId: string | null) {
  const [pendingOrders, setPendingOrders] = useState<OrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!shopId) {
      setPendingOrders([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const { data } = await (supabase as any).from('orders').select(PAYMENT_ORDER_COLUMNS).eq('shop_id', shopId).is('deleted_at', null)
      if (!cancelled) {
        setPendingOrders((data ?? []).map(mapOrder).filter((o: OrderRecord) => o.status !== 'cancelled' && orderBalance(o) > 0))
        setIsLoading(false)
      }
    }
    load()
    const channel = supabase
      .channel(uniqueChannelName(`pending-balances-${shopId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [shopId])

  return {
    pendingOrders,
    totalPending: pendingOrders.reduce((sum, o) => sum + orderBalance(o), 0),
    isLoading,
  }
}
