# Deployment & Operations Guide

## Database Migrations

### Current State

The entire database schema lives in a single file `supabase-migration.sql` (461 lines, 17 tables). There is no incremental migration system — every schema change requires manually editing this file and re-applying it, which is error-prone and makes rollbacks difficult.

### Step-by-Step: Switch to Supabase CLI Migrations

**Prerequisite**: Install the Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Linux (curl)
curl -fsSL https://cli.supabase.com/install.sh | sh

# Verify
supabase --version
```

**Step 1: Initialize Supabase in the project**
```bash
cd /workspaces/tailor
supabase init
```
This creates a `supabase/` directory with a `config.toml` file.

**Step 2: Link to your Supabase project**
```bash
supabase link --project-ref <your-project-ref>
```
You can find the project ref in your Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

**Step 3: Pull the current schema as the initial migration**
```bash
supabase db pull
```
This creates `supabase/migrations/<timestamp>_initial.sql` containing the full current schema from your database.

Commit this file:
```bash
git add supabase/
git commit -m "chore: initialize Supabase CLI with current schema"
```

**Step 4: Workflow for future schema changes**

Instead of editing `supabase-migration.sql`, create a new migration:
```bash
supabase migration new <descriptive-name>
# e.g. supabase migration new add_order_discount_field
```

This creates `supabase/migrations/<timestamp>_<name>.sql`. Edit the new file with only your changes:
```sql
-- supabase/migrations/<timestamp>_add_order_discount_field.sql
ALTER TABLE orders ADD COLUMN discount_pkr numeric(12,0) DEFAULT 0 NOT NULL;
```

**Step 5: Apply migrations locally**
```bash
supabase start          # Start local Supabase
supabase db reset       # Apply all migrations fresh
```

**Step 6: Apply migrations to production**
```bash
supabase db push
```

**Step 7: Keep `supabase-migration.sql` as a reference** (optional but recommended)
After each migration, regenerate it:
```bash
supabase db dump --local > supabase-migration.sql
```

### Best Practices

- **One change per migration** — makes rollbacks easy
- **Never edit an existing migration** — always create a new one
- **Always commit migration files** alongside the code that depends on them
- **Test locally first**: `supabase start` runs a full Postgres instance via Docker
- **Use branches in CI**: `supabase db push --linked` can deploy per-branch preview databases

### Rollback Procedure

If a production migration fails or causes issues:
```bash
# 1. Check the migration history
supabase migration list

# 2. Create a compensating migration (do NOT delete the original)
supabase migration new revert_add_order_discount_field
# Add the reverse SQL, e.g. ALTER TABLE orders DROP COLUMN discount_pkr;

# 3. Push the fix
supabase db push
```

---

## CI/CD Pipeline

### Current State

Zero CI/CD — no automated linting, type-checking, or testing runs on commits or PRs. Everything is manual.

### Step-by-Step: Add GitHub Actions CI

**Step 1: Create the directory structure**
```bash
mkdir -p .github/workflows
```

**Step 2: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint-and-typecheck:
    name: Lint & TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - run: npm run lint
        name: ESLint

      - run: npx tsc --noEmit
        name: TypeScript check

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - name: Run tests
        run: npm test
        env:
          ADMIN_SECRET: ci-admin-secret-for-tests
          SESSION_SIGNING_SECRET: ci-session-signing-secret
          OTP_PEPPER_SECRET: ci-otp-pepper
          ADMIN_TOTP_SECRET: JBSWY3DPEHPK3PXP
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          SENTRY_ENVIRONMENT: ci

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci

      - run: npm run build
        name: Next.js build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          ADMIN_SECRET: ci-admin-secret-for-tests
          SESSION_SIGNING_SECRET: ci-session-signing-secret
          OTP_PEPPER_SECRET: ci-otp-pepper
          ADMIN_TOTP_SECRET: JBSWY3DPEHPK3PXP
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          SENTRY_ENVIRONMENT: ci
```

**Step 3: Define secrets in GitHub**

Go to your repo → Settings → Secrets and variables → Actions → Add the following repository secrets:

| Secret | Value | Required for |
|--------|-------|-------------|
| `SENTRY_DSN` | Your Sentry DSN | Build |
| `SENTRY_ENVIRONMENT` | `production` | Build |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | Build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Build |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service key | Build |

**Step 4: Commit and push**
```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for lint, test, build"
git push
```

### Optional: Deploy to Vercel from CI

Add a deploy job after `build`:

```yaml
  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Workflow Diagram

```
[Push/PR] ──► Lint ──► TypeCheck ──► Test ──► Build ──► (auto-deploy to Vercel)
                  │                      │
              fail ❌                  fail ❌
```

### Environment Variables for Tests

The test suite (`node --test`) requires these env vars for the admin auth tests:

| Env Var | Test Value | Purpose |
|---------|-----------|---------|
| `ADMIN_SECRET` | `ci-admin-secret-for-tests` | Session token signing |
| `SESSION_SIGNING_SECRET` | `ci-session-signing-secret` | Member session signing |
| `OTP_PEPPER_SECRET` | `ci-otp-pepper` | OTP hashing |
| `ADMIN_TOTP_SECRET` | `JBSWY3DPEHPK3PXP` | TOTP 2FA verification |

Note: The Node.js built-in test runner runs `node --test --experimental-strip-types`. Tests using `@/` path aliases (like validation) won't work in CI without a path alias resolver. The current test suite avoids `@/` imports by using relative paths.

---

## Monitoring & Alerting

### Current State (already adequate)

- **Sentry** is fully integrated in client, server, and edge runtimes
- **Structured logger** (`src/lib/logger.ts`) used across 28 files
- **Vercel deployment config** exists with 4 cron jobs
- **Health check endpoint** at `/api/health`

### Recommended Additions

**1. Sentry Alert Rules**

In Sentry dashboard → Alerts → Create Alert:
- **Error Spike**: Trigger when errors exceed 10/min in production
- **New Error**: Trigger on any first-seen error type
- **Cron Monitor**: Watch for missed cron job executions (Sentry Cron Monitors)

**2. Uptime Monitoring**

Add a free uptime monitor (Better Uptime, Checkly, or Vercel's own):
```
Target: https://your-domain.com/api/health
Interval: 5 minutes
Expected status: 200
Expected response: { status: "healthy" }
```

**3. Vercel Analytics**

Enable in Vercel dashboard → Project → Analytics to track:
- Web Vitals (LCP, CLS, INP)
- Page views and traffic patterns

**4. Log Retention**

The custom logger only outputs to console (stdout/stderr). Vercel retains logs for 24 hours. For longer retention, consider:
- **Axiom** or **Logtail** for log aggregation
- **Sentry's log integration** to forward server logs
- Add a log drain in Vercel → Project → Log Drains

---

## Quick Reference: Common Commands

```bash
# Migration workflow
supabase migration new <name>        # Create migration
supabase db reset                     # Apply all migrations locally
supabase db push                      # Push to production
supabase db pull                      # Pull latest schema
supabase migration list               # Show applied migrations

# CI/CD
git push                              # Triggers CI automatically
gh workflow run ci.yml --ref <branch> # Manually trigger CI

# Monitoring
curl https://your-domain.com/api/health  # Health check
```
