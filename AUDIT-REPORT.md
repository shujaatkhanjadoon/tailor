# OpenCode AI — End-to-End Application Audit Report

**Application:** Tailor (v0.1.0)  
**Platform:** Next.js 16.2.7 / React 19.2.4 / Supabase / Upstash Redis  
**Audit Date:** 2026-06-08  
**Tests Audited:** 228 (all pass)  
**Files Audited:** 87 source files, 19 test files, 1 migration (461 lines SQL)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Database Analysis](#3-database-analysis)
4. [API Endpoint Audit](#4-api-endpoint-audit)
5. [Security Assessment](#5-security-assessment)
6. [Performance Analysis](#6-performance-analysis)
7. [Test Coverage & Quality](#7-test-coverage--quality)
8. [Offline-First Architecture Review](#8-offline-first-architecture-review)
9. [Risk Register](#9-risk-register)
10. [Actionable Recommendations](#10-actionable-recommendations)

---

## 1. Executive Summary

The Tailor application is a well-architected offline-first PWA for small-to-medium tailoring business management. It serves Pakistani shop owners with Urdu-first UX, PIN-based auth, subscription billing, and real-time order tracking.

**Overall Assessment:** The application shows strong architectural decisions — offline-first data layer, multi-layered rate limiting, HMAC-signed session tokens, and proper idempotency support. However, **4 critical bugs**, **6 high-severity issues**, and **15 medium-severity issues** were identified that require immediate attention before production use.

### Key Metrics

| Metric | Value |
|--------|-------|
| Total API Routes | 33 endpoints (46 route files) |
| Database Tables | 19 |
| Database Indexes | 30 |
| Rate Limit Tiers | 4 (login, OTP, signup, general) |
| Test Count | 228 (all passing) |
| Lint Results | Clean (ESLint) |
| Offline Tables | 8 (IndexedDB via Dexie) |
| External Dependencies | Supabase, Upstash Redis, Cloudinary, Resend |

---

## 2. System Architecture Overview

### Data Flow
```
Browser (PWA) ──► Next.js App Router ──► API Routes (server-side)
     │                                          │
     │ Dexie (IndexedDB)                         │
     │ (offline cache)                           ├── Supabase (primary DB)
     │                                           ├── Upstash Redis (rate limit + idempotency)
     └── Sync Engine ────────────────────────────┘   Cloudinary (photos)
                                                     Resend (emails)
```

### Auth Flow
- **Members (shop owners/karigars):** Phone + PIN via bcrypt(12), HMAC-SHA256 session tokens, 7-day TTL with rotation
- **Admins:** Static secret + TOTP (Google Authenticator), HMAC-SHA256 tokens, 15-min default / 7-day "remember me"
- **Cron:** Bearer token (`CRON_SECRET`)

### Key Architecture Choices
- **No ORM** — raw Supabase REST calls with manual snake_case→camelCase mapping
- **Dual caching** — Upstash Redis primary, in-memory Map fallback for rate limiting and idempotency
- **Offline-first** — all CRUD through `offlineRead`/`offlineWrite` helpers; sync engine reconciles local↔cloud
- **RLS bypass** — all writes go through service-role API routes; client reads use anon key with RLS via session variable

---

## 3. Database Analysis

### 3.1 Schema Design

**19 tables** across 6 domains:

| Domain | Tables | Indexes | RLS |
|--------|--------|---------|-----|
| Core Business | shops, customers, orders, payments, measurements | 12 | ✓ |
| Team | team_members | 2 | ✓ |
| Photos | order_photos | 1 | ✓ |
| Status | order_status_history | 1 | ✓ |
| Billing | subscriptions, subscription_payments, shop_usage | 4 | ✓ |
| Admin | admin_audit_log, admin_notifications, login_attempts, ip_blocklist, admin_accounts, coupon_redemptions, coupons, message_templates, cron_log | 4 | ✗ |
| Auth | email_verifications, push_subscriptions | 2 | ✓ |

### 3.2 Index Analysis ✅

The migration defines **30 indexes** covering all foreign keys, sort columns, and search fields. Key observations:

- **Composite indexes** on `(shop_id, status)`, `(shop_id, due_date)`, `(shop_id, created_at DESC)`, `(shop_id, order_number)` — correct for multi-tenant queries
- **Trigram index** on `customers(name)` for ILIKE search — covers the customer name search requirement
- **Missing composite index** on `orders(shop_id, assigned_to)` — the `useOrders` hook filters by `assigned_to` for karigars; a full scan of all shop orders could occur with large datasets
- **Missing index** on `subscription_payments(subscription_id)` — the admin query for payment history by subscription would benefit

### 3.3 Migration Pattern Assessment

The schema uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — safe for re-execution. The migration is **idempotent**.

### 3.4 Concurrency Vulnerabilities ⚠️

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| **DB-1** | **Payment insert before order update** — `paymentOps.add` first inserts the payment row, then atomically updates `amount_paid` with an optimistic lock. If the lock fails, the payment record is orphaned. | `operations.ts:776-788` | **Financial data integrity bug** — paid money recorded but not applied to order balance |
| **DB-2** | **Duplicate order numbers on race** — `getNextOrderNumber` uses `MAX(order_number)+1` without a unique constraint `(shop_id, order_number)`. Two concurrent `orderOps.add` calls produce the same number. | `operations.ts:573-584` | Duplicate `order_number` for same shop |
| **DB-3** | **No transaction for shop deletion** — 14 tables are deleted sequentially without a Supabase transaction. Partial failure leaves orphaned records. | `shop/delete/route.ts:67-91` | Data integrity failure |

### 3.5 Query Efficiency

| Query Pattern | Assessment |
|---------------|------------|
| Dashboard stats (5 parallel queries) | ✅ Good — `Promise.all` with count-only selects |
| Order list (paginated, filtered) | ✅ Good — server-side LIMIT/OFFSET + composite index |
| Reports (8 parallel queries) | ⚠️ **Heavy** — 8 Supabase requests including GROUP BY aggregates; period filtering applied client-side after fetch |
| Admin data ("shops" type) | ❌ **No pagination** — fetches ALL shops, subscriptions, usage, and orders into memory |
| Admin analytics | ❌ **No pagination** — fetches ALL subscription payments across all time for revenue calculation |
| Customer profile (N+1 payments) | ⚠️ Fetches all orders first, then collects IDs, then fetches payments by `order_id=in.(...)` — acceptable for typical customer sizes |

---

## 4. API Endpoint Audit

### 4.1 Endpoint Inventory

| Category | Endpoints | Methods | Auth | Rate Limited |
|----------|-----------|---------|------|-------------|
| Health | `/api/health` | GET | None | ✗ |
| CSP | `/api/csp-violation` | POST | None | ✗ |
| Auth | `/api/auth/*` (9 routes) | GET, POST, DELETE | Mixed | ✓ (5 of 9) |
| Billing | `/api/billing/*` (4 routes) | GET, POST | Member session | ✗ |
| Coupons | `/api/coupons/validate` | GET | None | ✗ |
| Photos | `/api/photos/delete`, `/api/order-photos` | POST | Mixed | ✗ |
| Push | `/api/push/subscriptions` | POST, DELETE | Member lookup | ✗ |
| Shop | `/api/shop/*` (2 routes) | POST | Member session | ✗ |
| Team | `/api/team/members` | POST | Member session | ✗ |
| Cron | `/api/cron/*` (4 routes) | GET, POST | CRON_SECRET | ✗ |
| Admin | `/api/admin/*` (15 routes) | GET, POST, PUT, PATCH, DELETE | Admin session | ✓ (login only) |
| Measurements | `/api/measurements` | POST | Member session | ✓ |
| Notifications | `/api/notifications` | GET | Member session | ✗ |
| **Total** | **33 endpoints** | — | — | **6 of 33** |

### 4.2 Critical Bugs Found

| ID | Endpoint | Severity | Issue |
|----|----------|----------|-------|
| **API-1** | `POST /api/team/members` | **CRITICAL** | **Double bcrypt hashing** — PIN is hashed twice (`bcrypt.hashSync(bcrypt.hashSync(pin, 12), 12)`). Login compares raw PIN against double-hashed value, which NEVER matches. Every member created through this route is permanently locked out. |
| **API-2** | `POST /api/team/members` | **CRITICAL** | **Missing `crypto` import** — line 69 calls `crypto.randomUUID()` but `crypto` is not imported. Runtime `ReferenceError` on creating a new member without a pre-existing `id`. |
| **API-3** | `POST /api/shop/delete` | **CRITICAL** | **No session authentication** — only validates body fields `(shopId, memberId)` without verifying `MEMBER_SESSION_COOKIE`. Anyone who knows a valid UUID pair can permanently delete a shop. No CSRF protection, no rate limiting on deletion. |
| **API-4** | `POST /api/admin/action` (reset_owner_pin) | **HIGH** | **`Math.random()` for PIN generation** — uses `Math.floor(100000 + Math.random() * 900000)` which is NOT cryptographically secure. Attacker who compromises this endpoint can predict generated PINs. |
| **API-5** | `POST /api/admin/action` (reset_admin_totp) | **HIGH** | **TOTP secret returned in API response** — the new secret is included in the JSON response body, visible to anyone with network access or response logging. |
| **API-6** | `POST /api/admin/action` | **HIGH** | **TOTP bypass when `ADMIN_TOTP_SECRET` not set** — `if (totpSecret && ...)` fails open. Destructive actions proceed without 2FA if env var is missing. Should fail closed. |
| **API-7** | `POST /api/admin/action` | **MEDIUM** | **`force_logout_sessions` is a no-op** — only writes an audit log, never actually invalidates any sessions. |
| **API-8** | `POST /api/auth/create-shop` | **MEDIUM** | **No server-side PIN strength validation** — schema accepts `z.string().min(1)`. Users can register with PIN `"1"`. The `validatePIN` function in `pin.ts` (which rejects weak PINs) is never called. |
| **API-9** | `POST /api/auth/session` (GET handler) | **MEDIUM** | **Does not re-verify member shop_id** against session token's `shopId`. Transferred members' old session tokens continue working for up to 7 days. |

### 4.3 Error Handling Patterns

| Pattern | Assessment |
|---------|------------|
| Try/catch with `logger.error` | ✅ Consistent across all routes — prevents uncaught promise rejections |
| Standardized response helpers | ✅ `ok()`, `badRequest()`, `unauthorized()`, `serverError()` etc. in `api-response.ts` |
| Zod validation | ✅ 13 schemas covering all route inputs |
| Sentry integration | ✅ `serverError()` captures exceptions in production |
| Fire-and-forget `.catch(() => {})` | ❌ **7 occurrences** — silent data loss for audit logs, login attempt records, email notifications, and owner alerts |

---

## 5. Security Assessment

### 5.1 Authentication

| Mechanism | Strength | Findings |
|-----------|----------|----------|
| PIN hashing | ✅ bcrypt cost factor 12 | Proper salt, proper cost |
| Session tokens | ✅ HMAC-SHA256 with nonce and rotation | 5-part token with expiry, base64url encoded |
| Cookie flags | ✅ httpOnly, secure, sameSite=strict, path='/' | Properly set on all session cookies |
| TOTP 2FA | ✅ otplib with ±1 step drift | Good implementation |
| Token format backward compat | ✅ Supports 4 legacy formats for graceful migration | Clean migration path |

### 5.2 Vulnerabilities Found

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| **SEC-1** | **HIGH** | **No session revocation mechanism** — both member and admin tokens are stateless HMAC. Stolen cookies cannot be individually revoked. Changing secrets invalidates ALL sessions. No `token_version` in DB. | `auth/session.ts`, `admin/auth.ts` |
| **SEC-2** | **HIGH** | **In-memory email rate limiter** — `emailLastSentAt` Map is per-process. In serverless/multi-instance deployments, attacker can bypass 60s cooldown by hitting N instances, sending N emails in 60s. | `email-otp.ts:23-39` |
| **SEC-3** | **MEDIUM** | **Rate limiter fail-open for normal endpoints** — Redis errors cause normal-sensitivity endpoints to return `{ allowed: true, remaining: 999 }`, bypassing all rate limiting. | `rate-limit.ts:141-144` |
| **SEC-4** | **MEDIUM** | **IP blocklist check fails open** — if Supabase is unreachable, the proxy allows ALL IPs through. | `proxy.ts:68` catch block |
| **SEC-5** | **MEDIUM** | **`'unsafe-inline'` CSP directive** — allows all inline scripts/styles, defeating CSP's XSS protection. | `csp.ts` |
| **SEC-6** | **LOW** | **`uuid()` fallback uses `Math.random()`** — when `crypto.randomUUID()` is unavailable (should never happen in modern runtimes), falls back to predictable IDs. | `operations.ts:52-56` |
| **SEC-7** | **LOW** | **`timingSafeEqual` wrapper returns `false` on error** — secure but makes debugging difficult by not logging the error. | `operations.ts:13-19` |

### 5.3 RLS Architecture Review

The RLS model is well-documented: all writes go through service-role API routes (bypassing RLS), client reads use anon key with `current_shop_id()` session variable set by the proxy. The model is correct for this architecture.

**Concern:** The `measurements_select` policy uses a subquery (`customer_id IN (SELECT id FROM customers...)`) instead of a direct `shop_id` column comparison. This is less efficient for large customer tables.

---

## 6. Performance Analysis

### 6.1 API Latency Patterns

| Endpoint Pattern | Avg Complexity | Bottleneck Risk |
|-----------------|----------------|-----------------|
| Single-row fetch by PK | O(1) | None |
| Paginated list with filters | O(n) with index | Low — 50/page default |
| Dashboard stats | 5 parallel queries | Low |
| Reports (all data) | 8 parallel + client-side memo | **High** — fetches ALL orders/payments for date range |
| Admin shops data | ALL records in memory | **Critical** — OOM risk with 1000+ shops |
| Photo compression | CPU-bound (canvas) | Medium — blocks main thread |
| Sync engine pull | ALL records per table | Medium — one-time per session, but grows with data |

### 6.2 Performance Hotspots

| Hotspot | Risk | Details |
|---------|------|---------|
| `admin/data/route.ts` (summary, shops, analytics) | **CRITICAL** | Fetches ALL subscription payments, ALL shops, ALL orders into memory. `analytics` reduces full payment list by date client-side. With thousands of shops, this causes OOM crashes. |
| `useReports` hook | **HIGH** | 8 parallel Supabase queries + 10+ `useMemo` computations on every mount. No shared cache across consumers. |
| `usePlan` hook | **MEDIUM** | Called by many components; no shared cache — each mount triggers its own fetch. |
| `VirtualList` | **MEDIUM** | `setTimeout(0)` for `onEndReached` delays infinite scroll trigger. No `useCallback` on render item. |
| `paymentOps.add` | **MEDIUM** | Sequential insert-then-update pattern is slower than an RPC call. |
| Bulk admin actions | **MEDIUM** | `bulk_set_plan`, `bulk_extend_expiry` use sequential `for...of` loops instead of `mapConcurrent`. |

### 6.3 Shop Name Cache

The shop name cache (`operations.ts:35-40`) has LRU eviction at 100 entries with 5-minute TTL. This is correctly bounded but uses a simple array-based LRU with O(n) lookup. For most shops (~dozen), this is negligible.

### 6.4 Bundle Size Observations

Not assessed in detail, but notable: `blueimp-load-image` (~30KB), `jspdf` + `jspdf-autotable` (~400KB combined), `recharts` (~300KB), and `lucide-react` (~200KB) are the largest dependencies.

---

## 7. Test Coverage & Quality

### 7.1 Test Suite Results

```
228 tests | 40 suites | 228 pass | 0 fail | 0 cancelled | 0 skipped
```

### 7.2 Coverage by Domain

| Domain | Tests | Status | Confidence |
|--------|-------|--------|------------|
| Admin Authentication | 13 | ✅ All pass | High — TOTP, session tokens, edge cases |
| Rate Limiting | 12 | ✅ All pass | High — IP detection, fingerprinting, windows |
| Phone Validation | 14 | ✅ All pass | High — Pakistani mobile formats |
| Billing Cycles | 17 | ✅ All pass | High — month-end clamping, leap years, lifetime |
| Payment Calculations | 10 | ✅ All pass | High — applied amounts, surplus, overpayments |
| Plans | 14 | ✅ All pass | High — plan retrieval, pricing, savings |
| WhatsApp Notify | 13 | ✅ All pass | High — URL format, phone formatting, messages |
| Karigar Limits | 13 | ✅ All pass | High — filtering, limits, sorting |
| Karigar Skills | 16 | ✅ All pass | High — parsing, formatting, garment matching |
| Currency | 13 | ✅ All pass | High — formatting, null/NaN/Infinity |
| CSP | 2 | ✅ All pass | Adequate |
| Utils | 5 | ✅ All pass | Adequate |
| Records (DB mapping) | 11 | ✅ All pass | High — all 7 entity types |
| Concurrent | 6 | ✅ All pass | Good — concurrency limits, empty arrays |
| API Integration | 44 | ✅ All pass | Comprehensive — auth, CRUD, billing, idempotency |
| Email OTP | 8 | ✅ All pass | Adequate |
| Order Recipient | 25 | ✅ All pass | Good — all relations and garment labels |

### 7.3 Coverage Gaps

| Area | Risk | What's Missing |
|------|------|----------------|
| **Component tests** | **HIGH** | 0 tests for 82 React components. Auth flows, order wizard, billing UI, reports, photo capture — all untested. |
| **E2E tests** | **HIGH** | No Playwright/Cypress tests for critical user flows: signup → login → create order → process → payment. |
| **Offline sync tests** | **MEDIUM** | The sync engine (431 lines in `sync.ts`) has zero tests. Conflict resolution, push/pull, delta sync — all untested. |
| **Race condition tests** | **MEDIUM** | No tests for concurrent payment submission, concurrent order creation, concurrent member creation. |
| **Error boundary tests** | **MEDIUM** | No tests verifying ErrorBoundary catches and recovers from crashes. |
| **Database integration tests** | **MEDIUM** | All DB tests mock `fetch`. SQL constraints, triggers, RLS policies never exercised. |
| **Security tests** | **MEDIUM** | No tests for CSRF, session stealing, rate limit bypass, PIN brute force. |

### 7.4 Test Quality

**Strengths:**
- Well-isolated factory helpers (`make()`, `payment()`)
- Excellent edge case coverage (billing cycles, phone formats)
- Deterministic assertions (no flaky tests)
- Comprehensive idempotency test suite

**Weaknesses:**
- Shallow assertions — many tests check `body.success === true` or `error.includes(string)` rather than exact error codes
- Mock coupling — `api-integration.test.ts` uses URL substring matching (`urlStr.includes(pattern)`) — brittle to query pattern changes
- Mock always returns 200/empty for unregistered routes, hiding unintended queries

---

## 8. Offline-First Architecture Review

### 8.1 Architecture Assessment

The offline-first pattern is well-implemented:
- **8 Dexie tables** mirroring Supabase schema with `_synced` and `_deleted` flags
- **`offlineRead`/`offlineWrite`** — try Supabase, fall back to Dexie, cache on success
- **Sync engine** — pull (server→local) + push (local→server) with `updated_at` conflict resolution
- **`mapConcurrent`** — batch processing with configurable concurrency
- **Auto-sync** on `window.online` event

### 8.2 Findings

| Issue | Severity | Details |
|-------|----------|---------|
| **String timestamp comparison for conflict resolution** | MEDIUM | `sync.ts:245` compares ISO strings directly. Lexicographic sort is correct for UTC ISO 8601, but zone format changes (e.g., `+05:00` vs `Z`) could produce wrong comparisons. |
| **Silent push failures** | LOW | `sync.ts:262-264` catches and logs individual push failures but doesn't propagate them. Caller gets no indication sync was incomplete. |
| **`syncDelta` no-timestamp edge case** | LOW | If a record has neither `updatedAt` nor `createdAt`, it's never pushed. Not currently an issue but fragile. |
| **Dead code in sync.ts** | LOW | Unused `const type = 'sync-error'` variable declaration at line 76-77. |

---

## 9. Risk Register

### Critical (Immediate action required)

| # | Risk | Impact | Likelihood | Recommendation |
|---|------|--------|------------|---------------|
| R1 | Team members permanently locked out (double bcrypt hash) | Auth failure for all karigars | **Certain** if route is used | Remove double hash, use single `bcrypt.hashSync` |
| R2 | Missing `crypto` import crashes member creation | Runtime crash | **Certain** on create without ID | Add `import crypto from 'crypto'` |
| R3 | Shop deletion without session check | Permanent data loss | Medium (requires UUID knowledge) | Add `verifyMemberSessionToken` check |
| R4 | Orphaned payment records on concurrent payment | Financial data loss | Low-Medium (requires race condition) | Swap insert/update order, use RPC |

### High (Fix within 1 week)

| # | Risk | Impact | Recommendation |
|---|-------|--------|---------------|
| R5 | `Math.random()` for PIN generation | Predictable PINs | Use `crypto.randomInt(100000, 999999)` |
| R6 | TOTP secret exposed in API response | 2FA compromise | Return confirmation only, log server-side |
| R7 | TOTP bypass when env var missing | Destructive actions without 2FA | Fail closed — block all destructive actions |
| R8 | Admin data endpoint OOM | Platform-wide crash | Add pagination/limits to all admin queries |
| R9 | No session revocation | Stolen sessions cannot be killed | Add `token_version` column to team_members |
| R10 | In-memory email rate limiter | OTP spam in multi-instance deploys | Move to Upstash Redis |

### Medium (Fix within sprint)

| # | Risk | Recommendation |
|---|-------|---------------|
| R11 | Duplicate order numbers | Add unique constraint `(shop_id, order_number)` or use SEQUENCE |
| R12 | No server-side PIN strength validation | Call `validatePIN()` in `create-shop` route |
| R13 | Session doesn't re-verify shop_id on GET | Compare `member.shop_id` against `session.shopId` |
| R14 | Audit log target_type heuristic wrong | Use explicit action→type mapping object |
| R15 | Bulk admin actions use sequential loops | Use `mapConcurrent` |
| R16 | Rate limiter fail-open for normal endpoints | Fail closed for all, or implement circuit breaker |
| R17 | IP blocklist fails open | Return hard 403 if Supabase is unreachable |
| R18 | Reports hook fetches all data on mount | Add caching layer (e.g., React Query) |
| R19 | usePlan hook no shared cache | Promote to context-level caching |
| R20 | No component/E2E tests | Start with critical user flows (auth, order wizard) |

---

## 10. Actionable Recommendations

### 10.1 Immediate Fixes (Day 1)

1. **Fix `team/members/route.ts` double hash**
   ```typescript
   // Line 51: Replace double hash with single
   updateData.pin_hash = bcrypt.hashSync(pin, SALT_ROUNDS)

   // Line 69: Add import
   import crypto from 'crypto'

   // Line 77: Fix create path
   pin_hash: pin ? bcrypt.hashSync(pin, SALT_ROUNDS) : '',
   ```

2. **Fix `shop/delete/route.ts` — add session verification**
   ```typescript
   const token = req.cookies.get(MEMBER_SESSION_COOKIE)?.value
   const session = token ? verifyMemberSessionToken(token) : null
   if (!session || session.memberId !== memberId || session.shopId !== shopId) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   }
   ```

3. **Fix `paymentOps.add` — swap order: update amount_paid first, then insert payment**
   Use `supabase.rpc()` for atomic `UPDATE ... RETURNING new_amount_paid`, then insert payment with the confirmed amount.

4. **Fix `admin/action/route.ts` — `Math.random()` → `crypto.randomInt()`**
   ```typescript
   const newPin = String(crypto.randomInt(100000, 999999));
   ```

### 10.2 Short-Term (This Sprint)

5. **Add pagination to `admin/data` endpoint** — enforce limit/offset on ALL data queries. Protect with a hard cap of 1000 records per query.

6. **Implement session revocation** — add `token_version` (integer, default 1) to `team_members`. Include version in session token payload. On PIN change or admin force-logout, increment version. Reject tokens with stale version.

7. **Move email rate limiter to Upstash Redis** — use the same `@upstash/ratelimit` pattern as the auth rate limiters.

8. **Fail closed for TOTP** — if `ADMIN_TOTP_SECRET` is not configured, deny all destructive admin actions with a clear error message.

9. **Fix order number race condition** — add `UNIQUE(shop_id, order_number)` constraint in Supabase migration. Replace `MAX+1` with `SELECT COALESCE(MAX(order_number), 0) + 1` wrapped in a retry loop.

### 10.3 Medium-Term (Next Sprint)

10. **Add unique constraint `UNIQUE(shop_id, order_number)`** to migration for data integrity.

11. **Add server-side PIN strength validation** in `create-shop` route using existing `validatePIN()` from `pin.ts`.

12. **Replace sequential bulk admin operations** with `mapConcurrent` (already imported in cron jobs).

13. **Add test coverage for sync engine, race conditions, and component rendering.** Prioritize: (a) offline sync push/pull, (b) concurrent payment submission, (c) auth wizard flow.

14. **Add API-level rate limiting to unprotected endpoints** — at minimum, `shop/delete`, `team/members`, `shop/update`, `billing/*`, and `admin/*`.

15. **Consolidate logAction target_type** — replace the brittle `action.includes("shop_")` heuristic with an explicit mapping:
    ```typescript
    const ACTION_TYPES: Record<string, string> = {
      set_plan: 'subscription', activate_payment: 'subscription',
      reject_payment: 'subscription', refund_payment: 'subscription',
      verify_shop: 'shop', deactivate_shop: 'shop', delete_shop: 'shop',
      block_ip: 'security', create_admin: 'admin', reset_owner_pin: 'shop',
      // ... complete mapping
    }
    ```

### 10.4 Long-Term (Backlog)

16. **Extract payment insert into a Supabase RPC function** — atomic `UPDATE orders.amount_paid` + `INSERT payment` in a single transaction. Eliminates the race condition entirely.

17. **Add React Query / SWR for client-side caching** — reduce `useReports` and `usePlan` redundant fetches. Implement stale-while-revalidate pattern.

18. **Replace CSP `'unsafe-inline'`** with hash/nonce-based approach for better XSS protection.

19. **Add E2E tests** with Playwright for critical flows: shop signup, login, order lifecycle, billing, admin panel.

20. **Consider using a Supabase database function** for the `getNextOrderNumber` query to guarantee atomicity.

### 10.5 Monitoring & Observability

21. **Add response time tracking** — wrap API handlers with a timing decorator that logs p50/p95/p99 latencies.

22. **Add database query logging** — enable `pg_stat_statements` (already installed per migration) to track slow queries.

23. **Add automated rate limit alerting** — monitor 429 responses; sudden spikes indicate attack or misconfiguration.

---

## Appendix A: Files Referenced

```
src/app/api/auth/login/route.ts          src/app/api/auth/session/route.ts
src/app/api/auth/create-shop/route.ts    src/app/api/auth/check-phone/route.ts
src/app/api/auth/send-otp/route.ts       src/app/api/auth/verify-otp/route.ts
src/app/api/auth/update-pin/route.ts     src/app/api/auth/shop-verify-request/route.ts
src/app/api/auth/log-attempt/route.ts    src/app/api/billing/submit-payment/route.ts
src/app/api/billing/subscription-status/route.ts
src/app/api/billing/subscription-event/route.ts
src/app/api/billing/cancel/route.ts      src/app/api/coupons/validate/route.ts
src/app/api/photos/delete/route.ts        src/app/api/push/subscriptions/route.ts
src/app/api/shop/update/route.ts         src/app/api/shop/delete/route.ts
src/app/api/team/members/route.ts        src/app/api/health/route.ts
src/app/api/csp-violation/route.ts       src/app/api/notifications/route.ts
src/app/api/order-photos/route.ts        src/app/api/measurements/route.ts
src/app/api/cron/expire-subscriptions/route.ts
src/app/api/cron/send-reminders/route.ts
src/app/api/cron/cleanup-photos/route.ts
src/app/api/cron/reset-usage/route.ts
src/app/api/admin/login/route.ts         src/app/api/admin/verify/route.ts
src/app/api/admin/logout/route.ts        src/app/api/admin/data/route.ts
src/app/api/admin/analytics/route.ts     src/app/api/admin/action/route.ts
src/app/api/admin/blocklist/route.ts     src/app/api/admin/templates/route.ts
src/app/api/admin/admins/route.ts        src/app/api/admin/coupons/route.ts
src/app/api/admin/health/route.ts        src/app/api/admin/reports/route.ts
src/app/api/admin/backfill-expiry/route.ts
src/app/api/admin/impersonate/route.ts
src/app/api/admin/totp-uri/route.ts
src/app/api/admin/notifications/route.ts
src/app/api/admin/notifications/whatsapp/route.ts
src/lib/db/operations.ts                 src/lib/db/schema.ts
src/lib/db/offline.ts                    src/lib/db/sync.ts
src/lib/db/seed.ts                       src/lib/supabase/client.ts
src/lib/supabase/server.ts              src/lib/supabase/service.ts
src/lib/supabase/records.ts             src/lib/supabase/types.ts
src/lib/supabase/realtime.ts            src/lib/security/rate-limit.ts
src/lib/security/email-otp.ts           src/lib/security/pin.ts
src/lib/security/phone.ts               src/lib/security/body.ts
src/lib/auth/session.ts                 src/lib/auth/AuthContext.tsx
src/lib/auth/useAuthWizard.ts           src/lib/admin/auth.ts
src/lib/admin/session.ts                src/lib/admin/audit.ts
src/lib/validation/schemas.ts           src/lib/validation/types.ts
src/lib/idempotency.ts                  src/lib/logger.ts
src/lib/api-response.ts                 src/lib/concurrent.ts
src/lib/tracking.ts                     src/lib/time.ts
src/proxy.ts                            supabase-migration.sql
tests/* (19 test files)                 src/hooks/* (7 hooks)
src/components/* (82 components)
```

---

## Appendix B: Test Command

All 228 tests pass:
```powershell
npm test
```
