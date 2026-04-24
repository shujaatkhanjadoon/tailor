// src/lib/supabase/sync-service.ts
import { supabase } from './client'
import { db }       from '@/lib/db/schema'
import type {
  ShopRow, TeamMemberRow, CustomerRow,
  MeasurementRow, OrderRow, PaymentRow, StatusHistoryRow,
} from './types'

// ── Field mappers: Dexie camelCase → Supabase snake_case ─────────

function shopToRow(r: any): ShopRow {
  return {
    id:              r.id,
    owner_phone:     r.ownerPhone,
    shop_name:       r.shopName,
    whatsapp_number: r.whatsappNumber || undefined,
    city:            r.city           || undefined,
    plan:            r.plan           || 'starter',
    plan_expires_at: r.planExpiresAt  || undefined,
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
    deleted_at:    r._deleted === 1 ? new Date().toISOString() : undefined,
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
    deleted_at:    r._deleted === 1 ? new Date().toISOString() : undefined,
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
    deleted_at:   r._deleted === 1 ? new Date().toISOString() : undefined,
  }
}

function orderToRow(r: any): OrderRow {
  // Guard: skip orders missing critical foreign keys
  if (!r.customerId) {
    throw new Error(`Order ${r.id} missing customerId — skipping`)
  }

  return {
    id:                   r.id,
    shop_id:              r.shopId,
    order_number:         r.orderNumber,
    tracking_code:        r.trackingCode        || undefined,
    customer_id:          r.customerId,
    customer_name:        r.customerName        || 'Unknown',
    customer_phone:       r.customerPhone       || '',
    measurement_id:       r.measurementId       || undefined,
    garment_type:         r.garmentType         || 'other',
    status:               r.status              || 'received',
    assigned_to:          r.assignedTo          || undefined,
    assigned_to_name:     r.assignedToName      || undefined,
    total_price:          r.totalPrice          ?? 0,
    amount_paid:          r.amountPaid          ?? 0,
    is_urgent:            r.isUrgent === 1,
    due_date:             r.dueDate             || today(),
    special_instructions: r.specialInstructions || undefined,
    fabric_photo_url:     r.fabricPhotoUrl      || undefined,
    style_photo_url:      r.stylePhotoUrl       || undefined,
    created_at:           r.createdAt,
    updated_at:           r.updatedAt,
    delivered_at:         r.deliveredAt         || undefined,
    deleted_at:           r._deleted === 1 ? new Date().toISOString() : undefined,
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
    deleted_at:  r._deleted === 1 ? new Date().toISOString() : undefined,
  }
}

function historyToRow(r: any): StatusHistoryRow {
  return {
    id:         r.id,
    order_id:   r.orderId,
    old_status: r.oldStatus || undefined,
    new_status: r.newStatus,
    changed_by: r.changedBy,
    changed_at: r.changedAt,
  }
}

// ── Helper ───────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0]

// Type-safe upsert — casts through any to avoid
// the "never" error from Supabase generic inference
async function upsertTable<T>(
  tableName: string,
  rows: T[]
): Promise<{ error: any }> {
  return (supabase as any)
    .from(tableName)
    .upsert(rows, { onConflict: 'id' })
}

// ── Main sync service ─────────────────────────────────────────────

export const syncService = {

  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine
  },

  // Push all unsynced Dexie records → Supabase
 async pushAll(shopId: string): Promise<{ success: boolean; errors: string[] }> {
    if (!syncService.isOnline()) return { success: false, errors: ['offline'] }

    const errors: string[] = []

    const push = async <T>(
      tableName:  string,
      records:    any[],
      mapper:     (r: any) => T,
      dexieTable: any,
      ids:        string[]
    ) => {
      if (records.length === 0) return

      const validRows: T[]     = []
      const validIds: string[] = []

      records.forEach((r, i) => {
        try {
          validRows.push(mapper(r))
          validIds.push(ids[i])
        } catch (e) {
          console.warn(`[Sync] Skipping invalid ${tableName}:`, String(e))
          dexieTable.update(ids[i], { _synced: 1 }).catch(() => {})
        }
      })

      if (validRows.length === 0) return

      const { error } = await upsertTable<T>(tableName, validRows)
      if (error) {
        console.error(`[Sync] ${tableName}:`, error.message)
        errors.push(`${tableName}: ${error.message}`)
      } else {
        await Promise.all(validIds.map(id => dexieTable.update(id, { _synced: 1 })))
        console.log(`[Sync] ✓ ${tableName} — ${validRows.length} records`)
      }
    }

    try {
      // ── STEP 1: Shop (no dependencies) ───────────────────────────
      const shop = await db.shop.toCollection().first()
      if (shop && shop._synced === 0) {
        const { error } = await upsertTable<ShopRow>('shops', [shopToRow(shop)])
        if (error) {
          // Shop sync failed — abort everything, nothing else can work
          errors.push(`shops: ${error.message}`)
          console.error('[Sync] shops failed — aborting:', error.message)
          return { success: false, errors }
        }
        await db.shop.update(shop.id, { _synced: 1 })
        console.log('[Sync] ✓ shops')
      }

      // ── STEP 2: Team members (depends on shop) ───────────────────
      const members = await db.teamMembers
        .where('shopId').equals(shopId)
        .filter(m => m._synced === 0)
        .toArray()
      await push<TeamMemberRow>(
        'team_members', members, memberToRow,
        db.teamMembers, members.map(m => m.id)
      )

      // If team members failed, stop — payments reference recorded_by
      if (errors.some(e => e.startsWith('team_members'))) {
        console.error('[Sync] team_members failed — aborting downstream')
        return { success: false, errors }
      }

      // ── STEP 3: Customers (depends on shop) ──────────────────────
      const customers = await db.customers
        .where('shopId').equals(shopId)
        .filter(c => c._synced === 0)
        .toArray()
      await push<CustomerRow>(
        'customers', customers, customerToRow,
        db.customers, customers.map(c => c.id)
      )

      // If customers failed, skip measurements and orders
      // (both have FK to customers)
      if (errors.some(e => e.startsWith('customers'))) {
        console.error('[Sync] customers failed — skipping measurements + orders')
        return { success: false, errors }
      }

      // ── STEP 4: Measurements (depends on customers) ──────────────
      // Extra guard: only sync measurements whose customer is in Supabase
      const allMeasurements = await db.measurements
        .where('shopId').equals(shopId)
        .filter(m => m._synced === 0)
        .toArray()

      if (allMeasurements.length > 0) {
        // Fetch which customer IDs actually exist in Supabase
        const customerIds = [...new Set(allMeasurements.map(m => m.customerId))]
        const { data: existingCustomers } = await (supabase as any)
          .from('customers')
          .select('id')
          .in('id', customerIds)

        const existingCustomerIds = new Set(
          (existingCustomers ?? []).map((c: any) => c.id)
        )

        // Split into safe (customer exists) and orphaned (customer missing)
        const safeMeasurements = allMeasurements.filter(m =>
          existingCustomerIds.has(m.customerId)
        )
        const orphanedMeasurements = allMeasurements.filter(m =>
          !existingCustomerIds.has(m.customerId)
        )

        // Retry orphaned: customer may have just been synced in step 3
        // Re-fetch after step 3 push
        if (orphanedMeasurements.length > 0) {
          const orphanCustomerIds = [...new Set(orphanedMeasurements.map(m => m.customerId))]
          const { data: retryCustomers } = await (supabase as any)
            .from('customers')
            .select('id')
            .in('id', orphanCustomerIds)

          const retryIds = new Set((retryCustomers ?? []).map((c: any) => c.id))

          orphanedMeasurements.forEach(m => {
            if (retryIds.has(m.customerId)) {
              safeMeasurements.push(m)
            } else {
              console.warn(`[Sync] Measurement ${m.id} orphaned — customer ${m.customerId} not in Supabase`)
              // Mark synced to prevent infinite retry
              db.measurements.update(m.id, { _synced: 1 }).catch(() => {})
            }
          })
        }

        await push<MeasurementRow>(
          'measurements', safeMeasurements, measurementToRow,
          db.measurements, safeMeasurements.map(m => m.id)
        )
      }

      // ── STEP 5: Orders (depends on customers) ────────────────────
      const allOrders = await db.orders
        .where('shopId').equals(shopId)
        .filter(o => o._synced === 0)
        .toArray()

      if (allOrders.length > 0) {
        // Same guard: only sync orders whose customer exists in Supabase
        const orderCustomerIds = [...new Set(allOrders.map(o => o.customerId).filter(Boolean))]
        const { data: existingForOrders } = await (supabase as any)
          .from('customers')
          .select('id')
          .in('id', orderCustomerIds)

        const existingForOrdersSet = new Set(
          (existingForOrders ?? []).map((c: any) => c.id)
        )

        const safeOrders = allOrders.filter(o =>
          o.customerId && existingForOrdersSet.has(o.customerId)
        )
        const skippedOrders = allOrders.filter(o =>
          !o.customerId || !existingForOrdersSet.has(o.customerId)
        )

        skippedOrders.forEach(o => {
          console.warn(`[Sync] Order ${o.id} skipped — customer ${o.customerId} missing`)
          db.orders.update(o.id, { _synced: 1 }).catch(() => {})
        })

        await push<OrderRow>(
          'orders', safeOrders, orderToRow,
          db.orders, safeOrders.map(o => o.id)
        )
      }

      // ── STEP 6: Payments (depends on orders + team_members) ──────
      const allPayments = await db.payments
        .where('shopId').equals(shopId)
        .filter(p => p._synced === 0)
        .toArray()

      if (allPayments.length > 0) {
        // Verify order IDs exist in Supabase
        const payOrderIds = [...new Set(allPayments.map(p => p.orderId))]
        const { data: existingOrders } = await (supabase as any)
          .from('orders')
          .select('id')
          .in('id', payOrderIds)

        const existingOrderIds = new Set(
          (existingOrders ?? []).map((o: any) => o.id)
        )

        const safePayments    = allPayments.filter(p => existingOrderIds.has(p.orderId))
        const skippedPayments = allPayments.filter(p => !existingOrderIds.has(p.orderId))

        skippedPayments.forEach(p => {
          console.warn(`[Sync] Payment ${p.id} skipped — order ${p.orderId} missing`)
          db.payments.update(p.id, { _synced: 1 }).catch(() => {})
        })

        await push<PaymentRow>(
          'payments', safePayments, paymentToRow,
          db.payments, safePayments.map(p => p.id)
        )
      }

      // ── STEP 7: Status history (depends on orders) ───────────────
      const history = await db.orderStatusHistory
        .where('shopId').equals(shopId)
        .filter(h => h._synced === 0)
        .toArray()

      if (history.length > 0) {
        const histOrderIds = [...new Set(history.map(h => h.orderId))]
        const { data: existingForHistory } = await (supabase as any)
          .from('orders')
          .select('id')
          .in('id', histOrderIds)

        const existingHistOrderIds = new Set(
          (existingForHistory ?? []).map((o: any) => o.id)
        )

        const safeHistory    = history.filter(h => existingHistOrderIds.has(h.orderId))
        const skippedHistory = history.filter(h => !existingHistOrderIds.has(h.orderId))

        skippedHistory.forEach(h => {
          db.orderStatusHistory.update(h.id, { _synced: 1 }).catch(() => {})
        })

        await push<StatusHistoryRow>(
          'order_status_history', safeHistory, historyToRow,
          db.orderStatusHistory, safeHistory.map(h => h.id)
        )
      }

    } catch (e) {
      const msg = `Unexpected: ${String(e)}`
      console.error('[Sync]', msg)
      errors.push(msg)
    }

    return { success: errors.length === 0, errors }
  },

  // Pull Supabase → Dexie (for cross-device login)
  async pullAll(shopId: string): Promise<void> {
    if (!syncService.isOnline()) return

    try {
      const [
        { data: orders },
        { data: customers },
        { data: payments },
        { data: measurements },
        { data: historyOrders },
      ] = await Promise.all([
        (supabase as any).from('orders').select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('customers').select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('payments').select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('measurements').select('*')
          .eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('orders').select('id')
          .eq('shop_id', shopId),
      ])

      if (orders) {
        await db.orders.bulkPut(orders.map((o: any) => ({
          id:                  o.id,
          shopId:              o.shop_id,
          orderNumber:         o.order_number,
          trackingCode:        o.tracking_code    ?? '',
          customerId:          o.customer_id,
          customerName:        o.customer_name,
          customerPhone:       o.customer_phone,
          measurementId:       o.measurement_id   ?? undefined,
          garmentType:         o.garment_type,
          status:              o.status,
          assignedTo:          o.assigned_to      ?? undefined,
          assignedToName:      o.assigned_to_name ?? undefined,
          totalPrice:          Number(o.total_price),
          amountPaid:          Number(o.amount_paid),
          isUrgent:            o.is_urgent ? 1 : 0,
          dueDate:             o.due_date,
          specialInstructions: o.special_instructions ?? undefined,
          fabricPhotoUrl:      o.fabric_photo_url     ?? undefined,
          stylePhotoUrl:       o.style_photo_url      ?? undefined,
          createdAt:           o.created_at,
          updatedAt:           o.updated_at,
          deliveredAt:         o.delivered_at         ?? undefined,
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
          notes:       m.notes    ?? undefined,
          takenAt:     m.taken_at,
          _synced:     1,
          _deleted:    0,
        })))
      }

      // Pull history using the order IDs we already fetched
      if (historyOrders && historyOrders.length > 0) {
        const orderIds = historyOrders.map((o: any) => o.id)

        const { data: history } = await (supabase as any)
          .from('order_status_history')
          .select('*')
          .in('order_id', orderIds)

        if (history) {
          // Build orderId → shopId map for the shopId field
          const orderShopMap = new Map<string, string>()
          if (orders) {
            orders.forEach((o: any) => orderShopMap.set(o.id, o.shop_id))
          }

          await db.orderStatusHistory.bulkPut(
            history.map((h: any) => ({
              id:        h.id,
              orderId:   h.order_id,
              shopId:    orderShopMap.get(h.order_id) ?? shopId,
              oldStatus: h.old_status ?? undefined,
              newStatus: h.new_status,
              changedBy: h.changed_by,
              changedAt: h.changed_at,
              _synced:   1 as const,
            }))
          )
        }
      }

      console.log('[Sync] ✓ Pull complete')
    } catch (e) {
      console.error('[Sync] Pull failed:', e)
    }
  },

  // Public order tracking by tracking code (cross-device)
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

  // Legacy — kept for backward compatibility
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

  // Auto-sync: push on reconnect + every 5 minutes
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