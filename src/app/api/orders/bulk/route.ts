// Bulk order operations: update status, assign karigar
import { NextRequest, NextResponse } from 'next/server'
import { verifyMemberSessionToken, MEMBER_SESSION_COOKIE } from '@/lib/auth/session'
import { sbFetch } from '@/lib/supabase/service'
import { validate } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const bulkUpdateSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['status', 'assign', 'unassign']),
  value: z.string().optional(), // new status or memberId
})

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
    const session = token ? verifyMemberSessionToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { shopId } = session

    const parsed = await validate(bulkUpdateSchema, req)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { orderIds, action, value } = parsed.data
    const now = new Date().toISOString()

    // Verify all orders belong to this shop before making changes
    const verifyRes = await sbFetch(
      `orders?shop_id=eq.${encodeURIComponent(shopId)}&id=in.(${orderIds.map(encodeURIComponent).join(',')})&select=id&limit=50`
    )
    if (!verifyRes.ok) {
      return NextResponse.json({ error: 'Failed to verify orders' }, { status: 500 })
    }
    const verified = await verifyRes.json()
    if (!verified?.length) {
      return NextResponse.json({ error: 'No valid orders found for this shop' }, { status: 403 })
    }

    const validIds = verified.map((o: { id: string }) => o.id)
    const idsIn = validIds.map(encodeURIComponent).join(',')

    let updated = 0
    const errors: string[] = []

    if (action === 'status') {
      if (!value) return NextResponse.json({ error: 'Status value required' }, { status: 400 })
      try {
        const res = await sbFetch(`orders?id=in.(${idsIn})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: value,
            updated_at: now,
            ...(value === 'delivered' ? { delivered_at: now } : {}),
          }),
        })
        if (res.ok) updated = validIds.length
        else errors.push(`Status update failed`)
      } catch (e) {
        errors.push(`Status update error: ${String(e)}`)
      }

      // Insert status history records in parallel
      try {
        const historyInserts = validIds.map((orderId: string) =>
          sbFetch('order_status_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({
              order_id: orderId,
              shop_id: shopId,
              new_status: value,
              old_status: 'updated_via_bulk',
              changed_by: session.memberId,
              changed_at: now,
            }),
          }).catch(() => null)
        )
        await Promise.all(historyInserts)
      } catch { /* non-fatal */ }
    }

    if (action === 'assign') {
      if (!value) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
      // Fetch member name for assignee display
      let assigneeName = ''
      try {
        const memberRes = await sbFetch(`team_members?id=eq.${encodeURIComponent(value)}&select=name&limit=1`)
        if (memberRes.ok) {
          const memberData = await memberRes.json()
          assigneeName = memberData?.[0]?.name ?? ''
        }
      } catch { /* assignee name is cosmetic */ }

      try {
        const res = await sbFetch(`orders?id=in.(${idsIn})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            assigned_to: value,
            assigned_to_name: assigneeName || null,
            updated_at: now,
          }),
        })
        if (res.ok) updated = validIds.length
        else errors.push(`Assign update failed`)
      } catch (e) {
        errors.push(`Assign error: ${String(e)}`)
      }
    }

    if (action === 'unassign') {
      try {
        const res = await sbFetch(`orders?id=in.(${idsIn})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            assigned_to: null,
            assigned_to_name: null,
            updated_at: now,
          }),
        })
        if (res.ok) updated = validIds.length
        else errors.push(`Unassign failed`)
      } catch (e) {
        errors.push(`Unassign error: ${String(e)}`)
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated,
      totalRequested: orderIds.length,
      validIds,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e) {
    logger.error('orders-bulk', 'Unexpected error', e)
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 })
  }
}
