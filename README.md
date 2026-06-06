# MeraDarzi — Tailor Management Software (Pakistan)

Cloud-based tailor shop management for darzis and boutiques across Pakistan. Manage orders, customers, measurements, payments, stitching records, karigar tracking, and delivery — all in one PWA that works on any device.

## Tech Stack

- **Framework:** Next.js 16 (React 19)
- **Database:** Supabase (PostgreSQL) + Dexie/IndexedDB (local cache)
- **Styling:** Tailwind CSS 4
- **Auth:** bcrypt PIN + session tokens (HMAC-SHA256)
- **Admin 2FA:** TOTP (Google Authenticator)
- **Payments:** Raast (Pakistan instant bank transfer)
- **Notifications:** Web Push (VAPID), WhatsApp click-to-chat
- **Images:** Cloudinary
- **Email:** Resend
- **Rate Limiting:** Upstash Redis (with in-memory fallback)
- **Error Tracking:** Sentry
- **Edge:** Mumbai (bom1) — Vercel

## Getting Started

### Prerequisites

- Node.js 22+
- A Supabase project (free tier works)
- Cloudinary account
- (Optional) Resend API key for email
- (Optional) Upstash Redis for distributed rate limiting

### Environment Setup

```bash
cp .env.example .env.local
```

Fill in all required vars. At minimum you need:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_SECRET=<random 32-byte hex>
SESSION_SIGNING_SECRET=<random 32-byte hex (different from ADMIN)>
ADMIN_TOTP_SECRET=<base32 or hex secret for Google Authenticator>
CRON_SECRET=<random secret>
OTP_PEPPER_SECRET=<random secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (webpack) |
| `npm run build` | Production build (webpack) |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (Node test runner) |

## Project Structure

```
src/
├── app/                # Next.js App Router pages + API routes
│   ├── api/            # All API routes (auth, billing, cron, admin)
│   ├── auth/           # Login page
│   ├── billing/        # Pricing, upgrade pages
│   ├── customers/      # Customer management
│   ├── orders/         # Order management
│   ├── payments/       # Payment tracking
│   ├── reports/        # Analytics dashboard
│   └── admin/          # Admin panel (2FA protected)
├── components/         # React components
│   ├── ui/            # Base UI components
│   ├── layout/        # AppShell, footer, navigation
│   ├── dashboard/     # Dashboard widgets
│   ├── billing/       # Plan badges, banners
│   ├── orders/        # Order form wizard
│   └── notifications/ # Notification components
├── hooks/              # Custom React hooks
├── lib/                # Core business logic
│   ├── auth/           # Session management, AuthContext
│   ├── billing/        # Pricing plans, cycles, Raast payment
│   ├── db/             # Database schema + operations
│   ├── security/       # Rate limiting, CSP
│   ├── supabase/       # Supabase client, service, types
│   ├── i18n/           # Urdu/English locale
│   └── payments/       # Payment calculations
```

## Deployment

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Set all env vars (see `.env.example`)
4. Configure Vercel Cron Jobs matching `vercel.json`
5. Set Sentry DSN and environment
6. Deploy

### Required GitHub Secrets (for CI)

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key |
| `SENTRY_DSN` | Sentry error tracking |

### Database Migrations

This project uses Supabase. To version-control your schema:

```bash
supabase login
supabase link --project-ref <your-ref>
supabase db pull
```

## License

Private — all rights reserved.
