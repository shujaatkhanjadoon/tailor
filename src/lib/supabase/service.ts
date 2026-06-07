const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

export function requireServiceKey() {
  if (!SB_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  }
  return { url: SB_URL, key: SB_KEY, headers: HEADERS }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRetryableFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const cause = (error as { cause?: { code?: string } })?.cause
  return (
    message.includes('fetch failed') ||
    message.includes('Connect Timeout') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
  )
}

export async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { headers } = requireServiceKey()
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
        signal: AbortSignal.timeout(60000),
      })

      if (res.status >= 500 && attempt < 3) {
        await sleep(500 * attempt)
        continue
      }

      return res
    } catch (error) {
      lastError = error
      if (attempt >= 3 || !isRetryableFetchError(error)) break
      await sleep(700 * attempt)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Supabase request failed')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>
export type TableRow<T> = T extends { Row: infer R } ? R : Row

export async function sbGet<T = Row>(path: string): Promise<T[]> {
  const res = await sbFetch(path)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SELECT failed (${res.status}): ${err}`)
  }
  return res.json()
}

export async function sbPost(table: string, data: object): Promise<Row | null> {
  const res = await sbFetch(table, {
    method:  'POST',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`INSERT ${table} failed (${res.status}): ${err}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

export async function sbPatch(path: string, data: object): Promise<void> {
  const res = await sbFetch(path, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PATCH ${path} failed (${res.status}): ${err}`)
  }
}

export async function sbDelete(path: string): Promise<void> {
  const res = await sbFetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DELETE ${path} failed (${res.status}): ${err}`)
  }
}

export async function sbUpsertById(table: string, data: Record<string, unknown>): Promise<void> {
  const res = await sbFetch(`${table}?on_conflict=id`, {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`UPSERT ${table} failed (${res.status}): ${err}`)
  }
}

export async function sbUpsertByShopId(table: string, data: object): Promise<void> {
  const res = await sbFetch(`${table}?on_conflict=shop_id`, {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`UPSERT ${table} failed (${res.status}): ${err}`)
  }
}
