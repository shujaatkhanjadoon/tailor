import { db } from './schema'

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Perform a Supabase read with offline fallback.
 * If online: try Supabase, cache results in Dexie on success.
 * If offline or Supabase fails: read from Dexie.
 */
export async function offlineRead<T extends { id: string; _synced?: 0 | 1 }>(
  label: string,
  supabaseRead: () => Promise<T[]>,
  dexieRead: () => Promise<T[]>,
  dexieCache: (records: T[]) => Promise<void>,
): Promise<T[]> {
  if (isOnline()) {
    try {
      const records = await supabaseRead()
      await dexieCache(records).catch(() => {})
      return records
    } catch (err) {
      console.warn(`[Offline] ${label} — Supabase read failed, falling back to Dexie:`, err)
    }
  }
  return dexieRead()
}

/**
 * Perform a Supabase read for a single record with offline fallback.
 */
export async function offlineReadOne<T extends { id: string; _synced?: 0 | 1 }>(
  label: string,
  supabaseRead: () => Promise<T | undefined>,
  dexieRead: () => Promise<T | undefined>,
  dexieCache: (record: T) => Promise<void>,
): Promise<T | undefined> {
  if (isOnline()) {
    try {
      const record = await supabaseRead()
      if (record) await dexieCache(record).catch(() => {})
      return record
    } catch (err) {
      console.warn(`[Offline] ${label} — Supabase read failed, falling back to Dexie:`, err)
    }
  }
  return dexieRead()
}

/**
 * Perform a Supabase write with offline queuing.
 * If online: write to Supabase, cache in Dexie with _synced: 1.
 * If offline: write to Dexie with _synced: 0 and no updatedAt change (so sync
 * engine can detect it as pending).
 */
export async function offlineWrite<T extends { id: string; _synced?: 0 | 1; _deleted?: 0 | 1; updatedAt?: string }>(
  label: string,
  supabaseWrite: () => Promise<T>,
  dexieWrite: (record: T) => Promise<void>,
  record: T,
): Promise<T> {
  const forDexie = { ...record, _synced: 0 as const }
  if (isOnline()) {
    try {
      const result = await supabaseWrite()
      const cached = { ...result, _synced: 1 as const }
      await dexieWrite(cached).catch(() => {})
      return result
    } catch (err) {
      console.warn(`[Offline] ${label} — Supabase write failed, queuing locally:`, err)
    }
  }
  await dexieWrite(forDexie)
  return forDexie as unknown as T
}

/**
 * Count how many records are pending sync across all tables.
 */
export async function getPendingSyncCount(): Promise<number> {
  let total = 0
  const tables = ['customers', 'orders', 'payments', 'measurements', 'shops', 'teamMembers'] as const
  for (const table of tables) {
    try {
      const t = db[table] as any
      total += await t.where('_synced').equals(0).count()
    } catch {}
  }
  return total
}

export { nowISO }
