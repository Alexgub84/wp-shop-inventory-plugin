import { z } from 'zod'
import { ConfigError } from './errors.js'
import { createNoopLogger, type Logger } from './logger.js'

const coerceBooleanFromEnvVar = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === 'boolean') return val
    return val.toLowerCase() === 'true'
  })
  .default(false)

const configSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  mockMode: coerceBooleanFromEnvVar,
  sessionTimeoutMs: z.coerce.number().int().min(1000).default(300000),
  dbPath: z.string().min(1).default('./data/router.db'),
  phoneNumber: z.string({ required_error: 'PHONE_NUMBER is required' }).min(1, 'PHONE_NUMBER cannot be empty'),
  shopUrl: z.string({ required_error: 'SHOP_URL is required' }).min(1, 'SHOP_URL cannot be empty'),
  authToken: z.string({ required_error: 'AUTH_TOKEN is required' }).min(1, 'AUTH_TOKEN cannot be empty'),
  greenApi: z.object({
    instanceId: z.string({ required_error: 'GREEN_API_INSTANCE_ID is required' }).min(1, 'GREEN_API_INSTANCE_ID cannot be empty'),
    token: z.string({ required_error: 'GREEN_API_TOKEN is required' }).min(1, 'GREEN_API_TOKEN cannot be empty')
  })
})

export type Config = z.infer<typeof configSchema>

function fieldToEnvVar(field: string): string {
  const mapping: Record<string, string> = {
    'port': 'PORT',
    'logLevel': 'LOG_LEVEL',
    'mockMode': 'MOCK_MODE',
    'sessionTimeoutMs': 'SESSION_TIMEOUT_MS',
    'dbPath': 'DB_PATH',
    'phoneNumber': 'PHONE_NUMBER',
    'shopUrl': 'SHOP_URL',
    'authToken': 'AUTH_TOKEN',
    'greenApi.instanceId': 'GREEN_API_INSTANCE_ID',
    'greenApi.token': 'GREEN_API_TOKEN'
  }
  return mapping[field] || field.toUpperCase()
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, logger?: Logger): Config {
  const log = logger ?? createNoopLogger()

  const result = configSchema.safeParse({
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    mockMode: env.MOCK_MODE,
    sessionTimeoutMs: env.SESSION_TIMEOUT_MS,
    dbPath: env.DB_PATH,
    phoneNumber: env.PHONE_NUMBER,
    shopUrl: env.SHOP_URL,
    authToken: env.AUTH_TOKEN,
    greenApi: {
      instanceId: env.GREEN_API_INSTANCE_ID,
      token: env.GREEN_API_TOKEN
    }
  })

  if (!result.success) {
    const missingVars: string[] = []
    const errors = result.error.errors.map(e => {
      const field = e.path.join('.')
      const envVarName = fieldToEnvVar(field)
      if (e.code === 'invalid_type' && e.received === 'undefined') {
        missingVars.push(envVarName)
      }
      return { field, envVar: envVarName, message: e.message }
    })

    log.error({ event: 'config_validation_failed', errors })

    if (missingVars.length > 0) {
      log.error({
        event: 'missing_environment_variables',
        missing: missingVars,
        hint: 'Add these variables to your .env file'
      })
    }

    const firstError = result.error.errors[0]
    const field = firstError.path.join('.')
    throw new ConfigError(firstError.message, field)
  }

  log.info({ event: 'config_loaded', port: result.data.port, logLevel: result.data.logLevel })
  return result.data
}
