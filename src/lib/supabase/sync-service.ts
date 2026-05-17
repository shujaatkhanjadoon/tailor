// src/lib/supabase/sync-service.ts
import { supabase }        from './client'
import { db, type ShopRecord } from '@/lib/db/schema'
import type {
  ShopRow, TeamMemberRow, CustomerRow,
  MeasurementRow, OrderRow, PaymentRow, StatusHistoryRow,
  PhotoRow,
} from './types'

// ── Field mappers: Dexie camelCase → Supabase snake_case ─────────

function shopToRow(r: any): Partial<ShopRow> {
  return {
    id:              r.id,
    owner_phone:     r.ownerPhone,
    owner_name:      r.ownerName      || undefined,
    shop_name:       r.shopName,
    whatsapp_number: r.whatsappNumber || undefined,
    state_province:  r.stateProvince  || undefined,
    city:            r.city           || undefined,
    address_line:    r.addressLine    || undefined,
    postal_code:     r.postalCode     || undefined,
    brand_name:      r.brandName      || undefined,
    brand_color:     r.brandColor     || undefined,
    brand_logo_url:  r.brandLogoUrl   || undefined,
    is_active:       r.isActive !== 0,
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
    order_for_relation: r.orderForRelation || 'self',
    order_for_name:     r.orderForName     || undefined,
    recipient_gender:   r.recipientGender  || undefined,
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
    order_for_relation:   r.orderForRelation    || 'self',
    order_for_name:       r.orderForName        || undefined,
    recipient_gender:     r.recipientGender     || undefined,
    measurement_id:       r.measurementId       || undefined,
    garment_type:         r.garmentType         || 'other',
    status:               r.status              || 'received',
    assigned_to:          r.assignedTo          || undefined,
    assigned_to_name:     r.assignedToName      || undefined,
    total_price:          r.totalPrice          ?? 0,
    amount_paid:          r.amountPaid          ?? 0,
    is_urgent:            r.isUrgent === 1,
    due_date:             r.dueDate             || new Date().toISOString().split('T')[0],
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
    applied_to_balance: r.appliedToBalance ?? r.amount,
    kind:        r.kind ?? 'order_payment',
    method:      r.method,
    recorded_by: r.recordedBy,
    paid_at:     r.paidAt,
    notes:       r.notes   || undefined,
    deleted_at:  r._deleted === 1 ? new Date().toISOString() : undefined,
  }
}

function photoToRow(r: any): PhotoRow {
  if (!r.cloudUrl || !r.publicId) {
    throw new Error(`Photo ${r.id} has no Cloudinary URL — skipping cloud sync`)
  }

  return {
    id:             r.id,
    order_id:       r.orderId,
    shop_id:        r.shopId,
    type:           r.type,
    cloud_url:      r.cloudUrl,
    public_id:      r.publicId,
    cloud_size_kb:  r.cloudSizeKB,
    size_kb:        r.sizeKB,
    taken_at:       r.takenAt,
    deleted_at:     r._deleted === 1 ? new Date().toISOString() : undefined,
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

// ── Type-safe upsert helper ───────────────────────────────────────
// Casting through `as any` resolves the "never" TypeScript error
// from Supabase generic inference on complex union types.

async function upsertTable<T>(
  tableName: string,
  rows:      T[]
): Promise<{ error: any }> {
  return (supabase as any)
    .from(tableName)
    .upsert(rows, { onConflict: 'id' }) as any
}

async function ensureRemoteShopExists(shop: ShopRecord): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('shops')
    .select('id')
    .eq('id', shop.id)
    .maybeSingle()

  if (!error && data?.id) return true

  const { error: upsertError } = await upsertTable<Partial<ShopRow>>('shops', [shopToRow(shop)])
  if (upsertError) {
    console.error('[Sync] shops repair failed:', upsertError.message)
    return false
  }

  await db.shop.update(shop.id, { _synced: 1 }).catch(() => {})
  return true
}

// ── Ensure subscription row exists for a shop ─────────────────────
// Uses ignoreDuplicates so it never overwrites a paid subscription.
// Only creates a starter row if none exists.

async function ensureSubscriptionExists(shopId: string): Promise<void> {
  try {
    const { error } = await (supabase as any)
      .from('subscriptions')
      .upsert(
        {
          shop_id:       shopId,
          plan:          'starter',
          status:        'active',
          trial_ends_at: null,
          expires_at:    null,
          billing_cycle: null,
          amount_pkr:    null,
          updated_at:    new Date().toISOString(),
        },
        {
          onConflict:       'shop_id',
          ignoreDuplicates: true,   // won't overwrite existing paid plan
        }
      )

    if (error) {
      // Log but don't throw — subscription may already exist correctly
      console.warn('[Sync] ensureSubscription warning (non-fatal):', error.message)
    } else {
      console.log('[Sync] ✓ subscription ensured')
    }
  } catch (e) {
    // Never fatal — the shop data still syncs even if this fails
    console.warn('[Sync] ensureSubscription error (non-fatal):', String(e))
  }
}

// ── Ensure shop_usage row exists ──────────────────────────────────

async function ensureUsageExists(shopId: string): Promise<void> {
  try {
    await (supabase as any)
      .from('shop_usage')
      .upsert(
        {
          shop_id:           shopId,
          orders_this_month: 0,
          customers_total:   0,
          karigar_count:     0,
          storage_used_kb:   0,
          month_year:        new Date().toISOString().slice(0, 7),
          updated_at:        new Date().toISOString(),
        },
        {
          onConflict:       'shop_id',
          ignoreDuplicates: true,
        }
      )
  } catch (e) {
    console.warn('[Sync] ensureUsage non-fatal:', String(e))
  }
}

// ── Main sync service ─────────────────────────────────────────────

export const syncService = {

  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine
  },

  // ── Push all unsynced Dexie records → Supabase ────────────────
  async pushAll(shopId: string): Promise<{ success: boolean; errors: string[] }> {
    if (!syncService.isOnline()) {
      return { success: false, errors: ['offline'] }
    }

    const errors: string[] = []

    // Generic push helper — maps rows, skips invalid, upserts, marks _synced
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
          // Log and skip this record — don't fail the entire batch
          console.warn(`[Sync] Skipping invalid ${tableName} record:`, String(e))
          // Mark as synced to prevent infinite retry of truly broken records
          dexieTable.update(ids[i], { _synced: 1 }).catch(() => {})
        }
      })

      if (validRows.length === 0) return

      const { error } = await upsertTable<T>(tableName, validRows)
      if (error) {
        console.error(`[Sync] ${tableName} error:`, error.message)
        errors.push(`${tableName}: ${error.message}`)
      } else {
        await Promise.all(validIds.map(id => dexieTable.update(id, { _synced: 1 })))
        console.log(`[Sync] ✓ ${tableName} — ${validRows.length} records`)
      }
    }

    try {

      // ── STEP 1: Shop ────────────────────────────────────────────
      // Must succeed before anything else — all other tables FK to shops
      const shop = await db.shop.get(shopId) ?? await db.shop.toCollection().first()
      if (shop && shop.id !== shopId) {
        const msg = `local shop ${shop.id} does not match active shop ${shopId}`
        console.warn('[Sync] shops mismatch:', msg)
        errors.push(`shops: ${msg}`)
        return { success: false, errors }
      }
      if (shop && shop._synced === 0) {
        const { error: shopError } = await upsertTable<Partial<ShopRow>>(
          'shops', [shopToRow(shop)]
        )
        if (shopError) {
          console.error('[Sync] shops failed — aborting push:', shopError.message)
          errors.push(`shops: ${shopError.message}`)
          return { success: false, errors }
        }
        await db.shop.update(shop.id, { _synced: 1 })
        console.log('[Sync] ✓ shops')

        // Ensure subscription + usage rows exist
        // These are created server-side by trigger, but may be missing
        // if the shop was created offline. ignoreDuplicates keeps paid plans safe.
        await ensureRemoteShopExists(shop)
        await ensureSubscriptionExists(shop.id)
        await ensureUsageExists(shop.id)
      } else if (shop && shop._synced === 1) {
        // Shop already synced — still ensure subscription exists
        // in case it was lost or never created
        const remoteShopReady = await ensureRemoteShopExists(shop)
        if (remoteShopReady) {
          await ensureSubscriptionExists(shop.id)
          await ensureUsageExists(shop.id)
        }
      }

      // ── STEP 2: Team members ────────────────────────────────────
      // Must come before orders (orders.assigned_to FKs to team_members)
      const members = await db.teamMembers
        .where('shopId').equals(shopId)
        .filter(m => m._synced === 0)
        .toArray()
      await push<TeamMemberRow>(
        'team_members', members, memberToRow,
        db.teamMembers, members.map(m => m.id)
      )

      // If team_members failed, payments will also fail (recorded_by FK)
      // but we continue — partial sync is better than none
      const membersFailed = errors.some(e => e.startsWith('team_members'))
      if (membersFailed) {
        console.warn('[Sync] team_members had errors — payments may fail FK check')
      }

      // ── STEP 3: Customers ───────────────────────────────────────
      // Must come before measurements + orders (both FK to customers)
      const customers = await db.customers
        .where('shopId').equals(shopId)
        .filter(c => c._synced === 0)
        .toArray()
      await push<CustomerRow>(
        'customers', customers, customerToRow,
        db.customers, customers.map(c => c.id)
      )

      // ── STEP 4: Measurements ────────────────────────────────────
      // Depends on customers — run after customers succeed
      const measurements = await db.measurements
        .where('shopId').equals(shopId)
        .filter(m => m._synced === 0)
        .toArray()

      if (measurements.length > 0) {
        // Filter out measurements whose customer hasn't synced yet
        // to avoid FK violation
        const { data: syncedCustomers } = await (supabase as any)
          .from('customers')
          .select('id')
          .eq('shop_id', shopId)

        const syncedCustomerIds = new Set(
          (syncedCustomers ?? []).map((c: any) => c.id)
        )

        const safeMeasurements = measurements.filter(m =>
          syncedCustomerIds.has(m.customerId)
        )
        const skippedMeasurements = measurements.filter(m =>
          !syncedCustomerIds.has(m.customerId)
        )

        // Skip orphaned measurements — their customers haven't synced
        skippedMeasurements.forEach(m => {
          console.warn(`[Sync] Skipping measurement ${m.id} — customer not yet in Supabase`)
        })

        await push<MeasurementRow>(
          'measurements', safeMeasurements, measurementToRow,
          db.measurements, safeMeasurements.map(m => m.id)
        )
      }

      // ── STEP 5: Orders ──────────────────────────────────────────
      // Depends on customers — run after customers succeed
      const orders = await db.orders
        .where('shopId').equals(shopId)
        .filter(o => o._synced === 0)
        .toArray()

      if (orders.length > 0) {
        // Filter out orders whose customer hasn't synced yet
        const { data: syncedCustomers } = await (supabase as any)
          .from('customers')
          .select('id')
          .eq('shop_id', shopId)

        const syncedCustomerIds = new Set(
          (syncedCustomers ?? []).map((c: any) => c.id)
        )

        const safeOrders = orders.filter(o =>
          o.customerId && syncedCustomerIds.has(o.customerId)
        )
        const skippedOrders = orders.filter(o =>
          !o.customerId || !syncedCustomerIds.has(o.customerId)
        )

        skippedOrders.forEach(o => {
          console.warn(`[Sync] Skipping order ${o.id} — customer ${o.customerId} not in Supabase`)
          // Mark as synced to stop retrying with a missing customer
          db.orders.update(o.id, { _synced: 1 }).catch(() => {})
        })

        await push<OrderRow>(
          'orders', safeOrders, orderToRow,
          db.orders, safeOrders.map(o => o.id)
        )
      }

      // ── STEP 6: Payments ────────────────────────────────────────
      // Depends on orders + team_members
      const payments = await db.payments
        .where('shopId').equals(shopId)
        .filter(p => p._synced === 0)
        .toArray()

      if (payments.length > 0) {
        // Verify order IDs exist in Supabase
        const { data: syncedOrders } = await (supabase as any)
          .from('orders')
          .select('id')
          .eq('shop_id', shopId)

        const syncedOrderIds = new Set(
          (syncedOrders ?? []).map((o: any) => o.id)
        )

        const safePayments = payments.filter(p =>
          syncedOrderIds.has(p.orderId)
        )
        const skippedPayments = payments.filter(p =>
          !syncedOrderIds.has(p.orderId)
        )

        skippedPayments.forEach(p => {
          console.warn(`[Sync] Skipping payment ${p.id} — order ${p.orderId} not in Supabase`)
        })

        await push<PaymentRow>(
          'payments', safePayments, paymentToRow,
          db.payments, safePayments.map(p => p.id)
        )
      }

      // ── STEP 7: Order status history ─────────────────────────────
      // Depends on orders + team_members
      const history = await db.orderStatusHistory
        .where('shopId').equals(shopId)
        .filter(h => h._synced === 0)
        .toArray()

      if (history.length > 0) {
        // Verify order IDs exist
        const { data: syncedOrders } = await (supabase as any)
          .from('orders')
          .select('id')
          .eq('shop_id', shopId)

        const syncedOrderIds = new Set(
          (syncedOrders ?? []).map((o: any) => o.id)
        )

        const safeHistory = history.filter(h =>
          syncedOrderIds.has(h.orderId)
        )
        const skippedHistory = history.filter(h =>
          !syncedOrderIds.has(h.orderId)
        )

        skippedHistory.forEach(h => {
          db.orderStatusHistory.update(h.id, { _synced: 1 }).catch(() => {})
        })

        await push<StatusHistoryRow>(
          'order_status_history', safeHistory, historyToRow,
          db.orderStatusHistory, safeHistory.map(h => h.id)
        )
      }

      // ── STEP 8: Cloudinary photo metadata ───────────────────────
      const photos = await db.photos
        .where('shopId').equals(shopId)
        .filter(p => p._synced === 0 && !!p.cloudUrl && !!p.publicId)
        .toArray()
      await push<PhotoRow>(
        'order_photos', photos, photoToRow,
        db.photos, photos.map(p => p.id)
      )

    } catch (e) {
      const msg = `Unexpected push error: ${String(e)}`
      console.error('[Sync]', msg)
      errors.push(msg)
    }

    const success = errors.length === 0
    console.log(`[Sync] pushAll complete — ${success ? 'success' : `${errors.length} errors`}`)
    return { success, errors }
  },

  // ── Pull Supabase → Dexie (for cross-device login) ────────────
  async pullAll(shopId: string): Promise<void> {
    if (!syncService.isOnline()) return

    try {
      // Fetch all tables in parallel
      const [
        { data: orders },
        { data: customers },
        { data: payments },
        { data: measurements },
        { data: members },
        { data: historyOrders },
      ] = await Promise.all([
        (supabase as any).from('orders')
          .select('*').eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('customers')
          .select('*').eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('payments')
          .select('*').eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('measurements')
          .select('*').eq('shop_id', shopId).is('deleted_at', null),
        (supabase as any).from('team_members')
          .select('*').eq('shop_id', shopId).eq('is_active', true),
        (supabase as any).from('orders')
          .select('id').eq('shop_id', shopId),
      ])

      // ── Orders ─────────────────────────────────────────────────
      if (orders && orders.length > 0) {
        await db.orders.bulkPut(orders.map((o: any) => ({
          id:                  o.id,
          shopId:              o.shop_id,
          orderNumber:         o.order_number,
          trackingCode:        o.tracking_code    ?? '',
          customerId:          o.customer_id,
          customerName:        o.customer_name,
          customerPhone:       o.customer_phone,
          orderForRelation:    o.order_for_relation ?? 'self',
          orderForName:        o.order_for_name     ?? undefined,
          recipientGender:     o.recipient_gender   ?? undefined,
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
        console.log(`[Sync] Pulled ${orders.length} orders`)
      }

      // ── Customers ──────────────────────────────────────────────
      if (customers && customers.length > 0) {
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
        console.log(`[Sync] Pulled ${customers.length} customers`)
      }

      // ── Payments ───────────────────────────────────────────────
      if (payments && payments.length > 0) {
        await db.payments.bulkPut(payments.map((p: any) => ({
          id:          p.id,
          shopId:      p.shop_id,
          orderId:     p.order_id,
          amount:      Number(p.amount),
          appliedToBalance: p.applied_to_balance === null || p.applied_to_balance === undefined
            ? Number(p.amount)
            : Number(p.applied_to_balance),
          kind:        p.kind ?? 'order_payment',
          method:      p.method,
          recordedBy:  p.recorded_by,
          paidAt:      p.paid_at,
          notes:       p.notes ?? undefined,
          _synced:     1,
          _deleted:    0,
        })))
        console.log(`[Sync] Pulled ${payments.length} payments`)
      }

      // ── Measurements ───────────────────────────────────────────
      if (measurements && measurements.length > 0) {
        await db.measurements.bulkPut(measurements.map((m: any) => ({
          id:          m.id,
          customerId:  m.customer_id,
          shopId:      m.shop_id,
          orderForRelation: m.order_for_relation ?? 'self',
          orderForName:     m.order_for_name     ?? undefined,
          recipientGender:  m.recipient_gender   ?? undefined,
          garmentType: m.garment_type,
          values:      m.values,
          notes:       m.notes    ?? undefined,
          takenAt:     m.taken_at,
          _synced:     1,
          _deleted:    0,
        })))
        console.log(`[Sync] Pulled ${measurements.length} measurements`)
      }

      // ── Team members ───────────────────────────────────────────
      if (members && members.length > 0) {
        await db.teamMembers.bulkPut(members.map((m: any) => ({
          id:          m.id,
          shopId:      m.shop_id,
          name:        m.name,
          phone:       m.phone,
          role:        m.role,
          pin:         m.pin_hash,
          speciality:  m.speciality    ?? undefined,
          payRateType: m.pay_rate_type ?? undefined,
          payRate:     m.pay_rate      ?? undefined,
          isActive:    m.is_active ? 1 : 0,
          joinedAt:    m.joined_at,
          createdAt:   m.created_at,
          _synced:     1,
          _deleted:    0,
        })))
        console.log(`[Sync] Pulled ${members.length} team members`)
      }

      // ── Order status history ────────────────────────────────────
      if (historyOrders && historyOrders.length > 0) {
        const orderIds = historyOrders.map((o: any) => o.id)

        // Fetch in chunks of 100 to avoid URL length limits
        const chunkSize = 100
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize)
          const { data: history } = await (supabase as any)
            .from('order_status_history')
            .select('*')
            .in('order_id', chunk)

          if (history && history.length > 0) {
            // Build orderId → shopId map
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
      }

      const { data: photos } = await (supabase as any)
        .from('order_photos')
        .select('*')
        .eq('shop_id', shopId)
        .is('deleted_at', null)

      if (photos && photos.length > 0) {
        await db.photos.bulkPut(photos.map((p: any) => ({
          id:          p.id,
          orderId:     p.order_id,
          shopId:      p.shop_id,
          type:        p.type,
          base64:      '',
          cloudUrl:    p.cloud_url,
          publicId:    p.public_id,
          cloudSizeKB: p.cloud_size_kb ?? undefined,
          sizeKB:      p.size_kb ?? 0,
          takenAt:     p.taken_at,
          _synced:     1,
          _deleted:    0,
        })))
        console.log(`[Sync] Pulled ${photos.length} photo records`)
      }

      const [
        { data: deletedCustomers },
        { data: deletedOrders },
        { data: deletedMeasurements },
        { data: deletedPayments },
        { data: deletedPhotos },
      ] = await Promise.all([
        (supabase as any).from('customers').select('id').eq('shop_id', shopId).not('deleted_at', 'is', null),
        (supabase as any).from('orders').select('id').eq('shop_id', shopId).not('deleted_at', 'is', null),
        (supabase as any).from('measurements').select('id').eq('shop_id', shopId).not('deleted_at', 'is', null),
        (supabase as any).from('payments').select('id').eq('shop_id', shopId).not('deleted_at', 'is', null),
        (supabase as any).from('order_photos').select('id').eq('shop_id', shopId).not('deleted_at', 'is', null),
      ])

      await Promise.all([
        ...((deletedCustomers ?? []).map((r: any) => db.customers.update(r.id, { _deleted: 1, _synced: 1 }))),
        ...((deletedOrders ?? []).map((r: any) => db.orders.update(r.id, { _deleted: 1, _synced: 1 }))),
        ...((deletedMeasurements ?? []).map((r: any) => db.measurements.update(r.id, { _deleted: 1, _synced: 1 }))),
        ...((deletedPayments ?? []).map((r: any) => db.payments.update(r.id, { _deleted: 1, _synced: 1 }))),
        ...((deletedPhotos ?? []).map((r: any) => db.photos.update(r.id, { _deleted: 1, _synced: 1 }))),
      ])

      console.log('[Sync] ✓ pullAll complete')

    } catch (e) {
      console.error('[Sync] pullAll failed:', e)
    }
  },

  // ── Get order by tracking code (public — cross-device) ────────
  async getOrderByTrackingCode(code: string): Promise<any | null> {
    if (!syncService.isOnline()) return null

    try {
      const { data, error } = await (supabase as any)
        .from('orders')
        .select(`*, shops(shop_name, whatsapp_number, city, brand_name, brand_color, brand_logo_url)`)
        .eq('tracking_code', code.toUpperCase())
        .is('deleted_at', null)
        .maybeSingle()

      if (error || !data) return null
      return data
    } catch (e) {
      console.error('[Sync] getOrderByTrackingCode error:', e)
      return null
    }
  },

  // ── Get order by number (legacy fallback) ─────────────────────
  async getOrderByNumber(orderNumber: number): Promise<any | null> {
    if (!syncService.isOnline()) return null

    try {
      const { data, error } = await (supabase as any)
        .from('orders')
        .select(`*, shops(shop_name, whatsapp_number, city, brand_name, brand_color, brand_logo_url)`)
        .eq('order_number', orderNumber)
        .is('deleted_at', null)
        .maybeSingle()

      if (error || !data) return null
      return data
    } catch (e) {
      console.error('[Sync] getOrderByNumber error:', e)
      return null
    }
  },

  // ── Auto-sync: push on reconnect + every 60 seconds ───────────
  startAutoSync(shopId: string): () => void {
    if (typeof window === 'undefined') return () => {}

    const doSync = async () => {
      if (navigator.onLine) {
        await syncService.pushAll(shopId).catch(console.error)
      }
    }

    window.addEventListener('online', doSync)
    const interval = setInterval(doSync, 60_000)

    return () => {
      window.removeEventListener('online', doSync)
      clearInterval(interval)
    }
  },
}
