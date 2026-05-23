# FIX RECOMMENDATIONS — Meradarzi Tailor

**Date:** 2026-05-23

---

## CRITICAL FIXES (Apply Immediately)

### FIX-01: Rename proxy.ts to middleware.ts

```bash
# Rename src/proxy.ts to src/middleware.ts
# Next.js automatically loads middleware.ts at the root of src/
```

This single change activates:
- All security headers (HSTS, XFO, XCTO, CSP, Referrer-Policy)
- Global API rate limiting
- CSRF origin checks
- Admin session validation at the edge
- Cron authentication
- Member session rotation
- Request size limiting

**Files affected:** `src/proxy.ts` → `src/middleware.ts`

---

### FIX-02: Add Server-Side PIN Verification to Session Creation

**File:** `src/app/api/auth/session/route.ts`

**Change:** Add server-side bcrypt verification of PIN before issuing session token.

**Before:**
```typescript
const token = generateMemberSessionToken(memberId, shopId) // No PIN check!
```

**After:**
```typescript
const pinValid = await verifyPinServerSide(memberId, pin)
if (!pinValid) {
  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}
const token = generateMemberSessionToken(memberId, shopId)
```

The `verifyPinServerSide` function fetches the stored `pin_hash` and uses `bcrypt.compare()` to verify.

---

### FIX-03: Remove Plaintext PIN from API Requests

**File:** `src/lib/auth/AuthContext.tsx`

**Change:** Remove `pinPlain` from the create-shop API request body. The server should generate the encrypted PIN from the hash.

```typescript
// Remove: pinPlain: pin,
```

**File:** `src/app/api/auth/create-shop/route.ts`

**Change:** Server-side: generate encrypted PIN from `pinHash` instead of receiving `pinPlain`.

---

### FIX-04: Authenticate update-pin Endpoint

**File:** `src/app/api/auth/update-pin/route.ts`

**Change:** Require valid session cookie and verify `memberId`/`shopId` match the session.

```typescript
const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
const session = token ? verifyMemberSessionToken(token) : null
if (!session || memberId !== session.memberId || shopId !== session.shopId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

### FIX-05: Stop Exposing pin_hash to Client

**File:** `src/app/auth/page.tsx` (line ~355)

**Change:** Remove `pin_hash` from the Supabase `select` query. Use a server endpoint instead.

**Affected hooks:** Update client auth flow to send PIN to server API endpoint and receive only a success/failure response.

---

### FIX-06: Remove PIN Decryption from Admin API

**File:** `src/app/api/admin/data/route.ts` (lines 82-87)

**Before:**
```typescript
const decryptedPin = encryptedPin ? decryptPIN(encryptedPin) : null
return { ...shop, owner_pin: decryptedPin, ... }
```

**After:**
```typescript
return { ...shop, owner_pin_available: !!shop.encrypted_owner_pin, ... }
```

Never expose decrypted PINs to the admin dashboard.

---

### FIX-07: Replace All Hard Deletes with Soft Deletes

**Files affected:**
- `src/lib/db/operations.ts:79-81` — order_photos, payments, order_status_history
- `src/lib/db/operations.ts:92` — orders
- `src/lib/db/operations.ts:267` — team_members
- `src/lib/db/operations.ts:392-393` — measurements, customers

**Change pattern:**
```typescript
// Before:
requireOk((supabase as any).from('orders').delete().in('id', orderIds))

// After:
requireOk((supabase as any).from('orders').update({ deleted_at: ts }).in('id', orderIds))
```

---

## HIGH PRIORITY FIXES (Apply Within Days)

### FIX-08: Add Rate Limiting to All Critical Endpoints

**Endpoints needing rate limiting:**
- `POST /api/auth/session` — Rate limit: 10 per minute per IP
- `POST /api/auth/update-pin` — Rate limit: 3 per 15 minutes per user
- `POST /api/admin/login` — Rate limit: 5 per minute per IP
- `POST /api/admin/action` — Rate limit: 30 per minute

Use the existing `checkRateLimit` function from `@/lib/security/rate-limit`.

---

### FIX-09: Add Payment Processing Transaction Safety

**File:** `src/lib/db/operations.ts:563-602`

**Change:** Add optimistic locking with version check:
```typescript
const { error } = await supabase
  .from('orders')
  .update({ amount_paid: nextPaid, updated_at: ts })
  .eq('id', order.id)
  .eq('amount_paid', order.amountPaid)  // Optimistic lock
```

---

### FIX-10: Add Database Indexes

Create `supabase/migrations/001_indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_orders_shop_deleted ON orders(shop_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_deleted_status ON orders(assigned_to, deleted_at, status);
CREATE INDEX IF NOT EXISTS idx_customers_shop_deleted ON customers(shop_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_shop_deleted_paid ON payments(shop_id, deleted_at, paid_at);
CREATE INDEX IF NOT EXISTS idx_team_members_shop_deleted ON team_members(shop_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_team_members_phone ON team_members(phone) WHERE is_active AND deleted_at IS NULL;
```

---

### FIX-11: Replace Raw `<img>` with `next/image`

**Files:** 6 files with raw `<img>` tags

**Change pattern:**
```tsx
// Before:
<img src={url} alt="Photo" className="..." />

// After:
import Image from 'next/image'
<Image src={url} alt="Photo" width={400} height={300} className="..." />
```

---

### FIX-12: Add Pagination to All List Queries

**Files:** `src/lib/db/operations.ts`

All `getAll()` methods now accept optional `limit` and `offset` parameters with sensible defaults.

---

### FIX-13: Fix timezone Bug in `nowKarachiIso()`

**File:** `src/lib/time.ts:7-9`

**Before:** Returns UTC (`new Date().toISOString()`)
**After:** Returns Asia/Karachi time with `+05:00` offset

---

### FIX-14: Stop Logging Session Tokens

**File:** `src/app/api/admin/login/route.ts:66`

**Change:** Log only the first 12 characters of the token hash instead of the full token.

---

### FIX-15: Escape LIKE Wildcards in Customer Search

**File:** `src/lib/db/operations.ts:320`

**Change:** Add `escapeLike()` function that escapes `%`, `_`, and `\` characters in user search input.

---

## MEDIUM PRIORITY FIXES (Apply Within Sprint)

### FIX-16: Implement React Query for Client-Side Caching

Add `@tanstack/react-query` to dependencies and wrap data fetching hooks with `useQuery`.

### FIX-17: Add Auth Middleware for API Routes

Create centralized auth checks in `middleware.ts` for:
- Member session validation
- Admin session validation
- Cron secret validation

### FIX-18: Add CSP Nonces

Replace `'unsafe-inline'` with `'nonce-{random}'` for scripts. Pass the nonce to all `<script>` tags.

### FIX-19: Add Structured Logging

Create `src/lib/logger.ts`:
```typescript
export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', msg, ...meta, timestamp: new Date().toISOString() })),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta, timestamp: new Date().toISOString() })),
}
```

### FIX-20: Add MFA Support for Member Login

Implement the already-defined TOTP schema for member two-factor authentication.

---

## CODE QUALITY FIXES

### Q-01: Remove `(supabase as any)` Casts

Use the generated `Database` type from `src/lib/supabase/types.ts` for type-safe queries.

### Q-02: Remove Dead Code

- Remove unused `QRCodeSVG` import from `RaastPaymentSheet.tsx`
- Remove duplicate `formatKarachiDateInput()` function
- Remove `TailorDB` Dexie class or make lazy

### Q-03: Extract Configuration Constants

- Move Raast payment credentials to env vars
- Move WhatsApp numbers to env vars
- Move plan prices to central `plans.ts`
- Move session timeout to single constant

---

## SUMMARY OF FIXES APPLIED IN THIS AUDIT

| # | Fix | File | Status |
|---|-----|------|--------|
| 1 | Rename proxy.ts → middleware.ts (CSP tightened, connect-src fixed) | `src/proxy.ts` | **APPLIED** |
| 2 | Cookie secure flag always true, `__Secure-` prefix, rename secret env var | `src/lib/auth/session.ts` | **APPLIED** |
| 3 | Rate limiter fails closed (not open) | `src/lib/security/rate-limit.ts` | **APPLIED** |
| 4 | `nowKarachiIso()` uses timezone | `src/lib/time.ts` | **APPLIED** |
| 5 | Encode limit param in audit.ts | `src/lib/admin/audit.ts` | **APPLIED** |
| 6 | Server-side PIN verification in session creation | `src/app/api/auth/session/route.ts` | **APPLIED** |
| 7 | Session auth required for update-pin | `src/app/api/auth/update-pin/route.ts` | **APPLIED** |
| 8 | Admin login: always secure cookie, token hash logged | `src/app/api/admin/login/route.ts` | **APPLIED** |
| 9 | Admin data API: no PIN decryption, validated limit | `src/app/api/admin/data/route.ts` | **APPLIED** |
| 10 | Soft deletes for orders, payments, history, members, customers | `src/lib/db/operations.ts` | **APPLIED** |
| 11 | Pagination on all list queries | `src/lib/db/operations.ts` | **APPLIED** |
| 12 | LIKE injection escape in customer search | `src/lib/db/operations.ts` | **APPLIED** |
| 13 | N+1 fixed in order creation (parallel customer fetch) | `src/lib/db/operations.ts` | **APPLIED** |
| 14 | Payment race condition fixed (optimistic locking) | `src/lib/db/operations.ts` | **APPLIED** |
| 15 | Dashboard stats uses server-side COUNT | `src/lib/db/operations.ts` | **APPLIED** |
| 16 | Shop name cache with TTL and eviction | `src/lib/db/operations.ts` | **APPLIED** |
| 17 | Cloudinary deletion error handling fixed | `src/lib/db/operations.ts` | **APPLIED** |
