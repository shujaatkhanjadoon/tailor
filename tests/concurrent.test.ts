import assert from 'node:assert/strict'
import test from 'node:test'
import { mapConcurrent } from '../src/lib/concurrent.ts'

test('mapConcurrent: processes all items with no errors', async () => {
  const processed: number[] = []
  const errors = await mapConcurrent([1, 2, 3], async (n) => {
    processed.push(n)
  })
  assert.equal(errors.length, 0)
  assert.equal(processed.length, 3)
  assert.deepEqual(processed.sort(), [1, 2, 3])
})

test('mapConcurrent: collects errors from failing items', async () => {
  const errors = await mapConcurrent([1, 2, 3], async (n) => {
    if (n === 2) throw new Error('item 2 failed')
  })
  assert.equal(errors.length, 1)
  assert.ok(errors[0].includes('item 2 failed'))
})

test('mapConcurrent: all items fail', async () => {
  const errors = await mapConcurrent([1, 2], async () => {
    throw new Error('always fails')
  })
  assert.equal(errors.length, 2)
})

test('mapConcurrent: empty array', async () => {
  const errors = await mapConcurrent([], async () => {
    throw new Error('should not run')
  })
  assert.equal(errors.length, 0)
})

test('mapConcurrent: respects concurrency limit', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const errors = await mapConcurrent(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 10))
      inFlight--
    },
    3,
  )
  assert.equal(errors.length, 0)
  assert.equal(maxInFlight, 3, 'should not exceed concurrency of 3')
})

test('mapConcurrent: single item batch', async () => {
  let count = 0
  const errors = await mapConcurrent(['only'], async () => {
    count++
  }, 1)
  assert.equal(errors.length, 0)
  assert.equal(count, 1)
})
