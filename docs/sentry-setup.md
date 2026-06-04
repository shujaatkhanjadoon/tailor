# Sentry Error Tracking Setup

## 1. Create a Sentry Account

1. Go to https://sentry.io/signup/
2. Sign up with GitHub, Google, or email
3. Select the "Developer" plan (free tier includes 5k events/month)
4. Create a new project → Select "Next.js"

## 2. Install Dependencies

```bash
npm install @sentry/nextjs
```

## 3. Environment Variables

Add to `.env.local`:

```env
# Sentry
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxxx.ingest.us.sentry.io/xxxxxx
SENTRY_ENVIRONMENT=production  # or development/staging
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% sampling in production, 1.0 in dev
```

### Where to find the DSN:
- Sentry Dashboard → Your Project → Settings → Client Keys (DSN)
- Copy the DSN string

## 4. Sentry Configuration

Create `sentry.client.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV !== 'test',
  // Capture unhandled rejections
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
```

Create `sentry.server.config.ts`:

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV !== 'test',
})
```

## 5. Update next.config.ts

```ts
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // ... existing config
}

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
})
```

## 6. Verify Setup

```bash
# Trigger a test error in development:
curl http://localhost:3000/api/sentry-test
# Or visit in browser
```

Create `src/app/api/sentry-test/route.ts`:

```ts
export async function GET() {
  throw new Error('Sentry test error')
}
```

## 7. Dashboard Configuration

After deploying, in Sentry Dashboard:
- **Alerts**: Create alert rules for error thresholds (e.g., >10 errors in 5 min)
- **Performance**: Monitor transaction durations
- **Releases**: Track errors by deployment version

## 8. Usage in Code

Replace `console.error` with Sentry:

```ts
import * as Sentry from '@sentry/nextjs'

// Before:
console.error('[Admin] activateSubscription:', e)

// After:
Sentry.captureException(e, { tags: { action: 'activateSubscription' } })
```

## 9. Production Deployment

Add to `vercel.json` or environment variables in Vercel dashboard:
```
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
SENTRY_AUTH_TOKEN=...  # Optional: for source map upload
```

## 10. Free Tier Limits

- **5,000 events/month** (Developer plan)
- **1 user seat** included
- **30-day retention**
- For more: Upgrade to Team plan ($26/month)
