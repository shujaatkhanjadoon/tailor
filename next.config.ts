// next.config.ts
import type { NextConfig } from 'next'
const withPWA = require('next-pwa')({
  dest:        'public',
  register:    true,
  skipWaiting: true,
  disable:     process.env.NODE_ENV !== 'production', // ← only enable in prod
})

const nextConfig: NextConfig = {
  // your existing config here
}

module.exports = withPWA(nextConfig)