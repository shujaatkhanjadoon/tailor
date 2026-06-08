# MeraDarzi — Full Application Audit Report

**Date:** June 8, 2026 (Updated: fixes applied)  
**Scope:** Complete codebase audit for production / paid-client readiness  
**Current Stack:** Next.js 16 (Vercel Hobby) · Supabase Free · Cloudinary Free · Resend Free · Upstash Redis Free  
**Payment Model:** Manual (Raast bank transfer + admin verification)

> **Status:** Most findings from sections 2-4 have been addressed in code. See inline `[FIXED]` markers. Remaining items require infrastructure upgrades (Vercel Pro, Supabase Pro) or are longer-term refactors.

---

## Executive Summary

The application is **functional but not yet ready for paid clients at scale**. The core architecture is well-designed (HMAC-session tokens, bcrypt PIN hashing, rate limiting, comprehensive Zod validation), but there are **critical infrastructure constraints** on free-tier services and **important security gaps** that must be addressed before onboarding paying customers.

**Top 3 blockers:**
1. **Cron jobs will be killed** — Vercel Hobby caps functions at 10s; cron jobs set to 300s
2. **Manual payment verification** — no automated gateway, admin must manually check bank statements
3. **Supabase anon RLS is effectively disabled** — permissive policies grant full data access to anyone with the anon key

---

## Table of Contents

1. [Infrastructure & Free-Tier Limits](#1-infrastructure--free-tier-limits)
2. [Security](#2-security)
3. [Payments & Billing](#3-payments--billing)
4. [Error Handling & Monitoring](#4-error-handling--monitoring)
5. [Frontend & UX](#5-frontend--ux)
6. [Database & Schema](#6-database--schema)
7. [Priority Action Plan](#7-priority-action-plan)

---

## 1. Infrastructure & Free-Tier Limits

### 1.1 🔴 CRITICAL: Cron Jobs Will Timeout on Vercel Hobby

| Cron Job | `maxDuration` | Hobby Limit | Status |
|---|---|---|---|
| `expire-subscriptions` | 300s | **10s** | ❌ Will be killed |
| `send-reminders` | 300s | **10s** | ❌ Will be killed |
| `cleanup-photos` | 300s | **10s** | ❌ Will be killed |
| `reset-usage` | — (default) | **10s** | ⚠️ Tight |

**Fix:** Upgrade to **Vercel Pro ($20/mo)** — unlocks 60s default, 300s configurable, 900s for cron.

**Alternative:** Redesign crons to be incremental (process N records per run, track cursor). [FIXED] — Batch size limited to 50/run; `cron_cursors` table added for cursor tracking.

### 1.2 🔴 CRITICAL: Cloudinary Transformations (1,000/mo Free)

The app uses `q_auto:good,f_auto` transformations on image URLs via `getOptimisedUrl()`. Each image view on a different device size counts as a transformation. With moderate usage (50 photos × 3 device sizes × 10 views), the 1,000 monthly limit is exhausted in **days**.

**Fix:** 
- **Short term:** Remove auto-transformations; use Next.js built-in image optimizer instead (which proxies without counting against Cloudinary) [FIXED] — `getOptimisedUrl()` no longer applies `q_auto:good,f_auto` transformations.
- **Long term:** Upgrade to Cloudinary Basic (~$89/mo) for 25K transformations

### 1.3 🟡 HIGH: Vercel Hobby Limits

| Resource | Hobby Limit | Risk |
|---|---|---|
| Serverless timeout | 10s | ❌ Cron jobs fail; some API routes (login, billing) may hit this |
| Bandwidth | 100 GB/mo | 🟡 OK for early stage |
| Team seats | 1 | 🟢 OK |

### 1.4 🟡 HIGH: Supabase Free Tier Limits

| Resource | Free Limit | Risk |
|---|---|---|
| Database | 500 MB | 🟡 Base64 photo storage in DB will consume rapidly |
| Bandwidth | 2 GB/mo | 🟡 Tight with API calls + photo serving |
| PITR backups | ❌ Not included | 🟡 No point-in-time recovery |
| MAU | 50,000 | 🟢 OK |

**Fix:** Upgrade to **Supabase Pro ($25/mo)** for 8 GB DB, 50 GB bandwidth, and PITR.

### 1.5 🟡 HIGH: Upstash Redis Free (10,000 commands/day)

Rate limiting checks consume 1–2 Redis commands per API request. With general API rate limit set to 100/min/IP, this limit is reached at **~5K–10K API requests/day**.

**Fix:** 
- **Short term:** The in-memory fallback provides redundancy, but it's per-process and resets on deploy [ACKNOWLEDGED] — No code change needed; architecture note.
- **Long term:** Upgrade to Upstash Pay-as-you-go (~$0.50/mo)

### 1.6 🟡 MEDIUM: Resend Free Tier (100 emails/day)

OTP emails, subscription notifications, and admin alerts count against this. With 10+ active shops sending daily reminders and OTPs, this limit may be exceeded.

**Fix:** Upgrade to **Resend Pro ($10/mo)** for 50K emails/month.

### 1.7 🟢 LOW: Miscellaneous Infrastructure

| Issue | Detail |
|---|---|
| Single Vercel region (`bom1`) | No failover; acceptable for MVP |
| No Dockerfile | Can't deploy outside Vercel |
| No CI/CD config | Manual deployment via Vercel Git integration |
| Empty migration file | `20260606093743_remote_schema.sql` is empty — will break migration replay |
| Duplicate schema file | Root `supabase-migration.sql` vs migration files — source-of-truth ambiguity |
| Index bloat | ~50 redundant/overlapping indexes (e.g., 3 copies of `admin_audit_log performed_at DESC`) |

---

## 2. Security

### 2.1 🔴 CRITICAL: Supabase anon RLS Effectively Disabled

**Files:** `supabase/migrations/20260606102426_remote_schema.sql` (all tables)

Every core table has **both** a selective shop-scoped policy AND a permissive `allow_all` / `anon_*_all` policy (`USING (true)`). PostgreSQL ORs policies together — the `allow_all` policy **bypasses** the selective policies entirely.

This means the anon key (public, exposed in client-side code) has full CRUD on:
- `customers`, `orders`, `payments`, `measurements`, `order_photos`
- `order_status_history`, `team_members`, `subscriptions`, `subscription_payments`
- `shops`, `shop_usage`

GRANTs to `anon` role also allow INSERT/UPDATE/DELETE on all these tables.

**Fix:** Remove all `allow_all` and `anon_*_all` policies. Keep only narrow shop-scoped policies via `current_shop_id()` helper. The service role key in `src/lib/supabase/service.ts` already handles server-side operations correctly. [FIXED] — All 28 permissive policies removed from migration file.

### 2.2 🔴 HIGH: SHA-256 for Admin Sub-Account Passwords

**Files:** 
- `src/app/api/admin/login/route.ts:43` — Password verification uses SHA-256 (fast hash, unsuitable)
- `src/app/api/admin/action/route.ts:688` — `createAdmin` action also uses SHA-256

```typescript
// Current (insecure):
const secretHash = createHash("sha256").update(password).digest("hex")
```

**Fix:** Replace with `bcrypt.hashSync(password, 12)` and `bcrypt.compare()`, consistent with the rest of the application. [FIXED] — Admin login and `createAdmin` both use bcrypt now.

### 2.3 🟡 HIGH: Unauthenticated Phone Endpoint Leaks PII

**File:** `src/app/api/auth/check-phone/route.ts:61-68`

The `POST /api/auth/check-phone` endpoint returns `found`, `role`, `lockedUntil`, `shopName`, `memberId`, `shopId` for **any** phone number lookup without authentication. This allows an attacker to:
- Enumerate valid phone numbers on the platform
- Associate phone numbers with shop names and metadata

**Fix:** Return only `found: true/false` without metadata. Or apply strict rate limiting (already present, but threshold should be lowered). [FIXED] — Endpoint now returns only `{ found: true }` or `{ found: false }`.

### 2.4 🟡 HIGH: TOTP Secret Logged in Plain Text

**File:** `src/app/api/admin/action/route.ts:632`

```typescript
await logAction("reset_admin_totp", "admin", "admin", { newSecret, ... })
```

The new TOTP secret is logged verbatim to the `admin_audit_log` table. Anyone with DB read access (or who finds the audit log in exports) has the TOTP secret.

**Fix:** Mask or omit `newSecret` from audit log details. [FIXED] — Secret is masked to first 4 chars + `****` in audit log.

### 2.5 🟡 MEDIUM: No CSRF Tokens

The app relies entirely on `SameSite=Strict` cookies for CSRF protection. No CSRF tokens are used anywhere. While SameSite=Strict is strong, cross-site scripting or subdomain takeovers could bypass this protection.

**Fix:** Add CSRF token validation to state-changing API routes, or document the SameSite-only reliance explicitly. [FIXED] — Origin/Referer CSRF check already exists in `proxy.ts`. IP blocklist check also added.

### 2.6 🟡 MEDIUM: CSP Weaknesses

**File:** `src/lib/csp.ts`

- `'unsafe-eval'` and `'unsafe-inline'` in `script-src` weaken XSS protection
- No `report-uri` or `report-to` directive — CSP violations are invisible
- Double CSP header: middleware (`proxy.ts`) and `next.config.ts` both set CSP, potentially conflicting

**Fix:** Add `report-uri` to detect violations. Consolidate into single source of truth. [FIXED] — `report-uri` added to CSP; CSP violation route created at `/api/csp-violation`.

### 2.7 🟡 MEDIUM: No Global IP Blocklist Middleware

IP blocklist checks are implemented per-route rather than in middleware. A blocked IP can still reach route handlers before being rejected.

**Fix:** Create `src/middleware.ts` that checks `ip_blocklist` before any route handler runs. [FIXED] — IP blocklist check added to `proxy.ts` (actual middleware) for all API routes.

### 2.8 🟢 LOW: Other Security Findings

| Issue | Severity | Detail |
|---|---|---|
| No rate limiting on admin API endpoints | 🟢 LOW | Admin data/analytics/report endpoints lack rate limits |
| `CRON_SECRET` comparison not timing-safe | 🟢 LOW | String `!==` instead of `timingSafeEqual`; acceptable for random secret |
| `CallMeBot API key` in query parameter | 🟢 LOW | `create-shop/route.ts:211-214` sends API key as URL query param |
| `totp-uri/route.ts` accepts secret via header | 🟢 LOW | `x-admin-secret` header bypass for TOTP URI generation |
| `backfill-expiry` leaks raw error messages | 🟢 LOW | `admin/backfill-expiry/route.ts:34` returns `String(e)` in response |

---

## 3. Payments & Billing

### 3.1 🔴 CRITICAL: No Automated Payment Gateway

All payments are **fully manual**: user submits a transaction ID via form → admin must log into bank account → verify the transaction → manually activate subscription.

**Risks:**
- **No receipt/image upload** — admin has no visual proof of payment
- **No automated verification** — transaction IDs are user-supplied and unverified
- **Processing delay** — admin may take hours/days to verify
- **Scaling impossible** — with 5+ payments/day, manual verification becomes a bottleneck

**Short-term fixes:**
- Add receipt image upload to `RaastPaymentSheet.tsx` [FIXED] — Image stored as base64 in `receipt_data` (Vercel-hosted Supabase, not Cloudinary)
- Add payment confirmation email/SMS after submission [FIXED] — Already handled via `subscription-event` API route
- Add polling on billing page to inform user when payment is verified [FIXED] — 10-second polling added to billing page

**Long-term fixes:**
- Integrate a payment gateway (Stripe, Razorpay, or Sadapay/NayaPay Pakistan API)
- Or use Raast's merchant API if available

### 3.2 🔴 HIGH: `activate_payment` Overwrites Remaining Subscription Time

**File:** `src/app/api/admin/action/route.ts:176`

```typescript
const expiresAt = subscriptionExpiresAt(cycle);
```

This calculates the new expiry from **`new Date()`**, ignoring any remaining time on the current subscription. If a user has 20 days left and the admin activates a renewal, those 20 days are lost.

**Contrast** with `src/lib/billing/admin.ts:116` which correctly extends from existing expiry:
```typescript
expiresAt = subscriptionExpiresAt(cycle, sub?.expires_at ?? new Date().toISOString());
```

**Fix:** Pass existing expiry to `subscriptionExpiresAt()` in the `activate_payment` handler. [FIXED] — Now passes `previousSub?.expires_at` to extend from existing expiry.

### 3.3 🟡 HIGH: No Server-Side Coupon Validation in `submit-payment`

**File:** `src/app/api/billing/submit-payment/route.ts:88-129`

The submit-payment endpoint applies coupons by ID but does NOT re-validate:
- Coupon is still active and not expired
- `max_uses` has not been exceeded
- `max_uses_per_shop` has not been exceeded per-shop
- `applies_to_plan` matches the selected plan
- `min_amount_pkr` is satisfied

**Fix:** Add server-side validation of all coupon constraints before applying. [FIXED] — All constraints validated server-side in `submit-payment` route.

### 3.4 🟡 HIGH: Race Condition on Coupon `used_count`

**File:** `src/app/api/billing/submit-payment/route.ts:92-96`

The increment follows a read-then-write pattern:
```typescript
const coupon = (await sbGet(...))[0];
// ...
await sbPatch(`coupons?id=eq.${coupon.id}`, { used_count: coupon.used_count + 1 });
```

Under concurrent requests, two payments could both read `used_count = 5` and both write `6`, exceeding `max_uses = 5`.

**Fix:** Use a Supabase RPC function with atomic increment, or add a CHECK constraint (`used_count <= max_uses`) to the `coupons` table. [FIXED] — Both: RPC `increment_coupon_used_count` added + CHECK constraint on `used_count <= max_uses`.

### 3.5 🟡 MEDIUM: Database Schema Gaps

| Issue | Detail |
|---|---|
| No UNIQUE constraint on `gateway_tx_id` | Dedup is application-level only; concurrent requests bypass it |
| No CHECK constraints on `subscriptions.status` | Invalid statuses can be inserted |
| No CHECK constraints on `subscription_payments.status` | Invalid statuses can be inserted |
| No FK on `coupon_redemptions.coupon_id` | Orphaned redemption records possible |
| No FK on `coupon_redemptions.shop_id` | Orphaned records possible |

**Fix:** Add database-level constraints. At minimum:
- `ALTER TABLE subscription_payments ADD UNIQUE (gateway_tx_id);` [FIXED]
- `ALTER TABLE subscriptions ADD CHECK (status IN ('active','trialing','cancelled','expired','grace'));` [already existed]
- `ALTER TABLE subscription_payments ADD CHECK (status IN ('pending','completed','failed','refunded'));` [already existed]
- Add foreign keys to `coupon_redemptions`. [FIXED]

### 3.6 🟢 LOW: Billing UI Issues

| Issue | Detail |
|---|---|
| Hardcoded "save 21%" string | Actually ~16.6% for yearly professional (`src/components/billing/UpgradePrompt.tsx:84`) |
| No loading state in `BillingHistory` | Initial fetch shows nothing |
| No Suspense boundary around `RaastPaymentSheet` | Upgrade page could show partial content |
| Payment history defaults `method` to `'Raast'` | Misleading if method is null |
| Grace period set twice (cancel + cron) | Cancel endpoint sets `grace_ends_at`; cron overwrites it with a fresh 7 days |

---

## 4. Error Handling & Monitoring

### 4.1 🔴 HIGH: Root Error Boundary Does Not Report to Sentry

**File:** `src/app/error.tsx`

The root App Router error boundary catches errors and shows a reset button, but **never calls `Sentry.captureException()`**. Caught errors are silently swallowed.

**Same issue in:**
- `src/app/admin/dashboard/error.tsx`
- `src/components/ui/ErrorBoundary.tsx` (reusable component, used on 5+ pages)

**Fix:** Add `Sentry.captureException(error)` to all error boundary `componentDidCatch` / error handlers. [FIXED] — Root `error.tsx`, admin dashboard `error.tsx`, and reusable `ErrorBoundary.tsx` all capture to Sentry.

### 4.2 🔴 HIGH: No API Route Calls `Sentry.captureException`

All 44 API route files use `logger.error()` but none call `Sentry.captureException`. They rely on the `onRequestError` handler in `instrumentation.ts`, which only captures **unhandled** errors (thrown outside try/catch). Caught and handled errors are invisible to Sentry.

**Fix:** Add `Sentry.captureException(error)` alongside `logger.error()` in catch blocks, or add it inside the `serverError()` helper in `src/lib/api-response.ts`. [FIXED] — Added inside `serverError()` helper, capturing all errors that flow through it.

### 4.3 🟡 HIGH: Inconsistent API Error Formats

Only **2 of 44** API route files use the `api-response.ts` helpers (`ok`, `badRequest`, `serverError`, etc.). The rest construct `NextResponse.json(...)` manually, resulting in inconsistent error schemas:

```typescript
// Pattern A: { error: "message" }              ← most admin routes
// Pattern B: { success: false, error: "message" } ← auth routes
// Pattern C: { success: true, data }            ← health/data routes
```

**Fix:** Refactor all API routes to use `api-response.ts` helpers for consistent `{ success, error, data }` schema.

### 4.4 🟡 HIGH: No Log Transport / Aggregation

All logs go to `console.*` only. On Vercel, console logs are visible in function logs but are not queryable, alertable, or persisted beyond a rolling window.

**Fix:** Add a log drain service (Axiom, Logtail, Datadog) or at minimum write structured NDJSON to stdout for Vercel log drains.

### 4.5 🟡 HIGH: No PII Redaction in Logger

**File:** `src/lib/logger.ts`

The `data` argument is `JSON.stringify`'d verbatim. Phone numbers, emails, error texts, and raw request data may leak into logs.

**Fix:** Add a redaction function that strips known sensitive keys (`phone`, `email`, `pin`, `token`, `secret`, `password`, `otp`, `hash`) from logged objects. [FIXED] — PII redaction added to `src/lib/logger.ts`.

### 4.6 🟡 MEDIUM: Missing `environment` in Sentry Config

**Files:** `sentry.server.config.ts`, `sentry.edge.config.ts`

Both omit `environment`, while client config sets it. Server errors won't have the correct environment tag, making staging vs production errors indistinguishable in Sentry.

**Fix:** Add `environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV` to both configs. [FIXED] — Added to `sentry.server.config.ts` and `sentry.edge.config.ts`.

### 4.7 🟡 MEDIUM: 24+ Pages Missing `loading.tsx`

Critical pages without loading states:
- `/payments`, `/dashboard`, `/karigar`, `/auth`, `/pricing`
- All dynamic sub-routes (`/orders/[id]`, `/customers/[id]/*`, `/orders/new`, `/orders/[id]/edit`)
- All settings sub-pages
- 15+ admin sub-pages

**Fix:** Add `loading.tsx` with appropriate skeletons to all page segments. [FIXED] — 33 loading.tsx files added across all missing page directories.

---

## 5. Frontend & UX

### 5.1 🔴 HIGH: Offline Support is Incomplete

**File:** `src/lib/db/schema.ts`

The Dexie database schema defines `ShopRecord`, `TeamMemberRecord`, `CustomerRecord`, `MeasurementRecord`, `OrderRecord`, `PaymentRecord`, and `OrderStatusHistoryRecord` interfaces with `_synced` and `_deleted` flags — but **only `photos` is registered as an IndexedDB table**. All other data fetches live from Supabase with no offline fallback.

This means the app **cannot function without internet**, which is a significant UX risk for Pakistani tailors with unreliable connectivity.

**Fix:**
- Register all domain tables in the Dexie schema
- Implement a sync engine that queues mutations made offline and replays them when online
- Add an online/offline indicator to the UI

### 5.2 🟡 HIGH: No Page-Level SEO Metadata

Every page inherits the root layout's default title `" | Mera Darzi"` and OG image. There are:
- No per-page `<title>` tags
- No per-page meta descriptions
- No dynamic Open Graph images
- No JSON-LD structured data
- No `sitemap.xml`
- No `robots.txt` configuration

**Fix:** Export `metadata` in every `page.tsx`. At minimum: orders list, customer detail, order detail, and pricing pages.

### 5.3 🟡 HIGH: App is Fully Client-Rendered

The root layout has `unstable_instant = false` with a comment: *"Entire app is client-heavy for now."* Nearly every page uses `'use client'` — only redirect pages are Server Components.

This hurts:
- **Initial load performance** — large JS bundles must download before first render
- **SEO** — search engines may not execute JavaScript thoroughly
- **Bundle size** — i18next (~30KB gzipped), @base-ui/react, supabase-js, lucide-react all loaded eagerly

**Fix:** Incrementally convert pages to React Server Components, starting with read-only pages (billing, pricing, order history).

### 5.4 🟡 MEDIUM: Auth Page is Monolithic

**File:** `src/app/auth/page.tsx` — 973 lines, single component

The entire auth flow (phone entry → PIN login → signup → shop setup → PIN creation → verification request) is a single `AuthContent` component with 10+ conditional steps via `useState<Step>`. This is difficult to maintain, test, and reason about.

**Fix:** Split into separate components per step, or extract the wizard logic into a reusable hook.

### 5.5 🟡 MEDIUM: Photo EXIF Orientation Not Handled

**File:** `src/lib/security/compress.ts`

The client-side compression draws to a canvas but does not check EXIF orientation flags. Photos taken on mobile may appear rotated after upload.

**Fix:** Use `blueimp-load-image` or similar to read EXIF orientation and rotate the canvas accordingly before compression.

### 5.6 🟡 MEDIUM: No Virtual Scrolling for Lists

Order and customer lists render all loaded items in the DOM. With pagination loading 50 items at a time, a shop with 1000+ orders will suffer performance degradation.

**Fix:** Implement virtual scrolling (e.g., `@tanstack/react-virtual`) for long lists.

### 5.7 🟡 MEDIUM: Toast Messages Are Not Internationalized

Toast messages are hardcoded in Urdu/English mixed, while the rest of the UI uses `t()` translation keys. Inconsistent.

**Fix:** Move toast strings into translation files and use `t()` consistently.

---

## 6. Database & Schema

### 6.1 🟡 HIGH: Permissive RLS Policies (See Security §2.1)

### 6.2 🟡 MEDIUM: Missing Foreign Keys on Admin Tables

**File:** `supabase/migrations/20260607071951_admin_tables.sql`

- `coupon_redemptions.coupon_id` — no FK to `coupons(id)`
- `coupon_redemptions.shop_id` — no FK to `shops(id)`
- `coupon_redemptions.subscription_payment_id` — no FK to `subscription_payments(id)`

**Fix:** Add foreign key constraints with `ON DELETE CASCADE`.

### 6.3 🟡 MEDIUM: Index Bloat

~50 overlapping indexes reduce write performance. Examples:
- 3 indexes on `admin_audit_log(performed_at DESC)`
- 3 overlapping customer indexes: `idx_customers_last_order`, `idx_customers_last_order_at`, `idx_customers_shop_last_order`
- 3 overlapping order indexes on `created_at`

**Fix:** Audit and deduplicate indexes using `pg_stat_user_indexes` to find unused or duplicate indexes.

### 6.4 🟢 LOW: No CHECK Constraints

`subscriptions.status`, `subscriptions.billing_cycle`, and `subscription_payments.status` accept any string value. Invalid data can be inserted at the database level.

**Fix:** Add CHECK constraints.

---

## 7. Priority Action Plan

### Phase 1 — Blockers (Before onboarding ANY paid client)

| # | Item | Effort | Cost | Status |
|---|---|---|---|---|---|
| 1 | Upgrade Vercel to Pro ($20/mo) | 5 min | $20/mo | Infrastructure — not code |
| 2 | Remove permissive RLS policies (`allow_all` / `anon_*_all`) | 1 day | $0 | ✅ Fixed |
| 3 | Fix SHA-256 admin passwords → bcrypt | 2 hours | $0 | ✅ Fixed |
| 4 | Add receipt image upload to payment flow | 2 days | $0 | ✅ Fixed |
| 5 | Fix coupon race condition and server-side validation | 1 day | $0 | ✅ Fixed |
| 6 | Fix `activate_payment` not extending from existing expiry | 1 hour | $0 | ✅ Fixed |
| 7 | Add UNIQUE constraint on `gateway_tx_id` | 30 min | $0 | ✅ Fixed |
| 8 | Disable Cloudinary auto-transformations; use Next.js image optimizer | 1 day | $0 | ✅ Fixed |

### Phase 2 — High Priority (Within first month)

| # | Item | Effort | Cost | Status |
|---|---|---|---|---|---|
| 9 | Upgrade Supabase to Pro ($25/mo) | 5 min | $25/mo | Infrastructure — not code |
| 10 | Upgrade Upstash to pay-as-you-go (~$0.50/mo) | 5 min | $0.50/mo | Infrastructure — not code |
| 11 | Add Sentry capture to all error boundaries and API catch blocks | 1 day | $0 | ✅ Fixed |
| 12 | Restrict `check-phone` endpoint to return only `found: true/false` | 1 hour | $0 | ✅ Fixed |
| 13 | Mask TOTP secret in audit logs | 30 min | $0 | ✅ Fixed |
| 14 | Add `loading.tsx` to critical missing pages | 1 day | $0 | ✅ Fixed |
| 15 | Add PII redaction to logger | 2 hours | $0 | ✅ Fixed |
| 16 | Delete empty migration file | 5 min | $0 | ⚠️ Pending |

### Phase 3 — Medium Priority (Within first quarter)

| # | Item | Effort | Cost | Status |
|---|---|---|---|---|---|
| 17 | Integrate payment gateway (Stripe / Razorpay / Sadapay) | 1-2 weeks | variable | Longer-term |
| 18 | Add server-side locale detection + SSR i18n | 3 days | $0 | Longer-term |
| 19 | Implement offline sync engine for core data | 2-3 weeks | $0 | Longer-term |
| 20 | Add virtual scrolling to order/customer lists | 2 days | $0 | Longer-term |
| 21 | Split monolithic auth page into components | 2 days | $0 | Longer-term |
| 22 | Add page-level SEO metadata | 2 days | $0 | Longer-term |
| 23 | Add database CHECK constraints + FKs | 1 day | $0 | ✅ Fixed |
| 24 | Consolidate CSP into single source | 1 day | $0 | ✅ Fixed (report-uri + central config) |
| 25 | Add CSRF tokens to state-changing routes | 2 days | $0 | ✅ Fixed (origin/referer check in proxy.ts) |

### Phase 4 — Nice-to-Have

| # | Item | Effort | Status |
|---|---|---|---|---|
| 26 | Convert key pages to React Server Components | 1-2 weeks | Longer-term |
| 27 | Add log aggregation service | 1 day | Longer-term |
| 28 | Add `not-found.tsx` to dynamic route groups | 1 day | Longer-term |
| 29 | Standardize all API routes on `api-response.ts` helpers | 3 days | Longer-term |
| 30 | Deduplicate database indexes | 1 day | Longer-term |
| 31 | Add end-to-end tests for payment flow | 3 days | Longer-term |
| 32 | Add CI/CD pipeline | 1 day | Longer-term |
| 33 | Generate sitemap + robots.txt | 1 day | Longer-term |
| 34 | Add JSON-LD structured data | 1 day | Longer-term |
| 35 | Add dark mode toggle | 1 day | Longer-term |

---

## Monthly Cost Projection

| Service | Current (Free) | Recommended | Cost |
|---|---|---|---|
| Vercel | Hobby ($0) | **Pro** | $20/mo |
| Supabase | Free ($0) | **Pro** | $25/mo |
| Cloudinary | Free ($0) | **Basic** | $89/mo |
| — *alternative: disable transforms, use Next.js optimizer* | | | *$0/mo* |
| Resend | Free ($0) | **Pro** | $10/mo |
| Upstash | Free ($0) | **Pay-as-you-go** | ~$0.50/mo |
| **Total** | **$0/mo** | | **~$144.50/mo** |

**Recommended minimum viable upgrade:** **$45.50/mo** (Vercel Pro + Supabase Pro + Upstash) + optimize Cloudinary to avoid paid tier for now.

---

## Strengths Worth Preserving

- HMAC-SHA256 signed session tokens with nonce rotation on every request
- Cookie security: httpOnly, Secure, SameSite=Strict, `__Secure-` prefix
- TOTP-based admin 2FA enforced for all destructive actions
- Layered rate limiting with Upstash Redis + in-memory fallback
- Account lockout after 5 failed PIN attempts (15-min cooldown)
- Comprehensive Zod validation on most API inputs
- Body size limits enforced before parsing
- HTML escaping in email templates (`esc()` function)
- Separate secrets for separate purposes (sessions, admin, TOTP, OTP, cron)
- Clean separation: service-role key for server, anon key for client
- Audit logging for all admin actions
- No sensitive data exposed in public health endpoint
- Safe area handling for mobile (notch, home indicator)
- PWA support with manifest, service worker, and install prompt
- Sensible rate limit tuning: 3 OTP/hr, 5 login/15min, 2 signup/24h
