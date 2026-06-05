// src/app/api/cron/send-reminders/route.ts
// Sends WhatsApp reminders for expiring subscriptions
// Uses click-to-chat links stored in a reminders queue
// (Full WhatsApp Business API can be added later)

import { NextRequest, NextResponse } from 'next/server'
import { sbGet, sbPost, type Row } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

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

export const maxDuration = 300

export async function GET(req: NextRequest) {
  return POST(req)
}
export async function POST(req: NextRequest) {
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
      const trialExpiring = await sbGet(
        `subscriptions?select=id,shop_id,plan,status,trial_ends_at` +
        `&status=eq.trialing` +
        `&trial_ends_at=gte.${encodeURIComponent(targetStart.toISOString())}` +
        `&trial_ends_at=lte.${encodeURIComponent(targetEnd.toISOString())}`
      )
      const paidExpiring = await sbGet(
        `subscriptions?select=id,shop_id,plan,status,expires_at` +
        `&status=in.(active)` +
        `&expires_at=not.is.null` +
        `&expires_at=gte.${encodeURIComponent(targetStart.toISOString())}` +
        `&expires_at=lte.${encodeURIComponent(targetEnd.toISOString())}`
      )

      const allExpiring: Array<Row & { isTrial: boolean }> = [
        ...(trialExpiring ?? []).map(s => ({ ...s, isTrial: true })),
        ...(paidExpiring  ?? []).map(s => ({ ...s, isTrial: false })),
      ]

      for (const sub of allExpiring) {
        // Get shop details
        const shops = await sbGet(
          `shops?select=shop_name,owner_phone&id=eq.${sub.shop_id}&limit=1`
        )
        const shop = shops?.[0]

        if (!shop?.owner_phone) { results.skipped++; continue }

        // Check if reminder already sent today for this shop + days combo
        const reminderKey = `reminder_${days}d_${new Date().toISOString().split('T')[0]}`
        const existingReminders = await sbGet(
          `subscription_payments?select=id` +
          `&shop_id=eq.${sub.shop_id}` +
          `&gateway_tx_id=eq.${encodeURIComponent(reminderKey)}` +
          `&status=eq.pending&limit=1`
        )

        if (existingReminders.length > 0) { results.skipped++; continue }

        // Build WhatsApp message
        const planName  = sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)
        const message   = buildReminderMessage(shop.shop_name, planName, days, sub.isTrial)
        const cleanPhone = `92${shop.owner_phone.replace(/^0/, '').replace(/\D/g, '')}`
        const waLink    = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`

        // Store reminder in DB as a log record
        // In production: call WhatsApp Business API here
        try {
          await sbPost('subscription_payments', {
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
        } catch (insertErr: unknown) {
          const errMsg = insertErr instanceof Error ? insertErr.message : String(insertErr)
          if (errMsg.includes('409') || errMsg.includes('23505')) {
            results.skipped++
            continue
          }
          throw new Error(`Insert failed: ${errMsg}`)
        }

        results.remindersQueued++
      }
    }

    return NextResponse.json({ success: true, ...results })

  } catch (e) {
    logger.error('send-reminders', 'error', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
