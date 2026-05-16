import type { OrderRecord, PaymentRecord } from '@/lib/db/schema'

export function paymentAppliedAmount(payment: Pick<PaymentRecord, 'amount' | 'appliedToBalance'>): number {
  return Math.max(0, Math.min(payment.amount, payment.appliedToBalance ?? payment.amount))
}

export function paymentSurplusAmount(payment: Pick<PaymentRecord, 'amount' | 'appliedToBalance'>): number {
  return Math.max(0, payment.amount - paymentAppliedAmount(payment))
}

export function orderBalance(order: Pick<OrderRecord, 'totalPrice' | 'amountPaid'>): number {
  return Math.max(0, order.totalPrice - order.amountPaid)
}

export function orderFinancialSummary(
  order: Pick<OrderRecord, 'totalPrice' | 'amountPaid'>,
  payments: PaymentRecord[] = [],
) {
  const totals = sumPayments(payments.filter(p => p._deleted === 0))
  const effectivePaid = Math.min(order.totalPrice, totals.applied || order.amountPaid)
  const remainingBalance = Math.max(0, order.totalPrice - effectivePaid)

  return {
    totalAmount: order.totalPrice,
    advancePayment: payments
      .filter(p => p.kind === 'order_payment')
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))[0]?.amount ?? 0,
    receivedAmount: totals.received,
    appliedAmount: effectivePaid,
    remainingBalance,
    overpayment: totals.overpayments,
    tips: totals.tips,
    surplus: totals.surplus,
  }
}

export function customerFinancialSummary(orders: OrderRecord[], payments: PaymentRecord[]) {
  const activeOrders = orders.filter(o => o._deleted === 0 && o.status !== 'cancelled')
  const orderIds = new Set(activeOrders.map(o => o.id))
  const customerPayments = payments.filter(p => p._deleted === 0 && orderIds.has(p.orderId))
  const paymentTotals = sumPayments(customerPayments)
  const totalAmount = activeOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  const remainingBalance = activeOrders.reduce((sum, o) => sum + orderBalance(o), 0)

  return {
    totalAmount,
    receivedAmount: paymentTotals.received,
    appliedAmount: paymentTotals.applied,
    remainingBalance,
    overpayment: paymentTotals.overpayments,
    tips: paymentTotals.tips,
    adjustments: customerPayments
      .filter(p => /Auto-adjusted from order/i.test(p.notes ?? ''))
      .reduce((sum, p) => sum + paymentAppliedAmount(p), 0),
  }
}

export function orderPaymentProgress(order: Pick<OrderRecord, 'totalPrice' | 'amountPaid'>): number {
  if (order.totalPrice <= 0) return 0
  return Math.min(100, Math.round((order.amountPaid / order.totalPrice) * 100))
}

export function sumPayments(payments: PaymentRecord[]) {
  return payments.reduce(
    (totals, payment) => {
      const applied = paymentAppliedAmount(payment)
      const surplus = Math.max(0, payment.amount - applied)

      totals.received += payment.amount
      totals.applied += applied
      totals.surplus += surplus

      if (payment.kind === 'tip') totals.tips += surplus || payment.amount
      if (payment.kind === 'overpayment') totals.overpayments += surplus || payment.amount

      return totals
    },
    {
      received: 0,
      applied: 0,
      surplus: 0,
      tips: 0,
      overpayments: 0,
    },
  )
}
