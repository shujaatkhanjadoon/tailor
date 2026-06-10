import { db } from './schema'

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function isQuotaError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') return true
  if (e instanceof Error) {
    const msg = e.message.toLowerCase()
    if (msg.includes('quota') || msg.includes('quotaexceeded') || msg.includes('storage full')) return true
  }
  return false
}

/** Display a banner when IndexedDB storage is full. */
function showQuotaWarning() {
  if (typeof document === 'undefined') return
  // Avoid showing multiple banners
  if (document.getElementById('quota-warning')) return
  const banner = document.createElement('div')
  banner.id = 'quota-warning'
  banner.className =
    'fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap cursor-pointer'
  banner.textContent = '⚠️ Storage full — tap to clear old data'
  banner.addEventListener('click', () => {
    // Open settings where user can manage data
    window.location.href = '/settings'
    banner.remove()
  })
  document.body.appendChild(banner)
  setTimeout(() => banner.remove(), 15000)
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
      try {
        await dexieCache(records)
      } catch (e) {
        if (isQuotaError(e)) showQuotaWarning()
      }
      return records
    } catch (err) {
      console.warn(`[Offline] ${label} — Supabase read failed, falling back to Dexie:`, err)
    }
  }
  try {
    return dexieRead()
  } catch (e) {
    if (isQuotaError(e)) showQuotaWarning()
    throw e
  }
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
      if (record) {
        try {
          await dexieCache(record)
        } catch (e) {
          if (isQuotaError(e)) showQuotaWarning()
        }
      }
      return record
    } catch (err) {
      console.warn(`[Offline] ${label} — Supabase read failed, falling back to Dexie:`, err)
    }
  }
  try {
    return dexieRead()
  } catch (e) {
    if (isQuotaError(e)) showQuotaWarning()
    throw e
  }
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
      try {
        await dexieWrite(cached)
      } catch (e) {
        if (isQuotaError(e)) showQuotaWarning()
      }
      return result
    } catch (err) {
      console.warn(`[Offline] ${label} — Supabase write failed, queuing locally:`, err)
    }
  }
  try {
    await dexieWrite(forDexie)
  } catch (e) {
    if (isQuotaError(e)) showQuotaWarning()
  }
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
