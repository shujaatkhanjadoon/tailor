// src/lib/db/sync.ts
import { db } from './schema'

// syncQueue is kept as a legacy stub only.
// Actual sync is handled by syncService.pushAll() in sync-service.ts
// which queries _synced=0 directly from source tables.

type SyncOperation = 'create' | 'update' | 'delete'

export const syncQueue = {
  // No-op — pushAll handles sync by querying _synced=0 fields directly
  push(_op: SyncOperation, _table: string, _recordId: string, _payload: object) {
    // intentionally empty — do not write to syncQueue
  },

  async flush(): Promise<void> {
    // Drain legacy entries
    try {
      const count = await db.syncQueue.count()
      if (count > 0) {
        await db.syncQueue.clear()
        console.log(`[SyncQueue] Cleared ${count} legacy entries`)
      }
    } catch { /* ignore */ }
  },

  // Always returns 0 — real count is from _synced=0 fields
  async getPendingCount(): Promise<number> {
    return 0
  },
}

// Clear legacy queue entries on startup
if (typeof window !== 'undefined') {
  db.syncQueue.clear().catch(() => {})
}