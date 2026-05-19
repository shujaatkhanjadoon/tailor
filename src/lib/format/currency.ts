export function formatAmount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '0'
  return Math.round(amount).toLocaleString('en-PK')
}

export function formatRupees(value: number | string | null | undefined): string {
  return `Rs. ${formatAmount(value)}`
}
