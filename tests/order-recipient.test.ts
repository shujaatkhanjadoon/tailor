import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { relationNeedsName, isParentRelation, recipientLabel, napOwnerLabel } from '../src/lib/order-recipient.ts'

describe('relationNeedsName', () => {
  it('returns false for self', () => assert.equal(relationNeedsName('self'), false))
  it('returns false for wife', () => assert.equal(relationNeedsName('wife'), false))
  it('returns false for husband', () => assert.equal(relationNeedsName('husband'), false))
  it('returns false for father', () => assert.equal(relationNeedsName('father'), false))
  it('returns false for mother', () => assert.equal(relationNeedsName('mother'), false))
  it('returns true for son', () => assert.equal(relationNeedsName('son'), true))
  it('returns true for daughter', () => assert.equal(relationNeedsName('daughter'), true))
  it('returns true for brother', () => assert.equal(relationNeedsName('brother'), true))
  it('returns true for other', () => assert.equal(relationNeedsName('other'), true))
  it('returns false for undefined', () => assert.equal(relationNeedsName(undefined), false))
  it('returns false for empty string', () => assert.equal(relationNeedsName(''), false))
})

describe('isParentRelation', () => {
  it('returns true for father', () => assert.equal(isParentRelation('father'), true))
  it('returns true for mother', () => assert.equal(isParentRelation('mother'), true))
  it('returns false for son', () => assert.equal(isParentRelation('son'), false))
  it('returns false for undefined', () => assert.equal(isParentRelation(undefined), false))
})

describe('recipientLabel', () => {
  it('returns Self for self relation', () => assert.equal(recipientLabel('self'), 'Self'))
  it('returns Self for undefined relation', () => assert.equal(recipientLabel(undefined), 'Self'))
  it('returns Wife for wife relation', () => assert.equal(recipientLabel('wife'), 'Wife'))
  it('returns Son (Ali) for son with name', () => assert.equal(recipientLabel('son', 'Ali'), 'Son (Ali)'))
  it('returns Daughter for daughter without name', () => assert.equal(recipientLabel('daughter'), 'Daughter'))
  it('returns Brother (Ahmed) for brother with name', () => assert.equal(recipientLabel('brother', 'Ahmed'), 'Brother (Ahmed)'))
  it('uses relation key as label for unknown relation', () => assert.equal(recipientLabel('cousin', 'Zayn'), 'cousin (Zayn)'))
  it('trims name whitespace', () => assert.equal(recipientLabel('son', '  Ali  '), 'Son (Ali)'))
})

describe('napOwnerLabel', () => {
  it('includes recipient and garment type', () => {
    const result = napOwnerLabel({ relation: 'self', garmentType: 'shalwar_kameez' })
    assert.ok(result.includes('Self'))
    assert.ok(result.includes('Nap'))
    assert.ok(result.includes('Shalwar Kameez'))
  })
  it('defaults garment label for unknown type', () => {
    const result = napOwnerLabel({ relation: 'son', name: 'Ali', garmentType: 'xyz' })
    assert.ok(result.includes('Son (Ali)'))
    assert.ok(result.includes('xyz'))
  })
  it('uses Kapra when no garment type', () => {
    const result = napOwnerLabel({ relation: 'self' })
    assert.ok(result.includes('Kapra'))
  })
})
