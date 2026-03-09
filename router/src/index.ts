import 'dotenv/config'
import { createApp } from './app.js'
import { logger } from './logger.js'
import { ConfigError } from './errors.js'

const REQUIRED_VARS = ['PHONE_NUMBER', 'SHOP_URL', 'AUTH_TOKEN', 'GREEN_API_INSTANCE_ID', 'GREEN_API_TOKEN'] as const
const OPTIONAL_VARS = ['PORT', 'LOG_LEVEL', 'MOCK_MODE', 'SESSION_TIMEOUT_MS', 'DB_PATH'] as const
const SECRET_VARS = new Set(['AUTH_TOKEN', 'GREEN_API_TOKEN', 'GREEN_API_INSTANCE_ID'])

function maskValue(name: string, value: string): string {
  if (SECRET_VARS.has(name)) {
    return value.length <= 4 ? '***' : `${value.slice(0, 2)}...${value.slice(-2)}`
  }
  return value
}

function logEnvDiagnostics(): void {
  logger.info({ event: 'startup_diagnostics', nodeVersion: process.version, env: process.env.NODE_ENV ?? 'undefined' })

  const present: Record<string, string> = {}
  const missing: string[] = []

  for (const name of REQUIRED_VARS) {
    const val = process.env[name]
    if (val) {
      present[name] = maskValue(name, val)
    } else {
      missing.push(name)
    }
  }

  const optional: Record<string, string> = {}
  for (const name of OPTIONAL_VARS) {
    const val = process.env[name]
    if (val) optional[name] = val
  }

  logger.info({ event: 'env_check', required: present, optional })

  if (missing.length > 0) {
    logger.error({ event: 'env_missing', missing, hint: 'Set these in Railway Variables or .env' })
  }
}

async function main() {
  logEnvDiagnostics()

  let server, dependencies

  try {
    const app = createApp()
    server = app.server
    dependencies = app.dependencies
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error({
        event: 'startup_failed',
        reason: 'configuration_error',
        message: err.message,
        field: err.field
      })
    } else {
      logger.error({ event: 'startup_failed', error: err })
    }
    process.exit(1)
  }

  const { config } = dependencies

  try {
    await server.listen({ port: config.port, host: '0.0.0.0' })
    logger.info({ event: 'server_started', port: config.port })
  } catch (err) {
    logger.error({ event: 'server_start_failed', error: err })
    process.exit(1)
  }
}

main()
