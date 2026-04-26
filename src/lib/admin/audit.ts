// src/lib/admin/audit.ts
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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
  | 'admin_logout'

export async function logAdminAction(
  action:      AuditAction,
  targetType:  string,
  targetId:    string,
  shopId?:     string,
  details?:    Record<string, unknown>
): Promise<void> {
  try {
    await adminSupabase.from('admin_audit_log').insert({
      action,
      target_type:  targetType,
      target_id:    targetId,
      shop_id:      shopId ?? null,
      details:      details ?? {},
      performed_at: new Date().toISOString(),
    })
  } catch (e) {
    // Never throw — audit log failure should not block the action
    console.error('[Audit] Log failed:', e)
  }
}

export async function getAuditLog(limit = 100) {
  const { data } = await adminSupabase
    .from('admin_audit_log')
    .select(`*, shops(shop_name, owner_phone)`)
    .order('performed_at', { ascending: false })
    .limit(limit)
  return data ?? []
}