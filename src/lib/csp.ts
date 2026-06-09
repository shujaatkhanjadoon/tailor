const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://*.sentry.io'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'https:', 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'https://*.sentry.io',
    'https://res.cloudinary.com',
    'https://o*.ingest.sentry.io',
  ],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'report-uri': ['/api/csp-violation'],
}

export function cspHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

export { CSP_DIRECTIVES }
