// src/lib/db/operations.ts
import { db, OrderRecord, CustomerRecord, TeamMemberRecord, PaymentRecord } from './schema'
import { syncQueue } from './sync'
import { generateTrackingCode } from '../tracking'
import { supabase } from '@/lib/supabase/client'
import { paymentAppliedAmount } from '@/lib/payments/calculations'

// ── Utility ──────────────────────────────────────────────────────

const uuid = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const now   = () => new Date().toISOString()
const today = () => new Date().toISOString().split('T')[0]
const isBrowserOnline = () =>
  typeof navigator === 'undefined' || navigator.onLine

async function upsertRemote(table: string, row: Record<string, unknown>): Promise<void> {
  if (!isBrowserOnline()) return
  const { error } = await (supabase as any)
    .from(table)
    .upsert(row, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

function orderToRemoteRow(order: OrderRecord) {
  return {
    id:                   order.id,
    shop_id:              order.shopId,
    order_number:         order.orderNumber,
    tracking_code:        order.trackingCode,
    customer_id:          order.customerId,
    customer_name:        order.customerName,
    customer_phone:       order.customerPhone,
    measurement_id:       order.measurementId ?? null,
    garment_type:         order.garmentType,
    status:               order.status,
    assigned_to:          order.assignedTo ?? null,
    assigned_to_name:     order.assignedToName ?? null,
    total_price:          order.totalPrice,
    amount_paid:          order.amountPaid,
    is_urgent:            order.isUrgent === 1,
    due_date:             order.dueDate,
    special_instructions: order.specialInstructions ?? null,
    fabric_photo_url:     order.fabricPhotoUrl ?? null,
    style_photo_url:      order.stylePhotoUrl ?? null,
    created_at:           order.createdAt,
    updated_at:           order.updatedAt,
    delivered_at:         order.deliveredAt ?? null,
    deleted_at:           order._deleted === 1 ? now() : null,
  }
}

async function recalculateOrderPaymentState(orderId: string): Promise<void> {
  const order = await db.orders.get(orderId)
  if (!order) return

  const payments = await db.payments
    .where('orderId').equals(orderId)
    .filter(p => p._deleted === 0)
    .toArray()

  const applied = payments.reduce((sum, p) => sum + paymentAppliedAmount(p), 0)
  await db.orders.update(orderId, {
    amountPaid: Math.min(applied, order.totalPrice),
    updatedAt:  now(),
    _synced:    0 as const,
  })
}

function paymentToRemoteRow(payment: PaymentRecord) {
  return {
    id:                 payment.id,
    shop_id:            payment.shopId,
    order_id:           payment.orderId,
    amount:             payment.amount,
    applied_to_balance: payment.appliedToBalance ?? payment.amount,
    kind:               payment.kind ?? 'order_payment',
    method:             payment.method,
    recorded_by:        payment.recordedBy,
    paid_at:            payment.paidAt,
    notes:              payment.notes ?? null,
    deleted_at:         payment._deleted === 1 ? now() : null,
  }
}

function customerToRemoteRow(customer: CustomerRecord) {
  return {
    id:            customer.id,
    shop_id:       customer.shopId,
    name:          customer.name,
    phone:         customer.phone,
    whatsapp:      customer.whatsapp ?? null,
    gender:        customer.gender,
    notes:         customer.notes ?? null,
    photo_url:     customer.photoUrl ?? null,
    total_orders:  customer.totalOrders ?? 0,
    created_at:    customer.createdAt,
    updated_at:    customer.updatedAt,
    last_order_at: customer.lastOrderAt ?? null,
    deleted_at:    customer._deleted === 1 ? now() : null,
  }
}

// ── Standalone interface for teamOps.add ─────────────────────────
// Must be a named interface — prevents TypeScript inferring it
// from orderOps.add's Omit<OrderRecord,...> parameter type
export interface AddTeamMemberData {
  name:         string
  phone:        string
  role:         'owner' | 'karigar'
  pin:          string
  speciality?:  string
  payRateType?: 'daily' | 'per_order' | 'monthly'
  payRate?:     number
}

// ── Shop Ops ─────────────────────────────────────────────────────

export const shopOps = {
  async getShopId(): Promise<string | null> {
    const setting = await db.appSettings.get('shopId')
    return setting ? JSON.parse(setting.value) : null
  },

  async setupWithId(id: string, shopName: string, ownerPhone: string): Promise<string> {
    await db.shop.put({
      id,
      shopName,
      ownerPhone,
      isActive:  1,
      createdAt: now(),
      updatedAt: now(),
      _synced:   1,    // ← already in Supabase, mark as synced
      _deleted:  0,
    })
    await db.appSettings.put({
      key:   'shopId',
      value: JSON.stringify(id),
    })
    return id
  },

  async setup(shopName: string, ownerPhone: string): Promise<string> {
    const existing = await db.shop.toCollection().first()
    if (existing) return existing.id

    const id = uuid()
    await db.shop.put({
      id,
      shopName,
      ownerPhone,
      isActive: 1,
      createdAt: now(),
      updatedAt: now(),
      _synced:   0,
      _deleted:  0,
    })
    await db.appSettings.put({
      key:   'shopId',
      value: JSON.stringify(id),
    })
    return id
  },
}

// ── Team Ops ─────────────────────────────────────────────────────

export const teamOps = {
  async getAll(shopId: string): Promise<TeamMemberRecord[]> {
    return db.teamMembers
      .where('shopId').equals(shopId)
      .filter(m => m.isActive === 1 && m._deleted === 0)
      .toArray()
  },
  // Add to teamOps in src/lib/db/operations.ts

  // addWithId — use a pre-generated ID (from server)
  async addWithId(shopId: string, id: string, data: AddTeamMemberData): Promise<TeamMemberRecord> {
    const member: TeamMemberRecord = {
      id,
      shopId,
      name:        data.name,
      phone:       data.phone,
      role:        data.role,
      pin:         data.pin,
      speciality:  data.speciality,
      payRateType: data.payRateType,
      payRate:     data.payRate,
      isActive:    1,
      joinedAt:    today(),
      createdAt:   now(),
      _synced:     1,    // ← already in Supabase
      _deleted:    0,
    }
    // put (not add) so it overwrites if somehow already exists
    await db.teamMembers.put(member)
    return member
  },

  // Uses named AddTeamMemberData interface — TypeScript cannot
  // confuse this with orderOps.add's Omit<OrderRecord,...> type
  async add(shopId: string, data: AddTeamMemberData): Promise<TeamMemberRecord> {
    const member: TeamMemberRecord = {
      id:          uuid(),
      shopId,
      name:        data.name,
      phone:       data.phone,
      role:        data.role,
      pin:         data.pin,
      speciality:  data.speciality,
      payRateType: data.payRateType,
      payRate:     data.payRate,
      isActive:    1,
      joinedAt:    today(),
      createdAt:   now(),
      _synced:     0,
      _deleted:    0,
    }
    await db.teamMembers.add(member)
    syncQueue.push('create', 'teamMembers', member.id, member)
    return member
  },

  async verifyPin(memberId: string, pin: string): Promise<boolean> {
    const member = await db.teamMembers.get(memberId)
    return member?.pin === pin
  },

  async deactivate(memberId: string): Promise<void> {
    await db.teamMembers.update(memberId, { isActive: 0, _synced: 0 })
    syncQueue.push('update', 'teamMembers', memberId, { isActive: 0 })
  },

  async update(memberId: string, data: Partial<AddTeamMemberData>): Promise<void> {
    const updates: Partial<TeamMemberRecord> = {
      name:        data.name,
      phone:       data.phone,
      pin:         data.pin,
      speciality:  data.speciality,
      payRateType: data.payRateType,
      payRate:     data.payRate,
      _synced:     0,
    }

    Object.keys(updates).forEach((key) => {
      const typedKey = key as keyof typeof updates
      if (updates[typedKey] === undefined) delete updates[typedKey]
    })

    await db.teamMembers.update(memberId, updates)
    syncQueue.push('update', 'teamMembers', memberId, updates)
  },

  async getByPhone(phone: string): Promise<TeamMemberRecord | undefined> {
    return db.teamMembers.where('phone').equals(phone).first()
  },
}

// ── Customer Ops ─────────────────────────────────────────────────

export const customerOps = {
  async getAll(shopId: string): Promise<CustomerRecord[]> {
    return db.customers
      .where('shopId').equals(shopId)
      .filter(c => c._deleted === 0)
      .reverse()
      .sortBy('lastOrderAt')
  },

  async search(shopId: string, query: string): Promise<CustomerRecord[]> {
    if (!query.trim()) return customerOps.getAll(shopId)
    const q = query.toLowerCase()
    return db.customers
      .where('shopId').equals(shopId)
      .filter(c =>
        c._deleted === 0 &&
        (c.name.toLowerCase().includes(q) || c.phone.includes(q))
      )
      .toArray()
  },

  async add(
    shopId: string,
    data: Pick<CustomerRecord, 'name' | 'phone' | 'gender' | 'whatsapp'>
  ): Promise<CustomerRecord> {
    const customer: CustomerRecord = {
      id:          uuid(),
      shopId,
      totalOrders: 0,
      createdAt:   now(),
      updatedAt:   now(),
      _synced:     0,
      _deleted:    0,
      ...data,
    }
    await db.customers.add(customer)
    syncQueue.push('create', 'customers', customer.id, customer)
    try {
      await upsertRemote('customers', customerToRemoteRow(customer))
      await db.customers.update(customer.id, { _synced: 1 })
    } catch (e) {
      console.warn('[customerOps.add] Supabase write failed; left unsynced:', e)
    }
    return customer
  },

  async get(id: string): Promise<CustomerRecord | undefined> {
    return db.customers.get(id)
  },

  async update(id: string, data: Partial<CustomerRecord>): Promise<void> {
    const updates: Partial<CustomerRecord> = {
      ...data,
      updatedAt: now(),
      _synced:   0,
    }
    await db.customers.update(id, updates)
    syncQueue.push('update', 'customers', id, updates)
    const customer = await db.customers.get(id)
    if (customer) {
      try {
        await upsertRemote('customers', customerToRemoteRow(customer))
        await db.customers.update(id, { _synced: 1 })
      } catch (e) {
        console.warn('[customerOps.update] Supabase write failed; left unsynced:', e)
      }
    }
  },

  async softDelete(id: string): Promise<void> {
    await db.customers.update(id, { _deleted: 1, _synced: 0 })
    syncQueue.push('delete', 'customers', id, {})
  },
}

// ── Order Ops ────────────────────────────────────────────────────

export const orderOps = {
  async getAll(shopId: string): Promise<OrderRecord[]> {
    return db.orders
      .where('shopId').equals(shopId)
      .filter(o => o._deleted === 0)
      .reverse()
      .sortBy('createdAt')
  },

  async getAssignedTo(memberId: string): Promise<OrderRecord[]> {
    return db.orders
      .where('assignedTo').equals(memberId)
      .filter(o => o._deleted === 0 && !['delivered','cancelled'].includes(o.status))
      .toArray()
  },

  async getByStatus(shopId: string, status: OrderRecord['status']): Promise<OrderRecord[]> {
    return db.orders
      .where({ shopId, status })
      .filter(o => o._deleted === 0)
      .toArray()
  },

  async getOverdue(shopId: string): Promise<OrderRecord[]> {
    const todayStr = today()
    return db.orders
      .where('shopId').equals(shopId)
      .filter(o =>
        o._deleted === 0 &&
        o.dueDate < todayStr &&
        !['delivered','cancelled'].includes(o.status)
      )
      .toArray()
  },

  async getDueToday(shopId: string): Promise<OrderRecord[]> {
    return db.orders
      .where({ shopId, dueDate: today() })
      .filter(o => o._deleted === 0 && !['delivered','cancelled'].includes(o.status))
      .toArray()
  },

  async getNextOrderNumber(shopId: string): Promise<number> {
    const all = await db.orders.where('shopId').equals(shopId).toArray()
    return all.length > 0 ? Math.max(...all.map(o => o.orderNumber)) + 1 : 1
  },

  // trackingCode is Omitted — generated internally below
  // Do NOT pass trackingCode from the caller
  async add(
    shopId: string,
    data: Omit<OrderRecord,
      | 'id'
      | 'shopId'
      | 'orderNumber'
      | 'trackingCode'
      | 'amountPaid'
      | 'createdAt'
      | 'updatedAt'
      | '_synced'
      | '_deleted'
    >
  ): Promise<OrderRecord> {
    // ── Validate required fields ───────────────────────────────
    if (!data.customerId)  throw new Error('customerId is required')
    if (!data.garmentType) throw new Error('garmentType is required')
    if (!data.dueDate)     throw new Error('dueDate is required')
    // ──────────────────────────────────────────────────────────

    const orderNumber = await orderOps.getNextOrderNumber(shopId)
    const shop        = await db.shop.toCollection().first()
    const shopName    = shop?.shopName ?? 'DZ'

    const order: OrderRecord = {
      id:           uuid(),
      shopId,
      orderNumber,
      trackingCode: generateTrackingCode(shopName),  // generated here
      amountPaid:   0,
      createdAt:    now(),
      updatedAt:    now(),
      _synced:      0,
      _deleted:     0,
      ...data,   // data never contains trackingCode — safe spread
    }

    await db.orders.add(order)

    // Update customer stats
    const customer = await db.customers.get(order.customerId)
    if (customer) {
      const customerUpdates = {
        lastOrderAt: now(),
        totalOrders: (customer.totalOrders || 0) + 1,
        _synced:     0 as const,
      }
      await db.customers.update(order.customerId, customerUpdates)
      try {
        await upsertRemote('customers', customerToRemoteRow({ ...customer, ...customerUpdates }))
        await db.customers.update(order.customerId, { _synced: 1 })
      } catch (e) {
        console.warn('[orderOps.add] Customer Supabase update failed; left unsynced:', e)
      }
    }

    syncQueue.push('create', 'orders', order.id, order)
    try {
      await upsertRemote('orders', orderToRemoteRow(order))
      await db.orders.update(order.id, { _synced: 1 })
    } catch (e) {
      console.warn('[orderOps.add] Supabase write failed; left unsynced:', e)
    }
    return order
  },

  async updateStatus(
    orderId:   string,
    newStatus: OrderRecord['status'],
    changedBy: string
  ): Promise<void> {
    const order = await db.orders.get(orderId)
    if (!order) return

    const updates: Partial<OrderRecord> = {
      status:    newStatus,
      updatedAt: now(),
      _synced:   0,
      ...(newStatus === 'delivered' ? { deliveredAt: now() } : {}),
    }

    await db.orders.update(orderId, updates)

    await db.orderStatusHistory.add({
      id:        uuid(),
      orderId,
      shopId:    order.shopId,
      oldStatus: order.status,
      newStatus,
      changedBy,
      changedAt: now(),
      _synced:   0,
    })

    syncQueue.push('update', 'orders', orderId, updates)
    try {
      await upsertRemote('orders', orderToRemoteRow({ ...order, ...updates }))
      await db.orders.update(orderId, { _synced: 1 })
    } catch (e) {
      console.warn('[orderOps.updateStatus] Supabase write failed; left unsynced:', e)
    }
  },

  async assign(orderId: string, memberId: string, memberName: string): Promise<void> {
    const updates = {
      assignedTo:     memberId,
      assignedToName: memberName,
      updatedAt:      now(),
      _synced:        0 as const,
    }
    await db.orders.update(orderId, updates)
    syncQueue.push('update', 'orders', orderId, updates)
    const order = await db.orders.get(orderId)
    if (order) {
      try {
        await upsertRemote('orders', orderToRemoteRow(order))
        await db.orders.update(orderId, { _synced: 1 })
      } catch (e) {
        console.warn('[orderOps.assign] Supabase write failed; left unsynced:', e)
      }
    }
  },

  async softDelete(orderId: string): Promise<void> {
    await db.orders.update(orderId, {
      _deleted: 1,
      status:   'cancelled',
      _synced:  0,
    })
    syncQueue.push('delete', 'orders', orderId, {})
  },
}

// ── Payment Ops ──────────────────────────────────────────────────

export const paymentOps = {
  async getForOrder(orderId: string): Promise<PaymentRecord[]> {
    return db.payments.where('orderId').equals(orderId).toArray()
  },

  async getTodayTotal(shopId: string): Promise<number> {
    const payments = await db.payments
      .where('shopId').equals(shopId)
      .filter(p => p._deleted === 0 && p.paidAt.startsWith(today()))
      .toArray()
    return payments.reduce((sum, p) => sum + p.amount, 0)
  },

  async add(
    shopId: string,
    data: Pick<PaymentRecord, 'orderId' | 'amount' | 'method' | 'recordedBy' | 'notes'> & {
      kind?: PaymentRecord['kind']
      appliedToBalance?: number
    }
  ): Promise<PaymentRecord> {
    const amount = Math.floor(Number(data.amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }

    const order = await db.orders.get(data.orderId)
    if (!order || order.shopId !== shopId || order._deleted === 1) {
      throw new Error('Order not found for this payment')
    }

    const existingPayments = await db.payments
      .where('orderId').equals(data.orderId)
      .filter(p => p._deleted === 0)
      .toArray()
    const paidTowardBalance = existingPayments.reduce(
      (sum, p) => sum + paymentAppliedAmount(p),
      0
    )
    const remainingBalance = Math.max(0, order.totalPrice - paidTowardBalance)
    const kind = data.kind ?? 'order_payment'
    const requestedApplied = data.appliedToBalance ??
      (kind === 'order_payment' ? amount : 0)
    const appliedToBalance = Math.max(0, Math.min(amount, remainingBalance, requestedApplied))

    const payment: PaymentRecord = {
      ...data,
      id:       uuid(),
      shopId,
      amount,
      paidAt:   now(),
      _synced:  0,
      _deleted: 0,
      kind,
      appliedToBalance,
    }

    // Dexie transaction — atomically insert + recalculate
    await db.transaction('rw', [db.payments, db.orders], async () => {
      await db.payments.add(payment)
      await recalculateOrderPaymentState(data.orderId)
    })

    syncQueue.push('create', 'payments', payment.id, payment)
    try {
      await upsertRemote('payments', paymentToRemoteRow(payment))
      const updatedOrder = await db.orders.get(data.orderId)
      if (updatedOrder) await upsertRemote('orders', orderToRemoteRow(updatedOrder))
      await db.payments.update(payment.id, { _synced: 1 })
      await db.orders.update(data.orderId, { _synced: 1 })
    } catch (e) {
      console.warn('[paymentOps.add] Supabase write failed; left unsynced:', e)
    }
    return payment
  },
}

// ── Dashboard Ops ────────────────────────────────────────────────

export const dashboardOps = {
  async getStats(shopId: string) {
    const todayStr = today()

    const [allActiveOrders, todayIncome, overdueOrders] = await Promise.all([
      db.orders
        .where('shopId').equals(shopId)
        .filter(o =>
          o._deleted === 0 &&
          !['delivered','cancelled'].includes(o.status)
        )
        .toArray(),
      paymentOps.getTodayTotal(shopId),
      orderOps.getOverdue(shopId),
    ])

    const readyOrders    = allActiveOrders.filter(o => o.status === 'ready')
    const todaysOrders   = allActiveOrders.filter(o => o.createdAt.startsWith(todayStr))
    const pendingBalance = allActiveOrders.reduce(
      (sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid), 0
    )

    return {
      totalOrdersToday: todaysOrders.length,
      readyOrders:      readyOrders.length,
      overdueOrders:    overdueOrders.length,
      incomeToday:      todayIncome,
      pendingBalance,
      activeOrders:     allActiveOrders.length,
    }
  },
}
