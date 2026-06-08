const SENSITIVE_KEYS = ['phone', 'email', 'pin', 'token', 'secret', 'password', 'otp', 'hash', 'pin_hash', 'secret_hash', 'totp_secret', 'newSecret', 'authorization', 'cookie']

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[max-depth]'
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(item => redact(item, depth + 1))
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]'
    } else if (typeof val === 'object' && val !== null) {
      result[key] = redact(val, depth + 1)
    } else {
      result[key] = val
    }
  }
  return result
}

const PREFIX = {
  info:    '[INFO]',
  warn:    '[WARN]',
  error:   '[ERROR]',
  debug:   '[DEBUG]',
  cron:    '[CRON]',
  admin:   '[ADMIN]',
  auth:    '[AUTH]',
  api:     '[API]',
} as const

type Level = keyof typeof PREFIX

function formatMessage(level: Level, module: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const prefix = PREFIX[level]
  const safeData = data !== undefined ? redact(data) : data
  const dataStr = safeData !== undefined ? ` ${JSON.stringify(safeData)}` : ''
  return `${timestamp} ${prefix} [${module}] ${message}${dataStr}`
}

function ndjson(level: Level, module: string, message: string, data?: unknown, error?: unknown): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  }
  if (data !== undefined) entry.data = redact(data)
  if (error !== undefined) {
    entry.error = error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
  }
  return JSON.stringify(entry)
}

export const logger = {
  info(module: string, message: string, data?: unknown) {
    console.info(formatMessage('info', module, message, data))
    console.info(ndjson('info', module, message, data))
  },
  warn(module: string, message: string, data?: unknown) {
    console.warn(formatMessage('warn', module, message, data))
    console.warn(ndjson('warn', module, message, data))
  },
  error(module: string, message: string, error?: unknown) {
    const errStr = error instanceof Error ? error.stack ?? error.message : String(error ?? '')
    console.error(formatMessage('error', module, message), errStr)
    console.error(ndjson('error', module, message, undefined, error))
  },
  debug(module: string, message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', module, message, data))
      console.debug(ndjson('debug', module, message, data))
    }
  },
}
