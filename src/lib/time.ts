export const APP_TIME_ZONE = 'Asia/Karachi'

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

export function formatKarachiDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(typeof value === 'string' ? new Date(value) : value)
}
