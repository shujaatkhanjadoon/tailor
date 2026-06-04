import { NextResponse } from 'next/server'
import { sbGet } from '@/lib/supabase/service'

export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  // Check Supabase connectivity
  try {
    await sbGet('shops?limit=1&select=id')
    checks.supabase = 'ok'
  } catch (e) {
    checks.supabase = `error: ${e instanceof Error ? e.message : String(e)}`
    healthy = false
  }

  // Check required env vars
  const requiredVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_SECRET',
    'SESSION_SIGNING_SECRET',
    'CRON_SECRET',
    'PIN_ENCRYPTION_KEY',
  ]
  for (const name of requiredVars) {
    if (!process.env[name]) {
      checks[`env:${name}`] = 'missing'
      healthy = false
    }
  }

  const statusCode = healthy ? 200 : 503
  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: statusCode },
  )
}
