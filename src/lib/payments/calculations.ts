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
