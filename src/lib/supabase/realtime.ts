// src/lib/supabase/realtime.ts
// Supabase Realtime subscriptions — streams DB changes to all devices instantly

import { supabase }      from './client'
import { db }            from '@/lib/db/schema'

type RealtimeCallback = () => void

export interface RealtimeSubscription {
  unsubscribe: () => void
}

// ── Map Supabase row → Dexie record ──────────────────────────────

function mapOrder(row: any) {
  return {
    id:                  row.id,
    shopId:              row.shop_id,
    orderNumber:         row.order_number,
    trackingCode:        row.tracking_code    ?? '',
    customerId:          row.customer_id,
    customerName:        row.customer_name,
    customerPhone:       row.customer_phone,
    measurementId:       row.measurement_id   ?? undefined,
    garmentType:         row.garment_type,
    status:              row.status,
    assignedTo:          row.assigned_to      ?? undefined,
    assignedToName:      row.assigned_to_name ?? undefined,
    totalPrice:          Number(row.total_price),
    amountPaid:          Number(row.amount_paid),
    isUrgent:            (row.is_urgent ? 1 : 0) as 0 | 1,
    dueDate:             row.due_date,
    specialInstructions: row.special_instructions ?? undefined,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
    deliveredAt:         row.delivered_at     ?? undefined,
    _synced:             1 as const,
    _deleted:            (row.deleted_at ? 1 : 0) as 0 | 1,
  }
}

function mapCustomer(row: any) {
  return {
    id:          row.id,
    shopId:      row.shop_id,
    name:        row.name,
    phone:       row.phone,
    whatsapp:    row.whatsapp      ?? undefined,
    gender:      row.gender,
    notes:       row.notes         ?? undefined,
    totalOrders: row.total_orders  ?? 0,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    lastOrderAt: row.last_order_at ?? undefined,
    _synced:     1 as const,
    _deleted:    (row.deleted_at ? 1 : 0) as 0 | 1,
  }
}

function mapPayment(row: any) {
  return {
    id:         row.id,
    shopId:     row.shop_id,
    orderId:    row.order_id,
    amount:     Number(row.amount),
    method:     row.method,
    recordedBy: row.recorded_by,
    paidAt:     row.paid_at,
    notes:      row.notes ?? undefined,
    _synced:    1 as const,
    _deleted:   (row.deleted_at ? 1 : 0) as 0 | 1,
  }
}

function mapStatusHistory(row: any, shopId: string) {
  return {
    id:        row.id,
    orderId:   row.order_id,
    shopId,
    oldStatus: row.old_status ?? undefined,
    newStatus: row.new_status,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    _synced:   1 as const,
  }
}

function mapMeasurement(row: any) {
  return {
    id:          row.id,
    customerId:  row.customer_id,
    shopId:      row.shop_id,
    garmentType: row.garment_type,
    values:      row.values,
    notes:       row.notes    ?? undefined,
    takenAt:     row.taken_at,
    _synced:     1 as const,
    _deleted:    (row.deleted_at ? 1 : 0) as 0 | 1,
  }
}

// ── Main subscribe function ───────────────────────────────────────

export function subscribeToShop(
  shopId:  string,
  onChange: RealtimeCallback
): RealtimeSubscription {

  // Channel name must be unique per shop
  const channelName = `shop-${shopId}`

  const channel = (supabase as any)
    .channel(channelName)

    // ── Orders ────────────────────────────────────────────────────
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'orders',
      filter: `shop_id=eq.${shopId}`,
    }, async (payload: any) => {
      try {
        const row = payload.new ?? payload.old
        if (!row?.id) return

        if (payload.eventType === 'DELETE' || row.deleted_at) {
          await db.orders.update(row.id, { _deleted: 1 as const, _synced: 1 as const })
        } else {
          await db.orders.put(mapOrder(row))
        }
        onChange()
      } catch (e) {
        console.error('[RT] orders error:', e)
      }
    })

    // ── Customers ─────────────────────────────────────────────────
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'customers',
      filter: `shop_id=eq.${shopId}`,
    }, async (payload: any) => {
      try {
        const row = payload.new ?? payload.old
        if (!row?.id) return

        if (payload.eventType === 'DELETE' || row.deleted_at) {
          await db.customers.update(row.id, { _deleted: 1 as const, _synced: 1 as const })
        } else {
          await db.customers.put(mapCustomer(row))
        }
        onChange()
      } catch (e) {
        console.error('[RT] customers error:', e)
      }
    })

    // ── Payments ──────────────────────────────────────────────────
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'payments',
      filter: `shop_id=eq.${shopId}`,
    }, async (payload: any) => {
      try {
        const row = payload.new ?? payload.old
        if (!row?.id) return

        if (payload.eventType === 'DELETE') {
          await db.payments.delete(row.id)
        } else {
          await db.payments.put(mapPayment(row))
        }

        // Recalculate amountPaid on the parent order
        if (row.order_id) {
          const allPayments = await db.payments
            .where('orderId').equals(row.order_id)
            .filter(p => p._deleted === 0)
            .toArray()
          const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0)
          await db.orders.update(row.order_id, { amountPaid: totalPaid, _synced: 1 as const })
        }

        onChange()
      } catch (e) {
        console.error('[RT] payments error:', e)
      }
    })

    // ── Order status history ───────────────────────────────────────
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'order_status_history',
    }, async (payload: any) => {
      try {
        const row = payload.new
        if (!row?.id) return
        await db.orderStatusHistory.put(mapStatusHistory(row, shopId))
        onChange()
      } catch (e) {
        console.error('[RT] history error:', e)
      }
    })

    // ── Measurements ─────────────────────────────────────────────
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'measurements',
      filter: `shop_id=eq.${shopId}`,
    }, async (payload: any) => {
      try {
        const row = payload.new ?? payload.old
        if (!row?.id) return

        if (payload.eventType === 'DELETE' || row.deleted_at) {
          await db.measurements.update(row.id, { _deleted: 1 as const, _synced: 1 as const })
        } else {
          await db.measurements.put(mapMeasurement(row))
        }
        onChange()
      } catch (e) {
        console.error('[RT] measurements error:', e)
      }
    })

    .subscribe((status: string) => {
      console.log(`[RT] Channel ${channelName}: ${status}`)
    })

  return {
    unsubscribe: () => {
      ;(supabase as any).removeChannel(channel)
      console.log(`[RT] Unsubscribed from ${channelName}`)
    },
  }
}