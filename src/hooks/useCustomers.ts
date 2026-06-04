import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomerRecord, MeasurementRecord, OrderRecord, PaymentRecord } from '@/lib/db/schema'
import { customerFinancialSummary } from '@/lib/payments/calculations'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapMeasurement, mapOrder, mapPayment } from '@/lib/supabase/records'

const CUSTOMER_COLUMNS = 'id,shop_id,name,phone,whatsapp,gender,notes,photo_url,total_orders,created_at,updated_at,last_order_at,deleted_at'
const ORDER_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at'
const MEASUREMENT_COLUMNS = 'id,customer_id,shop_id,order_for_relation,order_for_name,recipient_gender,garment_type,values,notes,taken_at,deleted_at'
const PAYMENT_COLUMNS = 'id,shop_id,order_id,amount,applied_to_balance,kind,method,recorded_by,paid_at,notes,deleted_at'

const CUSTOMERS_PER_PAGE = 50

let chanId = 0
function uniqueChannelName(name: string) {
  return `${name}-${chanId++}`
}

export function useCustomers(shopId: string | null) {
  const [query, setQuery] = useState('')
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'child'>('all')
  const [allCustomers, setAllCustomers] = useState<CustomerRecord[]>([])
  const [page, setPage] = useState(0)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setPage(0)
  }, [query, genderFilter])

  useEffect(() => {
    if (!shopId) {
      setAllCustomers([])
      setTotalCustomers(0)
      setIsLoading(false)
      return
    }
    let cancelled = false

    const fetchAndSet = async (showLoading: boolean) => {
      if (showLoading) setIsLoading(true)

      const q = query.trim()

      let countQuery = supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .eq('shop_id', shopId)
        .is('deleted_at', null)
      if (q) {
        countQuery = countQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      }

      let dataQuery = supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('last_order_at', { ascending: false })
      if (q) {
        dataQuery = dataQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      }
      dataQuery = dataQuery.range(page * CUSTOMERS_PER_PAGE, page * CUSTOMERS_PER_PAGE + CUSTOMERS_PER_PAGE - 1)

      const { count: totalCount } = await countQuery
      const { data, error } = await dataQuery
      if (!cancelled && !error) {
        setAllCustomers(prev => page > 0 ? [...prev, ...(data ?? []).map(mapCustomer)] : (data ?? []).map(mapCustomer))
        setTotalCustomers(totalCount ?? 0)
      }
      if (!cancelled && showLoading) setIsLoading(false)
    }

    const load = () => fetchAndSet(true)
    const refresh = () => fetchAndSet(false)

    load()
    const channel = supabase
      .channel(uniqueChannelName(`customers-${shopId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `shop_id=eq.${shopId}` }, load)
      .subscribe()
    const interval = setInterval(refresh, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [shopId, page, query])

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
    total: totalCustomers,
    isLoading,
    query, setQuery,
    genderFilter, setGenderFilter,
    hasMore: (page + 1) * CUSTOMERS_PER_PAGE < totalCustomers,
    loadMore: () => setPage(p => p + 1),
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
      const { data: customerData } = await supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      const [{ data: orderData }, { data: measurementData }] = await Promise.all([
        supabase.from('orders').select(ORDER_COLUMNS).eq('customer_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('measurements').select(MEASUREMENT_COLUMNS).eq('customer_id', id).is('deleted_at', null).order('taken_at', { ascending: false }),
      ])
      const orderRows = (orderData ?? []).map(mapOrder)
      const orderIds = orderRows.map((o: OrderRecord) => o.id)
      const { data: paymentData } = orderIds.length
        ? await supabase.from('payments').select(PAYMENT_COLUMNS).in('order_id', orderIds).is('deleted_at', null)
        : { data: [] }
      if (cancelled) return
      setCustomer(customerData ? mapCustomer(customerData) : undefined)
      setOrders(orderRows)
      setMeasurements((measurementData ?? []).map(mapMeasurement))
      setPayments((paymentData ?? []).map(mapPayment))
    }

    const refresh = async () => {
      if (cancelled) return
      const { data: customerData } = await supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (cancelled) return
      if (customerData) setCustomer(mapCustomer(customerData))
    }

    load()
    const channel = supabase
      .channel(uniqueChannelName(`customer-profile-${id}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'measurements', filter: `customer_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe()
    const interval = setInterval(refresh, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [id])

  const finance = useMemo(() => customerFinancialSummary(orders, payments), [orders, payments])

  const fetchFull = useCallback(async () => {
    const { data: customerData } = await supabase
      .from('customers').select(CUSTOMER_COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle()
    const [{ data: orderData }, { data: measurementData }] = await Promise.all([
      supabase.from('orders').select(ORDER_COLUMNS).eq('customer_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('measurements').select(MEASUREMENT_COLUMNS).eq('customer_id', id).is('deleted_at', null).order('taken_at', { ascending: false }),
    ])
    const orderRows = (orderData ?? []).map(mapOrder)
    const orderIds = orderRows.map((o: OrderRecord) => o.id)
    const { data: paymentData } = orderIds.length
      ? await supabase.from('payments').select(PAYMENT_COLUMNS).in('order_id', orderIds).is('deleted_at', null)
      : { data: [] }
    setCustomer(customerData ? mapCustomer(customerData) : undefined)
    setOrders(orderRows)
    setMeasurements((measurementData ?? []).map(mapMeasurement))
    setPayments((paymentData ?? []).map(mapPayment))
  }, [id])

  const refresh = useCallback(() => fetchFull(), [fetchFull])

  return {
    customer,
    orders,
    measurements,
    totalSpent: finance.receivedAmount,
    pendingBalance: finance.remainingBalance,
    finance,
    refresh,
  }
}
