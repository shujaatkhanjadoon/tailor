// src/app/api/auth/create-shop/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendShopVerificationAlert } from '@/lib/security/email-otp'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
}

async function sbPost(table: string, data: object): Promise<any> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
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
  const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=id`, {
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
  const res = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=shop_id`, {
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
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  })
  if (!res.ok) return []
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
    email, city, pinHash,
  } = await req.json()

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
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Yeh phone number pehle se registered hai. Login karein.' },
        { status: 409 }
      )
    }

    // ── 2. Upsert shop (conflict on id) ───────────────────────────
    await sbUpsertById('shops', {
      id:                  shopId,
      shop_name:           shopName,
      owner_phone:         ownerPhone,
      owner_email:         email  ?? null,
      city:                city   ?? null,
      plan:                'starter',
      is_active:           true,
      verification_status: 'pending',
      created_at:          new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })

    // ── 3. Insert owner team member (conflict on id) ──────────────
    // Use a fixed ID so we can upsert safely
    const memberId = crypto.randomUUID()

    await sbUpsertById('team_members', {
      id:             memberId,
      shop_id:        shopId,
      name:           ownerName ?? shopName + ' (Owner)',
      phone:          ownerPhone,
      role:           'owner',
      pin_hash:       pinHash,
      email:          email ?? null,
      email_verified: email ? true : false,
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
        owner_email:  email ?? null,
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
    if (email) {
      sendShopVerificationAlert({
        shopName,
        ownerName:  ownerName ?? shopName,
        ownerPhone,
        ownerEmail: email,
        city,
        shopId,
      }).catch(console.error)
    }

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
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}