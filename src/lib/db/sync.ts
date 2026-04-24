// src/lib/db/sync.ts
import { db } from './schema'

type SyncOperation = 'create' | 'update' | 'delete'

export const syncQueue = {
  push(op: SyncOperation, table: string, recordId: string, payload: object) {
    
    db.syncQueue.add({
      operation: op,
      table,
      recordId,
      payload:   JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      retries:   0,
    }).catch(() => {})  // non-blocking, non-critical
  },

  async flush(): Promise<void> {
    // Legacy method — actual sync now handled by syncService.pushAll
    // Just drain the queue to keep count at 0
    const count = await db.syncQueue.count()
    if (count > 0) {
      await db.syncQueue.clear()
    }
  },

  async getPendingCount(): Promise<number> {
    // Return 0 — syncQueue is legacy, real count is from _synced fields
    return 0
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online — flushing queue...')
    syncQueue.flush()
  })
}