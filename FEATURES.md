# MeraDarzi — Complete App Analysis

> **App:** MeraDarzi (Mera Darzi) — Pakistan ka Tailor Management App
> **URL:** https://app.meradarzi.pk
> **Stack:** Next.js 16 (webpack) + React 19 + Supabase (PostgreSQL) + Dexie/IndexedDB + TypeScript
> **Auth:** PIN-based (bcrypt, 6-digit) + HMAC-SHA256 sessions + optional Admin TOTP 2FA
> **i18n:** English + Urdu (LTR-only, locale persisted)
> **Deploy:** Vercel — Mumbai (bom1) region
> **PWA:** Full offline support via service worker + Dexie sync engine

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [All Features (Detailed)](#2-all-features-detailed)
3. [User Workflows](#3-user-workflows)
4. [Data Model](#4-data-model)
5. [API Routes](#5-api-routes)
6. [Admin Panel](#6-admin-panel)
7. [Security](#7-security)
8. [Offline & Sync](#8-offline--sync)
9. [Billing & Pricing](#9-billing--pricing)
10. [File Map](#10-file-map)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Client (Browser/PWA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Next.js  │  │  Dexie   │  │ Service  │  │   shadcn/ui  │ │
│  │ Pages    │  │(IndexedDB)│  │  Worker  │  │  Components  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼───────────────────────────────────────┐
│                 Next.js Edge Middleware (proxy.ts)             │
│    Security Headers · Session Rotation · Rate Limit · IP      │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│              Next.js API Routes (22 endpoints)                │
│   Auth · Orders · Billing · Team · Admin · Shop · Photos     │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                     Supabase (PostgreSQL)                      │
│    13 Tables · RLS · Indexes · Triggers · Real-time           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. All Features (Detailed)

### 2.1 Authentication & Onboarding

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Phone-based login** | Enter Pakistani phone number, receive OTP, set 6-digit PIN | `app/auth/page.tsx`, `components/auth/AuthSteps.tsx` |
| **PIN login** | Authenticate with 6-digit PIN after initial setup | `app/api/auth/login/route.ts` |
| **HMAC session tokens** | SHA-256 HMAC signed tokens stored in httpOnly cookies | `lib/auth/session.ts` |
| **Session rotation** | Tokens rotated every 15 minutes via edge middleware | `proxy.ts:84-120` |
| **OTP via email** | 6-digit OTP sent to shop owner email for verification | `lib/email/index.ts` |
| **Rate limiting** | Upstash Redis (production) + in-memory Map (dev) per phone/IP | `lib/rate-limit.ts` |
| **Attempt logging** | Failed login attempts tracked per phone number | `app/api/auth/log-attempt/route.ts` |
| **Shop creation wizard** | Multi-step setup: phone → OTP → name → email → shop details → PIN | `app/auth/page.tsx` |
| **Admin TOTP 2FA** | Time-based One-Time Password for admin login | `app/api/admin/totp-uri/route.ts`, `app/api/admin/verify/route.ts` |

### 2.2 Dashboard

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Stats cards** | Today's orders, pending payments, total customers, revenue | `app/page.tsx`, `components/dashboard/` |
| **Role-based view** | Tailor (MeraDarzi) sees stats; Karigar (worker) sees assignments | `app/page.tsx` |
| **Alerts banner** | Subscription expiry warnings, verification reminders | `components/dashboard/` |
| **Revenue display** | Today's earnings, pending collection, monthly charts | `app/page.tsx` |
| **Online status indicator** | Shows connection status with offline queue count | `components/ui/OnlineStatus.tsx` |
| **PWA install prompt** | Browser prompt to install as standalone app | `components/ui/PWAInstallPrompt.tsx` |

### 2.3 Order Management

| Feature | Description | File(s) |
|---------|-------------|---------|
| **3-step order wizard** | Customer → Garment → Confirm & Payment | `app/orders/new/page.tsx` |
| **Step 1: Customer** | Select existing or add new customer with phone, address | `components/orders/wizard/Step1Customer.tsx` |
| **Step 2: Garment** | Select garment type, add measurement fields, pricing | `components/orders/wizard/Step2Garment.tsx` |
| **Step 3: Confirm** | Review order details, add advance/balance payment | `components/orders/wizard/Step3Confirm.tsx` |
| **Order types** | New stitching, alteration, ready-made | Schema `order_type` enum |
| **Order statuses** | Pending, In Progress, Ready for Fitting, Fitting Done, Completed, Delivered, Cancelled | Schema |
| **Advance payment tracking** | Track partial advances vs total amount | `lib/payments/calculations.ts` |
| **Balance calculation** | Auto-calculate remaining balance | `lib/payments/calculations.ts` |
| **Order history** | Full timeline of status changes | `app/orders/[id]/page.tsx` |
| **Bulk orders** | Create multiple orders at once for a single customer | `app/api/orders/bulk/route.ts` |
| **Order photos** | Upload garment reference images (Cloudinary) | `app/api/orders/order-photos/route.ts` |
| **Photo deletion** | Remove photos from orders | `app/api/orders/photos/delete/route.ts` |
| **Order search/filter** | Search by customer name, phone, order ID, status filter | `app/orders/page.tsx` |
| **Order tracking (public)** | Public page for customers to track order by code | `app/track/[code]/page.tsx` |

### 2.4 Customer Management

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Customer directory** | List all customers with phone, orders count, total spend | `app/customers/page.tsx` |
| **Add customer** | Name, phone, address fields | `app/customers/new/page.tsx` |
| **Customer detail** | Order history, total orders, total amount, latest activity | `app/customers/[id]/page.tsx` |
| **Customer search** | Search by name or phone number | `app/customers/page.tsx` |
| **Duplicate detection** | Check for existing customer by phone before adding | Backend validation |

### 2.5 Team Management

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Karigar (worker) management** | Add/remove tailors/workers with role assignments | `app/settings/team/page.tsx` |
| **Role types** | Tailor (shop owner), Karigar (worker) | `lib/team/types.ts` |
| **Skills & limits** | Assign garment specialization & max order capacity per karigar | `lib/team/karigar-limits.ts` |
| **Team member CRUD** | Full create, read, update, delete via API | `app/api/team/members/route.ts` |

### 2.6 Billing & Payments

| Feature | Description | File(s) |
|---------|-------------|---------|
| **3 pricing tiers** | Starter (free, 30 orders/mo), Professional (Rs 499/mo), Business (Rs 999/mo) | `lib/billing/plans.ts` |
| **Billing cycles** | Monthly subscription with automatic renewal | `lib/billing/cycles.ts` |
| **Proration** | Upgrade/downgrade proration for partial months | `lib/billing/cycles.ts` |
| **Expiry calculation** | Auto-calculate subscription end dates | `lib/billing/cycles.ts` |
| **Payment via Easypaisa/JazzCash** | Submit payment proof (screenshot) for manual verification | `app/api/billing/submit-payment/route.ts` |
| **Payment history** | Full ledger of all payments made | `app/billing/history/page.tsx` |
| **Subscription status** | Active, expired, cancelled states with warnings | `app/billing/page.tsx` |
| **Plan upgrade/downgrade** | Change plans mid-cycle with proration | `app/billing/upgrade/page.tsx` |
| **Cancel subscription** | Cancel with immediate or end-of-period options | `app/billing/cancel/page.tsx` |
| **Usage tracking** | Track order count per month against plan limit | `app/api/billing/subscription-event/route.ts` |
| **Expiry reminders** | Automated reminders at 7, 3, and 1 day before expiry | `app/api/cron/send-reminders/route.ts` |
| **Auto-expiry** | CRON job to expire subscriptions and block orders | `app/api/cron/expire-subscriptions/route.ts` |
| **Monthly reset** | Reset usage counters at start of each month | `app/api/cron/reset-usage/route.ts` |
| **Coupons/discounts** | Admin-managed coupon codes for discounts | `app/api/admin/coupons/route.ts`, `lib/admin/coupons.ts` |

### 2.7 Measurement Management

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Garment-specific measurements** | Different fields per garment type (shalwar kameez, sherwani, etc.) | `lib/measurements/index.ts` |
| **Standard fields** | Length, Chest, Shoulder, Sleeve, Collar, Waist, etc. | Schema |
| **Custom measurements** | Additional notes field per measurement | `lib/measurements/index.ts` |
| **Measurement history** | All past measurements stored per customer/garment | `lib/measurements/index.ts` |

### 2.8 Notifications

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Push notifications** | Web push via VAPID keys for order updates | `lib/notifications/push.ts` |
| **Push subscription** | Subscribe/unsubscribe browser push | `app/api/push/subscriptions/route.ts` |
| **In-app notifications** | Notification banner for alerts | `components/notifications/` |
| **Order status updates** | Notify when order status changes | `lib/notifications/scheduler.ts` |
| **Subscription alerts** | Warn before subscription expiry | `components/billing/ExpiryReminderBanner.tsx` |
| **Permission handling** | Request/deny/grant notification permission flow | `lib/notifications/permission.ts` |

### 2.9 Photo Management

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Cloudinary integration** | Upload garment reference photos to Cloudinary | `lib/photos/cloudinary.ts` |
| **Client-side compression** | Compress images before upload (browser-side) | `lib/photos/compress.ts` |
| **Multiple photos per order** | Attach multiple reference images per order | Schema |
| **Photo deletion** | Delete individual photos from orders | `app/api/orders/photos/delete/route.ts` |
| **Auto-cleanup** | CRON job to clean up orphaned photos | `app/api/cron/cleanup-photos/route.ts` |

### 2.10 Export & Reports

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Invoice generation** | PDF invoices via jsPDF for orders | `lib/export/invoice.ts` |
| **Order reports** | Filter by date range, status, karigar | `app/reports/page.tsx` |
| **Payment summaries** | Daily/monthly payment collection reports | `lib/payments/summaries.ts` |

### 2.11 Settings

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Shop profile** | Shop name, address, phone, logo | `app/settings/page.tsx` |
| **Change PIN** | Update 6-digit login PIN | `app/api/auth/update-pin/route.ts` |
| **Language toggle** | Switch between English and Urdu | `lib/i18n/` |
| **Team management** | Add/remove karigar (workers) | `app/settings/team/page.tsx` |
| **Notification preferences** | Opt in/out of push notifications | `app/settings/notifications/page.tsx` |
| **Data management** | Export/import data, clear local cache | `app/settings/data/page.tsx` |
| **Subscription info** | Current plan, usage, renewal date | `app/billing/page.tsx` |

### 2.12 Admin Panel

| Feature | Description | File(s) |
|---------|-------------|---------|
| **TOTP 2FA login** | Username + password + Time-based OTP | `app/admin/login/page.tsx` |
| **Admin dashboard** | Shops overview, revenue, orders, users | `app/admin/dashboard/page.tsx` |
| **Shop management** | View all shops, approve/block, verify | `app/admin/dashboard/shops/` |
| **Analytics** | Revenue charts, order trends, growth metrics | `app/admin/dashboard/analytics/` |
| **Payment management** | Verify payments, approve/reject, refund | `app/admin/dashboard/payments/` |
| **Reports** | System-wide reports and exports | `app/admin/dashboard/reports/` |
| **Admin management** | Add/remove admin users | `app/api/admin/admins/route.ts` |
| **Coupon management** | Create/disable discount codes | `app/api/admin/coupons/route.ts` |
| **Blocklist** | Block shops by phone or ID | `app/api/admin/blocklist/route.ts` |
| **WhatsApp communication** | Send messages to shop owners | `app/api/admin/whatsapp/route.ts` |
| **Backfill expiry** | Admin tool to fix subscription expiry dates | `app/api/admin/backfill-expiry/route.ts` |
| **Impersonation** | Login as any shop for support | `app/api/admin/impersonate/route.ts` |
| **Notifications** | Send system-wide notifications | `app/api/admin/notifications/route.ts` |
| **Templates** | Manage notification/email templates | `app/api/admin/templates/route.ts` |
| **System health** | Health checks, logs, monitoring | `app/api/admin/health/route.ts` |

---

## 3. User Workflows

### 3.1 New User Onboarding Flow

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Enter    │   │  Verify  │   │  Set     │   │  Set     │   │  Shop    │   │  Set 6-  │
│  Phone#   │ → │  OTP     │ → │  Name    │ → │  Email   │ → │  Details │ → │  digit    │
│           │   │          │   │          │   │          │   │          │   │  PIN      │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                                                │
                                                                                ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Dashboard│   │  Create  │   │  Confirm │
│ (Home)   │ ← │  Orders  │ ← │  PIN     │
└──────────┘   └──────────┘   └──────────┘
```

### 3.2 Order Creation Flow

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────┐
│  Step 1:     │   │  Step 2:         │   │  Step 3:         │   │              │
│  Select/Add  │ → │  Garment Type +  │ → │  Review +        │ → │  Order       │
│  Customer    │   │  Measurements    │   │  Payment Entry   │   │  Created!    │
│              │   │  + Photos        │   │  (Advance/Balance)│   │              │
└──────────────┘   └──────────────────┘   └──────────────────┘   └──────────────┘
```

### 3.3 Order Lifecycle

```
┌─────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌───────────┐   ┌───────────┐
│ Pending  │ → │ In       │ → │ Ready for    │ → │ Fitting  │ → │ Completed │ → │ Delivered │
│ (New)    │   │ Progress │   │ Fitting      │   │ Done     │   │           │   │           │
└─────────┘   └──────────┘   └──────────────┘   └──────────┘   └───────────┘   └───────────┘
                                                                                        │
                                                                                        ▼
                                                                                 ┌───────────┐
                                                                                 │ Cancelled │
                                                                                 │ (any time)│
                                                                                 └───────────┘
```

### 3.4 Billing Flow

```
┌──────────────┐   ┌──────────────────┐   ┌────────────────┐   ┌────────────────┐
│  Choose Plan  │ → │  Make Payment    │ → │  Admin         │ → │  Subscription │
│  (Starter/    │   │  via Easypaisa/  │   │  Verifies      │   │  Activated    │
│  Pro/Business)│   │  JazzCash        │   │  Payment       │   │               │
└──────────────┘   └──────────────────┘   └────────────────┘   └────────────────┘
                           │                                               │
                           ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                  Monthly Usage Tracking (orders counted against limit)              │
│                  Auto-reminders at 7, 3, 1 day before expiry                        │
│                  Auto-expiry if not renewed                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Sync Flow (Offline → Online)

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User performs   │     │  Data stored in   │     │  On reconnection │
│  actions offline │  →  │  Dexie/IndexedDB  │  →  │  Background sync │
│  (Create order,  │     │  with pending flag│     │  to Supabase     │
│  update status)  │     │                   │     │  via sync engine │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 4. Data Model

### 4.1 Supabase Tables (13 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `shops` | Shop accounts | id, name, phone, email, pin_hash, plan, status, created_at |
| `customers` | Customer records | id, shop_id, name, phone, address, total_orders, total_amount |
| `orders` | Order records | id, shop_id, customer_id, type, status, garment_type, amount, advance, balance |
| `order_status_history` | Status change log | id, order_id, from_status, to_status, changed_by, changed_at |
| `order_photos` | Garment photos | id, order_id, url, cloudinary_public_id, uploaded_at |
| `measurements` | Garment measurements | id, order_id, customer_id, garment_type, measurements (jsonb) |
| `team_members` | Karigar/workers | id, shop_id, name, role, phone, skills (jsonb), max_orders, is_active |
| `payments` | Payment records | id, shop_id, amount, method, proof_url, status, verified_by, verified_at |
| `subscriptions` | Subscription data | id, shop_id, plan, status, start_date, end_date, orders_used |
| `coupons` | Discount codes | id, code, discount_type, discount_value, max_uses, used_count, expires_at |
| `admins` | Admin users | id, username, password_hash, totp_secret, role |
| `notifications` | Notification records | id, shop_id, type, title, body, read, sent_at |
| `push_subscriptions` | Push notification subs | id, shop_id, endpoint, keys (jsonb), created_at |

### 4.2 Dexie (IndexedDB) Tables — Offline Schema

| Table | Purpose |
|-------|---------|
| `customers` | Offline customer cache |
| `orders` | Offline order cache |
| `orderPhotos` | Offline photos cache |
| `measurements` | Offline measurements cache |
| `teamMembers` | Offline team cache |
| `payments` | Offline payment records |
| `notifications` | Offline notification cache |
| `syncQueue` | Pending operations queue for sync |
| `syncLog` | Sync operation history |
| `shopInfo` | Cached shop/settings data |
| `subscription` | Cached subscription data |
| `coupons` | Cached coupon data |
| `appSettings` | App preferences (theme, lang, etc.) |
| `pushSubscriptions` | Cached push subscription data |

---

## 5. API Routes

### 5.1 Auth Endpoints (9)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | PIN-based login |
| `/api/auth/session` | GET | Validate current session |
| `/api/auth/session` | POST | Create new session |
| `/api/auth/session` | DELETE | Destroy session (logout) |
| `/api/auth/check-phone` | POST | Check if phone registered |
| `/api/auth/create-shop` | POST | Create new shop account |
| `/api/auth/send-otp` | POST | Send OTP email |
| `/api/auth/verify-otp` | POST | Verify OTP code |
| `/api/auth/update-pin` | POST | Change PIN |
| `/api/auth/log-attempt` | POST | Log login attempt/block |

### 5.2 Admin Endpoints (16)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/login` | POST | Admin login (password + TOTP) |
| `/api/admin/logout` | POST | Admin logout |
| `/api/admin/data` | GET | Get admin dashboard data |
| `/api/admin/action` | POST | Perform admin actions |
| `/api/admin/admins` | GET/POST | Manage admin users |
| `/api/admin/analytics` | GET | Get analytics data |
| `/api/admin/backfill-expiry` | POST | Fix expired subscriptions |
| `/api/admin/blocklist` | GET/POST | Manage blocklist |
| `/api/admin/coupons` | GET/POST | Manage coupons |
| `/api/admin/health` | GET | System health check |
| `/api/admin/impersonate` | POST | Impersonate a shop |
| `/api/admin/notifications` | GET/POST | Manage notifications |
| `/api/admin/reports` | GET | Generate reports |
| `/api/admin/templates` | GET/POST | Manage templates |
| `/api/admin/totp-uri` | GET | Get TOTP setup URI |
| `/api/admin/verify` | POST | Verify TOTP code |
| `/api/admin/whatsapp` | POST | Send WhatsApp message |

### 5.3 Business Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/billing/cancel` | POST | Cancel subscription |
| `/api/billing/submit-payment` | POST | Submit payment proof |
| `/api/billing/subscription-event` | POST | Record subscription event |
| `/api/billing/subscription-status` | GET | Get subscription status |
| `/api/orders/bulk` | POST | Bulk create orders |
| `/api/orders/order-photos` | POST | Upload order photos |
| `/api/orders/photos/delete` | POST | Delete order photo |
| `/api/team/members` | GET/POST/PUT/DELETE | Manage team |
| `/api/shop/update` | PUT | Update shop profile |
| `/api/shop/delete` | DELETE | Delete shop account |

### 5.4 CRON Endpoints (4)

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/expire-subscriptions` | Daily | Auto-expire overdue subs |
| `/api/cron/send-reminders` | Daily | Send expiring reminders |
| `/api/cron/reset-usage` | Monthly | Reset order counters |
| `/api/cron/cleanup-photos` | Weekly | Clean orphaned photos |

---

## 6. Admin Panel

The admin panel at `/admin/dashboard/*` is a full-featured backoffice with:

| Section | Path | Description |
|---------|------|-------------|
| Overview | `/admin/dashboard` | KPI cards, revenue chart, new shops, active subs |
| Shops | `/admin/dashboard/shops` | List/search all shops, approve/block/verify |
| Payments | `/admin/dashboard/payments` | Pending/approved/rejected payments, verify proof |
| Analytics | `/admin/dashboard/analytics` | Revenue trends, order volume, growth metrics |
| Reports | `/admin/dashboard/reports` | Downloadable CSV/PDF reports |
| Security | `/admin/dashboard/security` | Blocklist, login attempts, audit log |
| Settings | `/admin/dashboard/settings` | System config, templates, coupons |
| Health | `/admin/dashboard/health` | System status, DB health, queue depth |

---

## 7. Security

| Measure | Implementation |
|---------|---------------|
| **PIN hashing** | bcrypt with salt rounds |
| **Session tokens** | HMAC-SHA256 signed, httpOnly, secure, sameSite |
| **Session rotation** | Every 15 minutes via edge middleware |
| **Rate limiting** | Upstash Redis (prod) / in-memory Map (dev) |
| **Admin 2FA** | TOTP (Time-based One-Time Password) |
| **IP blocklist** | Admin-managed IP deny list |
| **Phone blocklist** | Block specific phone numbers |
| **CSP headers** | Content Security Policy in middleware |
| **Input validation** | Zod schemas on all API endpoints |
| **Phone validation** | Pakistan-specific phone regex pattern |
| **Environment validation** | Zod schema for all env vars at startup |
| **CORS** | Strict origin checks on API routes |

---

## 8. Offline & Sync

| Component | Description |
|-----------|-------------|
| **Dexie/IndexedDB** | 14 tables mirroring Supabase schema for offline access |
| **Sync engine** | Queues mutations when offline, replays on reconnection |
| **Conflict resolution** | Last-write-wins strategy with timestamp tracking |
| **Sync status indicators** | UI badges showing pending/ syncing/ error states |
| **Service Worker** | Workbox-based SW for caching static assets and API responses |
| **Install prompt** | BeforeInstallPrompt event handler for PWA install |
| **Background sync** | SyncManager API for background data sync |

---

## 9. Billing & Pricing

### Plans

| Plan | Price (PKR) | Orders/Month | Features |
|------|-------------|--------------|----------|
| **Starter** | Free | 30 | Basic order management, 1 user |
| **Professional** | Rs 300 | Unlimited | All features, team management, reports |
| **Business** | Rs 700 | Unlimited | All features + priority support + analytics |

### Payment Methods
- **Easypaisa** (manual verification via screenshot)
- **JazzCash** (manual verification via screenshot)
- Cash (manual entry)

### Subscription States
- `Active` — Within valid period, under order limit
- `Expiring` — Within 7 days of end date (reminders sent)
- `Expired` — Past end date (orders blocked)
- `Cancelled` — Manually cancelled (end of period or immediate)

---

## 10. File Map

### Pages & Routes

```
src/app/
├── page.tsx                          # Dashboard (home)
├── layout.tsx                        # Root layout
├── auth/page.tsx                     # Auth wizard (login/setup)
├── setup/page.tsx                    # Redirect to /auth
├── orders/
│   ├── page.tsx                      # Order list
│   ├── new/page.tsx                  # New order wizard
│   └── [id]/page.tsx                 # Order detail
├── customers/
│   ├── page.tsx                      # Customer list
│   ├── new/page.tsx                  # Add customer
│   └── [id]/page.tsx                 # Customer detail
├── track/[code]/page.tsx             # Public tracking page
├── billing/
│   ├── page.tsx                      # Subscription & plans
│   ├── upgrade/page.tsx              # Upgrade plan
│   ├── cancel/page.tsx               # Cancel subscription
│   └── history/page.tsx              # Payment history
├── settings/
│   ├── page.tsx                      # Shop profile
│   ├── team/page.tsx                 # Team management
│   ├── notifications/page.tsx        # Notification prefs
│   └── data/page.tsx                 # Data management
├── reports/page.tsx                  # Reports & exports
├── admin/
│   ├── login/page.tsx                # Admin login (2FA)
│   └── dashboard/
│       ├── page.tsx                  # Admin overview
│       ├── shops/page.tsx            # Shop management
│       ├── payments/page.tsx         # Payment verification
│       ├── analytics/page.tsx        # Analytics
│       ├── reports/page.tsx          # System reports
│       ├── security/page.tsx         # Blocklist & security
│       ├── settings/page.tsx         # System settings
│       └── health/page.tsx           # System health
├── api/
│   └── (auth/admin/billing/orders/team/shop/cron)/*.ts
```

### Core Libraries

```
src/lib/
├── auth/
│   ├── session.ts                    # HMAC session management
│   ├── context.tsx                   # Auth context provider
│   └── useAuthWizard.ts             # Auth wizard hook
├── db/
│   ├── schema.ts                     # Dexie schema (14 tables)
│   ├── operations.ts                 # Dexie CRUD operations
│   ├── sync.ts                       # Offline sync engine
│   ├── offline.ts                    # Offline utilities
│   └── seed.ts                       # Dev data seeding
├── supabase/
│   ├── client.ts                     # Browser client
│   ├── server.ts                     # Server client
│   ├── service.ts                    # Service role client
│   ├── records.ts                    # Record helpers
│   ├── realtime.ts                   # Real-time subscriptions
│   └── types.ts                      # Supabase type definitions
├── payments/
│   ├── calculations.ts               # Payment math
│   └── summaries.ts                  # Payment summaries
├── billing/
│   ├── plans.ts                      # Plan definitions
│   └── cycles.ts                     # Cycle calculation
├── admin/
│   └── coupons.ts                    # Coupon management
├── notifications/
│   ├── push.ts                       # Web push
│   ├── scheduler.ts                  # Notification scheduling
│   └── permission.ts                 # Permission handling
├── photos/
│   ├── cloudinary.ts                 # Cloudinary upload
│   └── compress.ts                   # Client compression
├── export/
│   └── invoice.ts                    # PDF invoice generation
├── team/
│   ├── types.ts                      # Team types
│   └── karigar-limits.ts            # Karigar capacity
├── i18n/
│   ├── index.ts                      # i18n setup
│   ├── en.json                       # English strings
│   └── ur.json                       # Urdu strings
├── email/
│   └── index.ts                      # Email sending
└── measurements/
    └── index.ts                      # Measurement fields
```

### Config & Infrastructure

```
├── next.config.ts                    # Next.js config (webpack, images, CSP, Sentry)
├── proxy.ts                          # Edge middleware (security, rate limit, session)
├── vercel.json                       # Vercel config (Mumbai region, CRON)
├── supabase-migration.sql            # Full DB schema (13 tables + RLS + triggers)
├── tailwind.config.ts                # Tailwind (if present)
├── tsconfig.json                     # TypeScript config
├── package.json                      # Dependencies & scripts
├── components.json                   # shadcn/ui config
├── public/
│   ├── sw.js                         # Service worker (Workbox)
│   ├── manifest.json                 # PWA manifest
│   ├── icon.svg                      # App icon
│   ├── logo.png                      # Sidebar logo
│   └── Mera-Darzi_logo.png          # Full logo
├── .github/workflows/ci.yml          # CI pipeline
├── e2e/                              # Playwright E2E tests
└── __tests__/                        # Unit/integration tests (22 files)
```

---

## Tech Stack Summary

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (webpack) |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS v4 (CSS custom properties) |
| **Components** | shadcn/ui (base-vega style) |
| **Icons** | Lucide React |
| **Database** | Supabase PostgreSQL |
| **Offline DB** | Dexie.js (IndexedDB) |
| **Auth** | bcrypt + HMAC-SHA256 + TOTP |
| **Validation** | Zod |
| **i18n** | i18next (en/ur) |
| **Payments** | Easypaisa / JazzCash (manual) |
| **Photos** | Cloudinary |
| **PDF** | jsPDF |
| **Push** | Web Push API (VAPID) |
| **Rate Limit** | Upstash Redis |
| **Monitoring** | Sentry |
| **Testing** | Jest + Playwright |
| **CI/CD** | GitHub Actions |
| **Deploy** | Vercel (Mumbai) |
| **PWA** | Workbox + Service Worker |

---

*Generated from codebase analysis — `/workspaces/tailor` — June 2026*
