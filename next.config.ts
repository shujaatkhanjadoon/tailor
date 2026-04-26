// next.config.ts
import type { NextConfig } from 'next'

const withPWA = require('next-pwa')({
  dest:        'public',
  register:    true,
  skipWaiting: true,
  disable:     process.env.NODE_ENV !== 'production',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler:    'StaleWhileRevalidate',
      options:    { cacheName: 'google-fonts-stylesheets' },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler:    'CacheFirst',
      options:    {
        cacheName: 'google-fonts-webfonts',
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler:    'CacheFirst',
      options:    {
        cacheName: 'images',
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
})

const nextConfig: NextConfig = {
  // Compress output
  compress: true,

  // Image optimization
  images: {
  formats: ['image/webp', 'image/avif'],
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'res.cloudinary.com',
      pathname: '/**',
    },
  ],
  minimumCacheTTL: 60,
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

module.exports = withPWA(nextConfig)