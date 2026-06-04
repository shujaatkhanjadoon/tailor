// src/lib/admin/audit.ts
'use server'

import { sbFetch } from '@/lib/supabase/service'

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
  try {
    const res = await sbFetch('admin_audit_log', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        action,
        target_type:  targetType,
        target_id:    targetId,
        shop_id:      shopId ?? null,
        details:      details ?? {},
        performed_at: new Date().toISOString(),
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Audit] Insert failed:', res.status, errText)
    } else {
      console.log('[Audit] ✓ logged:', action, targetType, targetId)
    }
  } catch (e) {
    // Never throw — audit failure must not block the admin action
    console.error('[Audit] logAdminAction error (non-fatal):', String(e))
  }
}

export async function getAuditLog(limit = 200): Promise<any[]> {
  try {
    const res = await sbFetch(
      `admin_audit_log?order=performed_at.desc&limit=${encodeURIComponent(String(limit))}&select=*`
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
