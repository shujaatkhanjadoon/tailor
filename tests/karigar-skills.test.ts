import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseKarigarSkills, formatKarigarSkills, canKarigarHandleGarment } from '../src/lib/team/karigar-skills.ts'
import type { TeamMemberRecord } from '../src/lib/db/schema.ts'

function make(speciality?: string): TeamMemberRecord {
  return {
    id: '1', shopId: 's1', name: 'Test', phone: '03001234567',
    role: 'karigar', pin: '123456', speciality,
    payRateType: undefined, payRate: undefined,
    isActive: 1, joinedAt: '', createdAt: '', _synced: 1, _deleted: 0,
  }
}

describe('parseKarigarSkills', () => {
  it('defaults to Sab Kuch for undefined', () => {
    assert.deepEqual(parseKarigarSkills(undefined), ['Sab Kuch'])
  })
  it('defaults to Sab Kuch for empty string', () => {
    assert.deepEqual(parseKarigarSkills(''), ['Sab Kuch'])
  })
  it('parses single skill', () => {
    assert.deepEqual(parseKarigarSkills('Shirt'), ['Shirt'])
  })
  it('parses comma-separated skills', () => {
    const skills = parseKarigarSkills('Shirt, Trouser/Pajama')
    assert.deepEqual(skills, ['Shirt', 'Trouser/Pajama'])
  })
  it('trims whitespace', () => {
    assert.deepEqual(parseKarigarSkills('  Shirt , Trouser/Pajama  '), ['Shirt', 'Trouser/Pajama'])
  })
  it('filters invalid skills and falls back', () => {
    assert.deepEqual(parseKarigarSkills('InvalidSkill'), ['Sab Kuch'])
  })
})

describe('formatKarigarSkills', () => {
  it('returns Sab Kuch for empty array', () => assert.equal(formatKarigarSkills([]), 'Sab Kuch'))
  it('returns Sab Kuch when Sab Kuch included', () => assert.equal(formatKarigarSkills(['Sab Kuch', 'Shirt']), 'Sab Kuch'))
  it('joins skills with comma', () => assert.equal(formatKarigarSkills(['Shirt', 'Coat']), 'Shirt, Coat'))
  it('deduplicates skills', () => assert.equal(formatKarigarSkills(['Shirt', 'Shirt']), 'Shirt'))
  it('filters invalid skills', () => assert.equal(formatKarigarSkills(['Invalid', 'Shirt']), 'Shirt'))
})

describe('canKarigarHandleGarment', () => {
  it('returns true for any garment when Sab Kuch', () => {
    assert.equal(canKarigarHandleGarment(make('Sab Kuch'), 'shirt'), true)
  })
  it('returns true for matching skill', () => {
    assert.equal(canKarigarHandleGarment(make('Shirt'), 'shirt'), true)
  })
  it('returns false for mismatched skill', () => {
    assert.equal(canKarigarHandleGarment(make('Shirt'), 'sherwani'), false)
  })
  it('returns true for other garment type', () => {
    assert.equal(canKarigarHandleGarment(make('Shirt'), 'other'), true)
  })
  it('returns true when no garment type provided', () => {
    assert.equal(canKarigarHandleGarment(make('Shirt'), undefined), true)
  })
  it('handles empty speciality (defaults to Sab Kuch)', () => {
    assert.equal(canKarigarHandleGarment(make(undefined), 'sherwani'), true)
  })
})
