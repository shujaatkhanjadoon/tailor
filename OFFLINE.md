# Offline Capabilities — Complete Reference

> **Last updated:** June 8, 2026  
> **Applies to:** All roles (owner/karigar) across all shop data

---

## How It Works

The app uses an **online-first with offline fallback** pattern:

1. **Online:** All reads come from Supabase (fresh data). Results are cached in IndexedDB (`_synced: 1`). All writes go to Supabase first, then cached locally.
2. **Offline:** Reads fall back to IndexedDB (last-cached data). Writes save to IndexedDB with `_synced: 0` and are queued for sync.
3. **Reconnect:** The sync engine pushes queued writes to Supabase (with conflict checking), then pulls fresh data.

---

## Works Fully Offline ✅

These operations read from IndexedDB when offline and queue writes for later sync:

| Feature | What works | What doesn't |
|---------|-----------|-------------|
| **View customers list** | See all customers (last cached version) | — |
| **View customer detail** | See customer info, phone, orders count | — |
| **Search customers** | Search by name/phone (from cached data) | — |
| **Add customer** | Creates locally; syncs when online | Phone lookup validation |
| **Edit customer** | Updates locally; syncs when online | — |
| **Delete customer** | Marks deleted locally; syncs when online | Cascade delete of orders (done on sync) |
| **View orders list** | See all orders (last cached version) | — |
| **View order detail** | See order info, status, customer | — |
| **Create order** | Creates locally with last-known order number; syncs when online | Auto-increment order number; tracking code generation |
| **Update order status** | Updates locally; syncs when online | Status history |
| **Assign karigar to order** | Updates locally; syncs when online | — |
| **Edit order fields** | Updates locally; syncs when online | — |
| **Delete order** | Marks deleted locally; syncs when online | Cascading photo/payment deletes (done on sync) |
| **View photos** | See cached photos from IndexedDB | Uploading new photos (requires Cloudinary) |
| **View team members** | See team list (last cached) | — |
| **Edit profile settings** | Changes saved locally; syncs when online | — |
| **Online status indicator** | Red banner shows "No internet — N changes pending" | — |

---

## Works with Limitations ⚠️

These operations work offline but some features are degraded:

| Feature | Offline behavior | Limitation |
|---------|-----------------|------------|
| **Create order** | Works locally | `orderNumber` uses last-known + 1 from IndexedDB cache; if two offline users create orders, they may get the same number (resolved on sync) |
| **Create customer** | Works locally | `totalOrders` defaults to 0; won't update until sync |
| **Dashboard** | Shows data from last cache | Stats (orders today, income, etc.) are stale; not updated until online |
| **Payment tracking** | View cached payments | Adding new payments offline may cause concurrency issues (no `amount_paid` lock check until sync) |
| **Search** | Searches from cached IndexedDB data | Won't find records created online by others since last cache |

---

## Requires Internet 🔴

These features **do not work** offline:

| Feature | Why |
|---------|-----|
| **Login / Authentication** | Needs to verify phone + PIN against Supabase |
| **Sign up / Create shop** | Creates records in Supabase + triggers confirmation |
| **Upload photos** | Requires `createImageBitmap` + canvas processing works offline, but Cloudinary upload needs network |
| **Payment submission** | `POST /api/billing/submit-payment` — requires server-side validation |
| **Admin panel** | Admin routes are not cached |
| **Subscription management** | Plan upgrades, billing history require live data |
| **Reports & analytics** | Dashboard stats (daily income, active orders) fetch from Supabase |
| **Export CSV** | Downloads data via browser; works offline if you have the data locally, but may miss recent changes |
| **Verification (OTP / PIN)** | Requires server-side check |
| **Coupon validation** | Server-side coupon check |
| **Language switching** | Translation files are loaded once; switching works offline if already loaded |
| **Any admin API** | Admin routes (`/admin/*`) are server-only |
| **Cron jobs** | Run on Vercel server, not client |
| **Email/SMS notifications** | Triggered server-side |

---

## Multi-User Scenarios

### Karigar vs Admin

Both roles have the same offline capabilities since all data is **shop-scoped**. Both see the same cached data.

### What Happens When...

| Scenario | Result |
|----------|--------|
| **Karigar A offline, creates order** | Order saved locally with `_synced: 0`. When A comes online, sync engine pushes to Supabase. |
| **Admin B online, updates same order** | B's change goes to Supabase immediately. |
| **A comes online after B** | Sync engine checks `updatedAt`. If B's change is newer, A's local change is **discarded**. A's version is replaced with server version. |
| **Both A and B offline, modify different orders** | No conflict. Both sync successfully on reconnect. |
| **Both A and B offline, modify same order** | Last one to come online — their `updatedAt` wins. The other's change is discarded. |
| **A offline creates customer C. B online creates customer D** | Different UUIDs, no conflict. Both exist. |
| **A offline deletes order. B online edits same order** | On sync, `updatedAt` comparison: if A's delete has later timestamp, order deleted; if B's edit has later timestamp, A's delete is discarded. |

### Conflict Resolution Summary

| Local vs Server | Winner |
|----------------|--------|
| Local `updatedAt` > Server `updatedAt` | Local wins (pushed to server) |
| Server `updatedAt` > Local `updatedAt` | Server wins (local discarded) |
| Equal timestamps | Server wins |
| Record exists locally, not on server | Inserted on server |
| Record deleted locally | Soft-deleted on server |

---

## Sync Engine Details

### When Sync Happens

| Trigger | Action |
|---------|--------|
| App starts (if online) | `sync()` called immediately |
| `online` event fires | `sync()` called automatically |
| User logs in | `pull()` fetches all shop data into IndexedDB |
| Every 5 seconds (while online) | `getPendingSyncCount()` updates the status indicator |

### What Gets Synced

Only records with `_synced: 0` are pushed. Records marked `_synced: 1` are considered already consistent with Supabase.

### Order of Operations

1. Push: customers → orders → payments → measurements → shops → teamMembers
2. Pull (after push): all tables pulled from Supabase

### How to Verify Sync Status

- **No banner** = online, everything synced
- **Amber banner** "Syncing N changes..." = actively pushing local changes
- **Red banner** "No internet — N changes pending" = offline with pending changes
- **Red banner** "No internet" = offline, nothing pending

---

## Testing Checklist

To verify offline works correctly:

1. ✅ Go offline (airplane mode or disconnect)
2. ✅ Open customers page — should show cached customers
3. ✅ Add a new customer — should save locally
4. ✅ Create a new order — should save locally
5. ✅ Edit an existing order status — should save locally
6. ✅ Go online — amber banner should appear "Syncing..."
7. ✅ Red banner disappears, data appears in Supabase
8. ✅ Refresh page — new data shows correctly
