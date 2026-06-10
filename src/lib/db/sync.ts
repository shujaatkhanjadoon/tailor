import { db, type ShopRecord, type TeamMemberRecord, type CustomerRecord, type MeasurementRecord, type OrderRecord, type PaymentRecord, type OrderStatusHistoryRecord } from './schema'
import { supabase } from '@/lib/supabase/client'
import { mapShop, mapTeamMember, mapCustomer, mapOrder, mapMeasurement, mapPayment, mapStatusHistory } from '@/lib/supabase/records'
import { nowISO } from './offline'

export type SyncEventType = 'pull-start' | 'pull-end' | 'push-start' | 'push-end' | 'sync-error' | 'sync-conflict'
export type SyncEventCallback = (event: SyncEventType, table?: string, detail?: string) => void

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
  private eventListeners: Map<SyncEventType, Set<SyncEventCallback>> = new Map()
  private started = false

  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  onOnlineChange(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onSyncEvent(callback: SyncEventCallback): () => void {
    for (const t of ['pull-start', 'pull-end', 'push-start', 'push-end', 'sync-error', 'sync-conflict'] as SyncEventType[]) {
      if (!this.eventListeners.has(t)) {
        this.eventListeners.set(t, new Set())
      }
      this.eventListeners.get(t)!.add(callback)
    }
    return () => {
      for (const s of this.eventListeners.values()) {
        s.delete(callback)
      }
    }
  }

  private emit(event: SyncEventType, table?: string, detail?: string) {
    const cbs = this.eventListeners.get(event)
    if (cbs) {
      cbs.forEach(fn => fn(event, table, detail))
    }
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
      this.emit('pull-start', t)
      await this.pullTable(t, shopId)
      this.emit('pull-end', t)
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

      const ids = serverRecords.map(r => r.id)
      const localRecords = await table.bulkGet(ids)
      const localMap = new Map<string, AnyRecord>()
      for (let i = 0; i < ids.length; i++) {
        if (localRecords[i] !== undefined) {
          localMap.set(ids[i], localRecords[i])
        }
      }

      for (const server of serverRecords) {
        const local = localMap.get(server.id)

        if (!isPushable || !local) {
          await table.put(server)
        } else if ((local as any)._synced === 1) {
          await table.put(server)
        }
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
        this.emit('push-start', t)
        await this.pushTable(t)
        this.emit('push-end', t)
      }
    } catch (err) {
      this.emit('sync-error', undefined, String(err))
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

    // Batch fetch server versions for conflict check
    const ids = unsynced.map(r => r.id)
    const idParams = ids.map((id, i) => `id=eq.${encodeURIComponent(id)}`).join(',')
    const serverMap = new Map<string, { updated_at: string; deleted_at: string | null }>()
    try {
      const res = await supabase
        .from(supabaseTable)
        .select('id, updated_at, deleted_at')
        .in('id', ids)
      if (!res.error && res.data) {
        for (const row of res.data) {
          serverMap.set(row.id, row)
        }
      }
    } catch {
      // fall through to per-record handling
    }

    for (const record of unsynced) {
      try {
        const r = record as any

        if (r._deleted === 1) {
          const { error } = await supabase
            .from(supabaseTable)
            .update({ deleted_at: nowISO() })
            .eq('id', record.id)
          if (error) throw error
          await table.delete(record.id)
          continue
        }

        const serverRow = serverMap.get(record.id)
        const localUpdatedAt = r.updatedAt || r.createdAt || ''
        const serverUpdatedAt = serverRow?.updated_at || ''

        if (serverRow && new Date(serverUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()) {
          // Server has a newer version — keep server version, skip local push
          this.emit('sync-conflict', tableName)
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

        const row = recordToRow(tableName, record)
        await supabase.from(supabaseTable).upsert(row).throwOnError()
        await table.update(record.id, { _synced: 1 } as any)
      } catch (err) {
        console.error(`[Sync] Push ${tableName} ${record.id} failed:`, err)
      }
    }
  }

  /** Push only records updated after a given timestamp (delta sync). */
  async syncDelta(since: string): Promise<number> {
    if (this.syncing || !this.isOnline()) return 0
    this.syncing = true
    let pushed = 0
    try {
      for (const t of PUSHABLE) {
        const table = db[t] as any
        const pending: AnyRecord[] = await table
          .where('_synced')
          .equals(0)
          .and((r: any) => r.updatedAt > since || r.createdAt > since)
          .toArray()
        if (pending.length === 0) continue
        await this.pushTable(t)
        pushed += pending.length
      }
    } catch (err) {
      console.error('[Sync] Delta sync failed:', err)
    } finally {
      this.syncing = false
    }
    return pushed
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
