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
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : ''
  return `${timestamp} ${prefix} [${module}] ${message}${dataStr}`
}

export const logger = {
  info(module: string, message: string, data?: unknown) {
    console.log(formatMessage('info', module, message, data))
  },
  warn(module: string, message: string, data?: unknown) {
    console.warn(formatMessage('warn', module, message, data))
  },
  error(module: string, message: string, error?: unknown) {
    const errStr = error instanceof Error ? error.stack ?? error.message : String(error ?? '')
    console.error(formatMessage('error', module, message), errStr)
  },
  debug(module: string, message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', module, message, data))
    }
  },
}
