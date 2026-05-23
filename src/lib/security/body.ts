// src/lib/security/body.ts
// Server-only: parse JSON body with size validation (not spoofable like content-length header)

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024 // 5MB

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export async function parseBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<ParseResult<T>> {
  let text: string
  try {
    text = await req.text()
  } catch {
    return { ok: false, error: 'Request body read failed', status: 400 }
  }

  if (text.length > maxBytes) {
    return { ok: false, error: `Request too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`, status: 413 }
  }

  if (!text) {
    return { ok: false, error: 'Request body required', status: 400 }
  }

  try {
    return { ok: true, data: JSON.parse(text) as T }
  } catch {
    return { ok: false, error: 'Invalid JSON in request body', status: 400 }
  }
}
