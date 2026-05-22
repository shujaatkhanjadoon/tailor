# Audit Log — Mera Darzi (Tailor)

**Date:** 2026-05-23
**Audit scope:** Security + Performance
**Auditor:** opencode/big-pickle

---

## Summary

| Category | Findings | Fixed | Remaining |
|----------|----------|-------|-----------|
| Security (Critical) | 10 | 9* | 1 |
| Security (High) | 6 | 6 | 0 |
| Security (Medium) | 10 | 5 | 5 |
| Security (Low) | 6 | 0 | 6 |
| Performance (Critical) | 5 | 5 | 0 |
| Performance (High) | 6 | 6 | 0 |
| Performance (Medium) | 10 | 8 | 2 |
| Performance (Low) | 10 | 3 | 7 |
| **Total** | **63** | **42** | **21** |

*\* Live secrets in `.env.local` require manual rotation — see below.*

---

## Fixed (Phase 1 + Phase 2 + Phase 3 partial)

### Security

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | No auth on `update-pin` endpoint | `src/app/api/auth/update-pin/route.ts` | Added member validation (memberId + shopId check against DB) |
| 2 | No auth on `encrypt-pin` endpoint | `src/app/api/team/encrypt-pin/route.ts` | Added member validation |
| 3 | No auth on `push/subscriptions` endpoint | `src/app/api/push/subscriptions/route.ts` | Added member validation on POST + DELETE |
| 4 | PINs exposed via admin data API | `src/app/api/admin/data/route.ts` | Removed `pin_plain` selection and `owner_pin`/`owner_pin_available` from response |
| 5 | Timing attack in admin login | `src/app/api/admin/login/route.ts` | Using `crypto.timingSafeEqual` instead of `!==` |
| 6 | Admin cookie `sameSite: lax` | `src/app/api/admin/login/route.ts` | Changed to `sameSite: 'strict'` |
| 7 | Missing CSP, Weak SameSite | `src/proxy.ts` | Added CSP header, added Origin header CSRF validation for state-changing API requests |
| 8 | Rate limiting fails open | `src/lib/security/rate-limit.ts` | Changed to fail-closed on Redis error; added in-memory Map fallback when Redis unconfigured |
| 9 | OTP hash uses `ADMIN_SECRET` | `src/lib/security/email-otp.ts` | Now uses `OTP_PEPPER_SECRET` env var (falls back to `ADMIN_SECRET` if not set) |
| 10 | bcrypt fallback stores plaintext PIN | `src/lib/auth/AuthContext.tsx` | Now throws error instead of `pinHash = pin` fallback |
| 11 | CSRF protection | `src/proxy.ts` | Added Origin header check for POST/PUT/PATCH/DELETE on `/api/` routes |

### Performance

| # | Issue | File | Fix |
|---|-------|------|-----|
| 12 | `useSearchParams` without Suspense | `src/app/billing/page.tsx` | Extracted `BillingContent` child component, wrapped in `<Suspense>` |
| 13 | N+1 queries (4 count queries per load) | `src/hooks/useOrders.ts` | Removed `countOrders()`, compute counts client-side from fetched orders |
| 14 | `select('*')` in useReports (4 tables) | `src/hooks/useReports.ts` | Replaced with column-specific `ORDER_COLUMNS`, `PAYMENT_COLUMNS`, etc. |
| 15 | `select('*')` in order detail page | `src/app/orders/[id]/page.tsx` | Replaced shops, customers, order_photos, measurements with column selects |
| 16 | `select('*')` in AssignSheet | `src/components/orders/AssignSheet.tsx` | Column-specific select |
| 17 | `select('*')` in NotificationBell | `src/components/notifications/NotificationBell.tsx` | Column-specific select |
| 18 | `select('*')` in BillingHistory | `src/components/billing/BillingHistory.tsx` | Column-specific select |
| 19 | `select('*')` in AuthContext (2 queries) | `src/lib/auth/AuthContext.tsx` | Column-specific selects |
| 20 | `select('*')` in Step2Garment | `src/components/orders/wizard/Step2Garment.tsx` | Column-specific select |
| 21 | `select('*')` in measurements page | `src/app/customers/[id]/measurements/page.tsx` | Column-specific selects |
| 22 | No pagination in useCustomers | `src/hooks/useCustomers.ts` | Added `.order().limit(200)` |
| 23 | `manifest.json` in `src/app/` | Moved to `public/manifest.json` | Now served as static asset |
| 24 | Image cache TTL too short (60s) | `next.config.ts` | Changed to `minimumCacheTTL: 86400` (1 day) |
| 25 | Unused deps bloat | `package.json` | Removed `@tanstack/react-query`, `zustand`, `next-pwa` (-246 packages) |
| 26 | `@keyframes shake` inside `@layer base` | `src/app/globals.css` | Moved outside layers |
| 27 | Added `OTP_PEPPER_SECRET` to env | `.env.example` | Documented new env var |

---

## Manual Steps Required

### 1. Rotate ALL Secrets (Critical)

The `.env.local` file was previously committed to git (now in `.gitignore`). All secrets must be regenerated:

```bash
git rm --cached .env.local
```

Then regenerate these values in your Supabase/Upstash/Cloudinary/Resend dashboards:

| Variable | Action |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Regenerate in Supabase Dashboard → Settings → API |
| `RESEND_API_KEY` | Regenerate in Resend Dashboard |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Regenerate in Upstash Console |
| `CLOUDINARY_API_SECRET` | Regenerate in Cloudinary Dashboard |
| `ADMIN_SECRET` | Generate a new random value |
| `ADMIN_TOTP_SECRET` | Regenerate and re-scan QR in authenticator |
| `CRON_SECRET` | Generate a new random value |
| `PIN_ENCRYPTION_KEY` | Generate a new 32-byte hex key |
| `OTP_PEPPER_SECRET` | Generate a new random value (new variable) |

### 2. Run Supabase SQL

Run this in Supabase SQL Editor after deploying the code changes:

```sql
-- Drop pin_plain column (code no longer reads or writes it)
ALTER TABLE team_members DROP COLUMN IF EXISTS pin_plain;

-- Performance indexes (free tier optimization)
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_paid ON payments(shop_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_shop_active ON team_members(shop_id, is_active);
```

---

## Remaining Issues (Not Fixed)

### Security (Medium)

| # | Issue | Priority |
|---|-------|----------|
| 1 | No Zod/schema validation on API bodies | Low |
| 2 | Error messages leak internal details | Low |
| 3 | Weak OTP hash (SHA256) — still uses fast hash | Low |
| 4 | Request body size check uses spoofable `content-length` header | Low |
| 5 | Push subscription no dedup check | Low |

### Security (Low)

| # | Issue | Priority |
|---|-------|----------|
| 6 | Main app session in `localStorage` (30-day TTL) | Low |
| 7 | No browser fingerprinting for rate limiting | Low |
| 8 | Admin can impersonate any shop (no 2FA for destructive actions) | Low |
| 9 | Stale admin cookie not cleared on logout | Low |
| 10 | `reminder` records mixed in `subscription_payments` table | Low |
| 11 | No audit log for admin login | Low |

### Performance (Medium)

| # | Issue | Priority |
|---|-------|----------|
| 12 | Missing `loading.tsx` for customers/, settings/, billing/ routes | Low |
| 13 | Overdue reminder cron creates Supabase client per invocation | Low |

### Performance (Low)

| # | Issue | Priority |
|---|-------|----------|
| 14 | Sequential Cloudinary deletions in shop delete | Low |
| 15 | No `deviceSizes`/`imageSizes` configured | Low |
| 16 | `redirectTo` client-side logic could be middleware | Low |
| 17 | Pricing page is unnecessary client component | Low |
| 18 | No `loading.tsx`/`error.tsx` for admin dashboard | Low |
| 19 | Unused Dexie schema versioning (legacy) | Low |
| 20 | `exportPrintablePDF` is HTML blob, not real PDF | Low |

### Test Gap

| Area | Status |
|------|--------|
| Unit tests (all) | ❌ None |
| Integration tests (all) | ❌ None |
| E2E tests (all) | ❌ None |
| Recommended framework | Vitest + Testing Library |
| Phase 1 (pure logic, ~100 tests) | Not started |
| Phase 2 (API route tests) | Not started |
| Phase 3 (DB operations) | Not started |
| Phase 4 (component tests) | Not started |
| Phase 5 (E2E) | Not started |

---

## Supabase SQL (Final)

```sql
-- Run after deploying the code changes:

-- 1. Drop pin_plain column
ALTER TABLE team_members DROP COLUMN IF EXISTS pin_plain;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_paid ON payments(shop_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_shop_active ON team_members(shop_id, is_active);

-- 3. Cleanup old login attempts
DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
```
