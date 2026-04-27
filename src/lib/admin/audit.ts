// src/lib/admin/audit.ts
'use server'

export type AuditAction =
  | 'activate_subscription'
  | 'reject_payment'
  | 'manual_plan_change'
  | 'shop_deactivated'
  | 'shop_activated'
  | 'reminder_sent'
  | 'subscription_cancelled'
  | 'admin_login'

const getHeaders = () => ({
  'Content-Type':  'application/json',
  'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY!,
  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
  'Prefer':        'return=minimal',
})

export async function logAdminAction(
  action:     AuditAction,
  targetType: string,
  targetId:   string,
  shopId?:    string,
  details?:   Record<string, unknown>
): Promise<void> {
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/admin_audit_log`,
      {
        method:  'POST',
        headers: getHeaders(),
        body:    JSON.stringify({
          action,
          target_type:  targetType,
          target_id:    targetId,
          shop_id:      shopId ?? null,
          details:      details ?? {},
          performed_at: new Date().toISOString(),
        }),
      }
    )
  } catch (e) {
    // Never throw — audit failure must not block the action
    console.error('[Audit] Log failed:', e)
  }
}

export async function getAuditLog(limit = 100) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/admin_audit_log?order=performed_at.desc&limit=${limit}&select=*`,
      {
        headers: {
          'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}