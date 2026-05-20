import { useEffect, useMemo, useState } from 'react'
import type { CustomerRecord, MeasurementRecord, OrderRecord, PaymentRecord } from '@/lib/db/schema'
import { customerFinancialSummary } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapMeasurement, mapOrder, mapPayment } from '@/lib/supabase/records'

function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useCustomers(shopId: string | null) {
  const [query, setQuery] = useState('')
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'child'>('all')
  const [allCustomers, setAllCustomers] = useState<CustomerRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!shopId) {
      setAllCustomers([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
      if (!cancelled && !error) setAllCustomers((data ?? []).map(mapCustomer))
      if (!cancelled) setIsLoading(false)
    }
    load()
    const channel = supabase
      .channel(uniqueChannelName(`customers-${shopId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [shopId])

  const filtered = useMemo(() => {
    let list = allCustomers
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
    }
    if (genderFilter !== 'all') list = list.filter(c => c.gender === genderFilter)
    return [...list].sort((a, b) => {
      if (a.lastOrderAt && b.lastOrderAt) return b.lastOrderAt.localeCompare(a.lastOrderAt)
      if (a.lastOrderAt) return -1
      if (b.lastOrderAt) return 1
      return a.name.localeCompare(b.name)
    })
  }, [allCustomers, query, genderFilter])

  return {
    customers: filtered,
    total: allCustomers.length,
    isLoading,
    query, setQuery,
    genderFilter, setGenderFilter,
  }
}

export function useCustomer(id: string) {
  const [customer, setCustomer] = useState<CustomerRecord | undefined>()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: customerData } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      const [{ data: orderData }, { data: measurementData }] = await Promise.all([
        (supabase as any).from('orders').select('*').eq('customer_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
        (supabase as any).from('measurements').select('*').eq('customer_id', id).is('deleted_at', null).order('taken_at', { ascending: false }),
      ])
      const orderRows = (orderData ?? []).map(mapOrder)
      const orderIds = orderRows.map((o: OrderRecord) => o.id)
      const { data: paymentData } = orderIds.length
        ? await (supabase as any).from('payments').select('*').in('order_id', orderIds).is('deleted_at', null)
        : { data: [] }
      if (cancelled) return
      setCustomer(customerData ? mapCustomer(customerData) : undefined)
      setOrders(orderRows)
      setMeasurements((measurementData ?? []).map(mapMeasurement))
      setPayments((paymentData ?? []).map(mapPayment))
    }
    load()
    const channel = supabase
      .channel(uniqueChannelName(`customer-profile-${id}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'measurements', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [id])

  const finance = useMemo(() => customerFinancialSummary(orders, payments), [orders, payments])

  return {
    customer,
    orders,
    measurements,
    totalSpent: finance.receivedAmount,
    pendingBalance: finance.remainingBalance,
    finance,
  }
}
