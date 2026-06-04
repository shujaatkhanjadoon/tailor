// src/app/api/auth/create-shop/route.ts
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  sendAdminShopRegistrationEmail,
  sendShopOwnerAccountCreated,
  sendShopVerificationAlert,
} from '@/lib/security/email-otp'
import { parseBody } from '@/lib/security/body'
import { getSignupRatelimiter, checkRateLimit, getRateLimitId } from '@/lib/security/rate-limit'
import { sbFetch, sbGet, sbPost, sbUpsertById, sbUpsertByShopId } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const limiter = getSignupRatelimiter()
  const rl      = await checkRateLimit(limiter, `signup:${getRateLimitId(req)}`, 'sensitive')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bahut zyada accounts bana rahe hain. 24 ghante mein dobara try karein.' },
      { status: 429 }
    )
  }

  const parsed = await parseBody<{
    shopId?: string; shopName?: string; ownerPhone?: string; ownerName?: string;
    email?: string; city?: string; stateProvince?: string; addressLine?: string;
    postalCode?: string; pinHash?: string;
  }>(req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const {
    shopId, shopName, ownerPhone, ownerName,
    email, city, stateProvince, addressLine, postalCode, pinHash,
  } = parsed.data

  if (!shopId || !shopName || !ownerPhone || !pinHash) {
    return NextResponse.json(
      { error: 'Required fields: shopId, shopName, ownerPhone, pinHash' },
      { status: 400 }
    )
  }

  try {
    // ── 1. Check for duplicate phone ─────────────────────────────
    const existing = await sbGet(
      `team_members?phone=eq.${ownerPhone}&is_active=eq.true&select=id,shop_id&limit=1`
    )
    const existingMember = existing[0]
    if (existingMember && existingMember.shop_id !== shopId) {
      return NextResponse.json(
        { error: 'Yeh phone number pehle se registered hai. Login karein.' },
        { status: 409 }
      )
    }
    const memberId = existingMember?.id ?? crypto.randomUUID()

    // ── 2. Upsert shop (conflict on id) ───────────────────────────
    const normalizedEmail = email ? String(email).toLowerCase().trim() : ''

    if (normalizedEmail) {
      const existingEmail = await sbGet(
        `team_members?email=eq.${encodeURIComponent(normalizedEmail)}` +
        `&is_active=eq.true&select=id,shop_id&limit=1`
      )
      const emailMember = existingEmail[0]
      if (emailMember && emailMember.shop_id !== shopId) {
        return NextResponse.json(
          { error: 'Yeh email pehle se registered hai. Dusri email use karein ya login karein.' },
          { status: 409 }
        )
      }

      const verifiedEmail = await sbGet(
        `email_verifications?phone=eq.${ownerPhone}` +
        `&email=eq.${encodeURIComponent(normalizedEmail)}` +
        `&verified_at=not.is.null&select=id&order=verified_at.desc&limit=1`
      )

      if (verifiedEmail.length === 0) {
        return NextResponse.json(
          { error: 'Email verify nahi hui. Pehle OTP verify karein.' },
          { status: 403 }
        )
      }
    }

    await sbUpsertById('shops', {
      id:                  shopId,
      shop_name:           shopName,
      owner_name:          ownerName ?? shopName,
      owner_phone:         ownerPhone,
      whatsapp_number:     ownerPhone,
      owner_email:         normalizedEmail || null,
      state_province:      stateProvince ?? null,
      city:                city   ?? null,
      address_line:        addressLine ?? null,
      postal_code:         postalCode ?? null,
      plan:                'starter',
      is_active:           true,
      verification_status: 'pending',
      created_at:          new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })

    // ── 3. Insert owner team member (conflict on id) ──────────────
    // Use a fixed ID so we can upsert safely
    await sbUpsertById('team_members', {
      id:             memberId,
      shop_id:        shopId,
      name:           ownerName ?? shopName + ' (Owner)',
      phone:          ownerPhone,
      role:           'owner',
      pin_hash:       pinHash,
      email:          normalizedEmail || null,
      email_verified: normalizedEmail ? true : false,
      is_active:      true,
      failed_attempts: 0,
      joined_at:      new Date().toISOString().split('T')[0],
      created_at:     new Date().toISOString(),
    })

    // ── 4. Upsert subscription (starter) ─────────────────────────
    await sbUpsertByShopId('subscriptions', {
      shop_id:       shopId,
      plan:          'starter',
      status:        'active',
      trial_ends_at: null,
      expires_at:    null,
      billing_cycle: null,
      amount_pkr:    null,
      updated_at:    new Date().toISOString(),
    })

    // ── 5. Upsert shop_usage ──────────────────────────────────────
    await sbUpsertByShopId('shop_usage', {
      shop_id:           shopId,
      orders_this_month: 0,
      customers_total:   0,
      karigar_count:     0,
      storage_used_kb:   0,
      month_year:        new Date().toISOString().slice(0, 7),
      updated_at:        new Date().toISOString(),
    })

    // ── 6. Insert verification request ───────────────────────────
    // Use POST (not upsert) — shop definitely exists now
    try {
      await sbPost('shop_verification_requests', {
        shop_id:      shopId,
        owner_name:   ownerName ?? shopName,
        owner_phone:  ownerPhone,
        owner_email:  normalizedEmail || null,
        state_province: stateProvince ?? null,
        city:         city  ?? null,
        status:       'pending',
        requested_at: new Date().toISOString(),
      })
    } catch (verifErr) {
      // Non-fatal — shop still created successfully
      console.error('[create-shop] Verification request failed (non-fatal):', verifErr)
    }

    // ── 7. Admin notifications (non-blocking) ─────────────────────
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mydarzi.vercel.app'
    const adminWA  = process.env.ADMIN_WHATSAPP

    // Email notification
    sendShopVerificationAlert({
      shopName,
      ownerName:  ownerName ?? shopName,
      ownerPhone,
      ownerEmail: normalizedEmail || 'N/A',
      city,
      shopId,
    }).catch(console.error)

    sendAdminShopRegistrationEmail({
      shopName,
      ownerName: ownerName ?? shopName,
      ownerPhone,
      ownerEmail: normalizedEmail || 'N/A',
      selectedPlan: 'starter',
      registrationDate: new Date().toISOString(),
      city,
      shopId,
    }).catch(console.error)

    sendShopOwnerAccountCreated({
      shopName,
      ownerName:  ownerName ?? shopName,
      ownerPhone,
      ownerEmail: normalizedEmail || undefined,
      city,
    }).catch(console.error)

    // WhatsApp via CallMeBot (if configured)
    // NOTE: CallMeBot API requires the key as a query param (API design constraint).
    // Key is sent over HTTPS only and never logged. Accepted risk per audit H5.
    const callMeBotKey = process.env.CALLMEBOT_API_KEY
    if (callMeBotKey && adminWA) {
      const msg = encodeURIComponent(
        `New Shop Registration!\n\n` +
        `Shop: ${shopName}\n` +
        `Owner: ${ownerName ?? 'N/A'}\n` +
        `Phone: ${ownerPhone}\n` +
        `City: ${city ?? 'N/A'}\n\n` +
        `Review: ${appUrl}/admin/dashboard/shops`
      )
      fetch(
        `https://api.callmebot.com/whatsapp.php` +
        `?phone=${adminWA}&text=${msg}&apikey=${callMeBotKey}`
      ).catch(console.error)
    } else if (adminWA) {
      // Log link for manual sending
      const msg = encodeURIComponent(
        `🆕 New Shop: ${shopName} | ${ownerPhone} | ${city ?? 'N/A'}`
      )
    }

    return NextResponse.json({
      success:  true,
      shopId,
      memberId,
    })

  } catch (e) {
    console.error('[create-shop] error:', e)
    return NextResponse.json(
      { error: 'Account creation failed. Dobara try karein.' },
      { status: 500 }
    )
  }
}
