import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  customerFinancialSummary,
  orderBalance,
  orderFinancialSummary,
  orderPaymentProgress,
  paymentAppliedAmount,
  paymentSurplusAmount,
  sumPayments,
} from '../src/lib/payments/calculations.ts'
import type { OrderRecord, PaymentRecord } from '../src/lib/db/schema.ts'

const baseOrder: OrderRecord = {
  id: 'order-1',
  shopId: 'shop-1',
  orderNumber: 1,
  trackingCode: 'ABC123',
  customerId: 'customer-1',
  customerName: 'Ali',
  customerPhone: '03001234567',
  garmentType: 'shalwar_kameez',
  status: 'received',
  totalPrice: 1000,
  amountPaid: 300,
  isUrgent: 0,
  dueDate: '2026-06-10',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  _synced: 1,
  _deleted: 0,
}

function payment(patch: Partial<PaymentRecord>): PaymentRecord {
  return {
    id: patch.id ?? crypto.randomUUID(),
    shopId: 'shop-1',
    orderId: 'order-1',
    amount: 0,
    method: 'cash',
    recordedBy: 'member-1',
    paidAt: '2026-06-01T00:00:00.000Z',
    _synced: 1,
    _deleted: 0,
    ...patch,
  }
}

describe('payment calculations', () => {
  it('caps applied amount between zero and payment amount', () => {
    assert.equal(paymentAppliedAmount(payment({ amount: 500 })), 500)
    assert.equal(paymentAppliedAmount(payment({ amount: 500, appliedToBalance: 300 })), 300)
    assert.equal(paymentAppliedAmount(payment({ amount: 500, appliedToBalance: 900 })), 500)
    assert.equal(paymentAppliedAmount(payment({ amount: 500, appliedToBalance: -10 })), 0)
  })

  it('calculates surplus and order balance without negative values', () => {
    assert.equal(paymentSurplusAmount(payment({ amount: 500, appliedToBalance: 300 })), 200)
    assert.equal(paymentSurplusAmount(payment({ amount: 500, appliedToBalance: 700 })), 0)
    assert.equal(orderBalance({ totalPrice: 1000, amountPaid: 250 }), 750)
    assert.equal(orderBalance({ totalPrice: 1000, amountPaid: 1200 }), 0)
  })

  it('sums received, applied, surplus, tips, and overpayments', () => {
    const totals = sumPayments([
      payment({ amount: 400, appliedToBalance: 400, kind: 'order_payment' }),
      payment({ amount: 150, appliedToBalance: 100, kind: 'overpayment' }),
      payment({ amount: 50, appliedToBalance: 0, kind: 'tip' }),
    ])

    assert.deepEqual(totals, {
      received: 600,
      applied: 500,
      surplus: 100,
      tips: 50,
      overpayments: 50,
    })
  })

  it('builds order financial summary from active payments', () => {
    const summary = orderFinancialSummary(baseOrder, [
      payment({ id: 'p1', amount: 300, appliedToBalance: 300, kind: 'order_payment', paidAt: '2026-06-01T00:00:00.000Z' }),
      payment({ id: 'p2', amount: 900, appliedToBalance: 700, kind: 'overpayment', paidAt: '2026-06-02T00:00:00.000Z' }),
      payment({ id: 'p3', amount: 100, appliedToBalance: 100, _deleted: 1 }),
    ])

    assert.equal(summary.totalAmount, 1000)
    assert.equal(summary.advancePayment, 300)
    assert.equal(summary.receivedAmount, 1200)
    assert.equal(summary.appliedAmount, 1000)
    assert.equal(summary.remainingBalance, 0)
    assert.equal(summary.overpayment, 200)
  })

  it('calculates customer summary from active, non-cancelled orders', () => {
    const cancelled = { ...baseOrder, id: 'order-2', status: 'cancelled' as const, totalPrice: 500, amountPaid: 500 }
    const summary = customerFinancialSummary([baseOrder, cancelled], [
      payment({ orderId: 'order-1', amount: 300, appliedToBalance: 300 }),
      payment({ orderId: 'order-2', amount: 500, appliedToBalance: 500 }),
    ])

    assert.equal(summary.totalAmount, 1000)
    assert.equal(summary.receivedAmount, 300)
    assert.equal(summary.appliedAmount, 300)
    assert.equal(summary.remainingBalance, 700)
  })

  it('calculates order payment progress', () => {
    assert.equal(orderPaymentProgress({ totalPrice: 1000, amountPaid: 250 }), 25)
    assert.equal(orderPaymentProgress({ totalPrice: 1000, amountPaid: 1250 }), 100)
    assert.equal(orderPaymentProgress({ totalPrice: 0, amountPaid: 100 }), 0)
  })
})
