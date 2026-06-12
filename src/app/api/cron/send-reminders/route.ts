// src/app/api/cron/send-reminders/route.ts
// Sends WhatsApp reminders for expiring subscriptions — incremental, max 50 per run

import { NextRequest, NextResponse } from 'next/server'
import { sbGet, sbPost, type Row } from '@/lib/supabase/service'
import { mapConcurrent } from '@/lib/concurrent'
import { logger } from '@/lib/logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mydarzi.vercel.app'

const BATCH_SIZE = 50

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
      `*Professional plan:* Rs. 499/month sirf!\n` +
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
    const reminderDays = [5, 3, 1]
    const allTasks: Array<{
      sub: Row & { isTrial: boolean }
      days: number
      reminderKey: string
      today: string
    }> = []

    const today = now.toISOString().split('T')[0]

    for (const days of reminderDays) {
      const targetDate  = new Date(now)
      targetDate.setDate(targetDate.getDate() + days)
      const targetStart = new Date(targetDate)
      targetStart.setHours(0, 0, 0, 0)
      const targetEnd   = new Date(targetDate)
      targetEnd.setHours(23, 59, 59, 999)

      const [trialExpiring, paidExpiring] = await Promise.all([
        sbGet(
          `subscriptions?select=id,shop_id,plan,status,trial_ends_at` +
          `&status=eq.trialing` +
          `&trial_ends_at=gte.${encodeURIComponent(targetStart.toISOString())}` +
          `&trial_ends_at=lte.${encodeURIComponent(targetEnd.toISOString())}` +
          `&limit=${BATCH_SIZE}`
        ),
        sbGet(
          `subscriptions?select=id,shop_id,plan,status,expires_at` +
          `&status=in.(active)` +
          `&expires_at=not.is.null` +
          `&expires_at=gte.${encodeURIComponent(targetStart.toISOString())}` +
          `&expires_at=lte.${encodeURIComponent(targetEnd.toISOString())}` +
          `&limit=${BATCH_SIZE}`
        ),
      ])

      for (const s of (trialExpiring ?? [])) {
        allTasks.push({ sub: { ...s, isTrial: true }, days, reminderKey: `reminder_${days}d_${today}`, today })
      }
      for (const s of (paidExpiring ?? [])) {
        allTasks.push({ sub: { ...s, isTrial: false }, days, reminderKey: `reminder_${days}d_${today}`, today })
      }
    }

    const errors = await mapConcurrent(allTasks, async (task) => {
      const { sub, days, reminderKey } = task

      const shops = await sbGet(
        `shops?select=shop_name,owner_phone&id=eq.${sub.shop_id}&limit=1`
      )
      const shop = shops?.[0]
      if (!shop?.owner_phone) { results.skipped++; return }

      const existingReminders = await sbGet(
        `subscription_payments?select=id` +
        `&shop_id=eq.${sub.shop_id}` +
        `&gateway_tx_id=eq.${encodeURIComponent(reminderKey)}` +
        `&status=eq.pending&limit=1`
      )
      if (existingReminders.length > 0) { results.skipped++; return }

      const planName  = sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)
      const message   = buildReminderMessage(shop.shop_name, planName, days, sub.isTrial)
      const cleanPhone = `92${shop.owner_phone.replace(/^0/, '').replace(/\D/g, '')}`
      const waLink    = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`

      // Send email reminder to shop owner (non-blocking)
      try {
        const { sendShopOwnerAdminActionEmail } = await import('@/lib/security/email-otp')
        const emailTitle = sub.isTrial
          ? `Trial ending in ${days} day${days > 1 ? 's' : ''}`
          : `Subscription expiring in ${days} day${days > 1 ? 's' : ''}`
        const emailMessage = sub.isTrial
          ? `Aapka free trial ${days} din mein khatam ho raha hai. Features continue rakhne ke liye upgrade karein.`
          : `Aapka ${planName} plan ${days} din mein expire ho raha hai. Renew karne ke liye billing page visit karein.`
        await sendShopOwnerAdminActionEmail({
          shopId: sub.shop_id,
          action: 'subscription_reminder',
          title: emailTitle,
          message: emailMessage,
          details: [
            ['Plan', planName],
            ['Days Left', String(days)],
            ...(sub.isTrial ? [['Type', 'Trial'] as [string, unknown]] : []),
          ],
        })
      } catch { /* non-fatal */ }

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
      }).catch((insertErr: unknown) => {
        const errMsg = insertErr instanceof Error ? insertErr.message : String(insertErr)
        if (errMsg.includes('409') || errMsg.includes('23505')) {
          results.skipped++
          return
        }
        throw new Error(`Insert failed: ${errMsg}`)
      })

      results.remindersQueued++
    })

    results.errors = errors

    return NextResponse.json({ success: true, ...results })

  } catch (e) {
    logger.error('send-reminders', 'error', e)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
