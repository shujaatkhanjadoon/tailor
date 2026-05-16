// src/app/api/cron/send-reminders/route.ts
// Sends WhatsApp reminders for expiring subscriptions
// Uses click-to-chat links stored in a reminders queue
// (Full WhatsApp Business API can be added later)

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mydarzi.vercel.app'

function buildReminderMessage(
  shopName:  string,
  planName:  string,
  daysLeft:  number,
  isTrial:   boolean,
): string {
  const urgency = daysLeft <= 1 ? '🚨 URGENT' : daysLeft <= 3 ? '⚠️' : '⏰'

  if (isTrial) {
    return (
      `${urgency} Assalam o Alaikum *${shopName}*!\n\n` +
      `Aapka *Meradarzi* free trial sirf *${daysLeft} din* mein khatam ho raha hai.\n\n` +
      `Trial ke baad *Starter* (free) plan par aa jayenge:\n` +
      `❌ Karigar accounts band\n` +
      `❌ Order tracking band\n` +
      `❌ Cloud sync band\n\n` +
      `📱 Abhi upgrade karein:\n` +
      `${APP_URL}/billing/upgrade\n\n` +
      `*Professional plan:* Rs. 999/month sirf!\n` +
      `Raast se pay karein — bilkul free transaction! ⚡\n\n` +
      `Shukriya! 🙏`
    )
  }

  return (
    `${urgency} Assalam o Alaikum *${shopName}*!\n\n` +
    `Aapka *${planName}* plan *${daysLeft} din* mein expire ho raha hai.\n\n` +
    `Renew karne ke liye:\n` +
    `${APP_URL}/billing/upgrade\n\n` +
    `Raast se pay karein — zero fee! ⚡\n\n` +
    `Koi masla ho to reply karein. Shukriya! 🙏`
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now     = new Date()
  const results = {
    remindersQueued: 0,
    skipped:         0,
    errors:          [] as string[],
  }

  try {
    // Find subscriptions expiring in 5, 3, or 1 days
    const reminderDays = [5, 3, 1]

    for (const days of reminderDays) {
      const targetDate  = new Date(now)
      targetDate.setDate(targetDate.getDate() + days)
      const targetStart = new Date(targetDate)
      targetStart.setHours(0, 0, 0, 0)
      const targetEnd   = new Date(targetDate)
      targetEnd.setHours(23, 59, 59, 999)

      // Check both trial and paid expirations
      const [{ data: trialExpiring }, { data: paidExpiring }] = await Promise.all([
        adminSupabase
          .from('subscriptions')
          .select('id, shop_id, plan, status, trial_ends_at')
          .eq('status', 'trialing')
          .gte('trial_ends_at', targetStart.toISOString())
          .lte('trial_ends_at', targetEnd.toISOString()),
        adminSupabase
          .from('subscriptions')
          .select('id, shop_id, plan, status, expires_at')
          .in('status', ['active'])
          .not('expires_at', 'is', null)
          .gte('expires_at', targetStart.toISOString())
          .lte('expires_at', targetEnd.toISOString()),
      ])

      const allExpiring = [
        ...(trialExpiring ?? []).map(s => ({ ...s, isTrial: true })),
        ...(paidExpiring  ?? []).map(s => ({ ...s, isTrial: false })),
      ]

      for (const sub of allExpiring) {
        // Get shop details
        const { data: shop } = await adminSupabase
          .from('shops')
          .select('shop_name, owner_phone')
          .eq('id', sub.shop_id)
          .single()

        if (!shop?.owner_phone) { results.skipped++; continue }

        // Check if reminder already sent today for this shop + days combo
        const reminderKey = `reminder_${days}d_${new Date().toISOString().split('T')[0]}`
        const { data: alreadySent } = await adminSupabase
          .from('subscription_payments')
          .select('id')
          .eq('shop_id', sub.shop_id)
          .eq('gateway_tx_id', reminderKey)
          .eq('status', 'pending')
          .maybeSingle()

        if (alreadySent) { results.skipped++; continue }

        // Build WhatsApp message
        const planName  = sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)
        const message   = buildReminderMessage(shop.shop_name, planName, days, sub.isTrial)
        const cleanPhone = `92${shop.owner_phone.replace(/^0/, '').replace(/\D/g, '')}`
        const waLink    = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`

        // Store reminder in DB as a log record
        // In production: call WhatsApp Business API here
        const { error: insertError } = await adminSupabase
          .from('subscription_payments')
          .insert({
            shop_id:       sub.shop_id,
            plan:          sub.plan,
            billing_cycle: 'monthly',
            amount_pkr:    0,
            method:        'reminder',
            gateway_tx_id: reminderKey,
            status:        'pending',
            receipt_data:  {
              type:       'reminder',
              days_left:  days,
              wa_link:    waLink,
              message:    message,
              sent_at:    now.toISOString(),
            },
          })
        if (insertError) {
          if (insertError.code === '23505') {
            results.skipped++
            continue
          }
          throw insertError
        }

        // Log the WhatsApp link so admin can send manually
        console.log(`[Cron] Reminder ${days}d: ${shop.shop_name} → ${waLink}`)
        results.remindersQueued++
      }
    }

    console.log('[Cron] send-reminders complete:', results)
    return NextResponse.json({ success: true, ...results })

  } catch (e) {
    console.error('[Cron] send-reminders error:', e)
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
