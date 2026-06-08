import { db, type ShopRecord, type TeamMemberRecord, type CustomerRecord, type MeasurementRecord, type OrderRecord, type PaymentRecord, type OrderStatusHistoryRecord } from './schema'
import { supabase } from '@/lib/supabase/client'
import { mapShop, mapTeamMember, mapCustomer, mapOrder, mapMeasurement, mapPayment, mapStatusHistory } from '@/lib/supabase/records'
import { nowISO } from './offline'

type TableName =
  | 'shops'
  | 'teamMembers'
  | 'customers'
  | 'measurements'
  | 'orders'
  | 'payments'
  | 'orderStatusHistory'

type AnyRecord =
  | ShopRecord
  | TeamMemberRecord
  | CustomerRecord
  | MeasurementRecord
  | OrderRecord
  | PaymentRecord
  | OrderStatusHistoryRecord

const SUPABASE_TABLES: Record<TableName, string> = {
  shops: 'shops',
  teamMembers: 'team_members',
  customers: 'customers',
  measurements: 'measurements',
  orders: 'orders',
  payments: 'payments',
  orderStatusHistory: 'order_status_history',
}

const SUPABASE_COLUMNS: Record<TableName, string> = {
  shops: 'id, shop_name, owner_name, owner_phone, whatsapp_number, state_province, city, address_line, postal_code, brand_name, brand_color, brand_logo_url, is_active, created_at, updated_at',
  teamMembers: 'id, shop_id, name, phone, role, pin_hash, speciality, pay_rate_type, pay_rate, is_active, joined_at, created_at, deleted_at',
  customers: 'id, shop_id, name, phone, whatsapp, gender, notes, photo_url, total_orders, created_at, updated_at, last_order_at, deleted_at',
  measurements: 'id, customer_id, shop_id, order_for_relation, order_for_name, recipient_gender, garment_type, values, notes, taken_at, deleted_at',
  orders: 'id, shop_id, order_number, tracking_code, customer_id, customer_name, customer_phone, order_for_relation, order_for_name, recipient_gender, measurement_id, garment_type, status, assigned_to, assigned_to_name, total_price, amount_paid, is_urgent, due_date, special_instructions, fabric_photo_url, style_photo_url, created_at, updated_at, delivered_at, deleted_at',
  payments: 'id, shop_id, order_id, amount, applied_to_balance, kind, method, recorded_by, paid_at, notes, deleted_at',
  orderStatusHistory: 'id, order_id, old_status, new_status, shop_id, changed_by, changed_at',
}

const MAPPERS: Record<TableName, (row: any) => AnyRecord> = {
  shops: mapShop,
  teamMembers: mapTeamMember,
  customers: mapCustomer,
  measurements: mapMeasurement,
  orders: mapOrder,
  payments: mapPayment,
  orderStatusHistory: mapStatusHistory,
}

/** Tables whose records carry _synced / _deleted flags and are pushed. */
const PUSHABLE: TableName[] = ['shops', 'teamMembers', 'customers', 'measurements', 'orders', 'payments']

class SyncEngine {
  private syncing = false
  private listeners: Set<(online: boolean) => void> = new Set()
  private started = false

  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  onOnlineChange(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(online: boolean) {
    this.listeners.forEach(fn => fn(online))
  }

  start() {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    window.addEventListener('online', () => {
      this.notify(true)
      this.sync()
    })
    window.addEventListener('offline', () => {
      this.notify(false)
    })
    if (this.isOnline()) {
      this.sync()
    }
  }

  // ─── Pull (server → local) ─────────────────────────────────────

  /** Fetch latest data from Supabase and merge into Dexie (non-destructive). */
  async pull(shopId?: string): Promise<void> {
    const tables: TableName[] = ['shops', 'teamMembers', 'customers', 'measurements', 'orders', 'payments', 'orderStatusHistory']
    for (const t of tables) {
      await this.pullTable(t, shopId)
    }
  }

  private async pullTable(tableName: TableName, shopId?: string) {
    try {
      let query = supabase
        .from(SUPABASE_TABLES[tableName])
        .select(SUPABASE_COLUMNS[tableName])

      if (shopId && tableName !== 'shops') {
        query = query.eq('shop_id', shopId)
      }
      if (tableName !== 'orderStatusHistory' && tableName !== 'shops') {
        query = query.is('deleted_at', null)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      if (!data || !Array.isArray(data)) return

      const mapper = MAPPERS[tableName]
      const serverRecords = data.map(row => mapper(row))

      const table = db[tableName] as any
      const isPushable = PUSHABLE.includes(tableName)

      for (const server of serverRecords) {
        try {
          const local: AnyRecord | undefined = await table.get(server.id)

          if (!isPushable || !local) {
            // New record or table without sync flags — always accept server version
            await table.put(server)
          } else if ((local as any)._synced === 1) {
            // Record is already synced locally — safe to overwrite with server version
            await table.put(server)
          }
          // If _synced === 0, keep local version (it will be pushed next sync)
        } catch {}
      }
    } catch (err) {
      console.error(`[Sync] Pull ${tableName} failed:`, err)
    }
  }

  // ─── Push (local → server) ─────────────────────────────────────

  /** Push all locally-queued changes to Supabase. */
  async sync(): Promise<void> {
    if (this.syncing || !this.isOnline()) return
    this.syncing = true
    try {
      for (const t of PUSHABLE) {
        await this.pushTable(t)
      }
      // After pushing, pull fresh data for records that may have changed server-side
      // Only pull if we actually pushed something
    } catch (err) {
      console.error('[Sync] Sync failed:', err)
    } finally {
      this.syncing = false
    }
  }

  private async pushTable(tableName: TableName) {
    const table = db[tableName] as any
    let unsynced: AnyRecord[]
    try {
      unsynced = await table.where('_synced').equals(0).toArray()
    } catch {
      return
    }
    if (unsynced.length === 0) return

    const supabaseTable = SUPABASE_TABLES[tableName]

    for (const record of unsynced) {
      try {
        const r = record as any

        if (r._deleted === 1) {
          // Soft-delete on server and remove from local
          const { error } = await supabase
            .from(supabaseTable)
            .update({ deleted_at: nowISO() })
            .eq('id', record.id)
          if (error) throw error
          await table.delete(record.id)
          continue
        }

        // ── Conflict check: read server version ──
        const { data: serverRow, error: fetchErr } = await supabase
          .from(supabaseTable)
          .select('updated_at, deleted_at')
          .eq('id', record.id)
          .maybeSingle()

        if (fetchErr) throw fetchErr

        const localUpdatedAt = r.updatedAt || r.createdAt || ''
        const serverUpdatedAt = serverRow?.updated_at || ''

        if (serverRow && serverUpdatedAt > localUpdatedAt) {
          // Server has a newer version — discard local change, pull server version
          const { data: fresh } = await supabase
            .from(supabaseTable)
            .select(SUPABASE_COLUMNS[tableName])
            .eq('id', record.id)
            .single()

          if (fresh) {
            const mapper = MAPPERS[tableName]
            await table.put(mapper(fresh))
          }
          continue
        }

        // Local is newer or server has no record → push local version
        const row = recordToRow(tableName, record)
        await supabase.from(supabaseTable).upsert(row).throwOnError()
        await table.update(record.id, { _synced: 1 } as any)
      } catch (err) {
        console.error(`[Sync] Push ${tableName} ${record.id} failed:`, err)
      }
    }
  }
}

function recordToRow(tableName: TableName, record: AnyRecord): Record<string, unknown> {
  const clean = <T extends Record<string, unknown>>(obj: T): T => {
    const out = { ...obj } as any
    Object.keys(out).forEach(k => { if (out[k] === undefined) delete out[k] })
    return out
  }

  switch (tableName) {
    case 'shops': {
      const r = record as ShopRecord
      return clean({
        id: r.id,
        shop_name: r.shopName,
        owner_name: r.ownerName ?? null,
        owner_phone: r.ownerPhone,
        whatsapp_number: r.whatsappNumber ?? null,
        state_province: r.stateProvince ?? null,
        city: r.city ?? null,
        address_line: r.addressLine ?? null,
        postal_code: r.postalCode ?? null,
        brand_name: r.brandName ?? null,
        brand_color: r.brandColor ?? null,
        brand_logo_url: r.brandLogoUrl ?? null,
        is_active: r.isActive !== 0,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })
    }
    case 'teamMembers': {
      const r = record as TeamMemberRecord
      return clean({
        id: r.id,
        shop_id: r.shopId,
        name: r.name,
        phone: r.phone,
        role: r.role,
        pin_hash: r.pin,
        speciality: r.speciality ?? null,
        pay_rate_type: r.payRateType ?? null,
        pay_rate: r.payRate ?? null,
        is_active: r.isActive !== 0,
        joined_at: r.joinedAt,
        created_at: r.createdAt,
      })
    }
    case 'customers': {
      const r = record as CustomerRecord
      return clean({
        id: r.id,
        shop_id: r.shopId,
        name: r.name,
        phone: r.phone,
        whatsapp: r.whatsapp ?? null,
        gender: r.gender,
        notes: r.notes ?? null,
        photo_url: r.photoUrl ?? null,
        total_orders: r.totalOrders ?? 0,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
        last_order_at: r.lastOrderAt ?? null,
      })
    }
    case 'measurements': {
      const r = record as MeasurementRecord
      return clean({
        id: r.id,
        customer_id: r.customerId,
        shop_id: r.shopId,
        order_for_relation: r.orderForRelation ?? null,
        order_for_name: r.orderForName ?? null,
        recipient_gender: r.recipientGender ?? null,
        garment_type: r.garmentType,
        values: r.values ?? {},
        notes: r.notes ?? null,
        taken_at: r.takenAt,
      })
    }
    case 'orders': {
      const r = record as OrderRecord
      return clean({
        id: r.id,
        shop_id: r.shopId,
        order_number: r.orderNumber,
        tracking_code: r.trackingCode,
        customer_id: r.customerId,
        customer_name: r.customerName,
        customer_phone: r.customerPhone,
        order_for_relation: r.orderForRelation ?? 'self',
        order_for_name: r.orderForName ?? null,
        recipient_gender: r.recipientGender ?? null,
        measurement_id: r.measurementId ?? null,
        garment_type: r.garmentType,
        status: r.status,
        assigned_to: r.assignedTo ?? null,
        assigned_to_name: r.assignedToName ?? null,
        total_price: r.totalPrice,
        amount_paid: r.amountPaid,
        is_urgent: r.isUrgent === 1,
        due_date: r.dueDate,
        special_instructions: r.specialInstructions ?? null,
        fabric_photo_url: r.fabricPhotoUrl ?? null,
        style_photo_url: r.stylePhotoUrl ?? null,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
        delivered_at: r.deliveredAt ?? null,
      })
    }
    case 'payments': {
      const r = record as PaymentRecord
      return clean({
        id: r.id,
        shop_id: r.shopId,
        order_id: r.orderId,
        amount: r.amount,
        applied_to_balance: r.appliedToBalance ?? r.amount,
        kind: r.kind ?? 'order_payment',
        method: r.method,
        recorded_by: r.recordedBy,
        paid_at: r.paidAt,
        notes: r.notes ?? null,
      })
    }
    case 'orderStatusHistory': {
      const r = record as OrderStatusHistoryRecord
      return clean({
        id: r.id,
        order_id: r.orderId,
        old_status: r.oldStatus,
        new_status: r.newStatus,
        shop_id: r.shopId,
        changed_by: r.changedBy,
        changed_at: r.changedAt,
      })
    }
  }
}

export const syncEngine = new SyncEngine()
