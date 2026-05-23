# MeraDarzi — Security & Performance Audit Report

**Date**: 2026-05-23  
**App**: MeraDarzi Tailor Management  
**Stack**: Next.js 16.2.4, React 19.2.4, Supabase, Upstash Redis, bcryptjs, Recharts  
**Scope**: Full codebase (`src/`), 32 pages, 27 API routes, proxy middleware, 11 hooks

---

## Severity Distribution

| Severity | Count |
|----------|:-----:|
| 🔴 Critical | 6 |
| 🟠 High | 12 |
| 🟡 Medium | 12 |
| 🟢 Low | 10 |
| **Total** | **40** |

---

## 🔴 CRITICAL

### C1. `.env.local` contains live production secrets

**File**: `.env.local`  
**Risk**: All 15+ secrets stored in plaintext on disk — Supabase service role key, Resend API key, admin secret, TOTP secret, OTP pepper, PIN encryption key, Cloudinary API secret, Upstash Redis token, CallMeBot API key. Any attacker with filesystem access or a compromised CI/CD pipeline has the keys to every service.

**Action**: Rotate every secret immediately. Generate new values:
- `SUPABASE_SERVICE_ROLE_KEY` — via Supabase project settings
- `ADMIN_SECRET`, `ADMIN_TOTP_SECRET` — generate with `openssl rand -hex 32`
- `CRON_SECRET`, `PIN_ENCRYPTION_KEY`, `OTP_PEPPER_SECRET` — generate fresh
- `CLOUDINARY_API_SECRET` — via Cloudinary dashboard
- `RESEND_API_KEY` — via Resend dashboard
- `UPSTASH_REDIS_REST_TOKEN` — via Upstash console
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — regenerate via Supabase

---

### C2. PIN verification falls back to plaintext string comparison

**File**: `src/lib/security/pin.ts:76-82`

```typescript
export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('$2')) {
    return pin === hash     // <-- PLAINTEXT COMPARISON
  }
  return bcrypt.compare(pin, hash)
}
```

**Risk**: Any user whose stored `pin_hash` doesn't start with `$2a$`/`$2b$` (the bcrypt prefix) has their PIN verified via direct string equality. A data migration error, legacy import, or admin manual edit could silently create plaintext-stored PINs.

**Action**:
1. Remove the `!hash.startsWith('$2')` branch.
2. Run a DB migration to find all non-bcrypt `pin_hash` values and force those users to reset their PIN.
3. After migration, deploy the code change.

---

### C3. `/api/billing/subscription-event` has zero authentication

**File**: `src/app/api/billing/subscription-event/route.ts:13-41`

**Risk**: Accepts `POST` with arbitrary `{ shopId, event, plan, amountPkr }` and sends an email via Resend. No authentication, no CSRF token, no rate limiting. An attacker can:
- Spam the admin email with fake subscription events
- Enumerate active shop IDs by observing error responses
- Use the endpoint as an open email relay (limited — only to the configured admin address)

**Action**:
1. Require admin session token (`ADMIN_SESSION_COOKIE`) verification.
2. Add rate limiting (5 req/min via the API rate limiter).
3. Add Zod schema validation for the request body.

---

### C4. Service role key imported at module level in Server Component

**File**: `src/app/admin/dashboard/analytics/page.tsx:13`

```typescript
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { ... } }
)
```

**Risk**: The `SUPABASE_SERVICE_ROLE_KEY` lives in module scope for the entire server process lifetime. If this file is ever transformed into a Client Component (e.g., via import chain), the key would be bundled into the client JS. Even without that, any RCE, SSRF, or server-side XSS vulnerability anywhere in the app could leak this key. The service role key has full read/write access to the entire database.

**Action**: Move the service-role Supabase calls into an API route (`/api/admin/analytics`) and fetch from the component, keeping the key inside the route handler scope.

---

### C5. All 32 pages are `"use client"` — no Server Components

**Files**: Every `src/app/*/page.tsx`

**Risk**: The entire app renders client-side. This means:
- **Zero SSR** — all content requires JS execution before the user sees anything
- **No streaming** — no progressive page loading
- **No Partial Prerendering (PPR)** — can't use Next.js 16's `cacheComponents` or `use cache`
- **Full JS bundle** downloaded on every navigation
- **Loading spinners** on every page until client-side Supabase queries complete
- **No SEO** for public pages (pricing, tracking)

**Action**: A phased conversion:
1. Identify purely presentational pages (`/track/[code]`, `/pricing`) — convert first.
2. Move data fetching to Server Components with async `await`, keeping interactive islands as Client Components with `"use client"`.
3. Enable `cacheComponents: true` in `next.config.ts`.

---

### C6. Dashboard computes derived stats every render with zero memoization

**File**: `src/app/page.tsx:51-70`

```tsx
const safe = allOrders.filter(o => !["delivered", "cancelled"].includes(o.status));
const todayPay = allPayments.filter(p => p.paidAt.startsWith(today));
const recent = [...allOrders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
const overdueOrders = safe.filter((o) => o.dueDate < today);
const readyOrders = safe.filter((o) => o.status === "ready");
const todaysNewOrders = safe.filter((o) => o.createdAt.startsWith(today));
const incomeToday = todayPay.reduce((sum, p) => sum + p.amount, 0);
const pendingBalance = safe.reduce((sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid), 0);
```

**Risk**: Every React re-render (keystroke in search, filter toggle, polling interval callback) runs 5+ array filters and 2+ reduces. With 500+ orders this is ~7000 array iterations per render. The 60-second polling fallback combined with realtime subscription callbacks compounds this.

**Action**: Wrap in a single `useMemo`:

```typescript
const stats = useMemo(() => {
  const safe = allOrders.filter(o => !["delivered","cancelled"].includes(o.status));
  const todayPay = allPayments.filter(p => p.paidAt.startsWith(today));
  return {
    recent: [...allOrders].sort(...).slice(0, 5),
    overdueOrders: safe.filter(o => o.dueDate < today),
    readyOrders: safe.filter(o => o.status === "ready"),
    todaysNewOrders: safe.filter(o => o.createdAt.startsWith(today)),
    incomeToday: todayPay.reduce((sum, p) => sum + p.amount, 0),
    pendingBalance: safe.reduce((sum, o) => sum + Math.max(0, o.totalPrice - o.amountPaid), 0),
  }
}, [allOrders, allPayments, today]);
```

---

## 🟠 HIGH

### H1. Session tokens lack nonce — no revocation possible

**Files**:
- `src/lib/auth/session.ts:12-19`
- `src/lib/admin/auth.ts:155-162`

**Finding**: Member session tokens are HMAC-SHA256 signatures of `{ memberId, shopId, iat, exp }` with no random nonce. Admin session tokens use `{ admin, timestamp }`. Both are deterministic for a given timestamp and secret.

**Risk**:
- No way to revoke individual sessions (no token blacklist, no session DB table).
- Session replay if a token is intercepted (no device binding).
- Compromised `ADMIN_SECRET` allows forging tokens for any timestamp.

**Action**: Include `crypto.randomUUID()` in the token payload. Store a session mapping (`session_id → { memberId, expiresAt, deviceInfo }`) in Supabase to enable per-session revocation.

---

### H2. 7-day session with no rotation/refresh mechanism

**File**: `src/lib/auth/session.ts:3`

```typescript
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
```

**Finding**: Once issued, the token is valid for 7 days with no sliding expiry, no refresh token, and no rotation. The cookie has no `maxAge` set (session cookie), but the embedded token expiry is 7 days.

**Risk**: A leaked token is valid for 7 days with no way to shorten its lifespan without changing `ADMIN_SECRET` (which invalidates all sessions).

**Action**: Implement a refresh token pattern:
1. Short-lived access token (15 minutes)
2. Long-lived refresh token (7 days) stored in DB, one-time-use with rotation
3. The proxy only checks the short-lived token; the client auto-refreshes via the refresh endpoint

---

### H3. Weak Content Security Policy

**File**: `src/proxy.ts:19-21`

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
```

**Finding**: `'unsafe-inline'` allows any inline script execution. `'unsafe-eval'` allows `eval()`, `setTimeout(string)`, and `Function()`.

**Risk**: Any stored XSS vulnerability can execute arbitrary JavaScript. The CSP is not defensive.

**Action**: Remove `'unsafe-inline'` and `'unsafe-eval'`. Use Next.js's built-in nonce generation for inline scripts:

```typescript
// In proxy.ts — generate nonce per request
const nonce = crypto.randomUUID()
res.headers.set('Content-Security-Policy',
  `default-src 'self'; script-src 'self' 'nonce-${nonce}'; ...`
)
```

This requires updating the root layout to pass the nonce to `<Script>` components.

---

### H4. `/api/notifications` GET has no authentication

**File**: `src/app/api/notifications/route.ts:18-46`

**Finding**: The GET handler accepts any `shopId` query parameter and returns admin notifications targeted to a specific plan. No session check, no API key.

**Risk**: An unauthenticated attacker can enumerate shop IDs and learn about active admin notifications (e.g., "system maintenance" or "new feature announcements"). While not sensitive, this is information leakage.

**Action**: Verify the member session cookie (`MEMBER_SESSION_COOKIE`) before returning notifications. The `shopId` from the session should match the requested `shopId`.

---

### H5. PIN sent as plaintext JSON from client

**File**: `src/lib/auth/AuthContext.tsx:274`

```typescript
body: JSON.stringify({
  ...,
  pinPlain: pin,  // <-- plaintext PIN in request body
})
```

**Finding**: During shop creation, the PIN is sent as `pinPlain` in the JSON body. While HTTPS encrypts the transport, the PIN appears in plaintext in:
- Server request logs (if any)
- Error stack traces
- Any intermediate proxy logs

**Action**: Hash the PIN client-side (via Web Crypto API) before sending, or derive a proof-of-knowledge (e.g., `HMAC-SHA256(challenge, pin)`) instead of the raw PIN. Alternatively, the server's `/api/auth/create-shop` already receives the plain PIN — the PIN encryption (`encryptPIN(pinPlain)`) happens server-side. The actual risk is logging exposure.

**Verdict**: Acceptable with HTTPS-only. Mitigate by ensuring no request body logging in production.

---

### H6. `useReports` fetches all records — unbounded data transfer

**File**: `src/hooks/useReports.ts:64-88`

```typescript
const [ordersRes, paymentsRes, customersRes, teamRes] = await Promise.all([
  supabase.from('orders').select(ORDER_COLUMNS).eq('shop_id', shopId).is('deleted_at', null),
  supabase.from('payments').select(PAYMENT_COLUMNS).eq('shop_id', shopId).is('deleted_at', null),
  supabase.from('customers').select(CUSTOMER_COLUMNS).eq('shop_id', shopId).is('deleted_at', null),
  supabase.from('team_members').select(TEAM_COLUMNS).eq('shop_id', shopId).is('deleted_at', null).eq('is_active', true),
])
```

**Finding**: Every time reports load, ALL orders, payments, customers, and team members are fetched from Supabase and loaded into browser memory. Filtering happens client-side via `useMemo`. A shop with 10,000 orders over 3 years will download ~10MB+ on every reports visit.

**Action**:
1. Move date-range filtering to the server query (Supabase allows `.gte('created_at', startDate)`).
2. For aggregation data (e.g., monthly income totals), create a Supabase view or database function that returns pre-computed summaries instead of raw rows.
3. Alternatively, add a dedicated aggregation API route.

---

### H7. OrderListCard fires N+1 Supabase queries for photo counts

**File**: `src/components/orders/OrderListCard.tsx:49-61`

**Finding**: Each `OrderListCard` independently queries `order_photos` for its order's photo count. If the orders page renders 50 cards, that's 50 separate Supabase queries in parallel.

**Action**: Fetch all photo counts for the visible order IDs in a single batched query at the list level, then pass the count as a prop:

```typescript
// In the list parent:
const { data: photoCounts } = await supabase
  .from('order_photos')
  .select('order_id', { count: 'exact', head: true })
  .in('order_id', visibleOrderIds)
```

---

### H8. All hooks fetch full datasets without server-side filtering

**Files**: `useOrders.ts`, `usePayments.ts`, `useCustomers.ts`

**Finding**: Every hook fetches all non-deleted records for the shop. `useCustomers` uses `.limit(200)`, but `useOrders` and `usePayments` have no limit. This architecture won't scale past a few thousand records.

**Action**: Implement progressive loading:
1. Initial load: fetch recent N records (e.g., last 30 days or last 100 records).
2. "Load more" or pagination to fetch older records on demand.
3. Apply all active filters (status, date range, search) as server-side query parameters, not client-side `.filter()`.

---

### H9. No `Cache-Control` headers on any API response

**File**: `src/proxy.ts` (entirely absent)

**Finding**: Security headers are set but no caching headers. `/api/auth/session` (GET) is called on every page load — it could be cached for 30-60 seconds.

**Action**: In the proxy, add:

```typescript
// For non-sensitive, GET, non-admin API routes
if (req.method === 'GET' && !pathname.startsWith('/api/admin') && !pathname.startsWith('/api/auth')) {
  res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120')
}
```

---

### H10. IncomeChart creates new data reference every render

**File**: `src/components/reports/IncomeChart.tsx:46`

```typescript
const data = (view === 'monthly' ? monthly : weekly).map(item => ({ ...item }))
```

**Finding**: Every React render creates a new array with new object references. Recharts detects "new data" and re-renders all bars, even when just toggling the breakdown button on/off.

**Action**: Memoize with `useMemo`:

```typescript
const data = useMemo(() =>
  (view === 'monthly' ? monthly : weekly).map(item => ({ ...item })),
  [view, monthly, weekly]
)
```

---

### H11. IncomeChart uses invalid `<rect>` children inside `<Bar>`

**File**: `src/components/reports/IncomeChart.tsx:122-128`

```tsx
<Bar dataKey="income" name="Income" fill="#3b82f6" radius={[6,6,0,0]}>
  {data.map((entry, i) => (
    <rect key={i} fill={entry.income === maxVal ? '#1d4ed8' : '#3b82f6'} />
  ))}
</Bar>
```

**Finding**: Recharts `<Bar>` accepts `<Cell>` children for per-item styling, not `<rect>`. The `<rect>` elements are either ignored or create extraneous DOM nodes. The pattern that works (used correctly in `OrderStatusChart.tsx`) is:

```tsx
<Bar dataKey="income" name="Income" radius={[6,6,0,0]}>
  {data.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={entry.income === maxVal ? '#1d4ed8' : '#3b82f6'} />
  ))}
</Bar>
```

**Action**: Replace `<rect>` with `<Cell>`.

---

### H12. Next.js 16 instant-navigation features not configured

**File**: `next.config.ts`

**Finding**: The app doesn't use:
- `cacheComponents: true` (enables Partial Prerendering)
- `unstable_instant` route segment option
- `use cache` directive

These features reduce JS bundle size and enable instant back/forward navigation.

**Action**: Read `node_modules/next/dist/docs/index.md` and enable appropriate features per route segment.

---

## 🟡 MEDIUM

### M1. SameSite `lax` on member session cookie

**File**: `src/lib/auth/session.ts:52`

```typescript
sameSite: 'lax',
```

**Finding**: `Lax` mode allows cookies on top-level GET navigations from external sites. For an app handling financial data (payments, balances), `Strict` is more appropriate.

**Action**: Change to `sameSite: 'strict'`.

---

### M2. Rate limiting fails open when Redis is unavailable

**File**: `src/lib/security/rate-limit.ts:103-148`

**Finding**: When Upstash Redis is unavailable or throws an error, the rate limiter falls back to an in-memory `Map` with a flat 60 req/min window regardless of endpoint sensitivity. This is per-process, so in multi-instance deployments, the limit multiplies.

**Action**:
1. For sensitive endpoints (login, OTP), fail *closed* — block the request with 429.
2. For general API, keep the in-memory fallback but preserve the endpoint-specific limits.
3. Add a health-check that logs a warning when Redis is unavailable.

---

### M3. 4-digit karigar PINs with no server-side account lockout

**File**: `src/lib/security/pin.ts:6`

```typescript
export const KARIGAR_PIN_LENGTH = 4
```

**Finding**: 4-digit PINs have only 10,000 possible combinations. Login is rate-limited (5/15min), but there's no account-level lockout after repeated failures. An attacker with a compromised rate-limit ID (e.g., IP rotation behind NAT) could brute-force a 4-digit PIN in ~33 hours at 5 attempts per 15 minutes.

**Action**:
1. Increase minimum karigar PIN length to 6 digits.
2. Implement account lockout: freeze the account after 10 consecutive failures for 1 hour.
3. The `failed_attempts` field already exists in `team_members` — use it.

---

### M4. `/api/admin/login` bypasses proxy rate limiting

**File**: `src/proxy.ts:62-71`

```typescript
const adminPublic = [
  '/admin/login',
  '/admin/setup-totp',
  '/api/admin/login',   // <-- not rate-limited
  '/api/admin/logout',
  '/api/admin/verify',
]
```

**Finding**: Admin login (`/api/admin/login`) bypasses the proxy's rate limiter because it matches the `adminPublic` check *before* the rate-limiting code runs. The admin login route does have an `ADMIN_SECRET` check, but there's no rate limiting against brute-forcing the admin secret or TOTP.

**Action**: Move admin login rate limiting into the proxy, above the `adminPublic` check, or add rate limiting inside the login route handler.

---

### M5. Mass-assignment via upsert with `resolution=merge-duplicates`

**File**: `src/app/api/auth/create-shop/route.ts:189-246`

```typescript
await sbUpsertByShopId('subscriptions', ...)
await sbUpsertById('shop_usage', ...)
```

**Finding**: The `sbUpsertById` helper upserts all fields in the object to Supabase. If a new field is added to the client payload (e.g., `is_active: false` or `role: 'admin'`), it would be persisted because the upsert is a direct object dump.

**Action**: Whitelist writable fields per operation instead of passing the entire parsed body to the upsert.

---

### M6. `CALLMEBOT_API_KEY` sent as URL query parameter

**File**: `src/app/api/auth/create-shop/route.ts:310-313`

```typescript
const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${adminWA}&text=${msg}&apikey=${callMeBotKey}`
```

**Finding**: The API key is part of the query string. Query parameters are logged by:
- CDN providers (Vercel edge logs)
- Intermediate proxies
- Browser history (if the admin clicks the link)
- Server access logs

**Action**: If CallMeBot supports header-based auth, switch to that. Otherwise, accept the risk (it's standard for CallMeBot's API design).

---

### M7. `shopOps.get()` uses `select('*')`

**File**: `src/lib/db/operations.ts:172`

```typescript
.from('shops').select('*').eq('id', shopId).maybeSingle()
```

**Finding**: Fetches all 18 columns of the `shops` table when only `shop_name` and `brand_logo_url` are typically used.

**Action**: Specify only the needed columns: `.select('id, shop_name, brand_logo_url, brand_name, is_active')`.

---

### M8. `jspdf` + `jspdf-autotable` eagerly imported (~2MB)

**File**: `src/lib/export/download.ts:1-2`

```typescript
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
```

**Finding**: These imports are at the top of the module — they're included in every page's JS bundle even if the user never clicks "Export PDF". `jspdf` alone is ~900KB minified.

**Action**: Use dynamic imports inside the handler:

```typescript
const handlePdfExport = async () => {
  const { jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  // ... use jsPDF
}
```

---

### M9. `PhotoCapture` uses native `<img>` instead of Next.js `<Image>`

**File**: `src/components/photos/PhotoCapture.tsx:98`

```tsx
<img src={displayUrl} alt={label} className="w-full h-full object-cover" loading="lazy" />
```

**Finding**: Native `<img>` bypasses Next.js Image Optimization — no automatic WebP/AVIF format negotiation, no responsive sizes, no lazy loading via IntersectionObserver.

**Action**: Replace with `<Image>` from `next/image`. If the `src` might be a base64 data URI (for previews), conditionally use `<img>` only for that case.

---

### M10. Duplicate Supabase order queries on dashboard

**File**: `src/app/page.tsx:42-43`

```typescript
const { orders: allOrders, isLoading } = useOrders(shopId, ...)
const { payments: allPayments } = usePayments(shopId)
```

**Finding**: `usePayments` internally fetches all orders (`PAYMENT_ORDER_COLUMNS`) to enrich payments with order details. The dashboard already has `allOrders` from `useOrders`. This doubles the orders query.

**Action**: Pass pre-fetched orders to `usePayments` instead of having it re-fetch, or share state via a context/cache.

---

### M11. `useOrders` computes filter counts inline instead of deriving

**File**: `src/hooks/useOrders.ts:116-122`

```typescript
const overdue   = orders.filter(...).length
const ready     = orders.filter(...).length
const todayC    = orders.filter(...).length
const unassigned = orders.filter(...).length
```

**Finding**: Counts are computed during the data-fetch cycle and stored in `setCounts()`. They could be derived with `useMemo` from `allOrders`, which is more idiomatic and avoids state synchronization bugs.

**Action**: Remove `counts` state. Compute with `useMemo` from `allOrders`:

```typescript
const counts = useMemo(() => ({
  overdue: allOrders.filter(o => o.dueDate < today && !['delivered','cancelled'].includes(o.status)).length,
  ready: allOrders.filter(o => o.status === 'ready').length,
  today: allOrders.filter(o => o.createdAt?.startsWith(today)).length,
  unassigned: allOrders.filter(o => !o.assignedTo && !['delivered','cancelled'].includes(o.status)).length,
}), [allOrders, today])
```

---

### M12. `log-attempt` endpoint lacks Zod validation for `failureReason`

**File**: `src/app/api/auth/log-attempt/route.ts:28`

**Finding**: The `failureReason` field is accepted without validation. While it's logged to the database and has a retention policy, it could be used to store arbitrary data.

**Action**: Add a Zod schema that limits `failureReason` to a max length (e.g., 200 chars) and optionally validates it against a set of known failure patterns.

---

## 🟢 LOW

### L1. TOTP implemented from scratch

**File**: `src/lib/admin/auth.ts:50-133`

**Finding**: TOTP 2FA is implemented manually following RFC 6238/4226 (HMAC-SHA1, 30-second window, +/-1 drift). Custom crypto implementations risk subtle bugs (time-step boundary, base32 padding, counter overflow).

**Action**: Replace with a well-audited library like `otplib` or `speakeasy`. Both are lightweight and cover edge cases.

---

### L2. Fallback to non-timing-safe comparison in `verifyMemberSessionToken`

**File**: `src/lib/auth/session.ts:40-41`

```typescript
} catch {
  return pin === hash  // fallback to non-timing-safe
}
```

**Finding**: If `timingSafeEqual` throws (e.g., length mismatch), the code falls back to `===` which is not timing-safe. While the throw scenario is unlikely, it defeats the purpose of using `timingSafeEqual`.

**Action**: Return `false` instead of falling back to `===`. A failed comparison due to an error should not allow the token through.

---

### L3. Client-side-only role restriction in AuthGuard

**File**: `src/components/auth/AuthGuard.tsx:40-45`

```typescript
if (currentUser.role === 'karigar') {
  const allowed = ['/karigar', '/orders']
  if (!allowed.some(r => pathname.startsWith(r))) {
    window.location.href = '/karigar'
  }
}
```

**Finding**: Karigars are redirected away from owner-only pages client-side. A determined user can inspect the JS bundle, modify the code, or bypass the redirect.

**Verdict**: Acceptable — the proxy layer also enforces auth at the network level. This is a UX convenience, not a security boundary.

---

### L4. Missing Zod validation on `billing/subscription-event` and `shop-verify-request`

**Files**:
- `src/app/api/billing/subscription-event/route.ts:15`
- `src/app/api/auth/shop-verify-request/route.ts:25`

**Finding**: Both endpoints use raw `req.json()` without schema validation.

**Action**: Add Zod schemas in `src/lib/validation/schemas.ts` for both endpoints.

---

### L5. Sync service is entirely no-op dead code

**File**: `src/lib/supabase/sync-service.ts`

**Finding**: `pullAll`, `startAutoSync`, `stopAutoSync` are all stubs that return empty/no-op values. The `_synced`, `_deleted` fields in the schema, `SyncQueueRecord`, and the entire offline-first architecture was planned but never implemented.

**Action**: Either implement offline sync or remove the dead code.

---

### L6. Duplicate UUID helper functions

**Files**: `src/lib/db/operations.ts:14`, `src/app/orders/new/page.tsx:26`

**Finding**: The same `uuid` implementation (nano ID fallback pattern) is defined in two places.

**Action**: Centralize to a shared `src/lib/utils.ts` or use `crypto.randomUUID()` directly.

---

### L7. `uniqueChannelName` uses `Date.now()` + random

**Files**: All hooks

```typescript
function uniqueChannelName(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
```

**Finding**: Every effect re-run creates a new channel name. While the cleanup correctly removes old channels, this creates unnecessary churn and accumulates stale channel registrations on the Supabase Realtime server.

**Action**: Use a stable name based on the hook parameters:

```typescript
function channelName(base: string, shopId: string, suffix?: string) {
  return `${base}-${shopId}${suffix ? `-${suffix}` : ''}`
}
```

---

### L8. Some admin dashboard effects lack cleanup

**File**: `src/app/admin/dashboard/page.tsx:125`

```typescript
useEffect(() => { load() }, [])
```

**Finding**: No cleanup function. If the component unmounts during the async `load()` call, `setState` runs on an unmounted component (React warning).

**Action**: Add the `cancelled` flag pattern:

```typescript
useEffect(() => {
  let cancelled = false
  const load = async () => {
    const data = await fetch(...)
    if (!cancelled) setData(data)
  }
  load()
  return () => { cancelled = true }
}, [])
```

---

### L9. `orderOps.add()` double-queries shop name

**File**: `src/lib/db/operations.ts:437-440`

```typescript
const [orderNumber, shop] = await Promise.all([
  orderOps.getNextOrderNumber(shopId),
  shopOps.get(shopId),  // <-- select('*') just for shopName
])
```

**Finding**: `shopOps.get()` fetches all 18 columns via `select('*')` but only `shop.shopName` is used for tracking code generation. Also, `orderOps.getNextOrderNumber()` runs a full query when a simpler counter would work.

**Action**: Either cache the shop name in the calling scope or pass it as a parameter.

---

### L10. Abandoned offline-first architecture artifacts

**Files**:
- `src/lib/db/schema.ts` — Dexie IndexedDB schema with `_synced`, `_deleted`, `SyncQueueRecord`
- `src/lib/db/sync.ts` — Legacy sync file
- `src/lib/supabase/realtime.ts` — No-op stub

**Finding**: The codebase has clear signs of a planned offline-first architecture that was abandoned. Fields like `_synced` and `_deleted` are always set to `1` and `0` respectively but are never queried or used for sync.

**Action**: Clean up unused schema fields and stub files, or commit to implementing offline support.

---

## Category Summary

| Category | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | Total |
|---|---|---|---|---|---|
| Authentication / Sessions | — | 2 | 1 | 2 | 5 |
| API Security | 2 | 1 | 2 | 1 | 6 |
| Secrets Management | 2 | — | — | — | 2 |
| Frontend Security | — | 1 | — | 1 | 2 |
| PIN Security | 1 | — | 1 | — | 2 |
| Rate Limiting | — | — | 2 | — | 2 |
| Data Fetching / Database | — | 3 | 2 | 2 | 7 |
| React / State Management | 1 | — | 1 | 1 | 3 |
| Bundle / Images | — | — | 2 | — | 2 |
| Next.js Configuration | 1 | 1 | — | — | 2 |
| Charts | — | 2 | — | — | 2 |
| Dead Code / Technical Debt | — | — | — | 4 | 4 |
| **Total** | **6** | **12** | **12** | **10** | **40** |

---

## Recommended Priority Order

### Immediate (fix first)
| # | Issue | Est. Effort |
|---|-------|-------------|
| 1 | C1 — Rotate all `.env.local` secrets | 30 min |
| 2 | C3 — Add auth to `/api/billing/subscription-event` | 30 min |
| 3 | C2 — Remove plaintext PIN fallback + migrate DB | 1 hr |
| 4 | C4 — Move service role key out of module scope | 30 min |
| 5 | C6 — Memoize dashboard derived stats | 15 min |

### Next sprint
| # | Issue | Est. Effort |
|---|-------|-------------|
| 6 | H4 — Add auth to `/api/notifications` GET | 20 min |
| 7 | M1 — Change SameSite `lax` → `strict` | 5 min |
| 8 | M4 — Add rate limiting to admin login | 15 min |
| 9 | M8 — Dynamic import `jspdf` | 15 min |
| 10 | H10 — Memoize IncomeChart data | 5 min |
| 11 | H11 — Fix `<rect>` → `<Cell>` in IncomeChart | 5 min |
| 12 | H9 — Add `Cache-Control` headers | 10 min |

### Medium-term
| # | Issue | Est. Effort |
|---|-------|-------------|
| 13 | H1 — Add nonce to session tokens + session DB | 4-6 hrs |
| 14 | H2 — Implement refresh token rotation | 6-8 hrs |
| 15 | H3 — Fix CSP with nonce-based approach | 4 hrs |
| 16 | H6-H8 — Server-side pagination & filtering | 4-8 hrs per hook |
| 17 | H7 — Batch OrderListCard photo queries | 1 hr |
| 18 | M3 — Increase karigar PIN to 6 digits + lockout | 2 hrs |
| 19 | C5 — Convert pages to Server Components | Ongoing |

### Technical debt
| # | Issue | Est. Effort |
|---|-------|-------------|
| 20 | L1 — Replace custom TOTP with `otplib` | 2 hrs |
| 21 | L5-L6, L10 — Remove dead code & duplications | 1 hr |
| 22 | M5 — Whitelist upsert fields | 2 hrs |
| 23 | M12 — Add Zod validation to remaining endpoints | 1 hr |
