# Mera Darzi — Full Application Audit & Production Readiness Prompt

> **Target:** Claude Code CLI / DeepSeek  
> **App:** Mera Darzi (meradarzi.pk) — Tailor Shop Management PWA  
> **Stack:** Next.js 16.2.7 / React 19.2.4 / Supabase / Upstash Redis / Cloudinary / Resend  
> **Date:** 2026-06-09

---

## 1. MISSION

**Transform Mera Darzi from a working MVP into a production-grade, secure, scalable SaaS platform ready for paid client onboarding and marketing.**

This means:
- Zero critical/high-severity bugs
- Industry-standard security posture
- Production-grade performance at scale
- Clean, maintainable, typed code
- Complete test coverage for critical paths
- Clear upgrade paths for infrastructure as the user base grows

---

## 2. APP OVERVIEW

### 2.1 What It Does

Mera Darzi is an offline-first PWA for Pakistani tailoring shops. Shop owners can:
- Manage customers, orders, measurements, and payments
- Assign work to karigar (tailor) team members
- Track orders with status workflow (received → cutting → stitching → finishing → ready → delivered)
- Provide public order tracking via tracking codes
- Take and store fabric/style photos via camera
- Works offline with IndexedDB sync
- Subscription-based billing via Raast (manual payments)

### 2.2 Who Uses It

- **Shop Owners** — full CRUD, billing, reports, settings
- **Karigars (Tailors)** — view/edit assigned orders only
- **Super Admins** — manage all shops, payments, coupons, system health via `/admin/dashboard/*`
- **Customers** — public order tracking via `/track/[code]`

### 2.3 Architecture

```
Browser (PWA) ──► Next.js App Router ──► API Routes (server-side)
     │                                          │
     │ Dexie (IndexedDB)                         │
     │ (offline cache)                           ├── Supabase (PostgreSQL)
     │                                           ├── Upstash Redis (rate limiting)
     └── Sync Engine ────────────────────────────┘   Cloudinary (photos)
                                                      Resend (emails)
```

### 2.4 Key Architectural Decisions

- **No Supabase Auth** — Custom PIN-based auth with bcrypt(12) + HMAC-SHA256 session tokens
- **No ORM** — Raw Supabase REST calls with manual snake_case→camelCase mapping in `src/lib/supabase/records.ts`
- **Offline-first** — All CRUD through `offlineRead`/`offlineWrite` wrappers; Dexie IndexedDB as local cache
- **RLS bypass** — All writes go through service-role API routes; client reads use anon key with `current_shop_id()` session variable
- **Manual payments** — Raast-based; admin manually verifies and activates subscriptions
- **No automated payment gateway** — relies on admin checking bank statements

---

## 3. ROUTES & PAGES — COMPLETE INVENTORY

### 3.1 Main App Pages (App Router)

| Route | Purpose | Key Components/Files |
|---|---|---|
| `/` | Dashboard — stats, recent orders, quick actions | `src/app/page.tsx`, `src/components/dashboard/` |
| `/auth` | Auth wizard — login + shop setup (multi-step) | `src/app/auth/`, `src/components/auth/` |
| `/dashboard` | Same as `/` | Alias |
| `/orders` | Order list with filters, search, pagination | `src/app/orders/page.tsx`, `src/hooks/useOrders.ts` |
| `/orders/new` | New order — select customer, garment, measurements, photos | `src/app/orders/new/` |
| `/orders/[id]` | Order detail — edit, add payments, change status, photos | `src/app/orders/[id]/` |
| `/customers` | Customer list with search | `src/app/customers/`, `src/hooks/useCustomers.ts` |
| `/customers/new` | New customer — name, phone, gender | `src/app/customers/new/` |
| `/customers/[id]` | Customer detail — profile, measurements, orders, balance | `src/app/customers/[id]/` |
| `/payments` | Payment history — all payment records | `src/app/payments/`, `src/hooks/usePayments.ts` |
| `/karigar` | Team member list (karigar management) | `src/app/karigar/` |
| `/reports` | Business reports & analytics | `src/app/reports/`, `src/hooks/useReports.ts` |
| `/pricing` | Public pricing page — plan comparison | `src/app/pricing/` |
| `/billing` | Billing dashboard — subscription info, usage | `src/app/billing/`, `src/hooks/usePlan.ts` |
| `/billing/history` | Past subscription payments | |
| `/billing/upgrade` | Choose plan, submit Raast payment | |
| `/billing/cancel` | Cancel subscription | |
| `/settings` | Shop settings — profile, branding | `src/app/settings/` |
| `/settings/shop` | Shop profile form | |
| `/settings/team` | Team CRUD (karigar members) | |
| `/settings/notifications` | Push notification preferences | |
| `/settings/change-pin` | Change login PIN | |
| `/track/[code]` | Public order tracking (no auth required) | `src/app/track/`, `src/components/track/` |

### 3.2 Admin Panel Pages

| Route | Purpose |
|---|---|
| `/admin/login` | Admin auth — secret key + TOTP 2FA |
| `/admin/setup-totp` | Google Authenticator QR code setup |
| `/admin/dashboard` | Super admin overview — revenue, active subs, pending payments |
| `/admin/dashboard/admins` | CRUD sub-admin accounts |
| `/admin/dashboard/shops` | All registered shops |
| `/admin/dashboard/shops/[id]` | Single shop detail |
| `/admin/dashboard/shops/bulk` | Bulk operations on shops |
| `/admin/dashboard/payments` | Pending/completed subscription payments — activate/reject |
| `/admin/dashboard/analytics` | Revenue analytics, MRR, churn |
| `/admin/dashboard/reports/revenue` | Revenue reports |
| `/admin/dashboard/reports/shops` | Shop reports |
| `/admin/dashboard/reports/subscriptions` | Subscription reports |
| `/admin/dashboard/coupons` | Coupon code management |
| `/admin/dashboard/disputes` | Payment disputes |
| `/admin/dashboard/notifications` | Send admin notifications to shops |
| `/admin/dashboard/notifications/history` | Past notifications |
| `/admin/dashboard/logs` | Audit log viewer |
| `/admin/dashboard/security` | Security dashboard |
| `/admin/dashboard/security/2fa` | 2FA management |
| `/admin/dashboard/security/blocklist` | IP blocklist |
| `/admin/dashboard/health` | System health monitoring |
| `/admin/dashboard/settings/messages` | System message templates |

### 3.3 API Routes

**Auth (9 routes):**
- `POST /api/auth/login` — PIN-based login with rate limiting
- `POST /api/auth/create-shop` — Create new shop + subscription + team
- `POST /api/auth/session` — Create member session
- `GET /api/auth/session` — Read/validate current session (auto-rotates)
- `DELETE /api/auth/session` — Destroy session
- `POST /api/auth/send-otp` — Send email OTP
- `POST /api/auth/verify-otp` — Verify email OTP
- `POST /api/auth/check-phone` — Check if phone registered
- `POST /api/auth/log-attempt` — Log login attempts
- `POST /api/auth/update-pin` — Change PIN
- `POST /api/auth/shop-verify-request` — Request shop verification

**Admin (15+ routes):**
- `POST /api/admin/login` — Admin login (secret + TOTP)
- `POST /api/admin/logout` — Admin logout
- `GET /api/admin/verify` — Check admin session
- `POST /api/admin/impersonate` — Impersonate a shop
- `GET /api/admin/totp-uri` — Get TOTP setup URI
- `POST /api/admin/action/*` — Activate/reject payments, set plans, etc.
- `GET/POST /api/admin/admins/*` — CRUD sub-admins
- `GET /api/admin/analytics/*` — Revenue & usage analytics
- `GET/POST /api/admin/coupons/*` — Coupon management
- `GET /api/admin/data/*` — Data export/import
- `GET /api/admin/health/*` — Health check endpoints
- `POST /api/admin/backfill-expiry` — Backfill expiry dates
- `GET /api/admin/blocklist/*` — IP blocklist management
- `GET /api/admin/notifications/*` — Admin notifications CRUD
- `GET /api/admin/reports/*` — Report data
- `GET /api/admin/templates/*` — Email/notification templates

**Billing (4 routes):**
- `POST /api/billing/submit-payment` — Submit Raast payment
- `POST /api/billing/subscription-event` — Handle subscription events
- `GET /api/billing/subscription-status` — Check subscription status
- `POST /api/billing/cancel` — Cancel subscription

**Cron (4 routes, protected by Bearer token):**
- `POST /api/cron/expire-subscriptions` — Daily 1AM PKT — subscription lifecycle
- `POST /api/cron/send-reminders` — Daily 9AM PKT — WhatsApp reminders
- `POST /api/cron/reset-usage` — 1st of month — reset monthly counters
- `POST /api/cron/cleanup-photos` — Daily 3AM PKT — delete old photos

**Other (10+ routes):**
- `GET /api/health` — Health check
- `POST /api/csp-violation` — CSP violation reporting
- `POST /api/shop/update` — Update shop settings
- `POST /api/shop/delete` — Delete shop (⚠️ CRITICAL: no session check per audit)
- `POST /api/team/members` — Team member CRUD (⚠️ CRITICAL: double bcrypt hash per audit)
- `POST /api/notifications` — Manage notifications
- `POST /api/push/subscriptions` — Web push subscriptions
- `POST /api/photos/delete` — Delete Cloudinary photo
- `POST /api/order-photos` — Upload order photos
- `POST /api/measurements` — Manage measurements
- `POST /api/coupons/validate` — Validate coupon codes

---

## 4. DATABASE SCHEMA

### 4.1 Tables (19 total)

| Table | Purpose | Key Columns |
|---|---|---|
| `shops` | Tenant shops | id, shop_name, owner_phone, plan, plan_expires_at, is_active, verification_status |
| `team_members` | Shop members (owner + karigar) | id, shop_id, name, phone, role, pin_hash, token_version |
| `customers` | Shop customers | id, shop_id, name, phone, gender, total_orders |
| `orders` | Order records | id, shop_id, customer_id, order_number, tracking_code, garment_type, status, total_price, amount_paid, assigned_to |
| `payments` | Order payments | id, shop_id, order_id, amount, method, recorded_by, paid_at |
| `measurements` | Customer measurements (JSONB) | id, customer_id, shop_id, garment_type, values |
| `order_photos` | Order fabric/style/reference photos | id, order_id, shop_id, type, cloud_url, public_id |
| `order_status_history` | Status change audit | id, order_id, old_status, new_status, changed_by |
| `subscriptions` | Shop subscriptions (1-to-1) | id, shop_id, plan, status, trial_ends_at, expires_at, grace_ends_at |
| `subscription_payments` | Subscription payment records | id, shop_id, subscription_id, plan, amount_pkr, method, status |
| `shop_usage` | Monthly usage counters (1-to-1) | id, shop_id, orders_this_month, customers_total, storage_used_kb |
| `email_verifications` | Email OTP tracking | id, phone, email, verified_at |
| `push_subscriptions` | Web push subscriptions | id, shop_id, member_id, endpoint, keys |
| `login_attempts` | Login audit log | id, phone, ip_address, success, failure_reason |
| `admin_audit_log` | Admin action log | id, action, target_type, target_id, shop_id, details |
| `admin_notifications` | In-app admin messages | id, title, message, type, target_plan, expires_at |
| `admin_accounts` | Sub-admin accounts | id, username, password_hash, role, totp_secret |
| `ip_blocklist` | Blocked IPs | id, ip, reason, blocked_by, blocked_at, expires_at |
| `coupons` | Discount coupons | id, code, discount_percent, max_uses, plan_tier |
| `coupon_redemptions` | Coupon usage | id, coupon_id, shop_id, subscription_payment_id |
| `cron_log` | Cron job execution log | id, job_name, started_at, completed_at, records_processed |
| `message_templates` | Email/notification templates | id, key, subject, body, variables |

### 4.2 Indexes

30 indexes covering foreign keys, sort columns, search fields. Key indexes:
- `orders(shop_id, status)` — filtered order lists
- `orders(shop_id, created_at DESC)` — recent orders
- `customers(name gin_trgm_ops)` — fuzzy name search
- `subscriptions(status)` — active subscription queries

**Missing indexes found:**
- `orders(shop_id, assigned_to)` — karigar-filtered queries
- `subscription_payments(subscription_id)` — payment history by subscription

---

## 5. AUTH & SECURITY FLOW

### 5.1 Shop Member Auth

1. Owner registers with phone → sets 6-digit PIN → optional email OTP
2. Login: phone + PIN → `POST /api/auth/login` → bcrypt verify → HMAC-SHA256 session token
3. Cookie: `__Secure-md_session` (httpOnly, secure, sameSite=strict, 7-day expiry)
4. Token format: `memberId:shopId:timestamp:nonce:tokenVersion:HMAC-SHA256-base64url`
5. Auto-rotation on every `GET /api/auth/session` call
6. Lockout: 5 failed attempts → 15-min lockout
7. Rate limiting: Upstash Redis + in-memory fallback — 5 attempts per 15min per IP+fingerprint
8. Roles: `owner` (full) / `karigar` (view own orders only)

### 5.2 Admin Auth

1. Secret key (`ADMIN_SECRET` env var) + optional TOTP via Google Authenticator
2. Cookie: `__Secure-admin_session` (15-min inactivity / 7-day "remember me")
3. Sub-admins: username/password + TOTP with roles (super_admin, finance, support)

### 5.3 Middleware (`src/proxy.ts`)

- Runs on every request
- CSP headers enforcement
- Rate limiting on all API routes
- CSRF origin/referer check for state-changing requests
- Cron route protection via Bearer token
- Admin route protection (cookie check + session verification)
- Main app route protection (redirects to `/auth` if no valid session)
- Global IP blocklist check
- 5MB request size limit

---

## 6. SUBSCRIPTION & PAYMENT FLOW

### 6.1 Plans

| Plan | Monthly (PKR) | Yearly (PKR) | Max Orders | Max Karigar |
|---|---|---|---|---|
| Starter | Free | Free | 30/mo | 0 |
| Professional | 999 | 9,999 | Unlimited | 3 |
| Business | 2,499 | 25,000 | Unlimited | Unlimited |

### 6.2 Payment Flow (Manual — Raast)

1. User selects plan → sees Raast payment details (ID, amount, bank)
2. User sends exact amount via Raast (bank app / Easypaisa / JazzCash)
3. User submits transaction ID via `POST /api/billing/submit-payment`
4. Admin manually verifies in `/admin/dashboard/payments`
5. Admin clicks "Activate" →:
   - Upserts subscription with new expiry
   - Marks payment as completed
   - Updates shop plan
   - Logs audit action
   - Sends WhatsApp notification

### 6.3 Subscription Lifecycle

```
trialing ──(trial ends)──► active (starter) OR grace
active ──(expires)──► grace (7 days)
grace ──(ends)──► active (starter plan — downgraded)
active ──(cancelled)──► grace (7 days) ──► active (starter)
```

### 6.4 Cron Jobs & Subscription Management

All 4 cron jobs run on Vercel Cron Jobs with Bearer token auth:

| Job | Schedule | What It Does |
|---|---|---|
| `expire-subscriptions` | Daily 1AM PKT | Mirrors sub expiry to shops, moves cancelled→grace, expired→grace, grace→starter, trial→starter, auto-rejects stale pending payments (>48h). Max 50/batch with cursor tracking. |
| `send-reminders` | Daily 9AM PKT | WhatsApp reminders for plans expiring in 5/3/1 day(s). Trial reminders. Max 50/batch. |
| `reset-usage` | 1st of month 12AM | Resets `shop_usage.orders_this_month` to 0. |
| `cleanup-photos` | Daily 3AM PKT | Deletes photos >90 days from Cloudinary + DB. Max 50/batch. |

---

## 7. KNOWN ISSUES FROM AUDIT-REPORT.md

### 7.1 CRITICAL — Fix Immediately

| ID | Issue | File | Impact |
|---|---|---|---|
| **API-1** | **Double bcrypt hashing** in team member creation | `src/app/api/team/members/route.ts:51` | Every created member permanently locked out — PIN never matches |
| **API-2** | **Missing `crypto` import** — `crypto.randomUUID()` called without import | `src/app/api/team/members/route.ts:69` | Runtime crash on member creation without pre-existing ID |
| **API-3** | **Shop delete has no session auth** — only validates body UUIDs | `src/app/api/shop/delete/route.ts` | Anyone who knows a valid shop+member UUID pair can permanently delete a shop |
| **DB-1** | **Payment insert before order update** — orphaned payments on race | `src/lib/db/operations.ts:776-788` | Money recorded but not applied to order |

### 7.2 HIGH — Fix Within Sprint

| ID | Issue | File |
|---|---|---|
| **API-4** | `Math.random()` for PIN generation (not crypto-safe) | `src/app/api/admin/action/route.ts` |
| **API-5** | TOTP secret returned in API response | `src/app/api/admin/action/route.ts` |
| **API-6** | TOTP bypass when env var missing (fails open) | `src/app/api/admin/action/route.ts` |
| **SEC-1** | No session revocation — stolen cookies cannot be invalidated | `src/lib/auth/session.ts`, `src/lib/admin/auth.ts` |
| **SEC-2** | In-memory email rate limiter — bypassable in multi-instance | `src/lib/security/email-otp.ts:23-39` |
| **SEC-5** | `'unsafe-inline'` CSP directive defeats XSS protection | `src/lib/csp.ts` |
| **R8** | Admin data endpoint fetches ALL records — OOM risk at scale | `src/app/api/admin/data/route.ts` |
| **DB-2** | Duplicate order numbers on race condition | `src/lib/db/operations.ts:573-584` |
| **DB-3** | No transaction for shop deletion — orphaned records on partial failure | `src/app/api/shop/delete/route.ts:67-91` |

### 7.3 MEDIUM — Fix Within Sprint

| ID | Issue |
|---|---|
| **API-8** | No server-side PIN strength validation in create-shop |
| **API-9** | Session GET doesn't re-verify member's shop_id |
| **R11** | No unique constraint `(shop_id, order_number)` in DB |
| **R15** | Bulk admin actions use sequential `for...of` instead of concurrent |
| **R16** | Rate limiter fail-open for normal endpoints |
| **R17** | IP blocklist check fails open if Supabase unreachable |
| **R18** | Reports hook fetches all data on mount — no caching |
| **R19** | usePlan hook has no shared cache |
| **SEC-3** | Rate limiter fails open on Redis errors |
| **SEC-4** | IP blocklist fails open on Supabase outage |

---

## 8. FREE TIER LIMITATIONS & UPGRADE GUIDANCE

### 8.1 Vercel (Current: Free/Hobby)

| Resource | Free Tier Limit | Upgrade To | When |
|---|---|---|---|
| Serverless Function Execution | 100 GB-hours/mo | Pro ($20/mo) | >100k API calls/mo |
| Edge Function Requests | 1M/mo | Pro ($20/mo) | >1M edge requests/mo |
| Bandwidth | 100 GB/mo | Pro ($20/mo) | >100 GB transfer/mo |
| Build Minutes | 6,000 min/mo | Pro ($20/mo) | Heavy CI usage |
| Team Features | No | Team ($20/seat/mo) | Need collaboration |
| Cron Jobs | 2 max | Pro ($20/mo) | Currently using 4! Free tier only allows 2 cron jobs |
| Concurrent Serverless | 10 | Pro (20+), Enterprise (500+) | Traffic spikes |
| Duration (Serverless) | 10s (Basic), 60s (Pro+Flask) | Pro ($20/mo) | Long-running APIs |
| **Estimated capacity on Free:** ~500 shops with light usage (10-20 API calls/shop/day) | | | |

**Verdict:** The 4 cron jobs already exceed Hobby's 2-job limit. Must upgrade to **Pro ($20/mo)** immediately for cron jobs to work in production.

### 8.2 Supabase (Current: Free)

| Resource | Free Tier Limit | Upgrade To | When |
|---|---|---|---|
| Database Size | 500 MB | Pro ($25/mo): 8 GB | >500MB data (est. ~2,000 shops with full data) |
| Bandwidth | 5 GB | Pro ($25/mo): 50 GB | >5GB transfer |
| API Requests | 50k/day or 2/hr rate limit | Pro ($25/mo) | >50k API req/day |
| Auth Users | 50k (not using Supabase Auth) | — | N/A (custom auth) |
| Realtime Connections | 200 concurrent | Pro ($25/mo) | >200 open channels |
| Edge Functions | 500k invocations/mo | Pro ($25/mo) | >500k/mo |
| Database Backups | Point-in-time | Pro ($25/mo): 7-day PITR | Production need |
| **Estimated capacity on Free:** ~300-500 shops with moderate usage (each shop ~100 API calls/day) | | | |

**Typical data sizes per shop:**
- Customers: ~1KB each (~500 = ~500KB for 500 shops) → ~250MB
- Orders: ~500B each (~100 = ~50KB for 500 shops) → ~25MB
- Payments: ~200B each (~300 = ~60KB for 500 shops) → ~30MB
- Photos stored on Cloudinary (not Supabase)
- **Total estimate: ~400-500 shops can fit in 500MB database**

### 8.3 Upstash Redis (Current: Free)

| Resource | Free Tier Limit | Upgrade To | When |
|---|---|---|---|
| Storage | 10 MB | Pro ($10/mo): 100 MB | >10MB for rate limiting state |
| Bandwidth | 100 MB/mo | Pro ($10/mo) | >100MB bandwidth |
| Commands | 10k/day | Pro ($10/mo): 500k/day | >10k rate limit checks/day |
| **Estimated capacity on Free:** ~1,000+ shops (rate limiting state is tiny — just counters per IP per window) | | | |

### 8.4 Resend (Current: Free)

| Resource | Free Tier Limit | Upgrade To | When |
|---|---|---|---|
| Emails/Day | 100 | Pro ($20/mo): 50k/day | >100 emails/day |
| Emails Total | 3,000 total | Pro ($20/mo): unlimited | >3k total |
| **Estimated capacity on Free:** ~50-100 shops (each shop gets ~1-2 transactional emails/month) | | | |

### 8.5 Cloudinary (Current: Free)

| Resource | Free Tier Limit | Upgrade To | When |
|---|---|---|---|
| Storage | 25 GB | Advanced ($99/mo): 75 GB | >25GB (est. ~50,000 photos at 500KB each) |
| Bandwidth | 25 GB/mo | Advanced ($99/mo) | >25GB transfer |
| Transformations | 25 credits/mo | Advanced ($99/mo) | >25 image transformations |
| **Estimated capacity on Free:** ~10,000-20,000 photos stored | | | |

### 8.6 Sentry (Current: Free)

| Resource | Free Tier Limit | Upgrade To | When |
|---|---|---|---|
| Errors | 5k/mo | Team ($29/mo): 50k/mo | >5k errors/month |
| Performance | 5k transactions/mo | Team ($29/mo): 50k | >5k transactions |
| **Estimated capacity on Free:** ~500-1,000 shops (errors should be minimal in stable app) | | | |

### 8.7 Summary — When to Upgrade What

```
Immediate (before going live):
  ├── Vercel → Pro ($20/mo)     [needed for 4 cron jobs alone]
  └── All cron jobs tested

At ~200-300 shops:
  ├── Supabase → Pro ($25/mo)   [database approaching 500MB]
  └── Resend → Pro ($20/mo)     [>100 emails/day]

At ~500 shops:
  ├── Vercel → Pro already done
  ├── Upstash → Pro ($10/mo)    [>10k commands/day]
  └── Cloudinary → Advanced or lower ($49/mo)

At ~1,000+ shops:
  ├── Sentry → Team ($29/mo)
  ├── Scale horizontally
  └── Consider dedicated PostgreSQL
```

**Total infrastructure cost per month:**
- Launch: ~$20/mo (Vercel Pro)
- 500 shops: ~$75/mo (Vercel Pro + Supabase Pro + Resend Pro)
- 1,000+ shops: ~$135/mo (Vercel Pro + Supabase Pro + Resend Pro + Upstash Pro + Sentry Team)

---

## 9. TASKS — FULL CATEGORIZED LIST

### 9.1 CRITICAL BUG FIXES

- [ ] **Fix double bcrypt hash** in `src/app/api/team/members/route.ts:51` — single `bcrypt.hashSync(pin, SALT_ROUNDS)`
- [ ] **Add missing `crypto` import** in `src/app/api/team/members/route.ts`
- [ ] **Add session verification** to `src/app/api/shop/delete/route.ts` — verify `MEMBER_SESSION_COOKIE`
- [ ] **Fix payment insert ordering** in `src/lib/db/operations.ts:776-788` — update `amount_paid` before inserting payment record (or use Supabase RPC for atomicity)
- [ ] **Fix `Math.random()` for PIN generation** in `src/app/api/admin/action/route.ts` — use `crypto.randomInt(100000, 999999)`
- [ ] **Remove TOTP secret from API response** in `src/app/api/admin/action/route.ts` — return confirmation only
- [ ] **Fail closed for TOTP** — if `ADMIN_TOTP_SECRET` env var not set, deny all destructive admin actions

### 9.2 HIGH PRIORITY — Security & Auth

- [ ] **Implement session revocation** — add `token_version` to `team_members` table, include in session token payload, increment on PIN change or admin force-logout
- [ ] **Move email rate limiter** from in-memory Map to Upstash Redis (`@upstash/ratelimit`)
- [ ] **Remove `'unsafe-inline'` from CSP** — use hash/nonce-based approach
- [ ] **Add pagination + hard caps** to all admin data queries (max 1,000 records per query)
- [ ] **Add server-side PIN strength validation** in `POST /api/auth/create-shop` using existing `validatePIN()`
- [ ] **Fix session GET endpoint** — re-verify that member's `shop_id` matches session token's `shopId`
- [ ] **Add rate limiting** to unprotected endpoints: `shop/delete`, `shop/update`, `billing/*`, `team/members`
- [ ] **Fix IP blocklist** to fail closed — return hard 403 if Supabase unreachable
- [ ] **Fix rate limiter** to fail closed for normal endpoints on Redis errors

### 9.3 HIGH PRIORITY — Data Integrity & Performance

- [ ] **Add UNIQUE constraint** `(shop_id, order_number)` to orders table in migration
- [ ] **Fix order number race** — wrap `MAX(order_number)+1` in retry loop or use DB sequence
- [ ] **Add missing indexes** — `orders(shop_id, assigned_to)`, `subscription_payments(subscription_id)`
- [ ] **Wrap shop deletion** in a transaction (or delete all related records atomically)
- [ ] **Replace sequential `for...of`** in bulk admin actions with `mapConcurrent` from `src/lib/concurrent.ts`
- [ ] **Fix reports hook** — add caching layer (React Query/SWR or useMemo with stale-while-revalidate)
- [ ] **Fix usePlan hook** — promote to context-level or shared cache

### 9.4 ARCHITECTURE & CODE QUALITY

- [ ] **Add database transaction support** for critical multi-table operations
- [ ] **Extract payment insert into Supabase RPC** — atomic `UPDATE orders.amount_paid` + `INSERT payment`
- [ ] **Fix `logAction` target_type heuristic** — use explicit action→type mapping object
- [ ] **Remove dead code** (e.g., `const type = 'sync-error'` in `sync.ts:76-77`)
- [ ] **Fix string timestamp comparison** in sync conflict resolution — normalize to UTC
- [ ] **Add error propagation** for sync push failures (currently silent)
- [ ] **Add TypeScript schema validation** for Dexie table definitions
- [ ] **Consolidate cookie format handling** — remove 4 legacy token format support in admin session

### 9.5 TEST COVERAGE

- [ ] **Add component tests** for critical UI: auth wizard, order flow, billing, reports
- [ ] **Add E2E tests** with Playwright: signup → login → create order → process → payment
- [ ] **Add sync engine tests** — push/pull, conflict resolution, delta sync
- [ ] **Add race condition tests** — concurrent payments, concurrent order creation, concurrent member creation
- [ ] **Add security tests** — CSRF, session reuse, PIN brute force, rate limit bypass
- [ ] **Add ErrorBoundary tests** — verify graceful crash recovery
- [ ] **Add database integration tests** — test SQL constraints and RLS policies
- [ ] **Improve assertion depth** — check exact error codes, not just `body.success`

### 9.6 UI/UX & FEATURE IMPROVEMENTS

- [ ] **Reduce bundle size** — lazy-load `jspdf`, `recharts`, `blueimp-load-image` on demand
- [ ] **Add loading skeletons** to all data-fetching pages
- [ ] **Add error boundaries** to each route group
- [ ] **Improve offline experience** — show pending sync count badge, disconnected banner
- [ ] **Add dark mode support** (next-themes already installed but check integration)
- [ ] **Add export functionality** — PDF invoices for orders, CSV for customers/payments
- [ ] **Add Urdu Nastaliq font option** — satisfy native Urdu speakers
- [ ] **Add search filters** to all list pages (orders, customers, payments)
- [ ] **Add bulk operations** — select multiple orders and update status, assign karigar

### 9.7 PAYMENT GATEWAY INTEGRATION (Replace Manual Flow)

- [ ] **Integrate automated payment gateway** — options:
  - **Stripe** — international, well-documented, webhooks
  - **JazzCash API** — Pakistan-specific, cheaper for local users
  - **EasyPaisa API** — Pakistan-specific
  - **Sadapay** — Pakistan-specific, modern API
  - **MintStars** — Pakistan-focused payment gateway
- [ ] **Add webhook endpoints** for automated payment confirmation
- [ ] **Replace admin manual activation** with automated subscription activation
- [ ] **Add payment retry/failure handling** with user notifications
- [ ] **Remove Raast manual flow** or keep as fallback option

### 9.8 NEW FEATURES — SUGGESTED

#### Essential for Paid Clients
- [ ] **Invoice generation** — PDF invoices per order with shop branding
- [ ] **Customer portal** — let customers view their order history and tracking
- [ ] **WhatsApp notifications to customers** — order status updates, ready for pickup
- [ ] **SMS notifications** via Twilio or local provider
- [ ] **Multi-language support** — Urdu (Nastaliq), English, Roman Urdu toggle
- [ ] **Data backup & restore** — one-click backup to cloud storage
- [ ] **Activity log** — customer-facing order activity timeline

#### Growth Features
- [ ] **Inventory management** — fabric stock, accessories, supplies tracking
- [ ] **Expense tracking** — shop expenses, payroll, utilities, rent
- [ ] **Multi-branch support** — one owner managing multiple shop locations
- [ ] **Customer loyalty program** — points, discounts, referral rewards
- [ ] **Appointment scheduling** — customer booking for measurements/fittings
- [ ] **Delivery management** — delivery tracking, rider assignment
- [ ] **GST/tax reporting** — automated tax calculation and reports
- [ ] **WhatsApp Business API integration** — rich messaging, templates
- [ ] **POS mode** — simplified order creation for walk-in customers
- [ ] **Barcode/QR scanning** — for order and inventory tracking

#### Admin Panel Enhancements
- [ ] **Automated payment reconciliation** — bank statement upload + auto-match
- [ ] **Advanced analytics** — cohort analysis, customer lifetime value, churn prediction
- [ ] **Marketing tools** — bulk SMS/WhatsApp to customers
- [ ] **A/B testing framework** — test pricing, features
- [ ] **API access for shops** — let shops integrate with their own tools

### 9.9 INFRASTRUCTURE & DEPLOYMENT

- [ ] **Upgrade Vercel to Pro** — required for 4 cron jobs
- [ ] **Set up staging environment** — separate Supabase project + Vercel deployment
- [ ] **Add database backups** — Supabase Pro enables PITR
- [ ] **Set up monitoring** — Sentry performance tracing, uptime monitoring
- [ ] **Add automated deployment** — GitHub Actions for preview deployments
- [ ] **Set up load testing** — k6 or Artillery for key endpoints
- [ ] **Add CDN caching** — Vercel Edge Cache for static assets
- [ ] **Set up error alerting** — Slack/Discord webhooks for critical errors

### 9.10 DOCUMENTATION & ONBOARDING

- [ ] **Write user documentation** — help center with guides for each feature
- [ ] **Write API documentation** — OpenAPI/Swagger spec for public API
- [ ] **Add onboarding wizard** — first-run experience for new shops
- [ ] **Add in-app help tooltips** — contextual help for each page
- [ ] **Write deployment runbook** — how to deploy, rollback, diagnose issues
- [ ] **Add changelog** — keep users informed of updates
- [ ] **Set up feedback system** — in-app feedback widget

---

## 10. FILE-BY-FILE REVIEW CHECKLIST

For every file, check:
- [ ] Correct imports — no missing/unused imports
- [ ] Type safety — no `any` types, proper generics
- [ ] Error handling — all promise rejections caught, meaningful error messages
- [ ] Security — no leaked secrets, proper auth checks, CSRF protection
- [ ] Performance — no N+1 queries, proper indexing, pagination where needed
- [ ] Race conditions — atomic operations for concurrent writes
- [ ] Input validation — Zod schema or manual validation on all user input
- [ ] Logging — sensitive data redacted, audit trail for admin actions
- [ ] Offline handling — graceful degradation when network unavailable
- [ ] i18n — all user-facing strings through translation system

### Key Files Requiring Special Attention

| File | Why |
|---|---|
| `src/proxy.ts` | Core security — auth, rate limiting, CSP, blocklist — edge runtime |
| `src/lib/db/operations.ts` | All CRUD operations — race conditions, data integrity |
| `src/lib/db/sync.ts` | Offline sync engine — conflict resolution |
| `src/lib/auth/session.ts` | Session token creation, verification, rotation |
| `src/lib/admin/auth.ts` | Admin auth — TOTP, session management |
| `src/lib/security/rate-limit.ts` | Rate limiting — Upstash + in-memory fallback |
| `src/lib/security/email-otp.ts` | Email OTP — rate limiting, hashing |
| `src/app/api/admin/action/route.ts` | Destructive admin actions — TOTP verification |
| `src/app/api/admin/data/route.ts` | Admin data queries — OOM risk at scale |
| `src/app/api/team/members/route.ts` | CRITICAL: double bcrypt hash + missing crypto import |
| `src/app/api/shop/delete/route.ts` | CRITICAL: no session auth |
| `src/app/api/cron/*/route.ts` | All 4 cron jobs — cursor tracking, batch limits |
| `src/app/api/billing/submit-payment/route.ts` | Payment submission — idempotency |
| `src/hooks/useReports.ts` | Heavy data fetching — caching needed |
| `src/hooks/usePlan.ts` | Repeated fetches — caching needed |

---

## 11. HOW TO VERIFY SUCCESS

### Test Matrix

| Area | Command / Method | Expected |
|---|---|---|
| Unit tests | `npm test` | 228+ tests passing (no regressions) |
| Lint | `npm run lint` | No errors |
| TypeScript | `npx tsc --noEmit` | No type errors |
| Auth flow | Manual: register → login → session persists | Session cookie set, auto-rotates |
| Order flow | Manual: create order → add payment → change status → deliver | All status transitions work, payments apply correctly |
| Offline | DevTools: go offline → create order → go online → sync | Order appears in Supabase after sync |
| Subscription | Submit payment → admin activates → plan upgrades | Subscription status updated in DB |
| Cron | Run each cron endpoint with Bearer token | Logs `records_processed > 0` |
| Security | Attempt: invalid PIN ×6, wrong TOTP, no session cookie | Rate limited, 401, redirected |
| Admin | Access all admin routes | Proper auth + permissions enforced |
| Performance | Load test: 100 concurrent order creations | No race conditions, <500ms p95 |
| Bundle | `npx next build` | Bundle size within acceptable range |

### Acceptance Criteria

1. **All critical bugs fixed** — no crashes, no data integrity issues
2. **All security vulnerabilities closed** — no fail-open auth, no predictable IDs, no leaked secrets
3. **All API routes properly authenticated** — no unauthorized access paths
4. **All cron jobs reliable** — idempotent, batched, error-resilient
5. **Admin panel paginated** — no OOM risk at any dataset size
6. **All pages render without errors** — no uncaught exceptions
7. **Offline mode functional** — data queues, syncs on reconnect
8. **Subscription flow end-to-end** — from plan selection to activated subscription
9. **Tests comprehensive** — critical paths covered, including race conditions
10. **Infrastructure ready for scale** — upgrade paths documented, monitoring in place

---

## 12. EXECUTION ORDER

### Phase 1 — Patch & Protect (Day 1)
1. Fix all CRITICAL bugs (double bcrypt, crypto import, shop delete auth, payment ordering)
2. Fix HIGH security issues (Math.random, TOTP secret leak, TOTP fail-open)
3. Fix CSP `unsafe-inline`
4. Add session revocation mechanism
5. Add missing indexes to Supabase
6. Run full test suite — verify no regressions

### Phase 2 — Data Integrity & Performance (Week 1)
1. Add UNIQUE constraint + fix order number race
2. Add pagination to admin data endpoints
3. Add server-side PIN validation
4. Fix rate limiter/blocklist fail-open issues
5. Replace sequential bulk ops with concurrent
6. Add caching to useReports, usePlan
7. Add E2E tests for critical flows

### Phase 3 — Production Hardening (Week 2)
1. Integrate automated payment gateway (replace manual Raast)
2. Add comprehensive error handling
3. Add component tests
4. Optimize bundle size (lazy load)
5. Add monitoring and alerting
6. Set up staging environment
7. Write documentation

### Phase 4 — Growth Features (Week 3-4)
1. Customer portal with order tracking
2. WhatsApp notifications to customers
3. Invoice generation
4. Inventory management
5. Multi-language support
6. Data backup & restore

### Phase 5 — Scale & Optimize (Ongoing)
1. Load testing
2. CDN caching
3. Performance optimization
4. Advanced analytics
5. Marketing tools
6. Public API

---

## 13. ENVIRONMENT VARIABLES REFERENCE

```env
# === REQUIRED — app crashes without these ===
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=         # Supabase service role key
NEXT_PUBLIC_APP_URL=               # http://localhost:3000 or https://...
ADMIN_SECRET=                      # HMAC secret for admin session signing
SESSION_SIGNING_SECRET=            # HMAC secret for member session signing (different from ADMIN_SECRET)
ADMIN_TOTP_SECRET=                 # TOTP secret for admin 2FA
CRON_SECRET=                       # Bearer token for Vercel Cron Jobs
OTP_PEPPER_SECRET=                 # Secret for OTP hashing

# === OPTIONAL — functional without, but features degrade ===
NEXT_PUBLIC_VAPID_PUBLIC_KEY=      # Web push VAPID public
VAPID_PRIVATE_KEY=                 # Web push VAPID private
VAPID_SUBJECT=                     # mailto: for push
RESEND_API_KEY=                    # Resend.com API key
RESEND_FROM_EMAIL=                 # From address
UPSTASH_REDIS_REST_URL=            # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN=          # Upstash Redis token
CLOUDINARY_API_SECRET=             # Cloudinary API secret
NEXT_PUBLIC_CLOUDINARY_API_KEY=    # Cloudinary API key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME= # Cloudinary cloud name
SENTRY_DSN=                        # Sentry DSN
ADMIN_NOTIFICATION_EMAIL=          # Admin notification email
CALLMEBOT_API_KEY=                 # CallMeBot WhatsApp API key
NEXT_PUBLIC_RAAST_ID=              # Raast payment ID
NEXT_PUBLIC_RAAST_NAME=            # Raast account holder name
NEXT_PUBLIC_RAAST_BANK=            # Raast bank name
TIMEZONE=Asia/Karachi              # Server timezone
```

---

## 14. FINAL NOTES

- **Do NOT use Supabase Auth** — the app has custom PIN-based auth with bcrypt(12). Keep it, just fix the bugs.
- **Do NOT rewrite the offline-first architecture** — it's well-designed. Just fix sync edge cases.
- **Payment gateway integration is the #1 business improvement** — manual Raast verification will not scale.
- **Vercel Pro upgrade is mandatory before going live** — the 4 cron jobs exceed Hobby's 2-job limit.
- **The app is fundamentally well-architected** — the issues are bugs and hardening, not design flaws.
- **All 228 existing tests must continue to pass** after any change.
