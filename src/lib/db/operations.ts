// src/lib/db/operations.ts

import { db, OrderRecord, CustomerRecord, TeamMemberRecord, PaymentRecord } from './schema'
import { generateTrackingCode } from '../tracking'
import { syncQueue } from './sync'

// ─── Utility ──────────────────────────────────────────────────────

const uuid = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const now  = () => new Date().toISOString()
const today = () => new Date().toISOString().split('T')[0]

// ─── Shop Setup ───────────────────────────────────────────────────

export const shopOps = {
  async getShopId(): Promise<string | null> {
    const setting = await db.appSettings.get('shopId')
    return setting ? JSON.parse(setting.value) : null
  },

  async setup(shopName: string, ownerPhone: string): Promise<string> {
    // Check if shop already exists
    const existing = await db.shop.toCollection().first()
    if (existing) return existing.id

    const id = uuid()

    // Use put instead of add — safe if called twice
    await db.shop.put({
      id,
      shopName,
      ownerPhone,
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

// ─── Team Members ─────────────────────────────────────────────────

export const teamOps = {
  async getAll(shopId: string): Promise<TeamMemberRecord[]> {
    return db.teamMembers
      .where('shopId').equals(shopId)
      .filter(m => m.isActive === 1 && m._deleted === 0)
      .toArray()
  },

  // ── Explicit types prevent TypeScript from conflating with paymentOps.add ──
 async add(
    shopId: string,
    data: Omit<OrderRecord, 'id' | 'shopId' | 'orderNumber' | 'trackingCode' | 'amountPaid' | 'createdAt' | 'updatedAt' | '_synced' | '_deleted'>
  ): Promise<OrderRecord> {
    const orderNumber = await orderOps.getNextOrderNumber(shopId)

    // Get shop name for prefix
    const shop     = await db.shop.toCollection().first()
    const shopName = shop?.shopName ?? 'DZ'

    const order: OrderRecord = {
      id:           uuid(),
      shopId,
      orderNumber,
      trackingCode: generateTrackingCode(shopName),   // ← ADD
      amountPaid:   0,
      createdAt:    now(),
      updatedAt:    now(),
      _synced:      0,
      _deleted:     0,
      ...data,
    }

    await db.orders.add(order)

    // Update customer lastOrderAt + totalOrders
    const customer = await db.customers.get(order.customerId)
    if (customer) {
      await db.customers.update(order.customerId, {
        lastOrderAt: now(),
        totalOrders: (customer.totalOrders || 0) + 1,
        _synced:     0,
      })
    }

    syncQueue.push('create', 'orders', order.id, order)
    return order
  },

  async verifyPin(memberId: string, pin: string): Promise<boolean> {
    const member = await db.teamMembers.get(memberId)
    return member?.pin === pin
  },

  async deactivate(memberId: string): Promise<void> {
    await db.teamMembers.update(memberId, { isActive: 0, _synced: 0 })
    syncQueue.push('update', 'teamMembers', memberId, { isActive: 0 })
  },

  async getByPhone(phone: string): Promise<TeamMemberRecord | undefined> {
    return db.teamMembers.where('phone').equals(phone).first()
  },
}

// ─── Customers ────────────────────────────────────────────────────

export const customerOps = {
  async getAll(shopId: string): Promise<CustomerRecord[]> {
    return db.customers
      .where({ shopId, _deleted: 0 })
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
      id: uuid(),
      shopId,
      totalOrders: 0,
      createdAt: now(),
      updatedAt: now(),
      _synced: 0,
      _deleted: 0,
      ...data,
    }
    await db.customers.add(customer)
    syncQueue.push('create', 'customers', customer.id, customer)
    return customer
  },

  async get(id: string): Promise<CustomerRecord | undefined> {
    return db.customers.get(id)
  },

  async update(id: string, data: Partial<CustomerRecord>): Promise<void> {
    // Explicit type annotation stops TS widening _synced to `number`
    const updates: Partial<CustomerRecord> = {
      ...data,
      updatedAt: now(),
      _synced:   0,          // TS now checks against Partial<CustomerRecord>
    }
    await db.customers.update(id, updates)
    syncQueue.push('update', 'customers', id, updates)
  },

  async softDelete(id: string): Promise<void> {
    await db.customers.update(id, { _deleted: 1, _synced: 0 })
    syncQueue.push('delete', 'customers', id, {})
  },
}

// ─── Orders ───────────────────────────────────────────────────────

export const orderOps = {
  async getAll(shopId: string): Promise<OrderRecord[]> {
    return db.orders
      .where('shopId').equals(shopId)
      .filter(o => o._deleted === 0)
      .reverse()
      .sortBy('createdAt')
  },

  // For Karigar — only their assigned orders
  async getAssignedTo(memberId: string): Promise<OrderRecord[]> {
    return db.orders
      .where('assignedTo').equals(memberId)
      .filter(o => o._deleted === 0 && !['delivered', 'cancelled'].includes(o.status))
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
        !['delivered', 'cancelled'].includes(o.status)
      )
      .toArray()
  },

  async getDueToday(shopId: string): Promise<OrderRecord[]> {
    return db.orders
      .where({ shopId, dueDate: today() })
      .filter(o => o._deleted === 0 && !['delivered', 'cancelled'].includes(o.status))
      .toArray()
  },

  async getNextOrderNumber(shopId: string): Promise<number> {
    const all = await db.orders.where('shopId').equals(shopId).toArray()
    return all.length > 0 ? Math.max(...all.map(o => o.orderNumber)) + 1 : 1
  },

  async add(
    shopId: string,
    data: Omit<OrderRecord, 'id' | 'shopId' | 'orderNumber' | 'amountPaid' | 'createdAt' | 'updatedAt' | '_synced' | '_deleted'>
  ): Promise<OrderRecord> {
    const orderNumber = await orderOps.getNextOrderNumber(shopId)
    const order: OrderRecord = {
      id: uuid(),
      shopId,
      orderNumber,
      amountPaid: 0,
      createdAt: now(),
      updatedAt: now(),
      _synced: 0,
      _deleted: 0,
      ...data,
    }
    await db.orders.add(order)

    // Update customer's lastOrderAt + totalOrders
    const customer = await db.customers.get(order.customerId)
    if (customer) {
      await db.customers.update(order.customerId, {
        lastOrderAt: now(),
        totalOrders: (customer.totalOrders || 0) + 1,
        _synced: 0,
      })
    }

    syncQueue.push('create', 'orders', order.id, order)
    return order
  },

  async updateStatus(
    orderId: string,
    newStatus: OrderRecord['status'],
    changedBy: string
  ): Promise<void> {
    const order = await db.orders.get(orderId)
    if (!order) return

    const updates: Partial<OrderRecord> = {
      status: newStatus,
      updatedAt: now(),
      _synced: 0,
      ...(newStatus === 'delivered' ? { deliveredAt: now() } : {}),
    }

    await db.orders.update(orderId, updates)

    // Record history
    await db.orderStatusHistory.add({
      id: uuid(),
      orderId,
      shopId:    order.shopId,
      oldStatus: order.status,
      newStatus,
      changedBy,
      changedAt: now(),
      _synced: 0,
    })

    syncQueue.push('update', 'orders', orderId, updates)
  },

  async assign(orderId: string, memberId: string, memberName: string): Promise<void> {
    const updates = {
      assignedTo: memberId,
      assignedToName: memberName,
      updatedAt: now(),
      _synced: 0 as const,
    }
    await db.orders.update(orderId, updates)
    syncQueue.push('update', 'orders', orderId, updates)
  },

  async softDelete(orderId: string): Promise<void> {
    await db.orders.update(orderId, { _deleted: 1, status: 'cancelled', _synced: 0 })
    syncQueue.push('delete', 'orders', orderId, {})
  },
}

// ─── Payments ─────────────────────────────────────────────────────

export const paymentOps = {
  async getForOrder(orderId: string): Promise<PaymentRecord[]> {
    return db.payments.where('orderId').equals(orderId).toArray()
  },

  async getTodayTotal(shopId: string): Promise<number> {
    const payments = await db.payments
      .where({ shopId })
      .filter(p => p.paidAt.startsWith(today()))
      .toArray()
    return payments.reduce((sum, p) => sum + p.amount, 0)
  },

  // ── Replace paymentOps.add (was causing line 280 error) ─────────

  async add(
    shopId: string,
    data: Pick<PaymentRecord, 'orderId' | 'amount' | 'method' | 'recordedBy' | 'notes'>
  ): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id:       uuid(),
      shopId,
      paidAt:   now(),
      _synced:  0,
      _deleted: 0,
      ...data,
    }
    await db.transaction('rw', [db.payments, db.orders], async () => {

      // Step 1: Insert the new payment
      await db.payments.add(payment)

      // Step 2: Sum ALL payments for this order
      //         The new payment is already in the table at this point
      const allPayments = await db.payments
        .where('orderId')
        .equals(data.orderId)
        .toArray()

      const totalPaid = allPayments
        .filter(p => p._deleted === 0)
        .reduce((sum, p) => sum + p.amount, 0)

      // Step 3: Update order with the correct total
      //         totalPaid already includes data.amount — DO NOT add again
      await db.orders.update(data.orderId, {
        amountPaid: totalPaid,
        updatedAt:  now(),
        _synced:    0 as const,
      })
    })

    syncQueue.push('create', 'payments', payment.id, payment)
    return payment
  },
}


// ─── Dashboard Stats ───────────────────────────────────────────────

export const dashboardOps = {
  async getStats(shopId: string) {
    const [
      allActiveOrders,
      todayIncome,
      overdueOrders,
    ] = await Promise.all([
      db.orders.where({ shopId }).filter(o =>
        o._deleted === 0 && !['delivered', 'cancelled'].includes(o.status)
      ).toArray(),
      paymentOps.getTodayTotal(shopId),
      orderOps.getOverdue(shopId),
    ])

    const readyOrders     = allActiveOrders.filter(o => o.status === 'ready')
    const todaysOrders    = allActiveOrders.filter(o => o.createdAt.startsWith(today()))
    const pendingBalance  = allActiveOrders.reduce(
      (sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid), 0
    )

    return {
      totalOrdersToday:  todaysOrders.length,
      readyOrders:       readyOrders.length,
      overdueOrders:     overdueOrders.length,
      incomeToday:       todayIncome,
      pendingBalance,
      activeOrders:      allActiveOrders.length,
    }
  },
}