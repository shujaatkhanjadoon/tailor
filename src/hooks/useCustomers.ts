// src/hooks/useCustomers.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useMemo } from 'react'
import { db, CustomerRecord, MeasurementRecord, OrderRecord, PaymentRecord } from '@/lib/db/schema'
import { customerFinancialSummary } from '@/lib/payments/calculations'

export function useCustomers(shopId: string | null) {
  const [query,        setQuery]        = useState('')
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'child'>('all')

  // ── No 3rd arg — type via Promise return ──────────────────────
  const allCustomers = useLiveQuery(
    async (): Promise<CustomerRecord[]> => {
      if (!shopId) return []
      return db.customers
        .where('shopId').equals(shopId)
        .filter(c => c._deleted === 0)
        .toArray()
    },
    [shopId]
  )

  const filtered = useMemo((): CustomerRecord[] => {
    let list: CustomerRecord[] = allCustomers ?? []

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q)
      )
    }

    if (genderFilter !== 'all') {
      list = list.filter(c => c.gender === genderFilter)
    }

    return [...list].sort((a, b) => {
      if (a.lastOrderAt && b.lastOrderAt) return b.lastOrderAt.localeCompare(a.lastOrderAt)
      if (a.lastOrderAt) return -1
      if (b.lastOrderAt) return 1
      return a.name.localeCompare(b.name)
    })
  }, [allCustomers, query, genderFilter])

  return {
    customers: filtered,
    total: allCustomers?.length ?? 0,
    query, setQuery,
    genderFilter, setGenderFilter,
  }
}

export function useCustomer(id: string) {
  const customer = useLiveQuery(
    () => db.customers.get(id),
    [id]
  )

  const orders = useLiveQuery(
    async (): Promise<OrderRecord[]> =>
      db.orders
        .where('customerId').equals(id)
        .filter(o => o._deleted === 0)
        .reverse()
        .sortBy('createdAt'),
    [id]
  )

  const measurements = useLiveQuery(
    async (): Promise<MeasurementRecord[]> =>
      db.measurements
        .where('customerId').equals(id)
        .reverse()
        .sortBy('takenAt'),
    [id]
  )

  const safeOrders: OrderRecord[] = orders ?? []

  const payments = useLiveQuery(
    async (): Promise<PaymentRecord[]> => {
      const orderIds = safeOrders.map(o => o.id)
      if (orderIds.length === 0) return []
      const rows = await db.payments.bulkGet(
        (await db.payments.toArray())
          .filter(p => orderIds.includes(p.orderId))
          .map(p => p.id)
      )
      return rows.filter(Boolean) as PaymentRecord[]
    },
    [safeOrders.map(o => o.id).join('|')]
  )

  const finance = useMemo(
    () => customerFinancialSummary(safeOrders, payments ?? []),
    [safeOrders, payments]
  )

  const totalSpent = useMemo(
    () => finance.receivedAmount,
    [finance]
  )

  const pendingBalance = useMemo(
    () => finance.remainingBalance,
    [finance]
  )

  return {
    customer,
    orders:       safeOrders,
    measurements: measurements ?? [],
    totalSpent,
    pendingBalance,
    finance,
  }
}
