import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('email OTP', () => {
  it('generateOTP returns 6-digit string', async () => {
    const { generateOTP } = await import('../src/lib/security/email-otp.ts')
    const otp = generateOTP()
    assert.equal(otp.length, 6)
    assert.match(otp, /^\d{6}$/)
  })

  it('generateOTP produces random values', async () => {
    const { generateOTP } = await import('../src/lib/security/email-otp.ts')
    const a = generateOTP()
    const b = generateOTP()
    assert.notEqual(a, b)
  })

  it('hashOTP produces a bcrypt hash starting with $2', async () => {
    process.env.OTP_PEPPER_SECRET = 'test-pepper-123'
    const { hashOTP } = await import('../src/lib/security/email-otp.ts')
    const hash = hashOTP('123456')
    assert.ok(hash.startsWith('$2'))
  })

  it('hashOTP throws if OTP_PEPPER_SECRET is missing', async () => {
    delete process.env.OTP_PEPPER_SECRET
    const { hashOTP } = await import('../src/lib/security/email-otp.ts')
    assert.throws(() => hashOTP('123456'), /OTP_PEPPER_SECRET is required/)
  })

  it('verifyOTP returns true for matching OTP', async () => {
    process.env.OTP_PEPPER_SECRET = 'test-pepper-456'
    const { hashOTP, verifyOTP } = await import('../src/lib/security/email-otp.ts')
    const otp = '654321'
    const hash = hashOTP(otp)
    assert.ok(verifyOTP(otp, hash))
  })

  it('verifyOTP returns false for wrong OTP', async () => {
    process.env.OTP_PEPPER_SECRET = 'test-pepper-789'
    const { hashOTP, verifyOTP } = await import('../src/lib/security/email-otp.ts')
    const hash = hashOTP('111111')
    assert.equal(verifyOTP('222222', hash), false)
  })

  it('verifyOTP returns false for non-bcrypt hash', async () => {
    process.env.OTP_PEPPER_SECRET = 'test-pepper'
    const { verifyOTP } = await import('../src/lib/security/email-otp.ts')

    assert.equal(verifyOTP('123456', 'not-a-bcrypt-hash'), false)
  })

  it('verifyOTP throws if OTP_PEPPER_SECRET is missing', async () => {
    delete process.env.OTP_PEPPER_SECRET
    const { verifyOTP } = await import('../src/lib/security/email-otp.ts')
    assert.throws(() => verifyOTP('123456', '$2a$10$somehash'), /OTP_PEPPER_SECRET is required/)
  })
})
