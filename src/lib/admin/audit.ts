// src/lib/admin/audit.ts
'use server'

// ── REST-based audit logger — avoids createClient timeout ─────────

function getSupabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')

  return {
    url,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Prefer':        'return=minimal',
    },
  }
}

export type AuditAction =
  | 'activate_subscription'
  | 'reject_payment'
  | 'manual_plan_change'
  | 'shop_deactivated'
  | 'shop_activated'
  | 'shop_deleted'
  | 'reminder_sent'
  | 'subscription_cancelled'
  | 'admin_login'

export async function logAdminAction(
  action:      AuditAction,
  targetType:  string,
  targetId:    string,
  shopId?:     string,
  details?:    Record<string, unknown>
): Promise<void> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  try {
    const { url, headers } = getSupabaseHeaders()

    const body = JSON.stringify({
      action,
      target_type:  targetType,
      target_id:    targetId,
      shop_id:      shopId ?? null,
      details:      details ?? {},
      performed_at: new Date().toISOString(),
    })

    const res = await fetch(`${url}/rest/v1/admin_audit_log`, {
      method: 'POST',
      headers,
      body,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Audit] Insert failed:', res.status, errText)
    } else {
      console.log('[Audit] ✓ logged:', action, targetType, targetId)
    }
  } catch (e) {
    // Never throw — audit failure must not block the admin action
    const hostname = sbUrl ? new URL(sbUrl).hostname : 'SUPABASE_URL_NOT_SET'
    console.error('[Audit] logAdminAction error (non-fatal):', String(e), `(hostname: ${hostname})`)
  }
}

export async function getAuditLog(limit = 200): Promise<any[]> {
  try {
    const { url, headers } = getSupabaseHeaders()

    const encodedLimit = encodeURIComponent(String(limit))
    const res = await fetch(
      `${url}/rest/v1/admin_audit_log?order=performed_at.desc&limit=${encodedLimit}&select=*`,
      { headers: { ...headers, 'Prefer': '' } }
    )

    if (!res.ok) {
      console.error('[Audit] getAuditLog failed:', res.status)
      return []
    }

    return res.json()
  } catch (e) {
    console.error('[Audit] getAuditLog error:', e)
    return []
  }
}