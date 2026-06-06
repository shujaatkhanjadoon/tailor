import assert from 'node:assert/strict'
import { it } from 'node:test'
import { cn } from '../src/lib/utils.ts'

it('cn merges class names', () => {
  assert.equal(cn('a', 'b'), 'a b')
})

it('cn handles conditional classes', () => {
  assert.equal(cn('base', false && 'hidden', 'visible'), 'base visible')
})

it('cn merges tailwind classes (last wins)', () => {
  assert.equal(cn('px-4', 'px-2'), 'px-2')
})

it('cn handles clsx arrays', () => {
  assert.equal(cn(['a', 'b'], 'c'), 'a b c')
})

it('cn handles empty input', () => {
  assert.equal(cn(), '')
})
