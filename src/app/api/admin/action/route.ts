// src/app/api/admin/action/route.ts
import { NextRequest, NextResponse } from 'next/server'

const SB_URL  = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const SB_HDRS = () => ({
  'Content-Type':  'application/json',
  'apikey':        SB_KEY(),
  'Authorization': `Bearer ${SB_KEY()}`,
  'Prefer':        'return=minimal',
})

async function sbPatch(table: string, filter: string, data: object): Promise<void> {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}`, {
    method:  'PATCH',
    headers: SB_HDRS(),
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${await res.text()}`)
}

async function sbPost(table: string, data: object, prefer = 'return=minimal'): Promise<void> {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...SB_HDRS(), 'Prefer': prefer },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`)
}

async function sbUpsert(table: string, data: object, onConflict: string): Promise<void> {
  const res = await fetch(
    `${SB_URL()}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method:  'POST',
      headers: { ...SB_HDRS(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body:    JSON.stringify(data),
    }
  )
  if (!res.ok) throw new Error(`UPSERT ${table}: ${res.status} ${await res.text()}`)
}

async function logAction(action: string, targetId: string, shopId: string, details: object) {
  try {
    await sbPost('admin_audit_log', {
      action,
      target_type:  action.includes('shop_') ? 'shop' : 'subscription',
      target_id:    targetId,
      shop_id:      shopId,
      details,
      performed_at: new Date().toISOString(),
    })
    console.log('[Admin Action] Logged:', action, shopId)
  } catch (e) {
    console.error('[Admin Action] Audit log failed (non-fatal):', e)
  }
}

function nextExpiry(cycle: string | undefined, planId = 'professional') {
  if (planId === 'starter') return null
  const d = new Date()
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else if (cycle === 'lifetime') d.setFullYear(d.getFullYear() + 100)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 500 }
    )
  }

  const body = await req.json()
  const { action } = body

  try {
    switch (action) {

      case 'set_plan': {
        const { shopId, planId, cycle } = body
        if (!shopId || !planId) {
          return NextResponse.json({ error: 'shopId and planId required' }, { status: 400 })
        }

        const now = new Date().toISOString()

        const expiresAt = nextExpiry(cycle, planId)

        // Update subscription
        await sbUpsert('subscriptions', {
          shop_id:       shopId,
          plan:          planId,
          billing_cycle: planId === 'starter' ? null : (cycle ?? 'monthly'),
          status:        'active',
          expires_at:    expiresAt,
          grace_ends_at: null,
          cancelled_at:  null,
          trial_ends_at: null,
          updated_at:    now,
        }, 'shop_id')

        // Update subscription plan only. Shop account activation is controlled separately.
        await sbPatch('shops', `id=eq.${shopId}`, {
          plan:       planId,
          updated_at: now,
        })

        // Audit log
        await logAction('manual_plan_change', shopId, shopId, {
          plan: planId, cycle, expires_at: expiresAt,
        })

        console.log('[Admin Action] Plan changed:', shopId, '->', planId, cycle)
        return NextResponse.json({ success: true })
      }

      case 'activate_payment': {
        const { paymentId, shopId, planId, cycle, amountPkr } = body
        if (!paymentId || !shopId || !planId) {
          return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const now = new Date().toISOString()

        const expiresAt = (() => {
          const d = new Date()
          if (cycle === 'monthly')  d.setMonth(d.getMonth() + 1)
          if (cycle === 'yearly')   d.setFullYear(d.getFullYear() + 1)
          if (cycle === 'lifetime') d.setFullYear(d.getFullYear() + 100)
          return d.toISOString()
        })()

        // Activate subscription
        await sbUpsert('subscriptions', {
          shop_id:          shopId,
          plan:             planId,
          billing_cycle:    cycle,
          status:           'active',
          expires_at:       expiresAt,
          grace_ends_at:    null,
          cancelled_at:     null,
          trial_ends_at:    null,
          amount_pkr:       amountPkr,
          updated_at:       now,
        }, 'shop_id')

        // Mark payment completed
        await sbPatch('subscription_payments', `id=eq.${paymentId}`, {
          status:  'completed',
          paid_at: now,
        })

        // Update subscription plan only. Shop account activation is controlled separately.
        await sbPatch('shops', `id=eq.${shopId}`, {
          plan: planId, updated_at: now,
        })

        // Audit log
        await logAction('activate_subscription', paymentId, shopId, {
          plan: planId, cycle, amount: amountPkr,
        })

        return NextResponse.json({ success: true, expiresAt })
      }

      case 'reject_payment': {
        const { paymentId, shopId, reason } = body
        if (!paymentId) {
          return NextResponse.json({ error: 'paymentId required' }, { status: 400 })
        }

        // Get existing receipt_data
        const existingRes = await fetch(
          `${SB_URL()}/rest/v1/subscription_payments?id=eq.${paymentId}&select=receipt_data`,
          { headers: { 'apikey': SB_KEY(), 'Authorization': `Bearer ${SB_KEY()}` } }
        )
        const existing = await existingRes.json()
        const receiptData = existing?.[0]?.receipt_data ?? {}

        await sbPatch('subscription_payments', `id=eq.${paymentId}`, {
          status: 'failed',
          receipt_data: {
            ...receiptData,
            rejection_reason: reason ?? 'Admin rejected',
            rejected_at:      new Date().toISOString(),
          },
        })

        await logAction('reject_payment', paymentId, shopId ?? paymentId, { reason })

        return NextResponse.json({ success: true })
      }

      case 'deactivate_shop': {
        const { shopId, reason } = body
        if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

        await sbPatch('shops', `id=eq.${shopId}`, {
          is_active: false,
          updated_at: new Date().toISOString(),
        })

        await logAction('shop_deactivated', shopId, shopId, { reason })
        return NextResponse.json({ success: true })
      }

      case 'activate_shop': {
        const { shopId, reason } = body
        if (!shopId) return NextResponse.json({ error: 'shopId required' }, { status: 400 })

        const now = new Date().toISOString()

        await sbPatch('shops', `id=eq.${shopId}`, {
          is_active: true,
          updated_at: now,
        })

        await logAction('shop_activated', shopId, shopId, { reason })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    console.error('[Admin Action API] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
