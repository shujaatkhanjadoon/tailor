// next.config.ts
import type { NextConfig } from 'next'
import { validateEnv } from './src/lib/env'
import { withSentryConfig } from '@sentry/nextjs'

// Validate all required environment variables at startup
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnv()
  } catch (e) {
    console.error('\n=== ENVIRONMENT VALIDATION FAILED ===')
    console.error(e instanceof Error ? e.message : e)
    console.error('========================================\n')
    process.exit(1)
  }
}

const appTimeZone = process.env.TIMEZONE ?? process.env.TIMEZ ?? process.env.TZ ?? 'Asia/Karachi'
process.env.TZ = appTimeZone

const nextConfig: NextConfig = {
  cacheComponents: true,

  env: {
    NEXT_PUBLIC_TIMEZONE: appTimeZone,
  },
  // Compress output
  compress: true,

  // Image optimization
  images: {
  formats: ['image/webp', 'image/avif'],
  deviceSizes: [375, 640, 750, 828, 1080, 1200],
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'res.cloudinary.com',
      pathname: '/**',
    },
  ],
  minimumCacheTTL: 86400,
},

  // Remove powered-by header
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Strict mode for better error catching
  reactStrictMode: true,
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "mera-darzi",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});


// export default nextConfig
