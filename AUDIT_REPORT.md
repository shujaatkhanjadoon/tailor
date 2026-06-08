# MeraDarzi — Remaining Audit Items

**Date:** June 8, 2026  
**Scope:** Items still requiring action after code fixes

> **Status:** Most code-level findings have been addressed. Remaining items are either infrastructure upgrades (paid tiers), longer-term refactors, or minor issues.

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

> Partial fix applied: batch size limited to 50/run; `cron_cursors` table added. Still requires Pro tier.

### 1.2 🔴 CRITICAL: Cloudinary Transformations (1,000/mo Free)

**Fix:** 
> Short-term fix applied: removed auto-transformations. Long-term upgrade to Cloudinary Basic (~$89/mo) still needed for 25K transformations.

### 1.3 🟡 HIGH: Vercel Hobby Limits

| Resource | Hobby Limit | Risk |
|---|---|---|
| Serverless timeout | 10s | ❌ Cron jobs fail; some API routes may hit this |
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

### 1.6 🟡 MEDIUM: Resend Free Tier (100 emails/day)

OTP emails, subscription notifications, and admin alerts count against this. With 10+ active shops sending daily reminders and OTPs, this limit may be exceeded.

**Fix:** Upgrade to **Resend Pro ($10/mo)** for 50K emails/month.

### 1.7 🟢 LOW: Miscellaneous Infrastructure

| Issue | Detail |
|---|---|
| No Dockerfile | Can't deploy outside Vercel |
| No CI/CD config | Manual deployment via Vercel Git integration |
| Empty migration file | `20260606093743_remote_schema.sql` is empty — will break migration replay |
| Duplicate schema file | Root `supabase-migration.sql` vs migration files — source-of-truth ambiguity |

---

## 2. Security

### 2.8 🟢 LOW: Remaining Security Items

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

> Short-term fixes applied (receipt upload, confirmation email, polling). Long-term gateway integration (Stripe, Razorpay, Sadapay) still pending.

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

### 4.3 🟡 HIGH: Inconsistent API Error Formats

Only **2 of 44** API route files use the `api-response.ts` helpers (`ok`, `badRequest`, `serverError`, etc.). The rest construct `NextResponse.json(...)` manually, resulting in inconsistent error schemas:

```typescript
// Pattern A: { error: "message" }              ← most admin routes
// Pattern B: { success: false, error: "message" } ← auth routes
// Pattern C: { success: true, data }            ← health/data routes
```

**Fix:** Refactor all API routes to use `api-response.ts` helpers for consistent `{ success, error, data }` schema.

---

## 5. Frontend & UX

### 5.7 🟡 MEDIUM: Toast Messages Are Not Internationalized

Toast messages are hardcoded in Urdu/English mixed, while the rest of the UI uses `t()` translation keys. Inconsistent.

**Fix:** Move toast strings into translation files and use `t()` consistently.

---

## 6. Database & Schema

### 6.2 🟡 MEDIUM: Missing Foreign Keys on Admin Tables

**File:** `supabase/migrations/20260607071951_admin_tables.sql`

- `coupon_redemptions.coupon_id` — no FK to `coupons(id)`
- `coupon_redemptions.shop_id` — no FK to `shops(id)`
- `coupon_redemptions.subscription_payment_id` — no FK to `subscription_payments(id)`

**Fix:** Add foreign key constraints with `ON DELETE CASCADE`.
> Partial fix applied: FKs added to `coupon_redemptions` table only.

---

## 7. Priority Action Plan

### Phase 1 — Blockers

| # | Item | Effort | Cost | Status |
|---|---|---|---|---|
| 1 | Upgrade Vercel to Pro ($20/mo) | 5 min | $20/mo | ⏳ Infrastructure |
| 2 | Upgrade Supabase to Pro ($25/mo) | 5 min | $25/mo | ⏳ Infrastructure |
| 3 | Upgrade Upstash to pay-as-you-go (~$0.50/mo) | 5 min | $0.50/mo | ⏳ Infrastructure |

### Phase 2 — High Priority

| # | Item | Effort | Cost | Status |
|---|---|---|---|---|
| 4 | Integrate payment gateway (Stripe / Razorpay / Sadapay) | 1-2 weeks | variable | 📅 Longer-term |
| 5 | Add server-side locale detection + SSR i18n | 3 days | $0 | 📅 Longer-term |
| 6 | Standardize all API routes on `api-response.ts` helpers | 3 days | $0 | 📅 Longer-term |
| 7 | Internationalize toast messages | 1 day | $0 | 📅 Pending |

### Phase 3 — Nice-to-Have

| # | Item | Effort | Status |
|---|---|---|---|
| 8 | Add `not-found.tsx` to dynamic route groups | 1 day | 📅 Longer-term |
| 9 | Add end-to-end tests for payment flow | 3 days | 📅 Longer-term |
| 10 | Add CI/CD pipeline | 1 day | 📅 Longer-term |
| 11 | Generate sitemap + robots.txt | 1 day | 📅 Longer-term |
| 12 | Add JSON-LD structured data | 1 day | 📅 Longer-term |
| 13 | Add dark mode toggle | 1 day | 📅 Longer-term |
| 14 | Fix billing UI issues (save 21% string, loading states, etc.) | 1 day | $0 | 📅 Pending |
| 15 | Address remaining LOW security items | 1 day | $0 | 📅 Pending |

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

**Recommended minimum viable upgrade:** **$45.50/mo** (Vercel Pro + Supabase Pro + Upstash) + optimized Cloudinary to avoid paid tier.
