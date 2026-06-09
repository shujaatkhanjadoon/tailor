import assert from 'node:assert/strict'
import { it } from 'node:test'
import { cspHeader } from '../src/lib/csp.ts'

it('cspHeader contains all required directives', () => {
  const header = cspHeader()
  assert.ok(header.includes("default-src 'self'"))
  assert.ok(header.includes("script-src 'self' 'unsafe-inline'"))
  assert.ok(header.includes("style-src 'self' 'unsafe-inline'"))
  assert.ok(header.includes('img-src'))
  assert.ok(header.includes("frame-ancestors 'none'"))
  assert.ok(header.includes("base-uri 'self'"))
  assert.ok(header.includes("form-action 'self'"))
})

it('cspHeader directives are semicolon-separated', () => {
  const parts = cspHeader().split('; ')
  assert.ok(parts.length >= 7)
})
