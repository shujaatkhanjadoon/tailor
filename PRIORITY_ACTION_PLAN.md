# PRIORITY ACTION PLAN — Meradarzi Tailor

**Date:** 2026-05-23
**Auditor:** Senior Application Security Engineer & Performance Architect

---

## IMMEDIATE (Within Hours) — Stop the Bleeding

### Phase 1: Security Fire Drill

| # | Action | Owner | Expected Time | Verification |
|---|--------|-------|---------------|--------------|
| 1 | **Rotate ALL production secrets** — Supabase service role key, Admin secret, TOTP secret, PIN encryption key, Cloudinary secret, Resend API key, Upstash Redis token | DevOps | 30 min | Verify old keys revoked |
| 2 | **Remove `.env.local` from workspace** — Move to Vercel Environment Variables | DevOps | 15 min | Confirm env vars loaded |
| 3 | **Remove VAPID private key from `.env.example`** — Replace with placeholder | Developer | 5 min | git diff shows removal |
| 4 | **Verify `proxy.ts` rename to `middleware.ts`** — Test security headers present | Developer | 15 min | `curl -I` shows HSTS, CSP, XFO |
| 5 | **Verify session endpoint now requires PIN** | Developer | 15 min | Test POST without PIN returns 401 |

### Phase 2: Authentication Hotfix

| # | Action | Owner | Expected Time | Verification |
|---|--------|-------|---------------|--------------|
| 6 | **Stop sending `pinPlain` in API requests** | Developer | 30 min | Network tab shows no pin field |
| 7 | **Remove `pin_hash` from client-accessible queries** | Developer | 30 min | Supabase query doesn't return pin_hash |
| 8 | **Verify `update-pin` endpoint requires session** | Developer | 15 min | Test without cookie returns 401 |
| 9 | **Verify admin data no longer decrypts PINs** | Developer | 15 min | Admin shops page shows "Available: yes" not actual PIN |

---

## SHORT-TERM (Within Days) — Structural Fixes

### Phase 3: Database Safety

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 10 | Verify all hard deletes replaced with soft deletes | Developer | 1 hr | Critical |
| 11 | Add rate limiting to session creation, admin login, update-pin | Developer | 2 hr | Critical |
| 12 | Add Supabase migration files with proper indexes | Developer | 2 hr | High |
| 13 | Fix payment race condition with optimistic locking | Developer | 1 hr | Critical |
| 14 | Add pagination limits to all list queries | Developer | 2 hr | High |

### Phase 4: Frontend Performance

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 15 | Remove 60-second polling from all hooks (keep Realtime) | Developer | 1 hr | High |
| 16 | Add React Query for caching | Developer | 4 hr | High |
| 17 | Replace 6 raw `<img>` tags with `next/image` | Developer | 2 hr | Medium |
| 18 | Fix `nowKarachiIso()` timezone | Developer | 30 min | High |
| 19 | Add loading skeletons for async data | Developer | 2 hr | Medium |

### Phase 5: Admin Security

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 20 | Fix admin login: always secure cookie, stop logging token | Developer | 30 min | High |
| 21 | Add rate limiting to admin login | Developer | 1 hr | High |
| 22 | Add IP/UA tracking to audit logs | Developer | 1 hr | Medium |
| 23 | Validate admin data API limit param | Developer | 30 min | Medium |

---

## MEDIUM-TERM (Within Sprint) — Architectural Improvements

### Phase 6: Authentication Architecture

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 24 | Move all PIN verification to server-side | Developer | 4 hr | Critical |
| 25 | Implement database-backed session revocation | Developer | 8 hr | High |
| 26 | Add MFA/TOTP support for member login | Developer | 8 hr | Medium |
| 27 | Remove dual session storage (localStorage + cookie) | Developer | 2 hr | Medium |

### Phase 7: API Architecture

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 28 | Create `src/lib/supabase/admin.ts` — centralized admin client | Developer | 2 hr | High |
| 29 | Move all billing Supabase calls to server API routes | Developer | 4 hr | High |
| 30 | Add middleware-level auth for all API routes | Developer | 4 hr | High |
| 31 | Create structured logger utility | Developer | 1 hr | Medium |

### Phase 8: Code Quality

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 32 | Remove dead code (QRCodeSVG, formatKarachiDateInput, TailorDB) | Developer | 1 hr | Low |
| 33 | Extract hardcoded configs to env vars | Developer | 2 hr | Medium |
| 34 | Remove `(supabase as any)` casts, use typed client | Developer | 4 hr | Medium |
| 35 | Extract monolithic components (AuthPage, TeamManager, KarigarPage) | Developer | 8 hr | Medium |

### Phase 9: Monitoring & Observability

| # | Action | Owner | Expected Time | Priority |
|---|--------|-------|---------------|----------|
| 36 | Add Sentry or similar error tracking | Developer | 2 hr | Medium |
| 37 | Add structured logging to all API routes | Developer | 4 hr | Medium |
| 38 | Add health check endpoint | Developer | 1 hr | Low |
| 39 | Add performance monitoring (Vercel Analytics / Web Vitals) | Developer | 1 hr | Low |

---

## TIMELINE

```
Day 1:  Phases 1-2 (Security fire drill + Auth hotfix)
Day 2:  Phases 3-4 (Database safety + Frontend performance)
Day 3:  Phase 5 (Admin security)
Week 2: Phase 6 (Auth architecture rewrite)
Week 3: Phase 7 (API architecture)
Week 4: Phases 8-9 (Code quality + Monitoring)
```

---

## VERIFICATION CHECKLIST

### Security Verification
- [ ] No secrets in `.env.local`, `.env.example`, or source code
- [ ] `middleware.ts` is loaded — check `curl -I` for security headers
- [ ] Session creation requires server-side PIN verification
- [ ] Update-pin endpoint requires authentication
- [ ] Admin data API does not return decrypted PINs
- [ ] No hard deletes remain in the codebase
- [ ] Rate limiting present on all auth endpoints
- [ ] No `pin_hash` returned in client-accessible queries

### Performance Verification
- [ ] Dashboard stats load time < 200ms (was loading all orders)
- [ ] Customer list shows first 100 records, not all
- [ ] No 60-second polling present (only Realtime subscriptions)
- [ ] All images use `next/image` with proper sizing
- [ ] `nowKarachiIso()` returns Karachi time, not UTC
- [ ] Payment updates use optimistic locking

### Architecture Verification
- [ ] `proxy.ts` is renamed to `middleware.ts`
- [ ] Single `supabase-admin.ts` utility exists
- [ ] `supabase/migrations/` directory has versioned SQL files
- [ ] Payment operations are transactional
- [ ] All direct Supabase client calls in pages are removed
