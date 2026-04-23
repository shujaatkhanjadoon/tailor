// src/lib/supabase/sync-service.ts
import { supabase }        from './client'
import { db }              from '@/lib/db/schema'
import type {
  ShopRow, TeamMemberRow, CustomerRow,
  MeasurementRow, OrderRow, PaymentRow, StatusHistoryRow,
} from './types'


function shopToRow(r: any): ShopRow {
  return {
    id:              r.id,
    owner_phone:     r.ownerPhone,
    shop_name:       r.shopName,
    whatsapp_number: r.whatsappNumber ?? null,
    city:            r.city           ?? null,
    plan:            r.plan           ?? 'starter',
    plan_expires_at: r.planExpiresAt  ?? null,
    is_active:       true,
    created_at:      r.createdAt,
    updated_at:      r.updatedAt,
  }
}

function memberToRow(r: any): TeamMemberRow {
  return {
    id:            r.id,
    shop_id:       r.shopId,
    name:          r.name,
    phone:         r.phone,
    role:          r.role,
    pin_hash:      r.pin,
    speciality:    r.speciality    || undefined,
    pay_rate_type: r.payRateType   || undefined,
    pay_rate:      r.payRate       || undefined,
    is_active:     r.isActive === 1,
    joined_at:     r.joinedAt,
    created_at:    r.createdAt,
    deleted_at:    r._deleted === 1 ? new Date().toISOString() : undefined,  // ← null → undefined
  }
}

function customerToRow(r: any): CustomerRow {
  return {
    id:            r.id,
    shop_id:       r.shopId,
    name:          r.name,
    phone:         r.phone,
    whatsapp:      r.whatsapp      || undefined,
    gender:        r.gender,
    notes:         r.notes         || undefined,
    photo_url:     r.photoUrl      || undefined,
    total_orders:  r.totalOrders   ?? 0,
    created_at:    r.createdAt,
    updated_at:    r.updatedAt,
    last_order_at: r.lastOrderAt   || undefined,
    deleted_at:    r._deleted === 1 ? new Date().toISOString() : undefined,  // ← null → undefined
  }
}

function measurementToRow(r: any): MeasurementRow {
  return {
    id:           r.id,
    customer_id:  r.customerId,
    shop_id:      r.shopId,
    garment_type: r.garmentType,
    values:       r.values,
    notes:        r.notes   || undefined,
    taken_at:     r.takenAt,
    deleted_at:   r._deleted === 1 ? new Date().toISOString() : undefined,  // ← null → undefined
  }
}

function orderToRow(r: any): OrderRow {
  return {
    id:                   r.id,
    shop_id:              r.shopId,
    order_number:         r.orderNumber,
    tracking_code:        r.trackingCode,
    customer_id:          r.customerId,
    customer_name:        r.customerName,
    customer_phone:       r.customerPhone,
    measurement_id:       r.measurementId       || undefined,
    garment_type:         r.garmentType,
    status:               r.status,
    assigned_to:          r.assignedTo          || undefined,
    assigned_to_name:     r.assignedToName      || undefined,
    total_price:          r.totalPrice,
    amount_paid:          r.amountPaid,
    is_urgent:            r.isUrgent === 1,
    due_date:             r.dueDate,
    special_instructions: r.specialInstructions || undefined,
    fabric_photo_url:     r.fabricPhotoUrl      || undefined,
    style_photo_url:      r.stylePhotoUrl       || undefined,
    created_at:           r.createdAt,
    updated_at:           r.updatedAt,
    delivered_at:         r.deliveredAt         || undefined,
    deleted_at:           r._deleted === 1 ? new Date().toISOString() : undefined,  // ← null → undefined
  }
}

function paymentToRow(r: any): PaymentRow {
  return {
    id:          r.id,
    shop_id:     r.shopId,
    order_id:    r.orderId,
    amount:      r.amount,
    method:      r.method,
    recorded_by: r.recordedBy,
    paid_at:     r.paidAt,
    notes:       r.notes   || undefined,
    deleted_at:  r._deleted === 1 ? new Date().toISOString() : undefined,  // ← null → undefined
  }
}

function historyToRow(r: any): StatusHistoryRow {
  return {
    id:         r.id,
    order_id:   r.orderId,
    old_status: r.oldStatus  ?? null,
    new_status: r.newStatus,
    changed_by: r.changedBy,
    changed_at: r.changedAt,
  }
}

// ── Type-safe upsert helpers ─────────────────────────────────────
// Casting through `unknown as TableRow[]` resolves the "never" error
// because TypeScript loses the generic inference chain on complex unions.

async function upsertTable<T>(
  tableName: string,
  rows: T[]
): Promise<{ error: any }> {
  return supabase
    .from(tableName as any)
    .upsert(rows as any, { onConflict: 'id' }) as any
}

// ── Main sync ────────────────────────────────────────────────────

export const syncService = {

  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine
  },

  async getOrderByTrackingCode(code: string): Promise<any | null> {
    const { data, error } = await (supabase as any)
      .from('orders')
      .select(`*, shops(shop_name, whatsapp_number, city)`)
      .eq('tracking_code', code.toUpperCase())
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return data
  },

  async pushAll(shopId: string): Promise<{ success: boolean; errors: string[] }> {
    if (!syncService.isOnline()) return { success: false, errors: ['offline'] }

    const errors: string[] = []

    // Helper: upsert rows then mark _synced = 1 in Dexie
    const push = async <T>(
      tableName:  string,
      records:    any[],
      mapper:     (r: any) => T,
      dexieTable: any,
      ids:        string[]
    ) => {
      if (records.length === 0) return
      const rows = records.map(mapper)
      const { error } = await upsertTable<T>(tableName, rows)
      if (error) {
        console.error(`[Sync] ${tableName}:`, error.message)
        errors.push(`${tableName}: ${error.message}`)
      } else {
        await Promise.all(ids.map(id => dexieTable.update(id, { _synced: 1 })))
        console.log(`[Sync] ✓ ${tableName} — ${records.length} records`)
      }
    }

    try {

      // ── 1. Shop ───────────────────────────────────────────────
      const shop = await db.shop.toCollection().first()
      if (shop && shop._synced === 0) {
        const { error } = await upsertTable<ShopRow>('shops', [shopToRow(shop)])
        if (error) {
          errors.push(`shops: ${error.message}`)
        } else {
          await db.shop.update(shop.id, { _synced: 1 })
          console.log('[Sync] ✓ shops')
        }
      }

      // ── 2. Team members ───────────────────────────────────────
      const members = await db.teamMembers
        .where('shopId').equals(shopId)
        .filter(m => m._synced === 0)
        .toArray()
      await push<TeamMemberRow>(
        'team_members', members, memberToRow,
        db.teamMembers, members.map(m => m.id)
      )

      // ── 3. Customers ──────────────────────────────────────────
      const customers = await db.customers
        .where('shopId').equals(shopId)
        .filter(c => c._synced === 0)
        .toArray()
      await push<CustomerRow>(
        'customers', customers, customerToRow,
        db.customers, customers.map(c => c.id)
      )

      // ── 4. Measurements ───────────────────────────────────────
      const measurements = await db.measurements
        .where('shopId').equals(shopId)
        .filter(m => m._synced === 0)
        .toArray()
      await push<MeasurementRow>(
        'measurements', measurements, measurementToRow,
        db.measurements, measurements.map(m => m.id)
      )

      // ── 5. Orders ─────────────────────────────────────────────
      const orders = await db.orders
        .where('shopId').equals(shopId)
        .filter(o => o._synced === 0)
        .toArray()
      await push<OrderRow>(
        'orders', orders, orderToRow,
        db.orders, orders.map(o => o.id)
      )

      // ── 6. Payments ───────────────────────────────────────────
      const payments = await db.payments
        .where('shopId').equals(shopId)
        .filter(p => p._synced === 0)
        .toArray()
      await push<PaymentRow>(
        'payments', payments, paymentToRow,
        db.payments, payments.map(p => p.id)
      )

      // ── 7. Order status history ───────────────────────────────
      const history = await db.orderStatusHistory
        .where('shopId').equals(shopId)
        .filter(h => h._synced === 0)
        .toArray()
      await push<StatusHistoryRow>(
        'order_status_history', history, historyToRow,
        db.orderStatusHistory, history.map(h => h.id)
      )

    } catch (e) {
      const msg = `Unexpected sync error: ${String(e)}`
      console.error('[Sync]', msg)
      errors.push(msg)
    }

    return { success: errors.length === 0, errors }
  },

  // ── Pull from Supabase → Dexie ────────────────────────────────
  async pullAll(shopId: string): Promise<void> {
    if (!syncService.isOnline()) return

    try {
      const [
        { data: orders },
        { data: customers },
        { data: payments },
        { data: measurements },
        { data: history },
      ] = await Promise.all([
        supabase.from('orders' as any).select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('customers' as any).select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('payments' as any).select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('measurements' as any).select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        supabase.from('order_status_history' as any).select('*')
          .in('order_id',
            (await supabase
              .from('orders' as any)
              .select('id')
              .eq('shop_id', shopId)
            ).data?.map((o: any) => o.id) ?? []
          ),
      ])

      if (orders) {
        await db.orders.bulkPut(orders.map((o: any) => ({
          id:                  o.id,
          shopId:              o.shop_id,
          orderNumber:         o.order_number,
          trackingCode:        o.tracking_code,
          customerId:          o.customer_id,
          customerName:        o.customer_name,
          customerPhone:       o.customer_phone,
          measurementId:       o.measurement_id  ?? undefined,
          garmentType:         o.garment_type,
          status:              o.status,
          assignedTo:          o.assigned_to     ?? undefined,
          assignedToName:      o.assigned_to_name ?? undefined,
          totalPrice:          Number(o.total_price),
          amountPaid:          Number(o.amount_paid),
          isUrgent:            o.is_urgent ? 1 : 0,
          dueDate:             o.due_date,
          specialInstructions: o.special_instructions ?? undefined,
          fabricPhotoUrl:      o.fabric_photo_url ?? undefined,
          stylePhotoUrl:       o.style_photo_url  ?? undefined,
          createdAt:           o.created_at,
          updatedAt:           o.updated_at,
          deliveredAt:         o.delivered_at     ?? undefined,
          _synced:             1,
          _deleted:            0,
        })))
      }

      if (customers) {
        await db.customers.bulkPut(customers.map((c: any) => ({
          id:          c.id,
          shopId:      c.shop_id,
          name:        c.name,
          phone:       c.phone,
          whatsapp:    c.whatsapp      ?? undefined,
          gender:      c.gender,
          notes:       c.notes         ?? undefined,
          photoUrl:    c.photo_url     ?? undefined,
          totalOrders: c.total_orders  ?? 0,
          createdAt:   c.created_at,
          updatedAt:   c.updated_at,
          lastOrderAt: c.last_order_at ?? undefined,
          _synced:     1,
          _deleted:    0,
        })))
      }

      if (payments) {
        await db.payments.bulkPut(payments.map((p: any) => ({
          id:          p.id,
          shopId:      p.shop_id,
          orderId:     p.order_id,
          amount:      Number(p.amount),
          method:      p.method,
          recordedBy:  p.recorded_by,
          paidAt:      p.paid_at,
          notes:       p.notes ?? undefined,
          _synced:     1,
          _deleted:    0,
        })))
      }

      if (measurements) {
        await db.measurements.bulkPut(measurements.map((m: any) => ({
          id:          m.id,
          customerId:  m.customer_id,
          shopId:      m.shop_id,
          garmentType: m.garment_type,
          values:      m.values,
          notes:       m.notes     ?? undefined,
          takenAt:     m.taken_at,
          _synced:     1,
          _deleted:    0,
        })))
      }

      if (history) {
        const orderShopMap = new Map<string, string>()
        if (orders) {
          orders.forEach((o: any) => orderShopMap.set(o.id, o.shop_id))
        }

        await db.orderStatusHistory.bulkPut(
          history.map((h: any) => ({
            id:        h.id,
            orderId:   h.order_id,
            shopId:    orderShopMap.get(h.order_id) ?? shopId,  // ← add shopId
            oldStatus: h.old_status ?? undefined,
            newStatus: h.new_status,
            changedBy: h.changed_by,
            changedAt: h.changed_at,
            _synced:   1 as const,
          }))
        )
      }

      console.log('[Sync] ✓ Pull complete')
    } catch (e) {
      console.error('[Sync] Pull failed:', e)
    }
  },

  // ── Public tracking ───────────────────────────────────────────
  async getOrderByNumber(orderNumber: number): Promise<any | null> {
    const { data, error } = await (supabase as any)
      .from('orders')
      .select(`*, shops(shop_name, whatsapp_number, city)`)
      .eq('order_number', orderNumber)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return data
  },

  // ── Auto-sync ─────────────────────────────────────────────────
  startAutoSync(shopId: string): () => void {
    if (typeof window === 'undefined') return () => {}

    const doSync = async () => {
      if (navigator.onLine) {
        await syncService.pushAll(shopId)
      }
    }

    window.addEventListener('online', doSync)
    const interval = setInterval(doSync, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', doSync)
      clearInterval(interval)
    }
  },
}