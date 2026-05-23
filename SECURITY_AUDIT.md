# SECURITY AUDIT REPORT — Meradarzi Tailor

**Date:** 2026-05-23
**Auditor:** Senior Application Security Engineer
**Scope:** Full codebase audit (100% of source files reviewed)

---

## EXECUTIVE SUMMARY

**Overall Security Score: 38/100**

The application has critical security vulnerabilities that require immediate attention. The most severe issues include:

1. **Security middleware never loaded** — `proxy.ts` (containing all security headers, CSP, rate limiting, CSRF protection) is never imported or executed. No `middleware.ts` exists.
2. **Client-side PIN verification** — Session tokens are issued without server-side credential verification. The client performs PIN validation and then requests a session token.
3. **Plaintext PIN over network** — Raw PIN sent in API request bodies alongside the hash.
4. **bcrypt hash exposed to client** — `pin_hash` returned in client-accessible Supabase queries enabling offline brute-force.
5. **Unauthenticated PIN update endpoint** — `POST /api/auth/update-pin` has no session verification.
6. **Live production secrets in `.env.local`** — Full database access, admin secrets, encryption keys, and API keys in plaintext.

---

## VULNERABILITY REGISTER

### CRITICAL (6 issues)

| ID | Issue | File(s) | Impact |
|----|-------|---------|--------|
| C-01 | **Security middleware never loaded** | `src/proxy.ts` (all) | No security headers, no CSP, no HSTS, no CSRF, no rate limiting. Site fully exposed. |
| C-02 | **Client-side PIN verification (auth bypass)** | `src/app/api/auth/session/route.ts:22-24` | Session tokens issued without server-side credential validation. Complete authentication bypass. |
| C-03 | **Plaintext PIN transmitted over network** | `src/lib/auth/AuthContext.tsx:266`, `src/app/api/auth/create-shop/route.ts:195,266` | Raw PIN visible in request bodies, server logs, and intermediate proxies. |
| C-04 | **bcrypt hash exposed to client** | `src/app/auth/page.tsx:355`, `src/lib/supabase/records.ts:40` | Offline brute-force of PINs possible with exposed bcrypt hashes. |
| C-05 | **Unauthenticated PIN update** | `src/app/api/auth/update-pin/route.ts:29-71` | Anyone with valid memberId/shopId can change any user's PIN without authentication. |
| C-06 | **Shop owner PIN decrypted in admin API** | `src/app/api/admin/data/route.ts:82-87` | All shop owner PINs exposed in plaintext to admin dashboard. |

### HIGH (12 issues)

| ID | Issue | File(s) | Impact |
|----|-------|---------|--------|
| H-01 | **Live production secrets in `.env.local`** | `.env.local:17-50` | Service role key, admin secret, TOTP secret, encryption key — all exposed. **Rotate immediately.** |
| H-02 | **VAPID private key in `.env.example`** | `.env.example:47` | Push notification signing key exposed in version control. |
| H-03 | **Missing CSRF protection on all auth endpoints** | All `src/app/api/auth/*/route.ts` | State-changing requests vulnerable to cross-site request forgery. |
| H-04 | **Non-revocable session tokens** | `src/lib/auth/session.ts:12-76` | Self-contained HMAC tokens with no database-backed revocation list. Cannot invalidate stolen tokens. |
| H-05 | **Race condition in payment processing** | `src/lib/db/operations.ts:573-600` | Concurrent payments cause lost updates and incorrect accounting. |
| H-06 | **Hard deletes on financial records** | `src/lib/db/operations.ts:79-81,92,267,392-393` | Payments, orders, and audit history permanently destroyed. |
| H-07 | **No transaction isolation across multi-table writes** | `src/lib/db/operations.ts:72-93,258-269,386-395` | Partial failures leave database in inconsistent state. |
| H-08 | **Supabase REST injection via unencoded URL params** | `src/app/api/auth/create-shop/route.ts:148`, multiple files | User input interpolated into Supabase REST URLs without encoding. |
| H-09 | **Session token logged to audit database** | `src/app/api/admin/login/route.ts:66` | Full admin session token stored in permanent audit log. |
| H-10 | **Client-side Supabase calls without server validation** | `src/app/billing/cancel/page.tsx:44-55`, multiple components | Billing operations executed directly from client, bypassing server auth. |
| H-11 | **Missing auth on `team/encrypt-pin` endpoint** | `src/app/api/team/encrypt-pin/route.ts` | Anyone can encrypt arbitrary PINs with server-side key. |
| H-12 | **No rate limiting on critical endpoints** | `src/app/api/admin/login/route.ts`, `src/app/api/auth/session/route.ts` | Brute-force attacks possible on admin login and session creation. |

### MEDIUM (15 issues)

| ID | Issue | File(s) | Impact |
|----|-------|---------|--------|
| M-01 | CSP uses `unsafe-inline` for scripts | `src/proxy.ts:12` | XSS protection weakened. |
| M-02 | Cookie `secure` depends on `NODE_ENV` | `src/lib/auth/session.ts:94` | Sessions could be sent over HTTP in misconfigured environments. |
| M-03 | Rate limiter fails open when Redis unavailable | `src/lib/security/rate-limit.ts:139-156` | Rate limiting bypassed in serverless multi-instance deployments. |
| M-04 | Missing MFA enforcement | `src/app/auth/page.tsx` (entire login flow) | PIN-only authentication with no second factor. |
| M-05 | Client-side lockout trivially bypassed | `src/app/auth/page.tsx:460-475` | Failed attempt tracking is client-side fire-and-forget. |
| M-06 | Sensitive data logging (PII, errors) | `src/app/api/auth/create-shop/route.ts:324`, multiple files | Phone numbers, IPs, stack traces logged to console. |
| M-07 | `ADMIN_SECRET` reused as OTP pepper | `src/lib/security/email-otp.ts:466,471` | Same secret used for two cryptographic purposes. |
| M-08 | OTP in email preheader | `src/lib/security/email-otp.ts:521` | OTP visible in locked-screen email notifications. |
| M-09 | Cloudinary unsigned upload preset | `src/lib/photos/cloudinary.ts:4` | Anyone can upload arbitrary images to Cloudinary. |
| M-10 | CallMeBot API key in URL query param | `src/app/api/auth/create-shop/route.ts:312-314` | API key exposed in server logs. |
| M-11 | LIKE injection in customer search | `src/lib/db/operations.ts:320` | Search for `%` returns all customers. |
| M-12 | Error messages leak DB details | `src/app/api/photos/delete/route.ts:77` | Supabase error messages returned to client. |
| M-13 | No audit log IP/UA tracking | `src/lib/admin/audit.ts:35-72` | Cannot trace admin actions to source. |
| M-14 | `nowKarachiIso()` returns UTC | `src/lib/time.ts:7-9` | Timestamps stored as UTC despite function name. |
| M-15 | Cross-shop subscription event forgery | `src/app/api/billing/subscription-event/route.ts:36-37` | Event API does not validate session shopId matches body shopId. |

### LOW (8 issues)

| ID | Issue | File(s) |
|----|-------|---------|
| L-01 | Weak 6-digit PIN strength | `src/lib/security/pin.ts:5-6` |
| L-02 | Missing `__Secure-` cookie prefix (FIXED) | `src/lib/auth/session.ts:4` |
| L-03 | Session rotation race condition | `src/lib/auth/session.ts:78-89` |
| L-04 | No input size limits on HTML fields | `src/app/auth/page.tsx:1118-1135` |
| L-05 | Hardcoded WhatsApp numbers | `src/lib/security/email-otp.ts:14-15` |
| L-06 | `(supabase as any)` bypasses TypeScript safety everywhere | `src/lib/db/operations.ts` (all queries) |
| L-07 | UUID fallback uses `Math.random()` | `src/lib/db/operations.ts:28-32` |
| L-08 | `pin_plain` field in type definitions | `src/lib/supabase/types.ts:78` |

---

## EXPLOITATION SCENARIOS

### Scenario 1: Complete Account Takeover
1. Attacker calls `POST /api/auth/session` with any valid `memberId` and `shopId`
2. Server returns a signed session cookie without verifying credentials
3. Attacker has full access to the victim's account

### Scenario 2: PIN Brute-Force
1. Attacker obtains `pin_hash` from client-accessible Supabase query
2. Offline brute-force of 6-digit PIN using bcrypt (feasible in hours)
3. Use recovered PIN to authenticate as the victim

### Scenario 3: Admin Credential Theft
1. Attacker obtains `.env.local` from compromised developer machine
2. Full database access via `SUPABASE_SERVICE_ROLE_KEY`
3. Decrypt all stored PINs via `PIN_ENCRYPTION_KEY`
4. Send arbitrary emails via `RESEND_API_KEY`

### Scenario 4: Data Destruction
1. Attacker sends DELETE requests to `POST /api/auth/session` bypassing auth
2. Hard deletes permanently destroy payment records, order history, customer data
3. Business data irretrievably lost

---

## REMEDIATION PRIORITY

### Immediate (within hours)
1. Rotate ALL secrets in `.env.local`
2. Rename `proxy.ts` to `middleware.ts`
3. Add server-side PIN verification to session creation endpoint
4. Remove `pinPlain` from API request bodies
5. Stop exposing `pin_hash` to client
6. Add authentication to `update-pin` endpoint

### Short-term (within days)
7. Remove PIN decryption from admin data API
8. Stop logging session tokens to audit database
9. Replace all hard deletes with soft deletes
10. Add rate limiting to all critical endpoints
11. Fix payment race condition with optimistic locking
12. Implement proper CSP without `unsafe-inline`

### Medium-term (within sprint)
13. Implement database-backed session revocation
14. Add MFA/TOTP support for member login
15. Move all Supabase direct client calls to server API routes
16. Add CSRF protection
17. Implement proper audit logging with IP/UA tracking
18. Add security headers to all responses

---

## OWASP TOP 10 MAPPING

| OWASP Category | Issues Found |
|----------------|--------------|
| A01: Broken Access Control | C-02, C-05, H-03, H-09, H-10, H-11, M-15 |
| A02: Cryptographic Failures | C-03, C-04, M-07 |
| A03: Injection | H-08, M-11 |
| A04: Insecure Design | C-01, H-04, H-05, H-07 |
| A05: Security Misconfiguration | C-06, H-01, H-02, M-01, M-02, M-03, M-09 |
| A06: Vulnerable Components | (not assessed - dependency audit needed) |
| A07: Identification/Auth Failures | C-02, C-05, M-04, M-05, L-01 |
| A08: Software/Data Integrity | (not assessed) |
| A09: Security Logging Failures | H-09, M-06, M-13 |
| A10: SSRF | (not found) |
