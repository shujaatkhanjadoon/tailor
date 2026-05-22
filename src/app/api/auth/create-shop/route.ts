// src/app/api/auth/create-shop/route.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  sendAdminShopRegistrationEmail,
  sendShopOwnerAccountCreated,
  sendShopVerificationAlert,
} from '@/lib/security/email-otp'
import { encryptPIN } from '@/lib/security/pin-crypto'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRetryableFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const cause = (error as { cause?: { code?: string } })?.cause
  return (
    message.includes('fetch failed') ||
    message.includes('Connect Timeout') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
  )
}

async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
        ...init,
        signal: AbortSignal.timeout(30000),
      })

      if (res.status >= 500 && attempt < 3) {
        await sleep(500 * attempt)
        continue
      }

      return res
    } catch (error) {
      lastError = error
      if (attempt >= 3 || !isRetryableFetchError(error)) break
      await sleep(700 * attempt)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Supabase request failed')
}

async function sbPost(table: string, data: object): Promise<any> {
  const res = await sbFetch(table, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`INSERT ${table} failed (${res.status}): ${err}`)
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : rows
}

async function sbUpsertById(table: string, data: object): Promise<void> {
  // Always conflict on 'id' — every table has this unique constraint
  const res = await sbFetch(`${table}?on_conflict=id`, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`UPSERT ${table} failed (${res.status}): ${err}`)
  }
}

async function sbUpsertByShopId(table: string, data: object): Promise<void> {
  // For tables with unique constraint on shop_id
  const res = await sbFetch(`${table}?on_conflict=shop_id`, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`UPSERT ${table} failed (${res.status}): ${err}`)
  }
}

async function sbGet(path: string): Promise<any[]> {
  const res = await sbFetch(path, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SELECT failed (${res.status}): ${err}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  if (!SB_KEY) {
    return NextResponse.json(
      { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 }
    )
  }

  const {
    shopId, shopName, ownerPhone, ownerName,
    email, city, stateProvince, addressLine, postalCode, pinHash, pinPlain,
  } = await req.json()

  if (!shopId || !shopName || !ownerPhone || !pinHash) {
    return NextResponse.json(
      { error: 'Required fields: shopId, shopName, ownerPhone, pinHash' },
      { status: 400 }
    )
  }

  if (pinPlain && !/^\d{6}$/.test(String(pinPlain))) {
    return NextResponse.json(
      { error: 'Shop account PIN must be exactly 6 digits' },
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
      pin_plain:      pinPlain ? encryptPIN(pinPlain) : null,
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
    const callMeBotKey = process.env.CALLMEBOT_API_KEY
    if (callMeBotKey && adminWA) {
      const msg = encodeURIComponent(
        `🆕 New Shop Registration!\n\n` +
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
      console.log(`[New Shop] WhatsApp admin: https://wa.me/${adminWA}?text=${msg}`)
    }

    console.log(`[create-shop] ✓ Created: ${shopName} (${shopId})`)

    return NextResponse.json({
      success:  true,
      shopId,
      memberId,
    })

  } catch (e) {
    console.error('[create-shop] error:', e)
    if (isRetryableFetchError(e)) {
      return NextResponse.json(
        { error: 'Supabase se connect nahi ho saka. Dobara try karein.' },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
