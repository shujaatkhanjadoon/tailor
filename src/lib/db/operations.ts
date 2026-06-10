// Supabase-backed operations with offline fallback.
import crypto, { timingSafeEqual as _timingSafeEqual } from 'crypto'
import type { CustomerRecord, MeasurementRecord, OrderRecord, PaymentRecord, TeamMemberRecord } from './schema'
import { db } from './schema'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapOrder, mapPayment, mapShop, mapTeamMember } from '@/lib/supabase/records'
import { generateTrackingCode } from '../tracking'
import { paymentAppliedAmount } from '@/lib/payments/calculations'
import { karachiDateString, nowKarachiIso } from '@/lib/time'
import { offlineRead, offlineReadOne, offlineWrite, isOnline } from '@/lib/db/offline'

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && _timingSafeEqual(left, right)
  } catch { return false }
}

// In-memory shop name cache — avoids redundant queries in orderOps.add()
const shopNameCache = new Map<string, { name: string; ts: number }>()
const SHOP_CACHE_TTL = 5 * 60 * 1000

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hashSync(pin, 12)
}

async function getShopName(shopId: string): Promise<string> {
  const cached = shopNameCache.get(shopId)
  if (cached && Date.now() - cached.ts < SHOP_CACHE_TTL) return cached.name
  const shop = await shopOps.get(shopId)
  const name = shop?.shopName ?? 'DZ'
  shopNameCache.set(shopId, { name, ts: Date.now() })
  if (shopNameCache.size > 100) {
    const cutoff = Date.now() - SHOP_CACHE_TTL
    for (const [key, val] of shopNameCache) {
      if (val.ts < cutoff) shopNameCache.delete(key)
    }
  }
  return name
}

const CUSTOMER_COLUMNS = 'id,shop_id,name,phone,whatsapp,gender,notes,photo_url,total_orders,created_at,updated_at,last_order_at,deleted_at'
const ORDER_COLUMNS = 'id,shop_id,order_number,tracking_code,customer_id,customer_name,customer_phone,order_for_relation,order_for_name,recipient_gender,measurement_id,garment_type,status,assigned_to,assigned_to_name,total_price,amount_paid,is_urgent,due_date,special_instructions,fabric_photo_url,style_photo_url,created_at,updated_at,delivered_at,deleted_at'
const PAYMENT_COLUMNS = 'id,shop_id,order_id,amount,applied_to_balance,kind,method,recorded_by,paid_at,notes,deleted_at'
const TEAM_MEMBER_COLUMNS = 'id,shop_id,name,phone,role,pin_hash,speciality,pay_rate_type,pay_rate,is_active,joined_at,created_at,deleted_at'

export const uuid = (): string => globalThis.crypto.randomUUID()

function clean<T extends Record<string, unknown>>(row: T): T {
  Object.keys(row).forEach(key => {
    if (row[key] === undefined) delete row[key]
  })
  return row
}

async function requireOk<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asRows = (rows: unknown): Record<string, any>[] => Array.isArray(rows) ? rows as Record<string, any>[] : []

async function deleteCloudinaryAssets(publicIds: string[]) {
  const uniqueIds = [...new Set(publicIds.filter(Boolean))]
  if (uniqueIds.length === 0) return
  const results = await Promise.allSettled(uniqueIds.map(publicId =>
    fetch('/api/photos/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId }),
    })
  ))
  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    console.error(`[deleteCloudinaryAssets] ${failures.length} asset(s) failed to delete`)
  }
}

async function getOrderPhotoPublicIds(orderIds: string[]) {
  if (orderIds.length === 0) return []
  const rows = await requireOk(
    supabase
      .from('order_photos')
      .select('public_id')
      .in('order_id', orderIds)
      .not('public_id', 'is', null)
  )
  return asRows(rows).map((row) => row.public_id).filter(Boolean)
}

async function deleteOrdersByIds(orderIds: string[]) {
  if (orderIds.length === 0) return
  const ts = nowKarachiIso()
  const publicIds = await getOrderPhotoPublicIds(orderIds)
  await deleteCloudinaryAssets(publicIds)

  await Promise.all([
    requireOk(supabase.from('order_photos').delete().in('order_id', orderIds)),
    requireOk(supabase.from('payments').update({ deleted_at: ts }).in('order_id', orderIds)),
    requireOk(supabase.from('order_status_history').update({ deleted_at: ts }).in('order_id', orderIds)),
  ])

  const orderRows = await requireOk(
    supabase.from('orders').select('measurement_id').in('id', orderIds)
  )
  const measurementIds = asRows(orderRows).map((row) => row.measurement_id).filter(Boolean)
  if (measurementIds.length > 0) {
    await requireOk(supabase.from('measurements').update({ deleted_at: ts }).in('id', measurementIds))
  }

  await requireOk(supabase.from('orders').update({ deleted_at: ts }).in('id', orderIds))
}

function customerToRow(customer: CustomerRecord) {
  return clean({
    id: customer.id,
    shop_id: customer.shopId,
    name: customer.name,
    phone: customer.phone,
    whatsapp: customer.whatsapp ?? null,
    gender: customer.gender,
    notes: customer.notes ?? null,
    photo_url: customer.photoUrl ?? null,
    total_orders: customer.totalOrders ?? 0,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
    last_order_at: customer.lastOrderAt ?? null,
    deleted_at: customer._deleted === 1 ? nowKarachiIso() : null,
  })
}

function orderToRow(order: OrderRecord) {
  return clean({
    id: order.id,
    shop_id: order.shopId,
    order_number: order.orderNumber,
    tracking_code: order.trackingCode,
    customer_id: order.customerId,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    order_for_relation: order.orderForRelation ?? 'self',
    order_for_name: order.orderForName ?? null,
    recipient_gender: order.recipientGender ?? null,
    measurement_id: order.measurementId ?? null,
    garment_type: order.garmentType,
    status: order.status,
    assigned_to: order.assignedTo ?? null,
    assigned_to_name: order.assignedToName ?? null,
    total_price: order.totalPrice,
    amount_paid: order.amountPaid,
    is_urgent: order.isUrgent === 1,
    due_date: order.dueDate,
    special_instructions: order.specialInstructions ?? null,
    fabric_photo_url: order.fabricPhotoUrl ?? null,
    style_photo_url: order.stylePhotoUrl ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    delivered_at: order.deliveredAt ?? null,
    deleted_at: order._deleted === 1 ? nowKarachiIso() : null,
  })
}

function paymentToRow(payment: PaymentRecord) {
  return clean({
    id: payment.id,
    shop_id: payment.shopId,
    order_id: payment.orderId,
    amount: payment.amount,
    applied_to_balance: payment.appliedToBalance ?? payment.amount,
    kind: payment.kind ?? 'order_payment',
    method: payment.method,
    recorded_by: payment.recordedBy,
    paid_at: payment.paidAt,
    notes: payment.notes ?? null,
    deleted_at: payment._deleted === 1 ? nowKarachiIso() : null,
  })
}

export interface AddTeamMemberData {
  name: string
  phone: string
  role: 'owner' | 'karigar'
  pin: string
  speciality?: string
  payRateType?: 'daily' | 'per_order' | 'monthly'
  payRate?: number
}

export const shopOps = {
  async getShopId(): Promise<string | null> {
    // Client-side cache — set by AuthContext after login
    if (typeof localStorage === 'undefined') return null
    try {
      return JSON.parse(localStorage.getItem('md_session_v2') || 'null')?.shopId ?? null
    } catch {
      return null
    }
  },

  async get(shopId: string) {
    const row = await requireOk(
      supabase.from('shops').select('id, shop_name, owner_name, owner_phone, whatsapp_number, state_province, city, address_line, postal_code, brand_name, brand_color, brand_logo_url, is_active, created_at, updated_at').eq('id', shopId).maybeSingle()
    )
    return row ? mapShop(row) : undefined
  },

  async setupWithId(id: string): Promise<string> {
    return id
  },

  async setup(shopName: string, ownerPhone: string): Promise<string> {
    const id = uuid()
    const ts = nowKarachiIso()
    await requireOk(
      supabase.from('shops').insert({
        id,
        shop_name: shopName,
        owner_phone: ownerPhone,
        plan: 'starter',
        is_active: true,
        created_at: ts,
        updated_at: ts,
      })
    )
    return id
  },
}

export const teamOps = {
  async getAll(shopId: string, limit = 100, offset = 0): Promise<TeamMemberRecord[]> {
    const rows = await requireOk(
      supabase
        .from('team_members')
        .select(TEAM_MEMBER_COLUMNS)
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('joined_at', { ascending: true })
        .range(offset, offset + limit - 1)
    )
    return asRows(rows).map(mapTeamMember)
  },

  async addWithId(shopId: string, id: string, data: AddTeamMemberData): Promise<TeamMemberRecord> {
    const ts = nowKarachiIso()
    const row = {
      id,
      shop_id: shopId,
      name: data.name,
      phone: data.phone,
      role: data.role,
      pin_hash: data.pin.startsWith('$2')
        // Double-hash guard: if the pin is already bcrypt-hashed (starts with $2), re-hash
        // to normalize the rounds; otherwise hash the plaintext pin with fresh salt
        ? bcrypt.hashSync(data.pin, 12)
        : hashPin(data.pin),
      speciality: data.speciality ?? null,
      pay_rate_type: data.payRateType ?? null,
      pay_rate: data.payRate ?? null,
      is_active: true,
      joined_at: karachiDateString(),
      created_at: ts,
    }
    const saved = await requireOk(
      supabase.from('team_members').insert(row).select('*').single()
    )
    return mapTeamMember(saved)
  },

  async add(shopId: string, data: AddTeamMemberData): Promise<TeamMemberRecord> {
    return teamOps.addWithId(shopId, uuid(), data)
  },

  async verifyPin(memberId: string, pinHash: string): Promise<boolean> {
    const row = await requireOk(
      supabase.from('team_members').select('pin_hash').eq('id', memberId).maybeSingle()
    )
    const pinRow = row as Record<string, unknown>
    if (!pinRow?.pin_hash) return false
    const storedHash = String(pinRow.pin_hash)
    if (storedHash.startsWith('$2')) {
      return bcrypt.compareSync(pinHash, storedHash)
    }
    return timingSafeEqual(pinHash, storedHash)
  },

  async deactivate(memberId: string): Promise<void> {
    const ts = nowKarachiIso()
    await requireOk(
      supabase.from('orders').update({
        assigned_to: null,
        assigned_to_name: null,
        updated_at: ts,
      }).eq('assigned_to', memberId).is('deleted_at', null)
    )
    await requireOk(
      supabase.from('team_members').update({ deleted_at: ts, is_active: false }).eq('id', memberId).eq('role', 'karigar')
    )
  },

  async update(memberId: string, data: Partial<AddTeamMemberData>): Promise<void> {
    await requireOk(
      supabase.from('team_members').update(clean({
        name: data.name,
        phone: data.phone,
        pin_hash: data.pin,
        speciality: data.speciality,
        pay_rate_type: data.payRateType,
        pay_rate: data.payRate,
      })).eq('id', memberId)
    )
  },

  async getByPhone(phone: string): Promise<TeamMemberRecord | undefined> {
    const row = await requireOk(
      supabase
        .from('team_members')
        .select(TEAM_MEMBER_COLUMNS)
        .eq('phone', phone)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle()
    )
    return row ? mapTeamMember(row) : undefined
  },
}

export const customerOps = {
  async getAll(shopId: string, limit = 100, offset = 0): Promise<CustomerRecord[]> {
    return offlineRead(
      'customerOps.getAll',
      async () => {
        const rows = await requireOk(
          supabase
            .from('customers')
            .select(CUSTOMER_COLUMNS)
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('last_order_at', { ascending: false, nullsFirst: false })
            .range(offset, offset + limit - 1)
        )
        return asRows(rows).map(mapCustomer)
      },
      async () => {
        const rows = await db.customers
          .where('shopId').equals(shopId)
          .filter(c => c._deleted !== 1)
          .sortBy('lastOrderAt')
        return rows.reverse().slice(offset, offset + limit)
      },
      async (records) => {
        await db.customers.bulkPut(records.map(c => ({ ...c, _synced: 1 })))
      },
    )
  },

  async search(shopId: string, query: string, limit = 100, offset = 0): Promise<CustomerRecord[]> {
    const q = query.trim()
    if (!q) return customerOps.getAll(shopId)
    const escaped = q.replace(/[%_\\]/g, '\\$&')
    return offlineRead(
      'customerOps.search',
      async () => {
        const rows = await requireOk(
          supabase
            .from('customers')
            .select(CUSTOMER_COLUMNS)
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
            .range(offset, offset + limit - 1)
        )
        return asRows(rows).map(mapCustomer)
      },
      async () => {
        const rows = await db.customers
          .where('shopId').equals(shopId)
          .filter(c => (c._deleted !== 1) && (c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)))
          .toArray()
        return rows.slice(offset, offset + limit)
      },
      async (records) => {
        await db.customers.bulkPut(records.map(c => ({ ...c, _synced: 1 })))
      },
    )
  },

  async add(
    shopId: string,
    data: Pick<CustomerRecord, 'name' | 'phone' | 'gender' | 'whatsapp'>
  ): Promise<CustomerRecord> {
    // Limit unverified shops: max 10 customers until admin approval
    const { data: shopVerification } = await supabase
      .from('shops')
      .select('verification_status')
      .eq('id', shopId)
      .maybeSingle()
    if (shopVerification?.verification_status === 'pending') {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .is('deleted_at', null)
      if ((count ?? 0) >= 10) {
        throw new Error('Aapka account verification pending hai. Sirf 10 customers tak allowed hain. Admin se contact karein.')
      }
    }

    const ts = nowKarachiIso()
    const customer: CustomerRecord = {
      id: uuid(),
      shopId,
      totalOrders: 0,
      createdAt: ts,
      updatedAt: ts,
      _synced: 0,
      _deleted: 0,
      ...data,
    }
    return offlineWrite(
      'customerOps.add',
      async () => {
        const saved = await requireOk(
          supabase.from('customers').insert(customerToRow(customer)).select(CUSTOMER_COLUMNS).single()
        )
        if (!saved) throw new Error('Failed to create customer')
        return mapCustomer(saved as Record<string, unknown>)
      },
      async (record) => {
        await db.customers.put(record)
      },
      customer,
    )
  },

  async get(id: string): Promise<CustomerRecord | undefined> {
    return offlineReadOne(
      'customerOps.get',
      async () => {
        const row = await requireOk(
          supabase.from('customers').select(CUSTOMER_COLUMNS).eq('id', id).is('deleted_at', null).maybeSingle()
        )
        return row ? mapCustomer(row) : undefined
      },
      async () => {
        return db.customers.where('id').equals(id).filter(c => c._deleted !== 1).first()
      },
      async (record) => {
        await db.customers.put({ ...record, _synced: 1 })
      },
    )
  },

  async update(id: string, data: Partial<CustomerRecord>): Promise<void> {
    const ts = nowKarachiIso()
    const patch = { ...data, updatedAt: ts }
    const supabaseWrite = async () => {
      const customerPatch = clean({
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp ?? null,
        gender: data.gender,
        notes: data.notes ?? null,
        photo_url: data.photoUrl ?? null,
        updated_at: ts,
      })
      await requireOk(supabase.from('customers').update(customerPatch).eq('id', id))
      const orderPatch = clean({
        customer_name: data.name,
        customer_phone: data.phone,
        updated_at: data.name !== undefined || data.phone !== undefined ? ts : undefined,
      })
      if (Object.keys(orderPatch).length > 0) {
        await requireOk(
          supabase.from('orders').update(orderPatch).eq('customer_id', id).is('deleted_at', null)
        )
      }
    }
    const dexieWrite = async (synced: 0 | 1) => {
      const existing = await db.customers.get(id)
      if (existing) {
        await db.customers.put({ ...existing, ...patch, _synced: synced })
      }
    }
    if (isOnline()) {
      try {
        await supabaseWrite()
        await dexieWrite(1)
      } catch (err) {
        console.warn('[Offline] customerOps.update failed, queuing locally:', err)
        await dexieWrite(0)
      }
    } else {
      await dexieWrite(0)
    }
  },

  async softDelete(id: string): Promise<void> {
    const ts = nowKarachiIso()

    const cascadeLocal = async () => {
      const orders = await db.orders.where('customerId').equals(id).toArray()
      for (const order of orders) {
        const payments = await db.payments.where('orderId').equals(order.id).toArray()
        for (const p of payments) {
          await db.payments.put({ ...p, _deleted: 1, _synced: 0 } as PaymentRecord)
        }
        await db.orders.put({ ...order, _deleted: 1, _synced: 0 } as OrderRecord)
      }
      const measurements = await db.measurements.where('customerId').equals(id).toArray()
      for (const m of measurements) {
        await db.measurements.put({ ...m, _deleted: 1, _synced: 0 } as MeasurementRecord)
      }
    }

    const markCustomer = async () => {
      const existing = await db.customers.get(id)
      if (existing) {
        await db.customers.put({ ...existing, _deleted: 1, _synced: 0 } as CustomerRecord)
      }
    }

    if (isOnline()) {
      try {
        const orderRows = await requireOk(supabase.from('orders').select('id').eq('customer_id', id))
        await deleteOrdersByIds(asRows(orderRows).map((row) => String(row.id)).filter(Boolean))
        await Promise.all([
          requireOk(supabase.from('measurements').update({ deleted_at: ts }).eq('customer_id', id)),
          requireOk(supabase.from('customers').update({ deleted_at: ts }).eq('id', id)),
        ])
      } catch (err) {
        console.warn('[Offline] customerOps.softDelete failed, queuing locally:', err)
      }
      await markCustomer()
      await cascadeLocal()
    } else {
      await markCustomer()
      await cascadeLocal()
    }
  },

  async bulkSoftDelete(ids: string[]): Promise<void> {
    // Process deletes sequentially to avoid overwhelming the DB
    for (const id of ids) {
      try {
        await customerOps.softDelete(id)
      } catch (err) {
        console.error(`[customerOps.bulkSoftDelete] Failed to delete ${id}:`, err)
      }
    }
  },
}

export const orderOps = {
  async getAll(shopId: string, limit = 100, offset = 0): Promise<OrderRecord[]> {
    return offlineRead(
      'orderOps.getAll',
      async () => {
        const rows = await requireOk(
          supabase
            .from('orders')
            .select(ORDER_COLUMNS)
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)
        )
        return asRows(rows).map(mapOrder)
      },
      async () => {
        const rows = await db.orders
          .where('shopId').equals(shopId)
          .filter(o => o._deleted !== 1)
          .sortBy('createdAt')
        return rows.reverse().slice(offset, offset + limit)
      },
      async (records) => {
        await db.orders.bulkPut(records.map(o => ({ ...o, _synced: 1 })))
      },
    )
  },

  async getAssignedTo(memberId: string): Promise<OrderRecord[]> {
    const rows = await requireOk(
      supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('assigned_to', memberId)
        .is('deleted_at', null)
        .not('status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false })
    )
    return asRows(rows).map(mapOrder)
  },

  async getNextOrderNumber(shopId: string): Promise<number> {
    const rows = await requireOk(
      supabase
        .from('orders')
        .select('order_number')
        .eq('shop_id', shopId)
        .order('order_number', { ascending: false })
        .limit(1)
    )
    const first = asRows(rows)[0]
    return first?.order_number ? first.order_number + 1 : 1
  },

  async add(
    shopId: string,
    data: Omit<OrderRecord,
      | 'id' | 'shopId' | 'orderNumber' | 'trackingCode' | 'amountPaid'
      | 'createdAt' | 'updatedAt' | '_synced' | '_deleted'
    >
  ): Promise<OrderRecord> {
    if (!data.customerId) throw new Error('customerId is required')
    if (!data.garmentType) throw new Error('garmentType is required')
    if (!data.dueDate) throw new Error('dueDate is required')

    // Limit unverified shops: max 5 orders until admin approval
    const { data: shopVerification } = await supabase
      .from('shops')
      .select('verification_status')
      .eq('id', shopId)
      .maybeSingle()
    if (shopVerification?.verification_status === 'pending') {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .is('deleted_at', null)
      if ((count ?? 0) >= 5) {
        throw new Error('Aapka account verification pending hai. Sirf 5 orders tak allowed hain. Admin se contact karein.')
      }
    }

    const ts = nowKarachiIso()
    const [shopName, customer] = await Promise.all([
      getShopName(shopId),
      customerOps.get(data.customerId).catch(() => undefined),
    ])
    // Verify measurement exists before referencing it to avoid FK violation
    if (data.measurementId) {
      try {
        const { data: measurement } = await supabase
          .from('measurements')
          .select('id')
          .eq('id', data.measurementId)
          .is('deleted_at', null)
          .maybeSingle()
        if (!measurement) {
          data = { ...data, measurementId: undefined }
        }
      } catch {
        data = { ...data, measurementId: undefined }
      }
    }

    // Retry loop for order number race condition — max 3 attempts
    const MAX_RETRIES = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const orderNumber = await orderOps.getNextOrderNumber(shopId)
      const order: OrderRecord = {
        id: uuid(),
        shopId,
        orderNumber,
        trackingCode: generateTrackingCode(shopName),
        amountPaid: 0,
        createdAt: ts,
        updatedAt: ts,
        _synced: 0,
        _deleted: 0,
        ...data,
      }

      try {
        // Attempt online insert first
        if (isOnline()) {
          const saved = await requireOk(
            supabase.from('orders').insert(orderToRow(order)).select(ORDER_COLUMNS).single()
          )
          if (customer) {
            await requireOk(
              supabase.from('customers').update({
                last_order_at: ts,
                total_orders: (customer.totalOrders ?? 0) + 1,
                updated_at: ts,
              }).eq('id', customer.id)
            )
          }
          // Cache locally
          if (!saved) throw new Error('Failed to create order')
          const mapped = mapOrder(saved as Record<string, unknown>)
          await db.orders.put({ ...mapped, _synced: 1 })
          return mapped
        } else {
          // Offline: queue for sync
          await db.orders.put({ ...order, _synced: 0 })
          return order
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        // Only retry on duplicate key (order number collision)
        if (lastError.message.includes('duplicate') || lastError.message.includes('23505')) {
          console.warn(`[orderOps.add] Duplicate order number ${orderNumber}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`)
          continue
        }
        throw lastError
      }
    }

    throw lastError ?? new Error('Failed to create order after retries')
  },

  async updateStatus(orderId: string, newStatus: OrderRecord['status'], changedBy: string): Promise<void> {
    const current = await requireOk(
      supabase.from('orders').select('status, shop_id').eq('id', orderId).single()
    ) as { status: string; shop_id: string }
    const ts = nowKarachiIso()
    await requireOk(
      supabase.from('orders').update(clean({
        status: newStatus,
        updated_at: ts,
        delivered_at: newStatus === 'delivered' ? ts : undefined,
      })).eq('id', orderId)
    )
    await requireOk(
      supabase.from('order_status_history').insert({
        id: uuid(),
        order_id: orderId,
        shop_id: current.shop_id,
        old_status: current.status,
        new_status: newStatus,
        changed_by: changedBy,
        changed_at: ts,
      })
    )
  },

  async assign(orderId: string, memberId: string | null, memberName?: string): Promise<void> {
    await requireOk(
      supabase.from('orders').update({
        assigned_to: memberId,
        assigned_to_name: memberId ? memberName ?? null : null,
        updated_at: nowKarachiIso(),
      }).eq('id', orderId)
    )
  },

  async update(orderId: string, data: Partial<Pick<OrderRecord,
    'garmentType' | 'dueDate' | 'totalPrice' | 'isUrgent' | 'specialInstructions' |
    'assignedTo' | 'assignedToName' | 'orderForRelation' | 'orderForName' | 'recipientGender'
  >>): Promise<OrderRecord> {
    const patch = clean({
      garment_type: data.garmentType,
      due_date: data.dueDate,
      total_price: data.totalPrice,
      is_urgent: data.isUrgent === undefined ? undefined : data.isUrgent === 1,
      special_instructions: data.specialInstructions ?? undefined,
      assigned_to: data.assignedTo,
      assigned_to_name: data.assignedToName,
      order_for_relation: data.orderForRelation,
      order_for_name: data.orderForName ?? undefined,
      recipient_gender: data.recipientGender,
      updated_at: nowKarachiIso(),
    })
    const saved = await requireOk(
      supabase.from('orders').update(patch).eq('id', orderId).select(ORDER_COLUMNS).single()
    )
    if (!saved) throw new Error('Order not found')
    return mapOrder(saved as Record<string, unknown>)
  },

  async softDelete(orderId: string): Promise<void> {
    if (isOnline()) {
      await deleteOrdersByIds([orderId])
    } else {
      const existing = await db.orders.get(orderId)
      if (existing) {
        await db.orders.put({ ...existing, _deleted: 1, _synced: 0 } as OrderRecord)
        const payments = await db.payments.where('orderId').equals(orderId).toArray()
        for (const p of payments) {
          await db.payments.put({ ...p, _deleted: 1, _synced: 0 } as PaymentRecord)
        }
      }
    }
  },
}

export const paymentOps = {
  async getForOrder(orderId: string): Promise<PaymentRecord[]> {
    const rows = await requireOk(
      supabase.from('payments').select(PAYMENT_COLUMNS).eq('order_id', orderId).is('deleted_at', null).order('paid_at')
    )
    return asRows(rows).map(mapPayment)
  },

  async getTodayTotal(shopId: string): Promise<number> {
    const today = karachiDateString()
    const rows = await requireOk(
      supabase.from('payments').select('amount').eq('shop_id', shopId).is('deleted_at', null).gte('paid_at', `${today}T00:00:00+05:00`)
    )
    return asRows(rows).reduce((sum: number, p) => sum + (p.amount ?? 0), 0)
  },

  async add(
    shopId: string,
    data: Pick<PaymentRecord, 'orderId' | 'amount' | 'method' | 'recordedBy' | 'notes'> & {
      kind?: PaymentRecord['kind']
      appliedToBalance?: number
    }
  ): Promise<PaymentRecord> {
    const amount = Math.floor(Number(data.amount))
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero')

    const orderRow = await requireOk(
      supabase.from('orders').select(ORDER_COLUMNS).eq('id', data.orderId).eq('shop_id', shopId).is('deleted_at', null).single()
    )
    if (!orderRow) throw new Error('Order not found')
    const order = mapOrder(orderRow as Record<string, unknown>)
    const existing = await paymentOps.getForOrder(data.orderId)
    const paidTowardBalance = existing.reduce((sum, p) => sum + paymentAppliedAmount(p), 0)
    const remainingBalance = Math.max(0, order.totalPrice - paidTowardBalance)
    const kind = data.kind ?? 'order_payment'
    const requestedApplied = data.appliedToBalance ?? (kind === 'order_payment' ? amount : 0)
    const appliedToBalance = Math.max(0, Math.min(amount, remainingBalance, requestedApplied))
    const nextPaid = Math.min(order.totalPrice, paidTowardBalance + appliedToBalance)
    const ts = nowKarachiIso()
    const { error: updateError } = await supabase
      .from('orders')
      .update({ amount_paid: nextPaid, updated_at: ts })
      .eq('id', order.id)
      .eq('amount_paid', order.amountPaid)
    if (updateError) {
      throw new Error('Concurrent payment detected. Please refresh and try again.')
    }

    const payment: PaymentRecord = {
      ...data,
      id: uuid(),
      shopId,
      amount,
      paidAt: ts,
      _synced: 1,
      _deleted: 0,
      kind,
      appliedToBalance,
    }
    const saved = await requireOk(
      supabase.from('payments').insert(paymentToRow(payment)).select(PAYMENT_COLUMNS).single()
    )
    if (!saved) throw new Error('Failed to create payment')
    return mapPayment(saved as Record<string, unknown>)
  },
}

export const dashboardOps = {
  async getStats(shopId: string) {
    const today = karachiDateString()
    const [incomeToday, activeResult, todayResult, readyResult, overdueResult] = await Promise.all([
      paymentOps.getTodayTotal(shopId),
      supabase.from('orders').select('id', { count: 'exact' })
        .eq('shop_id', shopId).is('deleted_at', null).not('status', 'in', '("delivered","cancelled")'),
      supabase.from('orders').select('id', { count: 'exact' })
        .eq('shop_id', shopId).is('deleted_at', null).gte('created_at', `${today}T00:00:00+05:00`),
      supabase.from('orders').select('id', { count: 'exact' })
        .eq('shop_id', shopId).is('deleted_at', null).eq('status', 'ready'),
      supabase.from('orders').select('total_price, amount_paid')
        .eq('shop_id', shopId).is('deleted_at', null).lt('due_date', today).not('status', 'in', '("delivered","cancelled")'),
    ])
    const overdueOrders = (overdueResult.data ?? []) as { total_price: number; amount_paid: number }[]
    const pendingBalance = overdueOrders.reduce((sum: number, o) => sum + Math.max(0, Number(o.total_price ?? 0) - Number(o.amount_paid ?? 0)), 0)
    return {
      totalOrdersToday: todayResult.count ?? 0,
      readyOrders: readyResult.count ?? 0,
      overdueOrders: overdueOrders.length,
      incomeToday,
      pendingBalance,
      activeOrders: activeResult.count ?? 0,
    }
  },
}
