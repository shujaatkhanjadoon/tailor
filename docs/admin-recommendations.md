# Admin Panel — Recommendations

## Current State

Existing admin routes:
- `/admin/dashboard` — Overview stats (revenue, subs, shops, pending)
- `/admin/dashboard/payments` — Verify/reject pending payments
- `/admin/dashboard/shops` — View/manage all shops (change plan, toggle active, login as shop, delete)
- `/admin/dashboard/analytics` — Revenue charts, MRR, churn, breakdowns
- `/admin/dashboard/notifications` — Send push notifications to shops
- `/admin/dashboard/logs` — Audit log viewer
- `/api/admin/backfill-expiry` — API-only (no UI)

---

## Recommended Additions (Priority Order)

### 1. P1 — Shop Detail Page (replace expanded card)
Current shops page uses an expandable card inside a list. For 50+ shops this is unusable.

**Add**: `/admin/dashboard/shops/[id]`
- Full shop info (all fields in one view)
- Order history for that shop
- Payment history
- Subscription timeline (status changes)
- Verification documents
- Activity log (login history, IPs)
- Direct actions (change plan, deactivate, impersonate)

### 2. P1 — Email Template Editor
Admin needs to update WhatsApp/email messages without deploying code.

**Add**: `/admin/dashboard/settings/messages`
- Activation message template
- Rejection message template
- Reminder message template (5d, 3d, 1d)
- Expiry notification template
- Preview button showing rendered message

### 3. P2 — Coupon / Discount Codes
For promotions and referrals.

**Add**: `/admin/dashboard/coupons`
- Create coupon (code, discount %, max uses, expiry)
- Track usage per shop
- Apply during payment (in submit-payment flow)

### 4. P2 — Dispute / Refund Management
When a customer disputes a payment.

**Add**: `/admin/dashboard/disputes`
- View disputed payments
- Refund with reason (marks payment `refunded`)
- Notify shop owner
- Refund report

### 5. P2 — Manual Subscription Adjustment
Sometimes admin needs to adjust a subscription outside of normal flows.

**Add**: In shop detail page:
- Extend expiry date by N days (free extension)
- Set custom expiry date
- Add free months
- Change amount_pkr

### 6. P2 — Notification History
See all notifications sent to shops.

**Add**: `/admin/dashboard/notifications/history`
- List of all push/email/WhatsApp notifications sent
- Status (delivered/failed)
- Click-through tracking (if WhatsApp)

### 7. P3 — Reports & Export
- `/admin/dashboard/reports/revenue` — Revenue report with date range picker, export CSV
- `/admin/dashboard/reports/subscriptions` — Active/churned/grace breakdown
- `/admin/dashboard/reports/shops` — Shop growth, signups per day/week/month

### 8. P3 — Role-based Admin Accounts
Currently single admin. For when you have multiple team members.

**Add**: `/admin/dashboard/admins`
- Create sub-admin accounts with limited permissions
- Roles: `super_admin` (full access), `finance` (payments only), `support` (view shops, no destructive actions)
- Login as sub-admin with TOTP

### 9. P3 — System Health Dashboard
- `/admin/dashboard/health`
- Cron job status (last run time, success/failure)
- Supabase connection status
- Redis/Upstash status
- Error rate from Sentry
- Queue depth (if any)

### 10. P4 — Bulk Operations
- `/admin/dashboard/shops/bulk`
- Bulk change plan (select multiple shops → apply plan)
- Bulk send notification
- Bulk extend expiry
- CSV import/export shop list

### 11. P4 — IP Blocklist
- `/admin/dashboard/security/blocklist`
- Add/remove blocked IPs
- View blocked login attempts
- Rate limit override for specific shops

### 12. P4 — Two-Factor Auth Recovery
- `/admin/dashboard/security/2fa`
- Reset TOTP for admin
- View backup codes
- Force logout all admin sessions

---

## UI/UX Improvements

| Issue | Fix |
|---|---|
| Shops page expandable card breaks with 50+ shops | Add server-side pagination + search + dedicated shop detail page |
| Payments page has no pagination | Add "load more" or page-based pagination for 100+ pending payments |
| No confirmation dialogs use proper modal (uses browser `confirm()`) | Replace all `confirm()` with a proper modal component |
| No loading states on action buttons | Already partially done; review remaining raw buttons |
| Mobile admin experience cramped | Audit all pages at 320px width |

---

## Security Improvements

| Issue | Fix |
|---|---|
| Admin session 15-min expiry but no "remember me" | Add optional 7-day session token |
| No IP allowlist for admin login | Add optional `ADMIN_IP_ALLOWLIST` env var |
| No admin action email confirmation | Already partially done via email-otp.ts; verify it sends correctly |
| No webhook for failed cron jobs | Add failure notification via email |

---

## Automation

| What | How |
|---|---|
| Alert when pending payments > 10 | Add check in expire-subscriptions cron, email admin |
| Weekly summary email to admin | New cron job: aggregate stats, email every Monday |
| Auto-trial for new shops | Already done (create-shop sets 14-day trial) |
| Auto-disable shops with expired payments | Already done (grace → starter) |
| WhatsApp fallback (when cron drops) | Add retry queue with 3 attempts |

---

## Implementation Notes

- All new pages should be `'use client'` to avoid PPR issues
- Use existing patterns: `useState/useEffect`, `fetch()` to `/api/admin/data`, error/success states
- Always require TOTP for destructive actions (delete, deactivate, refund)
- Add `nbAction` or similar word to destructive button labels as Urdu confirmation
- Cache admin data routes with `stale-while-revalidate` for dashboard overview
