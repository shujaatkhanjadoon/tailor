// src/lib/db/sync.ts
import { db } from './schema'
import { Table } from 'dexie'                        // ← add this import

type SyncOperation = 'create' | 'update' | 'delete'

export const syncQueue = {
  push(op: SyncOperation, table: string, recordId: string, payload: object) {
    db.syncQueue.add({
      operation: op,
      table,
      recordId,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      retries: 0,
    }).catch(console.error)
  },

  async flush(): Promise<void> {
    if (!navigator.onLine) return

    const pending = await db.syncQueue
      .orderBy('createdAt')
      .filter(q => q.retries < 5)
      .toArray()

    if (pending.length === 0) return

    for (const item of pending) {
      try {
        console.log(`[Sync] ${item.operation} ${item.table}/${item.recordId}`)

        // ── FIX: cast to Table<any> after verifying it's a Dexie Table ──
        const tableInstance = (db as unknown as Record<string, unknown>)[item.table]
        if (
          tableInstance &&
          typeof tableInstance === 'object' &&
          'update' in tableInstance
        ) {
          await (tableInstance as Table<any>).update(item.recordId, { _synced: 1 })
        }
        // ────────────────────────────────────────────────────────────────

        if (item.id !== undefined) {
          await db.syncQueue.delete(item.id)
        }
      } catch (err) {
        console.error(`[Sync] Failed ${item.table}/${item.recordId}:`, err)
        if (item.id !== undefined) {
          await db.syncQueue.update(item.id, {
            retries: item.retries + 1,
            lastError: String(err),
          })
        }
      }
    }
  },

  async getPendingCount(): Promise<number> {
    return db.syncQueue.count()
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online — flushing queue...')
    syncQueue.flush()
  })
}