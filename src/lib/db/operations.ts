// Supabase-backed operations. Local DB is intentionally not used for app data.
import type { CustomerRecord, OrderRecord, PaymentRecord, TeamMemberRecord } from './schema'
import { supabase } from '@/lib/supabase/client'
import { mapCustomer, mapOrder, mapPayment, mapShop, mapTeamMember } from '@/lib/supabase/records'
import { generateTrackingCode } from '../tracking'
import { paymentAppliedAmount } from '@/lib/payments/calculations'
import { karachiDateString, nowKarachiIso } from '@/lib/time'

const SESSION_KEY = 'md_session_v2'

const uuid = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })

function getSessionShopId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.shopId ?? null
  } catch {
    return null
  }
}

function clean<T extends Record<string, unknown>>(row: T): T {
  Object.keys(row).forEach(key => {
    if (row[key] === undefined) delete row[key]
  })
  return row
}

async function requireOk<T>(query: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

const asRows = (rows: unknown): any[] => Array.isArray(rows) ? rows : []

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
    return getSessionShopId()
  },

  async get(shopId: string) {
    const row = await requireOk(
      (supabase as any).from('shops').select('*').eq('id', shopId).maybeSingle()
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
      (supabase as any).from('shops').insert({
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
  async getAll(shopId: string): Promise<TeamMemberRecord[]> {
    const rows = await requireOk(
      (supabase as any)
        .from('team_members')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('joined_at', { ascending: true })
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
      pin_hash: data.pin,
      speciality: data.speciality ?? null,
      pay_rate_type: data.payRateType ?? null,
      pay_rate: data.payRate ?? null,
      is_active: true,
      joined_at: karachiDateString(),
      created_at: ts,
    }
    const saved = await requireOk(
      (supabase as any).from('team_members').upsert(row, { onConflict: 'id' }).select('*').single()
    )
    return mapTeamMember(saved)
  },

  async add(shopId: string, data: AddTeamMemberData): Promise<TeamMemberRecord> {
    return teamOps.addWithId(shopId, uuid(), data)
  },

  async verifyPin(memberId: string, pin: string): Promise<boolean> {
    const row = await requireOk(
      (supabase as any).from('team_members').select('pin_hash,pin_plain').eq('id', memberId).maybeSingle()
    )
    const pinRow = row as any
    return !!pinRow && (pinRow.pin_hash === pin || pinRow.pin_plain === pin)
  },

  async deactivate(memberId: string): Promise<void> {
    await requireOk(
      (supabase as any).from('team_members').update({ is_active: false, deleted_at: nowKarachiIso() }).eq('id', memberId)
    )
  },

  async update(memberId: string, data: Partial<AddTeamMemberData>): Promise<void> {
    await requireOk(
      (supabase as any).from('team_members').update(clean({
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
      (supabase as any)
        .from('team_members')
        .select('*')
        .eq('phone', phone)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle()
    )
    return row ? mapTeamMember(row) : undefined
  },
}

export const customerOps = {
  async getAll(shopId: string): Promise<CustomerRecord[]> {
    const rows = await requireOk(
      (supabase as any)
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('last_order_at', { ascending: false, nullsFirst: false })
    )
    return asRows(rows).map(mapCustomer)
  },

  async search(shopId: string, query: string): Promise<CustomerRecord[]> {
    const q = query.trim()
    if (!q) return customerOps.getAll(shopId)
    const rows = await requireOk(
      (supabase as any)
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    )
    return asRows(rows).map(mapCustomer)
  },

  async add(
    shopId: string,
    data: Pick<CustomerRecord, 'name' | 'phone' | 'gender' | 'whatsapp'>
  ): Promise<CustomerRecord> {
    const ts = nowKarachiIso()
    const customer: CustomerRecord = {
      id: uuid(),
      shopId,
      totalOrders: 0,
      createdAt: ts,
      updatedAt: ts,
      _synced: 1,
      _deleted: 0,
      ...data,
    }
    const saved = await requireOk(
      (supabase as any).from('customers').insert(customerToRow(customer)).select('*').single()
    )
    return mapCustomer(saved)
  },

  async get(id: string): Promise<CustomerRecord | undefined> {
    const row = await requireOk(
      (supabase as any).from('customers').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
    )
    return row ? mapCustomer(row) : undefined
  },

  async update(id: string, data: Partial<CustomerRecord>): Promise<void> {
    await requireOk(
      (supabase as any).from('customers').update(clean({
        name: data.name,
        phone: data.phone,
        whatsapp: data.whatsapp ?? null,
        gender: data.gender,
        notes: data.notes ?? null,
        photo_url: data.photoUrl ?? null,
        updated_at: nowKarachiIso(),
      })).eq('id', id)
    )
  },

  async softDelete(id: string): Promise<void> {
    const ts = nowKarachiIso()
    await Promise.all([
      requireOk((supabase as any).from('customers').update({ deleted_at: ts, updated_at: ts }).eq('id', id)),
      requireOk((supabase as any).from('measurements').update({ deleted_at: ts }).eq('customer_id', id)),
      requireOk((supabase as any).from('orders').update({ deleted_at: ts, status: 'cancelled', updated_at: ts }).eq('customer_id', id)),
    ])
  },
}

export const orderOps = {
  async getAll(shopId: string): Promise<OrderRecord[]> {
    const rows = await requireOk(
      (supabase as any)
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
    )
    return asRows(rows).map(mapOrder)
  },

  async getAssignedTo(memberId: string): Promise<OrderRecord[]> {
    const rows = await requireOk(
      (supabase as any)
        .from('orders')
        .select('*')
        .eq('assigned_to', memberId)
        .is('deleted_at', null)
        .not('status', 'in', '("delivered","cancelled")')
        .order('created_at', { ascending: false })
    )
    return asRows(rows).map(mapOrder)
  },

  async getNextOrderNumber(shopId: string): Promise<number> {
    const rows = await requireOk(
      (supabase as any)
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

    const [orderNumber, shop] = await Promise.all([
      orderOps.getNextOrderNumber(shopId),
      shopOps.get(shopId),
    ])
    const ts = nowKarachiIso()
    const order: OrderRecord = {
      id: uuid(),
      shopId,
      orderNumber,
      trackingCode: generateTrackingCode(shop?.shopName ?? 'DZ'),
      amountPaid: 0,
      createdAt: ts,
      updatedAt: ts,
      _synced: 1,
      _deleted: 0,
      ...data,
    }
    const saved = await requireOk(
      (supabase as any).from('orders').insert(orderToRow(order)).select('*').single()
    )
    const customer = await customerOps.get(data.customerId)
    if (customer) {
      await requireOk(
        (supabase as any)
          .from('customers')
          .update({
            last_order_at: ts,
            total_orders: (customer.totalOrders ?? 0) + 1,
            updated_at: ts,
          })
          .eq('id', customer.id)
      )
    }
    return mapOrder(saved)
  },

  async updateStatus(orderId: string, newStatus: OrderRecord['status'], changedBy: string): Promise<void> {
    const current = await requireOk(
      (supabase as any).from('orders').select('*').eq('id', orderId).single()
    ) as any
    const ts = nowKarachiIso()
    await requireOk(
      (supabase as any).from('orders').update(clean({
        status: newStatus,
        updated_at: ts,
        delivered_at: newStatus === 'delivered' ? ts : undefined,
      })).eq('id', orderId)
    )
    await requireOk(
      (supabase as any).from('order_status_history').insert({
        id: uuid(),
        order_id: orderId,
        old_status: current.status,
        new_status: newStatus,
        changed_by: changedBy,
        changed_at: ts,
      })
    )
  },

  async assign(orderId: string, memberId: string | null, memberName?: string): Promise<void> {
    await requireOk(
      (supabase as any).from('orders').update({
        assigned_to: memberId,
        assigned_to_name: memberId ? memberName ?? null : null,
        updated_at: nowKarachiIso(),
      }).eq('id', orderId)
    )
  },

  async softDelete(orderId: string): Promise<void> {
    await requireOk(
      (supabase as any).from('orders').update({
        deleted_at: nowKarachiIso(),
        status: 'cancelled',
      }).eq('id', orderId)
    )
  },
}

export const paymentOps = {
  async getForOrder(orderId: string): Promise<PaymentRecord[]> {
    const rows = await requireOk(
      (supabase as any).from('payments').select('*').eq('order_id', orderId).is('deleted_at', null).order('paid_at')
    )
    return asRows(rows).map(mapPayment)
  },

  async getTodayTotal(shopId: string): Promise<number> {
    const today = karachiDateString()
    const rows = await requireOk(
      (supabase as any).from('payments').select('amount').eq('shop_id', shopId).is('deleted_at', null).gte('paid_at', `${today}T00:00:00+05:00`)
    )
    return asRows(rows).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)
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
      (supabase as any).from('orders').select('*').eq('id', data.orderId).eq('shop_id', shopId).is('deleted_at', null).single()
    )
    const order = mapOrder(orderRow)
    const existing = await paymentOps.getForOrder(data.orderId)
    const paidTowardBalance = existing.reduce((sum, p) => sum + paymentAppliedAmount(p), 0)
    const remainingBalance = Math.max(0, order.totalPrice - paidTowardBalance)
    const kind = data.kind ?? 'order_payment'
    const requestedApplied = data.appliedToBalance ?? (kind === 'order_payment' ? amount : 0)
    const appliedToBalance = Math.max(0, Math.min(amount, remainingBalance, requestedApplied))
    const payment: PaymentRecord = {
      ...data,
      id: uuid(),
      shopId,
      amount,
      paidAt: nowKarachiIso(),
      _synced: 1,
      _deleted: 0,
      kind,
      appliedToBalance,
    }
    const saved = await requireOk(
      (supabase as any).from('payments').insert(paymentToRow(payment)).select('*').single()
    )
    const nextPaid = Math.min(order.totalPrice, paidTowardBalance + appliedToBalance)
    await requireOk(
      (supabase as any).from('orders').update({ amount_paid: nextPaid, updated_at: nowKarachiIso() }).eq('id', order.id)
    )
    return mapPayment(saved)
  },
}

export const dashboardOps = {
  async getStats(shopId: string) {
    const today = karachiDateString()
    const [orders, incomeToday] = await Promise.all([
      orderOps.getAll(shopId),
      paymentOps.getTodayTotal(shopId),
    ])
    const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
    return {
      totalOrdersToday: orders.filter(o => o.createdAt.startsWith(today)).length,
      readyOrders: activeOrders.filter(o => o.status === 'ready').length,
      overdueOrders: activeOrders.filter(o => o.dueDate < today).length,
      incomeToday,
      pendingBalance: activeOrders.reduce((sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid), 0),
      activeOrders: activeOrders.length,
    }
  },
}
