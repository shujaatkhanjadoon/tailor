// src/lib/db/sync.ts
// Legacy syncQueue API. App records are Supabase-backed now, so this stays no-op.

type SyncOperation = 'create' | 'update' | 'delete'

export const syncQueue = {
  // No-op — pushAll handles sync by querying _synced=0 fields directly
  push(_op: SyncOperation, _table: string, _recordId: string, _payload: object) {
    // intentionally empty — do not write to syncQueue
  },

  async flush(): Promise<void> {
    // intentionally empty
  },

  // Always returns 0 — real count is from _synced=0 fields
  async getPendingCount(): Promise<number> {
    return 0
  },
}
