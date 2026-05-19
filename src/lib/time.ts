export const APP_TIME_ZONE =
  process.env.NEXT_PUBLIC_TIMEZONE ??
  process.env.TIMEZONE ??
  process.env.TIMEZ ??
  'Asia/Karachi'

export function nowKarachiIso(): string {
  return new Date().toISOString()
}

export function karachiDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatKarachiDateInput(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatKarachiDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(typeof value === 'string' ? new Date(value) : value)
}

export function formatKarachiDateTimeInput(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? '00'

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
