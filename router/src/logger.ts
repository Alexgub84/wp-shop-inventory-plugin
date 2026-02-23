import { pino } from 'pino'

export interface Logger {
  info(obj: object, msg?: string): void
  warn(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
}

const noopFn = () => {}

const noopLogger: Logger = {
  info: noopFn,
  warn: noopFn,
  error: noopFn
}

export function createNoopLogger(): Logger {
  return noopLogger
}

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
      level: (label: string) => ({ level: label })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['*.token', '*.apiKey', '*.secret', '*.password', '*.authToken'],
      censor: '[REDACTED]'
    }
  })
}

export const logger = createLogger('wsi-router')
