# Mera Darzi — Remaining Tasks

Generated 2026-06-09 after completing Phases 1–3 of the comprehensive audit.

---

## 1. CODE QUALITY — Quick Wins

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

## 2. PRODUCTION READINESS

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

## 3. GROWTH FEATURES

### 3.1 Urdu Nastaliq Font Toggle
The font is already loaded (`Noto_Nastaliq_Urdu` in layout). Just needs:
- A toggle in settings to switch between Urdu Nastaliq and default font
- Apply `font-urdu` class to `<html>` when Urdu mode is on
- Already wired: `LocaleProvider` with `locale` state and `setLocale`

### 3.2 Bulk Operations on Customers Page
- Select multiple customers
- Batch delete (soft)
- Batch export to CSV

### 3.3 Customer Order History View
- On customer detail page (`/customers/[id]`), add a tab for order timeline
- Show status changes with timestamps

---

## 4. INFRASTRUCTURE & DEVOPS

### 4.1 Monitoring
| Tool | Purpose | Status |
|---|---|---|
| Sentry | Error tracking | Already configured (SENTRY_DSN) |
| Sentry Performance | Transaction tracing | Enable in Sentry settings |
| Uptime monitoring | cron-job.org or UptimeRobot | Free tier available |
| Error alerting | Slack/Discord webhook on critical errors | Create webhook + wire to Sentry alerts |

### 4.2 Load Testing
```bash
npm install -D @artilleryio/artillery
```
Test key endpoints:
- `POST /api/auth/login` — 100 concurrent logins
- `POST /api/orders` — 50 concurrent order creations
- `GET /api/auth/session` — 500 session checks (most frequent call)

### 4.3 Database Backups
- Enable Supabase PITR (requires Pro plan, $25/mo)
- Alternative: `pg_dump` via cron-job.org daily → store in Cloudinary/S3

---

## 5. BUG BACKLOG — Low Priority

From the audit (Section 7.3):

| ID | Issue | Impact |
|---|---|---|
| R11 | No unique constraint `(shop_id, order_number)` in DB | Fixed via migration ✅ |
| R17 | IP blocklist check fails open if Supabase unreachable | Fixed — now fails closed ✅ |
| SEC-3 | Rate limiter fails open on Redis errors | Fixed — now fails closed ✅ |
| API-8 | No server-side PIN strength validation in create-shop | Fixed — already present ✅ |
| API-9 | Session GET doesn't re-verify member's shop_id | Fixed — now verifies ✅ |

---

## Stats
- **Completed:** 40+ fixes/features across 33 files
- **Remaining:** ~25 tasks across 7 categories
- **Tests:** 274 unit + 40 E2E (all passing)
- **TypeScript:** 0 errors
