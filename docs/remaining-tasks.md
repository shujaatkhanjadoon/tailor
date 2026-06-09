# Mera Darzi — Remaining Tasks

Generated 2026-06-09 after completing Phases 1–3 of the comprehensive audit.

---

## 1. CODE QUALITY — Quick Wins (1–2 hours)

### 1.1 Remove Dead Code
| Location | Issue |
|---|---|
| `src/lib/db/sync.ts:76` | `const type = 'sync-error'` — assigned but unused variable |
| `src/lib/admin/auth.ts` | Legacy 4-part, 3-part, and 2-part token format support — consolidate to 6-part only once all sessions are migrated |
| `src/lib/supabase/records.ts` | Check for unused record mappers |

### 1.2 Fix Subtle Bugs
| Location | Issue | Fix |
|---|---|---|
| `src/lib/db/sync.ts:242-244` | String-based timestamp comparison `serverUpdatedAt > localUpdatedAt` — normalize to UTC or use ISO string comparison | Use `new Date(serverUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()` |
| `src/lib/db/operations.ts:255` | `pin.startsWith('$2')` check double-hashes already-hashed PINs in `addWithId` | Add comment explaining this is intentional for client-pre-hashed pins |
| `src/app/api/admin/action/route.ts:27-45` | `logAction` heuristic for `target_type` — uses `ACTION_TYPES[action] ?? 'subscription'` | Make explicit per-action instead of using fallback |

### 1.3 Type Safety
| Location | Issue |
|---|---|
| `src/lib/db/operations.ts` | 6 `@typescript-eslint/no-explicit-any` warnings — add proper types |
| `src/lib/supabase/records.ts` | Return types are implicit — add explicit return type annotations |

---

## 2. PRODUCTION READINESS (2–4 hours)

### 2.1 Run Production Build
```bash
npm run build
```
Fix any webpack-only errors that don't appear in `tsc --noEmit`.

### 2.2 Search/Filter on All List Pages
| Page | Status | What's Needed |
|---|---|---|
| `/orders` | ✅ Has search + status filter | — |
| `/customers` | ✅ Has search | Add gender/phone filter |
| `/payments` | ⬜ Missing filters | Add date range + method filter |
| `/karigar` | ⬜ Missing search | Add name/speciality search |

### 2.3 Offline Sync Status
| Task | Details |
|---|---|
| Pending sync count badge | Already exists in `OnlineStatus` component but only shown at bottom — add indicator to header/nav |
| Sync progress bar | Show upload/download progress during sync |
| Conflict resolution UI | If sync detects a conflict, show a simple "server version kept" toast |

### 2.4 Error Handling Edge Cases
| Scenario | Fix |
|---|---|
| Supabase connection lost mid-session | Show banner + auto-retry with backoff |
| IndexedDB full | Catch `QuotaExceededError` in Dexie operations and prompt user to clear old data |
| Cloudinary upload timeout | Already handled in `deleteCloudinaryAsset` — verify upload side too |

---

## 3. GROWTH FEATURES (5–10 hours)

### 3.1 Customer WhatsApp Notifications
Send automated WhatsApp messages on order status changes:

- **When order becomes "ready":** "Aapka order #123 tayyar hai, dukaan se le jaiye"
- **When order is "delivered":** "Shukriya! Apna experience share karein"
- **Trigger:** Add to `StatusUpdateSheet` and `bulk status update`
- **Implementation:** Use existing CallMeBot API (`CALLMEBOT_API_KEY` env var)

### 3.2 Urdu Nastaliq Font Toggle
The font is already loaded (`Noto_Nastaliq_Urdu` in layout). Just needs:
- A toggle in settings to switch between Urdu Nastaliq and default font
- Apply `font-urdu` class to `<html>` when Urdu mode is on
- Already wired: `LocaleProvider` with `locale` state and `setLocale`

### 3.3 Bulk Operations on Customers Page
- Select multiple customers
- Batch delete (soft)
- Batch export to CSV

### 3.4 Customer Order History View
- On customer detail page (`/customers/[id]`), add a tab for order timeline
- Show status changes with timestamps

---

## 4. PAYMENT AUTOMATION (10–20 hours)

### 4.1 Automated Payment Gateway
Replace manual Raast verification with automated payments:

| Gateway | Pros | Cons |
|---|---|---|
| **Stripe** | Well-documented, webhooks, international | 2.9% + $0.30 fees, PKR not natively supported |
| **JazzCash API** | Pakistan-specific, low fees | Documentation in progress, sandbox needed |
| **EasyPaisa API** | Popular in Pakistan | API access requires business approval |
| **Sadapay** | Modern API, growing fast | Newer, less battle-tested |

**Recommendation:** Start with Stripe for international + JazzCash for local.

### 4.2 Webhook Endpoints
```
POST /api/webhooks/stripe    — Stripe payment confirmed
POST /api/webhooks/jazzcash  — JazzCash callback
```
- Verify webhook signatures
- Auto-activate subscription on payment confirmation
- Send WhatsApp/email receipt to shop owner

### 4.3 Payment Flow Changes
1. User selects plan → redirected to Stripe/JazzCash checkout
2. Payment completed → webhook received → subscription auto-activated
3. Keep manual Raast as fallback option (already hardened)

---

## 5. INFRASTRUCTURE & DEVOPS (Ongoing)

### 5.1 Staging Environment
```bash
# Create separate Supabase project
# Deploy to Vercel preview URL
# Set staging env vars
```
- Copy production schema via `supabase db dump`
- Use staging for testing migrations before production

### 5.2 Monitoring
| Tool | Purpose | Status |
|---|---|---|
| Sentry | Error tracking | Already configured (SENTRY_DSN) |
| Sentry Performance | Transaction tracing | Enable in Sentry settings |
| Uptime monitoring | cron-job.org or UptimeRobot | Free tier available |
| Error alerting | Slack/Discord webhook on critical errors | Create webhook + wire to Sentry alerts |

### 5.3 Load Testing
```bash
npm install -D @artilleryio/artillery
```
Test key endpoints:
- `POST /api/auth/login` — 100 concurrent logins
- `POST /api/orders` — 50 concurrent order creations
- `GET /api/auth/session` — 500 session checks (most frequent call)

### 5.4 Database Backups
- Enable Supabase PITR (requires Pro plan, $25/mo)
- Alternative: `pg_dump` via cron-job.org daily → store in Cloudinary/S3

---

## 6. DOCUMENTATION & ONBOARDING

### 6.1 User Documentation
- Help center with Urdu/English guides for each feature
- Video tutorials (screen recording of key flows)
- FAQ page

### 6.2 API Documentation
- OpenAPI/Swagger spec for public API (if/when shops get API access)
- Internal API docs for admin endpoints

### 6.3 Onboarding Wizard
- First-run experience after signup:
  1. Add first customer
  2. Create first order
  3. Take measurements
  4. Process payment
- Skip option for power users

### 6.4 Deployment Runbook
- How to deploy, rollback, diagnose issues
- Environment variables checklist
- Common issues and solutions

---

## 7. BUG BACKLOG — Low Priority

From the audit (Section 7.3):

| ID | Issue | Impact |
|---|---|---|
| R11 | No unique constraint `(shop_id, order_number)` in DB | Fixed via migration ✅ |
| R17 | IP blocklist check fails open if Supabase unreachable | Fixed — now fails closed ✅ |
| SEC-3 | Rate limiter fails open on Redis errors | Fixed — now fails closed ✅ |
| API-8 | No server-side PIN strength validation in create-shop | Fixed — already present ✅ |
| API-9 | Session GET doesn't re-verify member's shop_id | Fixed — now verifies ✅ |

---

## 8. EXECUTION ORDER

### Today/Tomorrow
1. Remove dead code (Section 1.1)
2. Fix timestamp comparison in sync (Section 1.2)
3. Run `npm run build` and fix errors
4. Add search/filter to payments + karigar pages

### This Week
1. Customer WhatsApp notifications
2. Urdu font toggle
3. Offline sync status improvements
4. Bulk operations on customers

### Next Sprint
1. Automated payment gateway integration
2. Staging environment
3. Load testing
4. Documentation

---

## Stats
- **Completed:** 40+ fixes/features across 33 files
- **Remaining:** ~25 tasks across 7 categories
- **Tests:** 274 unit + 40 E2E (all passing)
- **TypeScript:** 0 errors
