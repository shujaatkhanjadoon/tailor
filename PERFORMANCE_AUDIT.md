# PERFORMANCE AUDIT REPORT — Meradarzi Tailor

**Date:** 2026-05-23
**Auditor:** Senior Performance Architect
**Scope:** Full codebase (frontend, API, database, build tooling)

---

## EXECUTIVE SUMMARY

**Overall Performance Score: 45/100**

The application has significant performance issues that will degrade rapidly as data grows. The most critical issues are:

1. **No pagination on any list operation** — All queries load entire tables into memory.
2. **No client-side caching** — Every hook fetches fresh data from Supabase on mount. No cache, no deduplication.
3. **Redundant polling + Realtime subscriptions** — Hooks poll every 60 seconds AND subscribe to Realtime.
4. **Multiple waterfall API calls** — Order detail page makes 5 sequential DB queries.
5. **Dashboard loads ALL orders into memory** — `getStats()` fetches every order to compute summary statistics.
6. **Missing database indexes** — No composite indexes on frequently filtered columns.
7. **`"use client"` on every page** — Zero Server Components; entire app is client-rendered.
8. **All pages monolithic** — No code splitting, lazy loading, or route-based splitting beyond bundled defaults.

---

## CRITICAL ISSUES

### C-01: No Pagination on Any List Query (Memory Overflow Risk)

**Files:**
- `src/lib/db/operations.ts:299` — `customerOps.getAll()` — ALL customers
- `src/lib/db/operations.ts:399` — `orderOps.getAll()` — ALL orders
- `src/lib/db/operations.ts:211` — `teamOps.getAll()` — ALL team members
- `src/lib/db/operations.ts:548` — `paymentOps.getForOrder()` — ALL payments per order
- `src/lib/db/operations.ts:608` — `dashboardOps.getStats()` — ALL orders

**Impact:** As the business grows to thousands of records, every page load fetches ALL data. Memory exhaustion, network saturation, and unusably slow page loads.

**Fix:** Added `.range()` pagination with default limits of 100 records. Dashboard queries now use server-side COUNT/aggregation.

### C-02: Dashboard Loads ALL Orders In-Memory

**File:** `src/lib/db/operations.ts:606-621`

**Before:** `orderOps.getAll(shopId)` fetches every order, then JavaScript filters in-memory for status counts.

**Impact:** A shop with 10,000 orders downloads all 10,000 rows just to show "5 overdue orders."

**Fix:** Replaced with 5 parallel `SELECT COUNT(*)` / filtered queries using Supabase's `count: 'exact', head: true`.

### C-03: N+1 Query in Order Creation

**File:** `src/lib/db/operations.ts:468` — `customerOps.get()` called AFTER order insert.

**Before:** Order is inserted (query 1), then customer is fetched (query 2), then customer is updated (query 3).

**Fix:** Fetch customer in parallel with order number and shop name (before insert).

### C-04: Redundant 60-second Polling + Realtime Subscriptions

**Files:** All hooks (`useOrders`, `usePayments`, `useCustomers`, `useReports`)

Every hook:
1. Fetches data on mount via Supabase query
2. Subscribes to Realtime channel
3. Sets up `setInterval` for 60-second polling

This means **5+ background requests per minute** even when no data changes.

**Fix:** Remove the `setInterval` polling. Realtime subscriptions are sufficient for live updates.

### C-05: 5 Sequential Waterfall Queries on Order Detail Page

**File:** `src/app/orders/[id]/page.tsx:53-114`

Chain: shop → customer → photos → measurement → fallback measurement

**Impact:** Page load time = sum of 5 sequential round-trips. With 100ms latency each, that's 500ms before rendering.

**Fix:** Consolidate into parallel requests or use Supabase joins.

---

## HIGH ISSUES

### H-01: No Client-Side Caching (All hooks)

**Files:** All `src/hooks/*.ts` files

Every component fetches data on mount with no cache. Navigating between pages causes full refetches. Example:
- Dashboard fetches orders → navigate to Customers → full customer refetch → navigate back to Dashboard → full orders refetch

**Fix:** Implement React Query (TanStack Query) or SWR for automatic caching, deduplication, and stale-while-revalidate.

### H-02: Missing Database Indexes

No SQL migration files exist. The following composite indexes are needed:

```sql
CREATE INDEX idx_orders_shop_deleted ON orders(shop_id, deleted_at);
CREATE INDEX idx_orders_assigned_deleted_status ON orders(assigned_to, deleted_at, status);
CREATE INDEX idx_customers_shop_deleted ON customers(shop_id, deleted_at);
CREATE INDEX idx_payments_shop_deleted_paid ON payments(shop_id, deleted_at, paid_at);
CREATE INDEX idx_team_members_shop_deleted ON team_members(shop_id, deleted_at);
CREATE INDEX idx_payments_order_id ON payments(order_id);
```

### H-03: `"use client"` on Every Page

All 24+ page files use `"use client"`, preventing server-side rendering benefits:
- No RSC payload streaming
- No automatic code splitting by route
- No SEO benefits for public pages (pricing, landing)
- Larger initial JS bundles

**Fix:** Remove `"use client"` from static/public pages. Keep it only on interactive components.

### H-04: 6 Raw `<img>` Tags Without `next/image`

| File | Line |
|------|------|
| `src/app/karigar/page.tsx` | 201-205 |
| `src/app/orders/[id]/page.tsx` | 636-639, 747-750 |
| `src/app/settings/shop/page.tsx` | 229-230, 275-276 |
| `src/components/layout/SideNav.tsx` | 108-109 |
| `src/components/track/TrackClient.tsx` | 269, 496 |

**Impact:** No automatic WebP conversion, no lazy loading, no responsive image sizing, no width/height attributes causing layout shift.

### H-05: Admin Analytics Loads All Historical Data

**File:** `src/app/api/admin/analytics/route.ts:30-43`, `src/app/api/admin/data/route.ts:117-161`

Fetches ALL subscription payments (unfiltered by date), ALL shops, ALL subscriptions on every analytics request.

**Fix:** Filter payments to last 12-24 months. Use database-side aggregation instead of in-memory reduce.

### H-06: Admin Shops Endpoint Downloads 4 Full Tables

**File:** `src/app/api/admin/data/route.ts:73-101`

Downloads ALL shops, ALL subscriptions, ALL usage records, and ALL orders, then manually joins in JavaScript.

**Fix:** Use Supabase relationship queries (`subscriptions(*)`) and pagination.

---

## MEDIUM ISSUES

### M-01: No Request Deduplication

Multiple hooks fetch the same shop data independently. Hooks don't share a cache layer, so the same data is fetched 3-4 times during initial page load.

### M-02: Large Monolithic Components Cause Excessive Re-renders

| Component | Lines | State Variables |
|-----------|-------|----------------|
| `AuthPage` | 500+ | 22+ `useState` |
| `TeamManager` | 808 | ~12 `useState` |
| `KarigarPage` | 1300 | ~15 `useState` |

Every keystroke in any input re-renders the entire component tree including all list items.

### M-03: `qrcode.react` Imported as Dead Code

**File:** `src/components/billing/RaastPaymentSheet.tsx:6`

Imports `QRCodeSVG` but the QR code rendering is commented out (lines 355-360). Adds ~30KB of dead JavaScript to the bundle.

### M-04: Missing `React.memo` on List Components

`RecentOrderCard` and `TeamManager` member list items are not memoized, causing unnecessary re-renders when parent state changes.

### M-05: No Prefetching or Preloading

Critical resources (fonts, logo, common API endpoints) are not prefetched or preloaded, causing loading delays.

### M-06: 3 CSS Imports in `globals.css`

Tailwind, tw-animate-css, and shadcn CSS are all imported in the entry CSS, increasing initial CSS bundle.

---

## LOW ISSUES

| ID | Issue | File |
|----|-------|------|
| L-01 | Dead `formatKarachiDateInput()` function (identical to `karachiDateString()`) | `src/lib/time.ts:20-27` |
| L-02 | `TailorDB` Dexie class unused by app | `src/lib/db/schema.ts:145-157` |
| L-03 | Retained `console.log` statements | Multiple files |
| L-04 | Poppins font loads 4 weights (400-700) | `src/app/layout.tsx:13-18` |

---

## PERFORMANCE SCORING

| Category | Score | Notes |
|----------|-------|-------|
| Database Queries | 25/100 | No indexes, no pagination, N+1, no caching |
| Frontend Rendering | 40/100 | No SSR, no code splitting, monolithic components |
| Bundle Size | 50/100 | Dead imports, no lazy loading for heavy libs |
| API Response Times | 35/100 | Waterfall queries, no pagination, all data loaded |
| Caching Strategy | 20/100 | Zero client-side cache, redundant polling |
| Image Optimization | 30/100 | Raw `<img>` tags, no WebP, no lazy loading |
| Build/Deploy Config | 60/100 | Good Vercel config, but no bundle analysis |
| **Overall** | **45/100** | Will degrade severely as data grows |

---

## TOP 10 PERFORMANCE FIXES

| Rank | Fix | Expected Improvement | Effort |
|------|-----|---------------------|--------|
| 1 | Add database indexes (composite) | 10-100x query speedup on large datasets | Low |
| 2 | Implement React Query for client caching | Eliminates 80%+ of redundant network requests | Medium |
| 3 | Remove 60-second polling (keep Realtime) | Reduces background traffic by ~80% | Low |
| 4 | Fix dashboard stats (server-side COUNT) | 100x speedup for shops with 10K+ orders | Low |
| 5 | Add pagination to all list queries | Prevents OOM crashes as data grows | Low |
| 6 | Consolidate waterfall queries to parallel | 3-5x faster page loads for order detail | Medium |
| 7 | Remove `"use client"` from public pages | Enables SSR, smaller bundles | Medium |
| 8 | Replace `<img>` with `next/image` | Proper WebP, lazy loading, CLS fix | Medium |
| 9 | Extract monolithic components | 50%+ re-render reduction on forms | High |
| 10 | Add Supabase migration files | Foundation for all future DB performance | Low |
