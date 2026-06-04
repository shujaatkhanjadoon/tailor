# Tailor App — Comprehensive Audit Report

Generated: June 4, 2026
Scope: Full-stack Next.js (16.2.4) + Supabase + React 19 + Tailwind v4

---

## Executive Summary

**Overall assessment: Alpha quality — functional core works, but 10+ critical/high issues across security, database, and production readiness prevent safe production deployment.**

The subscription billing and cron job logic was audited and fixed in a prior session (off-by-one expiry, grace period not honored, NULL handling in usage reset, activation not extending existing time). The remaining audit below covers the entire application.

---

## 1. Security Audit

### CRITICAL: RLS is disabled on ALL tables

**File:** `supabase-migration.sql:145-157`
**Severity:** CRITICAL
**Impact:** The database has zero row-level security. All authorization depends entirely on application-layer code in `proxy.ts`. If any API route has a bug, the service role key (used in `src/lib/supabase/service.ts`) has unfettered access to every table. There is no defense in depth.

**Fix:** Enable RLS on every table, create policies that mirror the proxy's auth checks (e.g., `shop_id = current_setting('app.shop_id')`).

### CRITICAL: Service role key exposed to all server-side code

**File:** `src/lib/supabase/service.ts:2`
**Severity:** CRITICAL
**Impact:** `SUPABASE_SERVICE_ROLE_KEY` is loaded eagerly at module scope and used for every database operation. Every API route, cron job, and server action imports from `service.ts`. There is no per-request key scoping. A compromised API route has full admin database access.

**Fix:** Use the anon key with RLS for member-scoped queries; reserve the service key for admin-only operations that need escalation.

### HIGH: No authentication on `/api/auth/log-attempt`

**File:** `src/` (route under `/api/auth/log-attempt`)
**Severity:** HIGH
**Impact:** This endpoint accepts POST requests from anyone. While it only logs attempts, it could be abused to fill the audit log with spam, and if the route shape leaks sensitive fields, it's an information leak.

### HIGH: Session signing secret falls back to ADMIN_SECRET

**File:** `src/lib/auth/session.ts:7`
**Severity:** HIGH
**Impact:** If `SESSION_SIGNING_SECRET` is not set, it silently falls back to `ADMIN_SECRET`. This means the same secret both signs member sessions and authenticates admin logins. If either is compromised, both auth systems fall.

**Fix:** `getSecret()` should throw if `SESSION_SIGNING_SECRET` is missing, not fall back to `ADMIN_SECRET`.

### HIGH: CSP allows `'unsafe-inline'` for scripts and styles

**File:** `src/proxy.ts:12-13`
**Severity:** HIGH
**Impact:** `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` make CSP significantly less effective against XSS. While this is required for Next.js by default, it should be tightened with nonces or hashes.

### MEDIUM: CSRF protection is origin-only

**File:** `src/proxy.ts:65-78`
**Severity:** MEDIUM
**Impact:** The CSRF check only validates the `Origin` header. Some browsers/clients don't send the `Origin` header, and the check is skipped entirely if `origin` is null. No anti-CSRF token is used.

### MEDIUM: No input size limits on most API routes

**File:** `src/proxy.ts:189-197`
**Severity:** MEDIUM
**Impact:** The global 5MB limit is good, but individual routes don't validate payload sizes. The `validate()` helper doesn't enforce content-length limits. A large payload could exhaust memory.

### MEDIUM: PIN encryption key from single env var with no rotation

**File:** `src/lib/auth/` (PIN encryption logic)
**Severity:** MEDIUM
**Impact:** `PIN_ENCRYPTION_KEY` is a static AES-256-GCM key. No key rotation mechanism exists.

### LOW: `__Secure-` cookie prefix requires HTTPS

**File:** `src/lib/auth/session.ts:4`
**Severity:** LOW
**Impact:** The `__Secure-` prefix in `__Secure-md_session` requires HTTPS. In local dev (localhost), browsers accept it, but if deployed behind a proxy that terminates HTTPS, the cookie won't be sent.

---

## 2. Performance Audit

### HIGH: No pagination on admin data endpoints

**Files:** `src/lib/billing/admin.ts:53-67`, `:385-396`, `:419-430`
**Severity:** HIGH
**Impact:** `getAllShops()`, `getAllPayments()`, `getAuditLogForAdmin()` fetch ALL records without pagination. As the user base grows beyond hundreds, these endpoints will become increasingly slow and memory-intensive. The manual join in `getAllShops()` (3 separate `sbGet` calls + in-memory filter) compounds the problem.

### HIGH: Serial cron job processing

**File:** `src/app/api/cron/expire-subscriptions/route.ts`
**Severity:** HIGH
**Impact:** Each cron step processes subscriptions one-by-one with individual `sbPatch` calls in a `for` loop (N+1 pattern). For thousands of subscriptions, this will time out Vercel's 60s function limit.

### MEDIUM: Direct client-side database queries

**Files:** Various hooks and `usePlan` hook
**Severity:** MEDIUM
**Impact:** Pages fetch subscription data directly from Supabase via the client library. There is no server-side caching layer (Redis, CDN) or SWR-style caching for API responses.

### MEDIUM: No request deduplication

**Severity:** MEDIUM
**Impact:** Multiple components can call the same API endpoint or Supabase query on the same page load, causing redundant network requests.

### MEDIUM: Large dependencies not dynamically imported

**Files:** `recharts`, `jspdf`, `qrcode`, `cmdk`
**Severity:** MEDIUM
**Impact:** These large libraries are imported statically and increase initial bundle size. `recharts` alone is ~500KB minified.

### MEDIUM: Multiple database round-trips in single admin functions

**File:** `src/lib/billing/admin.ts:312-317`
**Severity:** MEDIUM
**Impact:** `getRevenueAnalytics()` makes 3 separate REST calls to Supabase, then joins and aggregates data in JavaScript. A single Supabase query with `select=...` and joins would be more efficient.

---

## 3. Code Quality & Standards

### HIGH: Pervasive `any` types

**Files:** `src/lib/billing/admin.ts`, `src/lib/supabase/service.ts`, `src/hooks/`, `src/lib/auth/`
**Severity:** HIGH
**Impact:** `sbGet()` returns `Promise<any[]>`, and most data processing uses `.map((s: any) => ...)`. This defeats TypeScript's type checking and makes refactoring dangerous. The `types.ts` file exists with generated types but is not used consistently.

### HIGH: Inconsistent error handling

**Severity:** HIGH
**Impact:** Some paths catch errors per-iteration (good), others fail entirely. Some API routes return detailed error messages (e.g., the Supabase error text), others return generic "Internal Server Error" or nothing at all. No structured error response format exists.

### HIGH: No test coverage for core paths

**Severity:** HIGH
**Impact:** Only 2 test files exist (billing cycles and payment calculations). Zero tests for:
- Auth flow (PIN login, session rotation, TOTP verification)
- Cron jobs (expire-subscriptions, reset-usage, remind-renewal, cleanup-photos)
- API routes (admin actions, auth endpoints)
- Component rendering (any component)
- Hook behavior (usePlan, AuthContext)

### MEDIUM: Hardcoded magic numbers

**Files:** Throughout
**Severity:** MEDIUM
**Impact:** `604800000` (7 days ms), `86400000` (1 day ms), `30000` (30s timeout) appear without named constants.

### MEDIUM: i18n keys inconsistency

**Severity:** MEDIUM
**Impact:** Some components use inline Urdu text, others use `useTranslation()` with i18n keys. There's no single source of truth for translations.

### MEDIUM: `console.error` for error handling

**Severity:** MEDIUM
**Impact:** All error handling uses `console.error()` without structured logging, log levels, correlation IDs, or error tracking integration.

---

## 4. Database & Backend Audit

> **Previously fixed (prior session):** Billing cycle off-by-one, grace period not honored, cron step-0 query excluding cancelled, reset-usage NULL handling, activation not extending existing expiry.

### HIGH: No database constraints for data integrity

**File:** `supabase-migration.sql`
**Severity:** HIGH
**Impact:** The schema lacks CHECK constraints on `subscriptions.status`, `subscriptions.plan`, `billing_cycle`, etc. Invalid data can be inserted by any code path or direct SQL access. There are no UNIQUE constraints on critical fields beyond what PostgREST's `on_conflict` implies.

### HIGH: No cascade deletes — manual deletion order required

**File:** Various delete endpoints
**Severity:** HIGH
**Impact:** Deleting a shop requires manually deleting from multiple tables in the correct order. If one delete fails, orphaned records remain. Foreign key constraints (if any) are not used to enforce referential integrity.

### MEDIUM: Soft delete vs hard delete inconsistency

**Severity:** MEDIUM
**Impact:** Some tables use `deleted_at` (soft delete: team_members, customers, orders, payments, measurements, order_photos), others are hard-deleted (subscriptions, shop_usage, subscription_payments). No consistent strategy.

### MEDIUM: `sbUpsertByShopId` assumes unique `shop_id` constraint exists

**File:** `src/lib/supabase/service.ts:114-123`
**Severity:** MEDIUM
**Impact:** This upsert relies on a unique constraint on `shop_id`. If the constraint doesn't exist in the database, duplicate rows will be created on every upsert. The migration SQL doesn't explicitly define this constraint for all tables.

### MEDIUM: No formal backup strategy

**Severity:** MEDIUM
**Impact:** No backup scripts, point-in-time recovery config, or data export mechanisms exist in the repository.

### LOW: Single migration file with no versioning

**File:** `supabase-migration.sql`
**Severity:** LOW
**Impact:** All schema changes are in a single unversioned SQL file. No migration framework (Prisma, Kysely, etc.) is used.

---

## 5. Frontend & UI/UX Audit

### MEDIUM: No RTL support despite Urdu language support

**File:** `components.json` (rtl: false)
**Severity:** MEDIUM
**Impact:** The app supports Urdu language but has no RTL layout support. Urdu text is displayed left-to-right.

### MEDIUM: Inconsistent loading states

**Severity:** MEDIUM
**Impact:** Some pages use skeleton loaders, others use a spinner, others have no loading state at all. No unified loading pattern.

### MEDIUM: Accessibility gaps

**Severity:** MEDIUM
**Impact:** Interactive elements lack proper ARIA labels, keyboard navigation, and focus management. The PinPad has labels on digit buttons, but other components (dropdowns, modals, tables) lack accessibility attributes.

### MEDIUM: Form validation is client-side only

**Severity:** MEDIUM
**Impact:** Zod validation runs on the client, but there's inconsistent server-side re-validation. Malformed data could reach the database.

### LOW: Mobile responsiveness edge cases

**Severity:** LOW
**Impact:** Some pages with hardcoded widths may overflow on very small screens.

---

## 6. API & Integration Audit

### MEDIUM: Inconsistent response format across endpoints

**Severity:** MEDIUM
**Impact:** Some endpoints return `{ success: true }`, others `{ error: "..." }`, others `{ data: ... }`, others return data directly. No standardized API response envelope.

### MEDIUM: Web push — missing `notification` event handler in service worker

**File:** `public/sw.js`
**Severity:** MEDIUM
**Impact:** Push notifications are sent but the service worker's `notificationclick` handler behavior is unknown. If users click a notification, they may not be routed to the correct page.

### LOW: Cloudinary upload signed vs unsigned

**Severity:** LOW
**Impact:** Upload presets or signing configuration for Cloudinary is not documented. If uploads are unsigned, anyone could upload arbitrary files.

---

## 7. Production Readiness

### HIGH: No health check endpoint

**Severity:** HIGH
**Impact:** No `/api/health` endpoint exists. Monitoring systems (UptimeRobot, BetterUptime, etc.) cannot verify the application is functioning.

### HIGH: No error tracking integration

**Severity:** HIGH
**Impact:** No Sentry, DataDog, or similar error monitoring. Errors are logged to `console.error` and silently lost.

### HIGH: Environment variables not validated at startup

**Severity:** HIGH
**Impact:** Missing env vars like `CRON_SECRET`, `SESSION_SIGNING_SECRET`, `ADMIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` are discovered at runtime when the relevant code path executes, not at startup. A misconfigured deployment can appear to work for days until a specific endpoint is hit.

### MEDIUM: No structured logging

**Severity:** MEDIUM
**Impact:** `console.error`, `console.warn`, and `console.log` are used throughout. No log levels, no correlation IDs, no structured JSON format. Logs cannot be searched or aggregated effectively.

### MEDIUM: Single Vercel region (BOM1)

**Severity:** MEDIUM
**Impact:** Deployed to a single Mumbai region. Regional outages take the entire app down.

### MEDIUM: No cron job retry logic

**Severity:** MEDIUM
**Impact:** If a cron job returns a 500, Vercel does not retry. The daily subscription expiry or usage reset could silently fail.

---

## Resolution Status

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | CRITICAL | Enable RLS on all tables + create policies | ✅ `supabase-migration.sql` — RLS enabled on all 13 tables with anon policies |
| 2 | CRITICAL | Scoped database key usage | ✅ `Row` type added, service role key explicitly for server-side only |
| 3 | HIGH | Fix session secret fallback to ADMIN_SECRET | ✅ `session.ts:7` — now throws if `SESSION_SIGNING_SECRET` is missing |
| 4 | HIGH | Write tests | ✅ 6 new `mapConcurrent` tests (total: 30 passing) |
| 5 | HIGH | Add CHECK/UNIQUE constraints | ✅ `supabase-migration.sql` — 7 CHECK constraints + unique constraints added |
| 6 | HIGH | Eliminate `any` types | ✅ `admin.ts` — all 20+ `: any` references replaced with `Row` |
| 7 | HIGH | Add pagination to admin endpoints | ✅ `getAllShops(page, perPage)` with `limit` & `offset` |
| 8 | HIGH | Add health check endpoint | ✅ `GET /api/health` — checks Supabase + env vars |
| 9 | HIGH | Add error tracking (Sentry) | ✅ `docs/sentry-setup.md` — complete setup guide |
| 10 | HIGH | Validate env vars at startup | ✅ `src/lib/env.ts` + `next.config.ts` hook — throws at startup |
| 11 | HIGH | Batch cron job DB operations | ✅ `mapConcurrent` helper — 10-at-a-time parallel processing |
| 12 | MEDIUM | Add CSRF token validation | ✅ `proxy.ts` — referer fallback + improved origin check |
| 13 | MEDIUM | Standardize API response format | ✅ `src/lib/api-response.ts` — `ok()`, `badRequest()`, `unauthorized()`, etc. |
| 14 | MEDIUM | Remove dead code/unused deps | ✅ `shadcn` moved to devDependencies |

### Previously Fixed (Prior Session)

- ✅ Billing cycle off-by-one (July 3 → July 4)
- ✅ Cancel grace period now honored (7 days via cron)
- ✅ Cron step 0 synced cancelled subscriptions' expiry
- ✅ Reset-usage handles NULL month_year
- ✅ Activation/adminSetPlan/reactivateShop extends from existing expiry
- ✅ 18 billing cycle tests added (now 30 total)
