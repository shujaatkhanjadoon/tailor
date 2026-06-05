interface EnvVar {
  name: string
  required: boolean
  description: string
  default?: string
}

const ENV_VARS: EnvVar[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anon/public key',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (admin)',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public app URL for CORS and links',
  },
  {
    name: 'ADMIN_SECRET',
    required: true,
    description: 'Secret for admin HMAC session signing',
  },
  {
    name: 'SESSION_SIGNING_SECRET',
    required: true,
    description: 'Secret for member session HMAC signing',
  },
  {
    name: 'ADMIN_TOTP_SECRET',
    required: true,
    description: 'TOTP secret for admin 2FA',
  },
  {
    name: 'CRON_SECRET',
    required: true,
    description: 'Bearer token for cron job authentication',
  },
  {
    name: 'PIN_ENCRYPTION_KEY',
    required: false,
    description: '32-byte hex key for AES-256-GCM PIN encryption (unused; bcrypt used instead)',
  },
  {
    name: 'OTP_PEPPER_SECRET',
    required: true,
    description: 'Secret used for OTP hashing',
  },
  {
    name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    required: false,
    description: 'VAPID public key for web push',
  },
  {
    name: 'VAPID_PRIVATE_KEY',
    required: false,
    description: 'VAPID private key for web push',
  },
  {
    name: 'VAPID_SUBJECT',
    required: false,
    description: 'VAPID subject (mailto: url)',
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend.com API key for email',
  },
  {
    name: 'RESEND_FROM_EMAIL',
    required: false,
    description: 'From address for Resend emails',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false,
    description: 'Upstash Redis REST URL for rate limiting',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    description: 'Upstash Redis REST token',
  },
  {
    name: 'CLOUDINARY_API_SECRET',
    required: false,
    description: 'Cloudinary API secret',
  },
  {
    name: 'TIMEZONE',
    required: false,
    description: 'Server timezone',
    default: 'Asia/Karachi',
  },
]

const MISSING: string[] = []

export function validateEnv(): void {
  for (const v of ENV_VARS) {
    if (!v.required) continue
    if (v.name.startsWith('NEXT_PUBLIC_')) {
      if (typeof process.env[v.name] !== 'string' || !process.env[v.name]) {
        MISSING.push(v.name)
      }
    } else {
      if (!process.env[v.name]) {
        MISSING.push(v.name)
      }
    }
  }

  if (MISSING.length > 0) {
    const msg = `Missing required environment variables:\n  ${MISSING.join('\n  ')}\n\nSee .env.example for documentation.`
    throw new Error(msg)
  }
}
