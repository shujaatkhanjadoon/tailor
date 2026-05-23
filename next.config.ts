// next.config.ts
import type { NextConfig } from 'next'

const appTimeZone = process.env.TIMEZONE ?? process.env.TIMEZ ?? process.env.TZ ?? 'Asia/Karachi'
process.env.TZ = appTimeZone

const nextConfig: NextConfig = {
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

  // Strict mode for better error catching
  reactStrictMode: true,

  // Bundle analyzer (only in analyze mode)
  ...(process.env.ANALYZE === 'true' && {
    webpack(config: any) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'static' }))
      return config
    },
  }),
}

module.exports = nextConfig
