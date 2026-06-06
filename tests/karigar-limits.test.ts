import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getSelectableKarigarIds, getKarigarLimitMessage } from '../src/lib/team/karigar-limits.ts'
import type { TeamMemberRecord } from '../src/lib/db/schema.ts'

function make(id: string, overrides: Partial<TeamMemberRecord> = {}): TeamMemberRecord {
  return {
    id,
    shopId: 'shop1',
    name: `Karigar ${id}`,
    phone: `0300${id.slice(0, 7)}`,
    role: 'karigar',
    pin: '123456',
    speciality: undefined,
    payRateType: undefined,
    payRate: undefined,
    isActive: 1,
    joinedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    _synced: 1,
    _deleted: 0,
    ...overrides,
  }
}

describe('getSelectableKarigarIds', () => {
  it('returns empty set for no karigars', () => {
    const ids = getSelectableKarigarIds([], 3)
    assert.equal(ids.size, 0)
  })
  it('filters out non-karigar roles', () => {
    const members = [
      make('1', { role: 'owner' }),
      make('2', { role: 'manager' }),
    ]
    assert.equal(getSelectableKarigarIds(members, 3).size, 0)
  })
  it('filters out inactive karigars', () => {
    const members = [make('1', { isActive: 0 })]
    assert.equal(getSelectableKarigarIds(members, 3).size, 0)
  })
  it('filters out deleted karigars', () => {
    const members = [make('1', { _deleted: 1 })]
    assert.equal(getSelectableKarigarIds(members, 3).size, 0)
  })
  it('returns IDs for active karigars', () => {
    const members = [make('1'), make('2')]
    const ids = getSelectableKarigarIds(members, 3)
    assert.equal(ids.size, 2)
    assert.ok(ids.has('1'))
    assert.ok(ids.has('2'))
  })
  it('respects limit', () => {
    const members = [make('1'), make('2'), make('3')]
    assert.equal(getSelectableKarigarIds(members, 2).size, 2)
  })
  it('returns all for limit >= 999', () => {
    const members = [make('1'), make('2'), make('3')]
    assert.equal(getSelectableKarigarIds(members, 999).size, 3)
  })
  it('returns none for limit <= 0', () => {
    const members = [make('1'), make('2')]
    assert.equal(getSelectableKarigarIds(members, 0).size, 0)
  })
  it('sorts by joinedAt then createdAt', () => {
    const members = [
      make('2', { joinedAt: '2026-02-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z' }),
      make('1', { joinedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]
    const ids = [...getSelectableKarigarIds(members, 2)]
    assert.equal(ids[0], '1')
    assert.equal(ids[1], '2')
  })
})

describe('getKarigarLimitMessage', () => {
  it('handles zero limit', () => {
    assert.ok(getKarigarLimitMessage(0).includes('Starter'))
  })
  it('handles negative limit', () => {
    assert.ok(getKarigarLimitMessage(-1).includes('available nahi'))
  })
  it('handles professional limit', () => {
    const msg = getKarigarLimitMessage(3)
    assert.ok(msg.includes('3'))
  })
  it('handles unlimited', () => {
    assert.ok(getKarigarLimitMessage(999).includes('unlimited'))
  })
})
