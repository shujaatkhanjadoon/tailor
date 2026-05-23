# ARCHITECTURE REVIEW — Meradarzi Tailor

**Date:** 2026-05-23
**Auditor:** Senior Software Architect

---

## EXECUTIVE SUMMARY

The application uses **Next.js 16** with **Supabase** (PostgreSQL) as the backend. The architecture has several fundamental design flaws that impact security, scalability, and maintainability.

**Key Architecture Score: 42/100**

---

## POSITIVE ARCHITECTURAL DECISIONS

1. **HMAC-signed session tokens** with `timingSafeEqual` for signature verification
2. **TOTP 2FA for admin** login and destructive actions
3. **Zod schema validation** on most API inputs
4. **AES-256-GCM for PIN encryption** with proper IV and auth tag
5. **Rate limiting infrastructure** (Upstash Redis, though not fully wired)
6. **Web Push notifications** infrastructure in place
7. **Dynamic imports for heavy libraries** (`jspdf`, `recharts`)

---

## CRITICAL ARCHITECTURAL ISSUES

### A-01: Security Middleware Never Loaded (Most Critical)

**Problem:** The entire security middleware layer (`src/proxy.ts`) is defined but **never executed**. Next.js requires a file named `middleware.ts` at the root of `src/` to automatically apply middleware to matching routes.

**Impact:** Zero security headers, no CSP, no HSTS, no global rate limiting, no CSRF protection, no admin session validation at the edge, no request size limiting. The entire security infrastructure exists as dead code.

**Fix:** Rename `src/proxy.ts` to `src/middleware.ts`.

### A-02: Client-Side Authentication Architecture

**Problem:** Authentication is fundamentally broken at the architecture level:
1. Client performs PIN verification locally using bcrypt
2. Client then requests a session token from the server
3. The server trusts the client's claim without re-verification

This is the **Inverse of the Trust Model** — authentication decisions are made on the untrusted client and the trusted server blindly accepts them.

**Fix:** The server must verify credentials before issuing any session token. The client should never have access to `pin_hash`.

### A-03: Direct Supabase Client Calls from Frontend

**Problem:** Many components (billing, payments, auth) call Supabase REST API directly from the browser using the anon key. This:
- Bypasses server-side authorization checks
- Exposes the Supabase URL and anon key to end users
- Makes the app vulnerable to Supabase API changes
- Prevents centralized logging/monitoring

**Fix:** All data mutations should go through server API routes. The anon key should only be used for public/read operations.

### A-04: No `middleware.ts` Pattern

**Problem:** There is no centralized middleware for:
- Session validation
- Role-based authorization
- Rate limiting
- Request logging
- CSRF protection

Every API route independently handles auth (or doesn't). 26+ API route files each construct their own Supabase service role headers independently.

**Fix:** Create a middleware layer and a shared Supabase admin client utility.

### A-05: No Database Migration Files

**Problem:** There are zero SQL migration files in the repository. Database schema changes, index creation, and trigger definitions are not version-controlled. This means:
- Schema changes cannot be reviewed in PRs
- New environments require manual schema setup
- Indexes must be created manually via Supabase dashboard
- No audit trail of schema changes

**Fix:** Create `supabase/migrations/` directory with versioned SQL files.

---

## HIGH ARCHITECTURAL ISSUES

### A-06: Service Role Key Pattern Duplicated Across 15+ Files

**Problem:** Every API file that needs database access independently:
1. Reads `SUPABASE_SERVICE_ROLE_KEY` from env
2. Constructs `apikey` and `Authorization` headers
3. Calls Supabase REST API directly

This duplicates ~10 lines of boilerplate across 15+ files and increases the attack surface (each file is a potential leak point).

**Fix:** Create a single `src/lib/supabase/admin.ts` utility that all files import.

### A-07: No Server Components (Zero SSR)

**Problem:** Every single page file starts with `"use client"`. This means:
- No React Server Components (RSC) benefits
- No automatic streaming
- No reduced client bundle
- No SEO benefits for public pages
- All data fetching happens client-side

**Fix:** Public pages (pricing, landing, about) should be Server Components. Interactive components should be extracted to smaller client components.

### A-08: Monolithic Component Design

**Problem:** Key pages like `AuthPage` (500+ lines), `TeamManager` (808 lines), and `KarigarPage` (1300 lines) are monolithic:
- All state and UI in one component
- No separation of concerns
- Impossible to test or reason about
- Every state change re-renders the entire tree

**Fix:** Extract into smaller, focused components with single responsibilities. Use composition over props drilling.

### A-09: No Error Boundary Strategy

**Problem:** There's a single `error.tsx` at the app root and no per-route error boundaries. Async operations are often wrapped in try/catch with `console.error()` and no user feedback.

**Fix:** Add error boundaries at each route segment level. Implement a standardized error handling utility.

### A-10: Inconsistent Data Access Patterns

**Problem:** The codebase uses three different data access patterns:
1. Supabase JS client (browser-side, anon key)
2. Supabase REST API via `fetch` (server-side, service role key)
3. Server Supabase client

These are used interchangeably without clear guidelines on when to use which.

---

## MEDIUM ARCHITECTURAL ISSUES

### A-11: Dual Session Storage

Both an httpOnly cookie and `localStorage` are used for session management, creating desync risks and XSS surface area.

### A-12: No Database-Backed Session Revocation

Session tokens are fully self-contained HMAC tokens with no revocation mechanism. Account deactivation has delayed effect because existing tokens remain valid.

### A-13: Denormalized Data Without Sync Guarantees

`orders` table stores denormalized copies of `customer_name`, `customer_phone`, and `assigned_to_name`. The sync logic is incomplete:
- Renaming a team member does NOT update `assigned_to_name` on orders
- Customer name update sync is fire-and-forget (not transactional)

### A-14: Hardcoded Configuration Values

Multiple configuration values are hardcoded:
- Raast payment credentials in `src/lib/billing/raast.ts`
- WhatsApp admin numbers in 3+ files
- Plan prices in analytics calculations (3 locations)
- Session timeout duplicated in 3 files

### A-15: No Observability Infrastructure

- No structured logging
- No request tracing
- No performance monitoring
- No error tracking integration (Sentry, etc.)
- Audit logging failure is silent

---

## ARCHITECTURE RECOMMENDATIONS

### Immediate Structural Changes

1. **Rename `proxy.ts` → `middleware.ts`** — Unlocks all existing security middleware
2. **Create `src/lib/supabase/admin.ts`** — Single admin client utility for all server routes
3. **Create `supabase/migrations/` directory** — Version-controlled database schema
4. **Add `src/lib/logger.ts`** — Structured logging utility

### Short-term Architectural Improvements

5. **Implement the API Gateway pattern** — All client → Supabase calls go through Next.js API routes
6. **Add middleware-level authentication** — Centralized session validation for all API routes
7. **Remove dual session storage** — Keep only the httpOnly cookie
8. **Add database-backed sessions** — Enable session revocation

### Long-term Architectural Direction

9. **Migrate to Server Components** — RSC for public routes, client components only for interactivity
10. **Implement TanStack Query** — Standardized data fetching with caching
11. **Add feature flags** — Behind-the-scenes toggle for new features
12. **Add end-to-end testing** — Playwright or Cypress for critical flows
13. **Implement event sourcing for payments** — Financial operations should be event-logged

---

## COMPONENT RELATIONSHIP ISSUES

```
Current (problematic):
  Client Component (all pages)
    ├── Direct Supabase REST (anon key)
    ├── Direct Supabase JS client
    └── API Routes (some auth, some not)

Should be:
  Server Component (public routes)
    └── Client Component (interactive islands)
          └── API Routes (always authenticated)
                └── Supabase Admin Client (service key)
```

---

## DATA FLOW ISSUES

```
Current auth flow (vulnerable):
  Client: Enter PIN → Fetch pin_hash from Supabase → bcrypt.compare() locally → if OK, request session
  Server: Receive memberId/shopId → Issue session token → No PIN verification

Correct auth flow:
  Client: Enter PIN → Send PIN to server API
  Server: Fetch stored pin_hash → bcrypt.compare() server-side → If OK, issue session token
```
