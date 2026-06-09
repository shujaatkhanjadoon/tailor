# Cron Job Setup via cron-job.org (Free Tier)

Since Vercel Hobby plan only allows **2 cron jobs** but Mera Darzi needs **4**, use **cron-job.org** (free) to call the cron API endpoints.

## Prerequisites

1. Deploy the app to Vercel (or any hosting) with a public URL
2. Set the `CRON_SECRET` environment variable to a strong random string
3. Create a free account at [cron-job.org](https://cron-job.org)

## Cron Job Configuration

For each of the 4 jobs below, create a cron job in cron-job.org:

### 1. Expire Subscriptions — Daily 1:00 AM PKT (8:00 PM UTC previous day)

| Field | Value |
|---|---|
| **URL** | `https://your-app.vercel.app/api/cron/expire-subscriptions` |
| **Method** | POST |
| **Schedule** | `0 20 * * *` (8 PM UTC = 1 AM PKT next day) |
| **Header: Authorization** | `Bearer YOUR_CRON_SECRET` |
| **Header: Content-Type** | `application/json` |
| **Timeout** | 300 seconds |
| **Save responses** | Enabled (for debugging) |

### 2. Send Reminders — Daily 9:00 AM PKT (4:00 AM UTC)

| Field | Value |
|---|---|
| **URL** | `https://your-app.vercel.app/api/cron/send-reminders` |
| **Method** | POST |
| **Schedule** | `0 4 * * *` (4 AM UTC = 9 AM PKT) |
| **Header: Authorization** | `Bearer YOUR_CRON_SECRET` |
| **Header: Content-Type** | `application/json` |
| **Timeout** | 300 seconds |

### 3. Reset Usage — 1st of Month 12:00 AM PKT (7:00 PM UTC last day of month)

| Field | Value |
|---|---|
| **URL** | `https://your-app.vercel.app/api/cron/reset-usage` |
| **Method** | POST |
| **Schedule** | `0 19 1 * *` (7 PM UTC on 1st = 12 AM PKT on 1st) |
| **Header: Authorization** | `Bearer YOUR_CRON_SECRET` |
| **Header: Content-Type** | `application/json` |
| **Timeout** | 300 seconds |

### 4. Cleanup Photos — Daily 3:00 AM PKT (10:00 PM UTC previous day)

| Field | Value |
|---|---|
| **URL** | `https://your-app.vercel.app/api/cron/cleanup-photos` |
| **Method** | POST |
| **Schedule** | `0 22 * * *` (10 PM UTC = 3 AM PKT next day) |
| **Header: Authorization** | `Bearer YOUR_CRON_SECRET` |
| **Header: Content-Type** | `application/json` |
| **Timeout** | 300 seconds |

## Timezone Reference (PKT = UTC+5)

| Cron Job | PKT Time | UTC Time | Cron Expression |
|---|---|---|---|
| Expire subscriptions | 1:00 AM | 8:00 PM (prev day) | `0 20 * * *` |
| Send reminders | 9:00 AM | 4:00 AM | `0 4 * * *` |
| Reset usage (1st) | 12:00 AM | 7:00 PM (last day) | `0 19 1 * *` |
| Cleanup photos | 3:00 AM | 10:00 PM (prev day) | `0 22 * * *` |

## Testing

After setting up, test each cron job manually via curl:

```bash
# Replace with your actual URL and CRON_SECRET
curl -X POST https://your-app.vercel.app/api/cron/expire-subscriptions \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "timestamp": "2026-06-09T...",
  "expiryMirrored": 0,
  "cancelledToGrace": 0,
  ...
}
```

## Important Notes

- **All 4 cron endpoints accept both GET and POST** requests (cron-job.org can use either)
- **CSRF protection is bypassed** for `/api/cron/*` routes — external requests without origin headers work
- **Rate limiting does NOT apply** to cron endpoints (they use Bearer auth, not IP-based rate limiting)
- **Responses include `hasMore: true`** when there are more records to process — cron-job.org will call again on the next schedule
- **All cron jobs are idempotent** — safe to run multiple times without side effects
- **Batch size is 50 records per phase** — jobs process incrementally across runs
- **Cursor tracking** prevents re-processing the same records

## Free Tier Limitations

| Service | Limit | Usage |
|---|---|---|
| cron-job.org | 5 free cron jobs | 4 jobs used ✓ |
| Vercel Hobby | Serverless 10s timeout, 100 GB-hrs | OK for cron (brief POST requests) |
| Vercel Hobby | 10 concurrent functions | OK (cron runs sequentially at different times) |
