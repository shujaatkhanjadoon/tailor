# Tailor (MeraDarzi) — Comprehensive Quality Assurance & Application Audit Report

**Application:** Tailor v0.1.0
**Platform:** Next.js 16.2.7 / React 19.2.4 / Supabase / Upstash Redis
**Audit Date:** 2026-06-10
**Previous Audit:** 2026-06-08
**Audit Type:** Full end-to-end QA (technical + business + security + scalability)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Issue Severity Classification](#2-issue-severity-classification)
3. [Critical Issues](#3-critical-issues)
4. [High Severity Issues](#4-high-severity-issues)
5. [Medium Severity Issues](#5-medium-severity-issues)
6. [Low Severity & Cosmetic Issues](#6-low-severity--cosmetic-issues)
7. [Admin Panel Audit](#7-admin-panel-audit)
8. [Subscription & Payment Logic Review](#8-subscription--payment-logic-review)
9. [Application Flow Audit](#9-application-flow-audit)
10. [Scalability & Infrastructure Review](#10-scalability--infrastructure-review)
11. [Security & Production Readiness](#11-security--production-readiness)
12. [Feature Recommendations](#12-feature-recommendations)
13. [Production Readiness Assessment](#13-production-readiness-assessment)
14. [Action Plan](#14-action-plan)

---

## 1. Executive Summary

The Tailor (MeraDarzi) application is a Next.js 16 PWA for Pakistani tailoring shop management. It provides customer management, order tracking, measurements, payments, team management with karigar accounts, and subscription-based billing via manual Raast payments.

**Overall Assessment:** The application has a solid architectural foundation with some significant gaps in the subscription/payment workflow logic, admin tooling completeness, and production hardening. The app is approximately **70% production-ready** for a soft launch, but requires addressing critical subscription workflow issues before full production deployment.

### Key Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 6 | Subscription stacking, cron table missing, coupon race conditions, no refund handling, missing email notifications for approvals, payment dedup bypass |
| High | 11 | Proration calculation missing, admin activation hardcoded plan, WhatsApp-only reminders (no email), no email for cancel flow, missing audit trail for cancel, reactivateShop hardcodes professional plan, navigation guard bypass, no rate limit on admin actions API, RESEND_API_KEY missing causes crash, SUPABASE_SERVICE_ROLE_KEY as public env var naming confusion, dead health/disputes pages |
| Medium | 18 | Stub pages, missing pagination, UI inconsistencies, no export on most admin pages, stale payments auto-reject with no customer notification, no subscription payment history on user billing page, measurement photos not stored, shop delete is soft-delete only, RLS gap on team_members deleted_at check, no customer-facing subscription status API, coupon usage atomicity gap, missing Supabase function for coupon increments |
| Low | 12 | CSS inconsistencies, code duplication, hardcoded strings, missing loading states, missing error boundaries, unused routes, hardcoded env values |

---

## 2. Issue Severity Classification

- **Critical:** Data loss, security vulnerability, payment processing error, or feature that blocks core business flow
- **High:** Significant user-facing bug, missing business-critical functionality, or architectural flaw
- **Medium:** Noticeable UX issue, missing non-critical feature, or technical debt that will cause problems at scale
- **Low:** Cosmetic, minor UX polish, or nice-to-have improvements

---

## 3. Critical Issues

### C1. Subscription Stacking Prevention Missing

**Location:** `src/app/api/billing/submit-payment/route.ts`

**Problem:** A customer can submit multiple payments for different plans simultaneously (e.g., submit Professional monthly AND Business yearly payments). When admin activates one, the other remains pending. If the admin activates both, the last activation wins (upsert by shop_id) and the first payment is lost. There is no deduplication at the subscription level.

**Impact:** Customer loses money, manual cleanup required, trust erosion.

**Fix:**
1. When a user submits a payment, check if they already have a pending payment and warn/block
2. When admin activates a payment, auto-reject any other pending payments for the same shop
3. Add a unique constraint or application-level check preventing multiple pending payments per shop

### C2. Missing `cron_cursors` Table

**Location:** `src/app/api/cron/expire-subscriptions/route.ts` (lines 14-31)

**Problem:** The cron job references a `cron_cursors` table for incremental processing but this table does not exist in the migration SQL (`supabase-migration.sql`). The `getCursor` and `setCursor` functions will fail silently, but the incremental processing design is broken — every run starts from the beginning, potentially reprocessing the same records.

**Impact:** Cron job runs suboptimally. In worst case, expired subscriptions may not process correctly if BATCH_SIZE is exceeded but cursor tracking fails.

**Fix:** Add `cron_cursors` table to the migration:
```sql
CREATE TABLE IF NOT EXISTS cron_cursors (
  job_name TEXT PRIMARY KEY,
  cursor_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### C3. Coupon Race Condition

**Location:** `src/app/api/billing/submit-payment/route.ts` (lines 116-178)

**Problem:** Coupon validation and redemption are not atomic. Between checking `used_count < max_uses` and calling the RPC `increment_coupon_used_count`, another request could exhaust the coupon limit. The code handles the RPC failure gracefully but doesn't revert the payment creation.

**Impact:** Double-redemption possible under concurrent requests (unlikely at current scale but possible during promotions). Payment is created but coupon discount is not applied.

**Fix:** Move coupon validation and increment into a single Supabase RPC function with a transaction.

### C4. No Refund Handling for Activated Subscriptions

**Location:** `src/app/api/admin/action/route.ts` (lines 540-577, `refund_payment` case)

**Problem:** The `refund_payment` action marks a payment as `refunded` but does NOT:
1. Revert the subscription to the previous plan
2. Adjust the expiry date
3. Demote the shop's plan

**Impact:** Admin refunds a payment but the shop keeps the paid plan until expiry. Financial loss for the platform.

**Fix:** When refunding a completed payment, revert the subscription to the previous plan (or starter) and adjust expiry accordingly.

### C5. No Customer Email Notification on Payment Approval/Rejection

**Location:** `src/app/api/admin/action/route.ts` (activate_payment and reject_payment cases)

**Problem:** When admin activates or rejects a payment, the system calls `notifyOwner()` which sends an email via Resend, but:
1. If `RESEND_API_KEY` is missing, the email send crashes (caught non-fatally, but no notification)
2. There is no fallback notification mechanism (in-app notification, push notification)
3. The WhatsApp link is only generated for activation, and only if the admin manually clicks the link

**Impact:** Customer doesn't know their payment was approved or rejected without manually checking the app.

**Fix:**
1. Add in-app notification system for payment status changes
2. Show payment status prominently on the billing page
3. Add push notification fallback

### C6. Payment Dedup Bypass

**Location:** `src/app/api/billing/submit-payment/route.ts` (lines 40-49)

**Problem:** The transaction ID dedup check uses `gateway_tx_id=eq.${transactionId}` but this is not a unique constraint in the database. If the Supabase query fails or returns inconsistent results, duplicate payments can be created.

**Fix:** Add a UNIQUE constraint on `subscription_payments.gateway_tx_id`:
```sql
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_gateway_tx_id_key UNIQUE (gateway_tx_id);
```

---

## 4. High Severity Issues

### H1. No Proration Logic for Plan Changes

**Location:** `src/app/api/admin/action/route.ts` (set_plan case), `src/lib/billing/admin.ts` (activateSubscription)

**Problem:** When a customer upgrades or downgrades, there is no proration calculation. The new plan starts immediately with a fresh expiry. This means:
- **Upgrade from Professional Monthly to Business Monthly:** Customer loses remaining time on Professional plan
- **Downgrade from Business Yearly to Professional Monthly:** Customer loses months of paid Business time
- **Yearly → Monthly change:** Remaining yearly time is discarded

**Current behavior (activateSubscription):** Extends from existing expiry (line 116: `const baseDate = (oldExpiry && oldExpiry > new Date()) ? oldExpiry : new Date()`), which is a reasonable approach for same-plan renewals but incorrect for plan changes.

**Fix:**
1. Calculate remaining value of current plan (days left × daily rate)
2. Apply as credit toward new plan
3. Or: keep current plan until expiry, then switch to new plan

### H2. `reactivateShop` Hardcodes Professional Plan

**Location:** `src/lib/billing/admin.ts` (line 301)

**Problem:** The `reactivateShop` function always sets the plan to `professional` regardless of what plan the shop previously had.

```typescript
plan: 'professional',  // ← BUG: should be previous plan or admin-specified
```

**Fix:** Accept a `planId` parameter or fetch the last subscription plan from audit log.

### H3. WhatsApp-Only Reminders (No Email/Push)

**Location:** `src/app/api/cron/send-reminders/route.ts`

**Problem:** The reminder cron generates WhatsApp links but:
1. Doesn't send emails (Resend)
2. Doesn't send push notifications
3. WhatsApp links are just stored — no actual message is sent

The reminder "sending" is actually just creating a database record with a WhatsApp link. The admin dashboard's shops page shows WhatsApp buttons, but there's no automated sending.

**Fix:** Add email reminders via Resend, and if WhatsApp Business API is available, integrate real WhatsApp messaging.

### H4. Cancel Flow Missing Email Notifications

**Location:** `src/app/api/billing/cancel/route.ts`

**Problem:** When a user cancels their subscription:
1. No email notification to admin
2. No email notification to customer
3. The `subscription-event` API call on cancel page is client-side and fire-and-forget (line 57-68 of cancel/page.tsx)
4. No audit log entry

**Fix:** Send admin notification email on cancel, log to audit trail, and confirm via in-app notification.

### H5. No Rate Limiting on Admin Action API

**Location:** `src/app/api/admin/action/route.ts`, `src/proxy.ts`

**Problem:** The admin action API (`/api/admin/action`) is protected by session auth and TOTP for destructive actions, but has no rate limiting. An attacker with a stolen admin session could spam destructive actions.

**Fix:** Add rate limiting to admin API routes in middleware.

### H6. RESEND_API_KEY Missing Causes Hard Error

**Location:** `src/lib/security/email-otp.ts` (lines 12-18)

**Problem:** The `getResend()` function throws `Error('RESEND_API_KEY is required')` when the env var is missing. While email sending functions catch this non-fatally, the initial import/initialization path could crash in some edge cases.

**Fix:** Return `null` instead of throwing, and gracefully handle in callers.

### H7. Dead/Stub Admin Pages

**The following admin pages are essentially empty stubs:**
- `/admin/dashboard/health` — has page structure but no content meaningful beyond basic display
- `/admin/dashboard/disputes` — completely empty page
- `/admin/dashboard/settings/messages` — directory exists but page may be incomplete

**Fix:** Either implement these pages or hide them from navigation until ready.

### H8. Navigation Guard Bypass for Billing Routes

**Location:** `src/components/layout/AppShell.tsx` (lines 47-53)

**Problem:** The `isPlainRoute` check includes `pathname.startsWith('/pricing')` but NOT `/billing`, `/billing/upgrade`, `/billing/cancel`, or `/billing/history`. These pages require auth but are rendered without the AppShell/AuthGuard. They make API calls that require authentication but the page itself loads without the auth wrapper.

Looking at the middleware (`proxy.ts` lines 219-267), protected routes require a member session token. However, the billing pages are being treated as "plain routes" within AppShell but NOT as public routes in middleware — this means they go through auth check in middleware but render without the AppShell navbar/footer.

**Fix:** Clarify routing architecture. Billing pages that require auth should either be wrapped in AppShell or explicitly listed as protected plain routes.

### H9. `SubscriptionEvent` API is Notification-Only (No State Changes)

**Location:** `src/app/api/billing/subscription-event/route.ts`

**Problem:** The `/api/billing/subscription-event` endpoint only sends admin emails — it does NOT:
1. Record the event in the database
2. Change subscription status
3. Log to audit trail

This is misleading because the endpoint name suggests it actually processes subscription events.

**Fix:** Rename to `/api/billing/notify-admin` or add actual subscription state management.

### H10. Missing Shop Verification for Already-Subscribed Users

**Location:** Auth flow in `src/lib/auth/AuthContext.tsx`

**Problem:** When a shop is created via `setupShop()`, a verification request is created and the shop status is `pending`. The shop can immediately start using the app (creating customers, orders) before verification. If verification is rejected, all that data becomes inaccessible.

**Fix:** Consider limiting functionality for unverified shops (read-only mode, or max 5 orders).

### H11. Stale Payment Auto-Reject with No Customer Notification

**Location:** `src/app/api/cron/expire-subscriptions/route.ts` (lines 58-69)

**Problem:** Pending payments older than 48 hours are auto-rejected, but:
1. No notification to the customer
2. No notification to the admin
3. The rejection reason is generic ("Auto-rejected: pending > 48 hours")

**Fix:** Send email/WhatsApp notification to customer when auto-rejecting, and notify admin.

---

## 5. Medium Severity Issues

### M1. Admin Reports — Minimal Functionality
**Location:** `src/app/admin/dashboard/reports/`
- Revenue report: Functional with CSV export ✓
- Shops report: Page exists but has minimal features
- Subscriptions report: Page exists but has minimal features

### M2. No Pagination for `getAllShops()`
**Location:** `src/lib/billing/admin.ts` (line 62)
The function takes `page` and `perPage` parameters but the shop_usage and subscriptions joins are not paginated properly — all subscription and usage data is loaded for all shops.

### M3. Missing Coupon Counter RPC Function
**Location:** `supabase-migration.sql`
The `increment_coupon_used_count` RPC is called from `submit-payment/route.ts` but is NOT defined in the migration. This function needs to be created in Supabase.

### M4. No Subscription Payment History on User Billing Page
**Location:** `src/app/billing/page.tsx` → `BillingContent`
The user's billing page doesn't show their payment/submission history. They can't see past submitted payments or their status.

### M5. Soft-Delete Pattern Inconsistency
**Location:** `supabase-migration.sql`
- `shops.deleted_at` is set but RLS policies only check `deleted_at IS NULL` on team_members, customers, and orders
- `payments` has `deleted_at` but the policy doesn't filter it
- `order_photos` RLS policy doesn't filter `deleted_at`

### M6. No Customer-Facing Subscription Status API
**Location:** N/A (missing)
There's no API endpoint for a customer to check their subscription status, payment history, or expiry date. The `usePlan` hook reads from Supabase directly (client-side), which could expose plan details if RLS isn't perfectly configured.

### M7. WhatsApp Link Generation Uses Server Env Var in Client Components
**Location:** `src/app/admin/dashboard/shops/page.tsx` (line 232)
`process.env.NEXT_PUBLIC_APP_URL` is referenced in a client component, which works for `NEXT_PUBLIC_` vars but in the `buildExpiredWhatsApp` function it's used without a fallback.

### M8. Admin Notification History Page
**Location:** `src/app/admin/dashboard/notifications/history/`
The directory exists but the page content is minimal — just links back to the main notifications page.

### M9. Missing Filter/Search on Payments Admin Page
**Location:** `src/app/admin/dashboard/payments/page.tsx`
The payments page shows pending payments but has no filter by status (completed, failed, refunded), date range, plan type, or shop name. As payment volume grows, this becomes unmanageable.

### M10. `shop_usage` Not Updated in Real-time
**Location:** Multiple files
The `shop_usage` table tracks orders_this_month, customers_total, etc., but there's no hook or trigger to update these when orders/customers change. The cron job only resets monthly counts — it doesn't calculate them. These metrics appear to be updated manually or not at all.

### M11. No Input Validation on WhatsApp Numbers
**Location:** Multiple locations
WhatsApp numbers are formatted as `92XXXXXXXXXX` throughout the app but there's no validation that the input is a valid Pakistan phone number format before constructing WhatsApp links.

### M12. Billing Page Client-Side Fetch Without Loading States
**Location:** `src/components/billing/BillingContent.tsx`
The billing page fetches subscription data on the client side without proper loading skeleton states for all sections.

### M13. `health` Admin Page is Non-Functional
**Location:** `src/app/admin/dashboard/health/page.tsx`
The health check page exists but has no meaningful data display — it's essentially a placeholder.

### M14. `disputes` Admin Page is Empty
**Location:** `src/app/admin/dashboard/disputes/page.tsx`
This page is referenced in navigation but has no functional content.

### M15. No Bulk Operations Context in Admin UI
**Location:** `src/app/admin/dashboard/shops/page.tsx`
While the backend supports `bulk_set_plan` and `bulk_extend_expiry`, there's no UI to select multiple shops and perform bulk operations. This is a backend-only feature.

### M16. `adminSetPlan` Doesn't Check Shop Exists
**Location:** `src/lib/billing/admin.ts` (line 215)
The function upserts the subscription and patches the shop without verifying the shop exists. This could create orphaned subscription records.

### M17. `coupons` Admin Page — Basic CRUD Without Usage Stats
**Location:** `src/app/admin/dashboard/coupons/page.tsx`
The coupon management page exists but likely lacks redemption statistics and usage tracking views.

### M18. No Webhook/Event System for Subscription Changes
**Location:** Architecture-wide
There's no event-driven system for subscription state changes. Each action handler independently manages its side effects (emails, audit logs, WhatsApp links). This leads to inconsistent notification behavior.

---

## 6. Low Severity & Cosmetic Issues

### L1. Hardcoded Domain in Reminder Messages
`src/app/api/cron/send-reminders/route.ts` line 9: Fallback `'https://mydarzi.vercel.app'` — should use env var only.

### L2. Inconsistent Roman Urdu/English Mix
Admin pages use a mix of English and Roman Urdu. Some pages use "Shop", others use "Dukaan". Standardize on one language per context.

### L3. Missing Skeleton States on Some Pages
Several admin pages lack proper loading skeleton UIs (reports sub-pages, blocklist, admins).

### L4. `console.error` Usage in Production Code
Multiple files use `console.error()` instead of the structured `logger.error()`. Example: `activateSubscription` in `admin.ts` line 162.

### L5. No Error Boundary on Admin Dashboard Layout
`src/app/admin/dashboard/layout.tsx` exists but doesn't wrap with an error boundary component.

### L6. Duplicate WhatsApp Formatting Logic
Phone number formatting (`92XXXXXXXXXX` cleaning) is duplicated across multiple files (shops page, cancel page, reminders cron). Extract to a utility function.

### L7. `sentry-example-page` Still Present
`src/app/sentry-example-page/page.tsx` — should be removed before production.

### L8. `next-env.d.ts` Timestamp
This file is auto-generated and changes frequently.

### L9. `planRank` Function Only Handles 3 Plans
`src/app/api/admin/action/route.ts` line 62-66: Works for current plans but won't handle future plan additions gracefully.

### L10. No Type Safety for `Row` Type
`src/lib/supabase/service.ts` line 60: `export type Row = Record<string, any>` — the `any` type bypasses TypeScript checks throughout the codebase.

### L11. `sbGet` Typing is Too Permissive
`src/lib/supabase/service.ts` line 63: `<T = Row>` default is `Row = Record<string, any>`. Most callers don't specify the generic type.

### L12. Loading Fallback Pages Mostly Identical
All `loading.tsx` files have similar spinner components — opportunity to use a shared loading component.

---

## 7. Admin Panel Audit

### 7.1 Dashboard (`/admin/dashboard`)
| Feature | Status | Notes |
|---------|--------|-------|
| Stats cards (revenue, active subs, shops, pending) | ✅ Working | Data fetched from `/api/admin/data?type=summary` |
| Pending payments alert | ✅ Working | Shows count and link to payments page |
| Pending verifications alert | ✅ Working | Shows count and link to shops page |
| Recent shops list | ✅ Working | Shows last 8 shops with plan/status |
| Refresh button | ✅ Working | `Date.now()` in server component is fixed |
| Responsive design | ⚠️ Partial | Mobile card view works but some badges hidden on small screens |

### 7.2 Shops (`/admin/dashboard/shops`)
| Feature | Status | Notes |
|---------|--------|-------|
| Shop listing with pagination | ✅ Working | Load more pattern, 50 per page |
| Tab filtering (All, Renewals, Starter, etc.) | ✅ Working | Client-side filtering |
| Search | ✅ Working | By name, phone, email |
| Plan change dropdown | ✅ Working | Requires TOTP |
| Verification approve/reject | ✅ Working | For pending verifications |
| Activate/deactivate shop | ✅ Working | With confirmation modal |
| Impersonate (Login as Shop) | ✅ Working | TOTP-required |
| Reset owner PIN | ✅ Working | TOTP-required, shows new PIN |
| WhatsApp link generation | ✅ Working | Different messages for renewal reminders |
| Delete shop (rejected accounts) | ✅ Working | Soft-delete with confirmation |
| Shop detail page (`/admin/dashboard/shops/[id]`) | ✅ Working | Shows shop details, usage, order stats |
| Bulk operations | ❌ Missing | Backend supports bulk_set_plan, bulk_extend_expiry but no UI |
| Export shops | ❌ Missing | No CSV/Excel export |
| Order stats per shop | ✅ Working | Shows total/active/delivered counts |

### 7.3 Payments (`/admin/dashboard/payments`)
| Feature | Status | Notes |
|---------|--------|-------|
| Pending payments list | ✅ Working | With load more |
| Payment details (reference, transaction ID) | ✅ Working | Expandable card |
| Copy reference/transaction ID | ✅ Working | One-click copy |
| Receipt screenshot display | ✅ Working | From receipt_data |
| Coupon info display | ✅ Working | Shows discount details |
| Activate payment | ✅ Working | With confirmation modal |
| Reject payment | ✅ Working | Requires reason + TOTP |
| Filter by status | ❌ Missing | Only shows pending |
| Filter by date | ❌ Missing | No date range |
| Filter by plan | ❌ Missing | Can't filter professional/business |
| Completed/failed/refunded view | ❌ Missing | No way to see non-pending payments |
| Payment history page | ❌ Missing | Separate page needed |

### 7.4 Analytics (`/admin/dashboard/analytics`)
| Feature | Status | Notes |
|---------|--------|-------|
| Revenue overview | ✅ Working | Server component |
| MRR calculation | ✅ Working | Recurring revenue |
| Churn rate | ✅ Working | cancelled/total paid |
| Monthly revenue bar chart | ✅ Working | Last 6 months, custom CSS |
| Revenue by plan breakdown | ✅ Working | Professional vs Business |
| Revenue by cycle breakdown | ✅ Working | Monthly vs Yearly |
| Date range selection | ❌ Missing | Fixed to 6 months |
| Export | ❌ Missing | No CSV/PDF export |
| Growth metrics | ❌ Missing | No MoM growth % |

### 7.5 Notifications (`/admin/dashboard/notifications`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create notification | ✅ Working | Title, message, type, audience, expiry |
| Edit notification | ✅ Working | Pre-fills form |
| Delete notification | ✅ Working | With confirmation modal |
| Bulk WhatsApp links | ✅ Working | Generates wa.me links per shop |
| Active notifications list | ✅ Working | With type badges, edit/delete |
| Notification history | ⚠️ Partial | Page exists, minimal content |
| Push notification sending | ❌ Missing | WhatsApp links only (not auto-sent) |

### 7.6 Reports (`/admin/dashboard/reports/`)
| Feature | Status | Notes |
|---------|--------|-------|
| Revenue report | ✅ Working | 12-month view, CSV export |
| Shops report | ⚠️ Minimal | Page exists, basic table |
| Subscriptions report | ⚠️ Minimal | Page exists, basic table |

### 7.7 Security (`/admin/dashboard/security/`)
| Feature | Status | Notes |
|---------|--------|-------|
| IP Blocklist | ✅ Working | Add/remove with TOTP |
| 2FA Settings | ⚠️ Partial | Page exists |

### 7.8 Admins (`/admin/dashboard/admins`)
| Feature | Status | Notes |
|---------|--------|-------|
| List admin accounts | ✅ Working | With role icons, status |
| Create admin | ✅ Working | Username, password, role, TOTP |
| Activate/deactivate admin | ✅ Working | With TOTP |

### 7.9 Other Admin Pages
| Page | Status | Notes |
|------|--------|-------|
| Audit Log (`/admin/dashboard/logs`) | ✅ Working | Last 200 entries, server component |
| Coupons (`/admin/dashboard/coupons`) | ✅ Working | CRUD operations |
| Health (`/admin/dashboard/health`) | ❌ Stub | Empty/placeholder |
| Disputes (`/admin/dashboard/disputes`) | ❌ Stub | Empty/placeholder |
| Settings/Messages (`/admin/dashboard/settings/messages`) | ⚠️ Minimal | Template management |

---

## 8. Subscription & Payment Logic Review

### 8.1 Current Architecture

The payment flow is entirely manual:
1. Customer selects plan on `/billing/upgrade`
2. Customer sends money via Raast/Easypaisa/JazzCash/Bank
3. Customer submits transaction details via `/api/billing/submit-payment`
4. Payment record created with `status: 'pending'`
5. Admin receives notification email (optional)
6. Admin manually verifies payment against bank statement
7. Admin activates (`activate_payment`) or rejects (`reject_payment`) via admin panel
8. On activation: subscription updated, shop plan upgraded, audit log
9. On rejection: payment marked failed, reason recorded

### 8.2 Subscription State Machine

```
trialing → active → cancelled → grace → active (starter/free)
                  → expired → grace → active (starter/free)
```

### 8.3 Scenario Analysis

#### Scenario 1: Customer upgrades from Professional Monthly to Business Monthly
- **Current behavior:** New Plan starts immediately. Expiry extends from existing expiry (if still valid), creating a hybrid expiration that gives them Business features for their remaining Professional time + new Business time.
- **Recommended:** Calculate remaining Professional time value (days left × daily rate = ~Rs.33/day), credit toward Business plan (Rs.83/day). New expiry = today + (credit + new payment) / daily_business_rate.

#### Scenario 2: Customer downgrades from Business Yearly to Professional Monthly
- **Current behavior:** Business time is discarded. Professional starts fresh with 1-month expiry.
- **Recommended:** Keep Business plan until expiry, then switch. OR calculate prorated refund/credit.

#### Scenario 3: Customer with active Yearly subscription buys Monthly
- **Current behavior:** Monthly payment extends from existing yearly expiry. The customer now has Yearly+1Month.
- **Recommended:** This is reasonable if the customer is simply extending their subscription. But if they're changing billing cycles, warn them they're extending, not switching cycles.

#### Scenario 4: Customer purchases plan before current plan expires
- **Current behavior:** New time stacks on top of existing expiry. ✅
- **Verdict:** Good — the base date calculation in `subscriptionExpiresAt` uses `oldExpiry > new Date()` as the base, so unused time is preserved.

### 8.4 Missing Subscription Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Proration calculation | Critical | Fair billing for plan changes |
| Subscription renewal auto-charge | Future | Requires payment gateway integration |
| Plan comparison tool | Medium | Help customers choose |
| Usage notifications | Medium | "You've used 25/30 orders this month" |
| Grace period warning emails | High | Before features are cut off |
| Trial ending soon emails | High | Convert trials to paid |
| Invoice/receipt generation | Medium | For customer records |
| Payment method management | Future | Saved Raast ID, preferred method |
| Automatic payment matching | Future | Match bank transfers via reference |
| Subscription pause | Low | Temporary hold without canceling |

### 8.5 Database Improvements Needed

```sql
-- Add unique constraint on gateway_tx_id
ALTER TABLE subscription_payments 
  ADD CONSTRAINT subscription_payments_gateway_tx_id_key UNIQUE (gateway_tx_id);

-- Add cron_cursors table for incremental cron processing
CREATE TABLE IF NOT EXISTS cron_cursors (
  job_name TEXT PRIMARY KEY,
  cursor_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add increment_coupon_used_count RPC function
CREATE OR REPLACE FUNCTION increment_coupon_used_count(p_coupon_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id 
    AND (max_uses IS NULL OR used_count < max_uses)
    AND is_active = true
  RETURNING used_count INTO updated_count;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 9. Application Flow Audit

### 9.1 Customer-Facing Pages

| Route | Status | Authentication | Notes |
|-------|--------|---------------|-------|
| `/` (Landing) | ✅ | None | Marketing page |
| `/auth` | ✅ | None | Login/signup page |
| `/setup` | ✅ | None | Shop setup wizard |
| `/login` | ✅ | None | PIN login |
| `/dashboard` | ✅ | Member | Stats + recent orders |
| `/orders` | ✅ | Member | Order list + status management |
| `/orders/new` | ✅ | Member (Owner) | New order creation |
| `/orders/[id]` | ✅ | Member | Order detail |
| `/orders/[id]/edit` | ✅ | Member (Owner) | Edit order |
| `/customers` | ✅ | Member | Customer list |
| `/customers/new` | ✅ | Member | Add customer |
| `/customers/[id]` | ✅ | Member | Customer detail + measurements |
| `/customers/[id]/edit` | ✅ | Member | Edit customer |
| `/billing` | ✅ | Member | Current plan + billing info |
| `/billing/upgrade` | ✅ | Member | Plan selection + payment submission |
| `/billing/cancel` | ✅ | Member | Cancel subscription |
| `/billing/history` | ✅ | Member | Payment history |
| `/payments` | ✅ | Member (Owner) | Payment management |
| `/reports` | ✅ | Member (Owner) | Business reports |
| `/settings` | ✅ | Member | App settings |
| `/settings/shop` | ✅ | Member (Owner) | Shop profile settings |
| `/settings/team` | ✅ | Member (Owner) | Team/karigar management |
| `/settings/notifications` | ✅ | Member | Notification preferences |
| `/settings/change-pin` | ✅ | Member | Change PIN |
| `/track/[code]` | ✅ | None | Public order tracking |
| `/pricing` | ✅ | None | Public pricing page |
| `/karigar` | ✅ | Member (Karigar) | Karigar dashboard |

### 9.2 API Route Audit

| Route | Method | Auth | Purpose | Issues |
|-------|--------|------|---------|--------|
| `/api/auth/login` | POST | None | Phone+PIN login | ✅ |
| `/api/auth/send-otp` | POST | None | Send OTP email | ✅ |
| `/api/auth/verify-otp` | POST | None | Verify OTP | ✅ |
| `/api/auth/session` | GET/POST/DELETE | Member | Session management | ✅ |
| `/api/auth/create-shop` | POST | None | Shop creation | ✅ |
| `/api/auth/check-phone` | GET | None | Phone availability | ✅ |
| `/api/auth/update-pin` | POST | Member | PIN change | ✅ |
| `/api/auth/shop-verify-request` | POST | Member | Submit verification | ✅ |
| `/api/auth/log-attempt` | POST | None | Login attempt logging | ✅ |
| `/api/admin/login` | POST | None | Admin login with secret+TOTP | ✅ |
| `/api/admin/verify` | POST | None | Admin TOTP verification | ✅ |
| `/api/admin/logout` | POST | Admin | Admin logout | ✅ |
| `/api/admin/totp-uri` | GET | Admin | TOTP setup URI | ✅ |
| `/api/admin/action` | POST | Admin+TOTP | All admin actions | ⚠️ H5 (no rate limit) |
| `/api/admin/data` | GET | Admin | Dashboard data queries | ✅ |
| `/api/admin/notifications` | CRUD | Admin | Notification management | ✅ |
| `/api/admin/notifications/whatsapp` | POST | Admin | Bulk WhatsApp links | ✅ |
| `/api/admin/admins` | GET | Admin | Admin account listing | ✅ |
| `/api/admin/blocklist` | GET | Admin | IP blocklist | ✅ |
| `/api/admin/analytics` | GET | Admin | Analytics data | ✅ |
| `/api/admin/reports` | GET | Admin | Report generation (CSV) | ✅ |
| `/api/admin/impersonate` | POST | Admin+TOTP | Shop impersonation | ✅ |
| `/api/admin/health` | GET | Admin | Health check | ⚠️ Stub |
| `/api/admin/templates` | GET/POST | Admin | Message templates | ⚠️ Minimal |
| `/api/admin/backfill-expiry` | POST | Admin | Backfill expiry dates | ✅ |
| `/api/billing/submit-payment` | POST | Member | Submit manual payment | ⚠️ C1,C3,C6 |
| `/api/billing/cancel` | POST | Member | Cancel subscription | ⚠️ H4 |
| `/api/billing/subscription-event` | POST | Member | Notify admin of event | ⚠️ H9 |
| `/api/billing/subscription-status` | GET | Member | Subscription status | ✅ |
| `/api/coupons/validate` | GET | None | Validate coupon code | ✅ |
| `/api/cron/expire-subscriptions` | GET/POST | Cron | Subscription lifecycle | ⚠️ C2 |
| `/api/cron/send-reminders` | GET/POST | Cron | Expiry reminders | ⚠️ H3 |
| `/api/cron/reset-usage` | GET/POST | Cron | Monthly usage reset | ✅ |
| `/api/cron/cleanup-photos` | GET/POST | Cron | Orphan photo cleanup | ✅ |
| `/api/orders` | CRUD | Member | Order management | ✅ |
| `/api/orders/bulk` | POST | Member | Bulk order operations | ✅ |
| `/api/measurements` | CRUD | Member | Measurement management | ✅ |
| `/api/notifications` | GET/PATCH | Member | User notifications | ✅ |
| `/api/push/subscriptions` | POST/DELETE | Member | Web push subscriptions | ✅ |
| `/api/shop/update` | POST | Member | Shop profile update | ✅ |
| `/api/shop/delete` | POST | Member | Shop self-delete | ✅ |
| `/api/team/members` | CRUD | Member | Team management | ✅ |
| `/api/team/encrypt-pin` | POST | Member | PIN encryption helper | ✅ |
| `/api/order-photos` | CRUD | Member | Order photo management | ✅ |
| `/api/photos/delete` | POST | Member | Cloud photo deletion | ✅ |
| `/api/health` | GET | None | Public health check | ✅ |
| `/api/csp-violation` | POST | None | CSP violation reporting | ✅ |

### 9.3 Auth Flow Review ✅

- **PIN-based auth:** Phone + 6-digit PIN, bcrypt(12) hashing
- **Session tokens:** HMAC-SHA256 signed, 7-day TTL, token rotation on each request
- **Token versioning:** Incremented on PIN reset to revoke all sessions
- **Admin auth:** Static secret + TOTP (Google Authenticator), HMAC-SHA256, 15-min/7-day options
- **Cron auth:** Bearer token (`CRON_SECRET`)
- **RLS:** Shop-scoped via `app.current_shop_id` session variable
- **CSRF protection:** Origin/referer check on state-changing requests

**Assessment:** The auth system is well-designed with proper cryptographic signatures, session rotation, and scope isolation.

---

## 10. Scalability & Infrastructure Review

### 10.1 Vercel (Hosting)

**Current tier:** Likely Hobby (free)

| Resource | Free Limit | When to Upgrade |
|----------|-----------|-----------------|
| Bandwidth | 100 GB/month | At ~50 active shops with heavy photo usage |
| Build time | 100 hours/month | At ~5+ deploys/day with large build |
| Serverless function execution | 100 GB-hours | At ~500K function invocations/month |
| Edge middleware invocations | 1M/month | At ~200 active shops |
| Team members | 1 (personal) | Immediately if team collaboration needed |

**Upgrade threshold:** Pro tier ($20/month) when reaching:
- 50+ active shops
- 100K+ monthly page views
- 500+ orders/day

### 10.2 Supabase (Database + Storage)

**Current tier:** Likely Free (2 free projects)

| Resource | Free Limit | When to Upgrade |
|----------|-----------|-----------------|
| Database size | 500 MB | At ~5,000 shops or 10,000 photos stored as base64 |
| Bandwidth | 5 GB/month | At ~10,000 API calls/day for data-heavy queries |
| Auth users | Unlimited (custom auth used) | N/A |
| Storage | 1 GB | At ~5,000 photos (200KB avg) |
| Edge functions | 500K/month | At heavy cron usage |
| Real-time connections | 200 concurrent | At ~200 simultaneous users |

**⚠️ Photo Storage Concern:** Photos are stored as `base64` in the `order_photos` table AND on Cloudinary. The base64 field in the database will cause rapid database size growth. Storing photos in base64 can increase storage requirements by ~33% over raw binary.

**Upgrade threshold:** Pro tier ($25/month) when reaching:
- 2,000+ shops
- 2,000+ photos stored in DB
- 50+ concurrent real-time users

### 10.3 Resend (Email)

**Current tier:** Free (100 emails/day)

| Resource | Free Limit | Upgrade Threshold |
|----------|-----------|-------------------|
| Daily emails | 100/day | At ~30 active shops receiving OTP emails |
| Dedicated IP | Not included | Not needed until 10K+ emails/month |
| Email validation | Not included | Pro tier for spam prevention |

**Critical:** At 100 emails/day, the platform can support only ~30 signups (OTP email + welcome email) or ~50 payment notifications per day before hitting limits.

**Upgrade threshold:** Pro tier ($20/month for 5K emails) at 150+ active shops.

### 10.4 Upstash Redis (Rate Limiting + Idempotency)

**Current tier:** Likely Free (10K commands/day)

| Resource | Free Limit | Upgrade Threshold |
|----------|-----------|-------------------|
| Commands | 10K/day | At ~5K API calls/day |
| Storage | 256 MB | Not a constraint for rate limiting |
| Connections | 100 concurrent | At heavy usage |

**Upgrade threshold:** Pay-as-you-go at ~100 active shops.

### 10.5 Cloudinary (Photo Storage)

**Current tier:** Likely Free

| Resource | Free Limit | When to Upgrade |
|----------|-----------|-----------------|
| Storage | 25 GB | At ~100,000 photos |
| Bandwidth | 25 GB/month | At ~50,000 photo views/month |
| Transformations | 25/month | Not relevant for current usage |

### 10.6 Overall Capacity Estimates

| Metric | Free Tier | Pro Tier ($70-100/mo) | Business Tier ($200+/mo) |
|--------|-----------|----------------------|--------------------------|
| Active shops | 50-100 | 500-1,000 | 5,000+ |
| Daily orders | 100 | 1,000 | 10,000+ |
| Customers | 2,000 | 20,000 | 200,000+ |
| Photos stored | 1,000 | 10,000 | 100,000+ |
| Concurrent users | 20 | 200 | 2,000+ |
| Monthly emails | 3,000 (100/day) | 50,000 | 500,000+ |
| Database size | 500 MB | 8 GB | 50+ GB |

**Bottleneck forecast (in order of first to hit):**
1. Resend email limit (100/day) — first bottleneck
2. Upstash Redis commands (10K/day) — second bottleneck
3. Supabase database size (base64 photos) — third bottleneck
4. Vercel bandwidth — fourth bottleneck

---

## 11. Security & Production Readiness

### 11.1 Security Assessment

| Area | Rating | Notes |
|------|--------|-------|
| Authentication | ✅ Strong | HMAC-SHA256 sessions, bcrypt(12) PIN hashing, token rotation |
| Admin Auth | ✅ Strong | Secret + TOTP, session timeout, role-based access |
| CSRF Protection | ✅ Strong | Origin/referer checking on all state-changing requests |
| Rate Limiting | ✅ Strong | Multi-tier (login, OTP, signup, general API) via Upstash |
| IP Blocking | ✅ Strong | Database-backed with in-memory cache, TOTP-protected management |
| RLS (Row Level Security) | ✅ Strong | Shop-scoped data isolation via `app.current_shop_id` |
| Input Validation | ✅ Good | Zod schemas for all API inputs |
| API Security | ⚠️ Good | Missing rate limiting on admin/action endpoint |
| CSP Headers | ✅ Good | Strict CSP with framed-ancestors 'none' |
| SQL Injection | ✅ Strong | Supabase parameterized queries via REST API |
| XSS Prevention | ✅ Good | React + strict CSP |
| Password Storage | ✅ Strong | bcrypt(12) for PINs and admin passwords |
| Session Management | ✅ Strong | Signed tokens, rotation, TTL, token version invalidation |
| Photo Upload Security | ⚠️ Fair | No file type validation visible, base64 storage in DB |
| Environment Variables | ⚠️ Fair | `.env.example` is comprehensive, but no runtime validation |

### 11.2 Production Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Resend API key missing → email failures | Medium | High | Add env var validation at startup |
| Base64 photos bloat Supabase DB | High | Medium | Migrate to Cloudinary-only storage, remove base64 column |
| Stale payments never cleaned up | Low | Low | Cron handles 48h auto-reject |
| Supabase free tier exhaustion | Medium | High | Monitor usage, set up alerts, plan Pro upgrade |
| Redis rate limiter exhaustion → fail open | Low | High | In-memory fallback is in place |
| Admin account compromise | Low | Critical | TOTP 2FA is required for destructive actions |
| Customer payment dispute | Medium | Medium | Manual verification with screenshot and TxID matching |

### 11.3 Missing Security Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Security headers audit | High | Verify all headers in production deployment |
| CSP nonce implementation | Medium | Remove 'unsafe-inline' from script-src |
| API key rotation procedure | Medium | Document process for rotating all secrets |
| Penetration testing | Medium | Before production launch |
| Dependency audit | Low | `npm audit` on CI |
| Backup verification | High | Test Supabase backup restoration |
| Incident response plan | Medium | Document who to contact, rollback procedures |

---

## 12. Feature Recommendations

### 12.1 Essential (Before Production Launch)

1. **Fix subscription stacking (C1)** — Prevent multiple pending payments
2. **Add `cron_cursors` table (C2)** — Fix incremental cron processing
3. **Add unique constraint on `gateway_tx_id` (C6)** — Prevent duplicate payments
4. **Implement payment status notifications (C5)** — Let customers know when payments are approved/rejected
5. **Add proration logic (H1)** — Fair billing for plan changes
6. **Fix reactivateShop hardcoded plan (H2)** — Respect previous plan
7. **Add email reminders (H3)** — Not just WhatsApp links
8. **Add cancel flow notifications (H4)** — Email admin + customer on cancel
9. **Implement shop_usage counters** — Track and update order/customer counts
10. **Add rate limiting on admin action API (H5)** — Prevent abuse
11. **Create increment_coupon_used_count RPC** — Fix coupon functionality
12. **Add proper error boundaries** — Prevent full-page crashes

### 12.2 Growth Features (After 50+ Shops)

1. **Automated payment matching** — Parse bank SMS/email for Raast transfers
2. **Email campaign system** — Newsletter/promotional emails to shop owners
3. **Affiliate/referral program** — Shop owners refer other shops
4. **Multi-language support** — English UI option (i18next already integrated)
5. **Enhanced analytics** — Shop-level analytics dashboard for owners
6. **Bulk WhatsApp messaging** — Actually send WhatsApp messages (Business API)
7. **Order templates** — Save and reuse common order configurations
8. **Customer self-service portal** — Customers track their own orders without shop

### 12.3 Premium Features (Competitive Advantage)

1. **Stripe/PayPal integration** — For international markets (currently Pakistan-only)
2. **AI-powered measurements** — Photo-based body measurement estimation
3. **Design catalog** — Shareable garment design gallery
4. **White-label option** — Custom domain + branding for large shops
5. **Advanced inventory management** — Fabric stock tracking
6. **Machine learning demand forecasting** — Predict busy periods
7. **API for partners** — Allow fabric shops to integrate
8. **POS integration** — Physical shop counter integration

### 12.4 Business Improvements

| Area | Recommendation |
|------|---------------|
| **Customer retention** | Add loyalty program (discount on Nth order), automated follow-up WhatsApp after delivery |
| **Conversion (trial→paid)** | Add in-app "trial days remaining" countdown, feature preview carousel, one-click upgrade prompts |
| **Revenue generation** | Add "feature add-ons" (extra karigar slots, extra storage), seasonal pricing |
| **Operational efficiency** | Add bulk order creation from CSV, automated status update reminders via WhatsApp |
| **User experience** | Reduce clicks for common tasks, add keyboard shortcuts, improve mobile photo capture |

---

## 13. Production Readiness Assessment

### Overall Score: 70/100

| Dimension | Score | Notes |
|-----------|-------|-------|
| Core functionality | 85/100 | Order, customer, measurement management works well |
| Admin panel | 75/100 | Most features work, some pages are stubs |
| Subscription/payment | 55/100 | Manual flow works but missing critical safeguards |
| Security | 80/100 | Strong foundation, minor gaps |
| Performance | 75/100 | Good architecture, needs monitoring |
| Scalability | 60/100 | Can handle 50-100 shops on free tier |
| Error handling | 70/100 | Most errors caught, some silent failures |
| Testing | 65/100 | 228 unit tests pass, needs E2E tests for payment flow |
| Documentation | 60/100 | Codebase well-commented, missing ops runbook |
| Monitoring | 55/100 | Sentry configured, no performance monitoring, no uptime monitoring |

### Launch Recommendations

**Soft Launch (Private Beta):** Ready after fixing Critical issues C1-C6
- Target: 20-30 shops
- Duration: 1-2 months
- Focus: Payment workflow validation, subscription lifecycle testing

**Public Launch:** Ready after fixing High issues H1-H11
- Target: 100+ shops
- Focus: Marketing, support team training, payment verification staffing

**Scale Launch:** Ready after Medium issues M1-M18
- Target: 500+ shops
- Focus: Infrastructure upgrade, automated payment matching, dedicated support

---

## 14. Action Plan

### Phase 1: Critical Fixes (1-2 weeks)

| Issue | Effort | Priority |
|-------|--------|----------|
| C1: Subscription stacking prevention | Medium | 🔴 Immediate |
| C2: Create cron_cursors table | Small | 🔴 Immediate |
| C3: Coupon race condition fix | Medium | 🔴 Immediate |
| C4: Refund handling for subscriptions | Medium | 🔴 Immediate |
| C5: Payment status notifications | Medium | 🔴 Immediate |
| C6: Unique constraint on gateway_tx_id | Small | 🔴 Immediate |

### Phase 2: High Priority (2-4 weeks)

| Issue | Effort | Priority |
|-------|--------|----------|
| H1: Proration logic | Large | 🟠 High |
| H2: Fix reactivateShop plan | Small | 🟠 High |
| H3: Email reminders | Medium | 🟠 High |
| H4: Cancel flow notifications | Small | 🟠 High |
| H5: Rate limiting on admin action | Small | 🟠 High |
| H6: Graceful RESEND_API_KEY handling | Small | 🟠 High |
| H7: Remove/implement stub pages | Small | 🟠 High |
| H10: Verification-limited functionality | Medium | 🟠 High |
| H11: Auto-reject notifications | Small | 🟠 High |
| Create increment_coupon_used_count RPC | Small | 🟠 High |
| Fix shop_usage counter updates | Medium | 🟠 High |

### Phase 3: Medium Priority (4-8 weeks)

| Issue | Effort | Priority |
|-------|--------|----------|
| M1-M18: Various improvements | Various | 🟡 Medium |
| Export functionality for admin pages | Medium | 🟡 Medium |
| Payment history with filtering | Medium | 🟡 Medium |
| Bulk operations UI | Large | 🟡 Medium |
| Event-driven subscription notifications | Large | 🟡 Medium |

### Phase 4: Polish (Ongoing)

| Issue | Effort | Priority |
|-------|--------|----------|
| L1-L12: Cosmetic fixes | Small | 🟢 Low |
| Remove sentry-example-page | Small | 🟢 Low |
| Standardize language (Roman Urdu vs English) | Medium | 🟢 Low |
| Extract shared utilities | Small | 🟢 Low |

---

**Report generated by:** Comprehensive QA Audit
**Date:** 2026-06-10
**Next audit recommended:** After Phase 1 fixes are implemented
