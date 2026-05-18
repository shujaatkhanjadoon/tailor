import type { GarmentType, OrderRecipientRelation } from '@/types'
import { GARMENT_LABELS } from '@/types'

const LABELS: Record<string, string> = {
  self: 'Self',
  wife: 'Wife',
  husband: 'Husband',
  son: 'Son',
  daughter: 'Daughter',
  brother: 'Brother',
  sister: 'Sister',
  father: 'Father',
  mother: 'Mother',
  other: 'Other',
}

export function relationNeedsName(relation?: string): boolean {
  return !!relation && !['self', 'wife', 'husband'].includes(relation)
}

export function recipientLabel(
  relation?: OrderRecipientRelation | string,
  name?: string | null,
): string {
  const normalized = relation || 'self'
  const label = LABELS[normalized] ?? normalized
  const cleanName = name?.trim()
  if (normalized === 'self') return 'Self'
  return relationNeedsName(normalized) && cleanName
    ? `${label} (${cleanName})`
    : label
}

export function napOwnerLabel(opts: {
  relation?: OrderRecipientRelation | string
  name?: string | null
  garmentType?: GarmentType | string
}): string {
  const garment = opts.garmentType
    ? GARMENT_LABELS[opts.garmentType as GarmentType]?.label ?? opts.garmentType
    : 'Kapra'
  return `${recipientLabel(opts.relation, opts.name)} - Nap (${garment})`
}
