import { describe, it, expect } from 'vitest'
import { loadConfig } from '../../src/config.js'
import { ConfigError } from '../../src/errors.js'

function validEnv(): Record<string, string> {
  return {
    PORT: '3000',
    LOG_LEVEL: 'info',
    MOCK_MODE: 'false',
    SESSION_TIMEOUT_MS: '300000',
    DB_PATH: './data/test.db',
    PHONE_NUMBER: '972501234567',
    SHOP_URL: 'https://my-shop.com',
    AUTH_TOKEN: 'test-token-123',
    GREEN_API_INSTANCE_ID: 'instance-123',
    GREEN_API_TOKEN: 'green-token-456'
  }
}

describe('loadConfig', () => {
  it('should load valid config from env', () => {
    const config = loadConfig(validEnv())

    expect(config.port).toBe(3000)
    expect(config.logLevel).toBe('info')
    expect(config.mockMode).toBe(false)
    expect(config.sessionTimeoutMs).toBe(300000)
    expect(config.phoneNumber).toBe('972501234567')
    expect(config.shopUrl).toBe('https://my-shop.com')
    expect(config.authToken).toBe('test-token-123')
    expect(config.greenApi.instanceId).toBe('instance-123')
    expect(config.greenApi.token).toBe('green-token-456')
  })

  it('should apply defaults for optional fields', () => {
    const env = validEnv()
    delete env.PORT
    delete env.LOG_LEVEL
    delete env.MOCK_MODE
    delete env.SESSION_TIMEOUT_MS
    delete env.DB_PATH

    const config = loadConfig(env)

    expect(config.port).toBe(3000)
    expect(config.logLevel).toBe('info')
    expect(config.mockMode).toBe(false)
    expect(config.sessionTimeoutMs).toBe(300000)
    expect(config.dbPath).toBe('./data/router.db')
  })

  it('should parse MOCK_MODE=true', () => {
    const env = validEnv()
    env.MOCK_MODE = 'true'

    const config = loadConfig(env)
    expect(config.mockMode).toBe(true)
  })

  it('should throw ConfigError when PHONE_NUMBER is missing', () => {
    const env = validEnv()
    delete env.PHONE_NUMBER

    expect(() => loadConfig(env)).toThrow(ConfigError)
  })

  it('should throw ConfigError when SHOP_URL is missing', () => {
    const env = validEnv()
    delete env.SHOP_URL

    expect(() => loadConfig(env)).toThrow(ConfigError)
  })

  it('should throw ConfigError when AUTH_TOKEN is missing', () => {
    const env = validEnv()
    delete env.AUTH_TOKEN

    expect(() => loadConfig(env)).toThrow(ConfigError)
  })

  it('should throw ConfigError when GREEN_API_INSTANCE_ID is missing', () => {
    const env = validEnv()
    delete env.GREEN_API_INSTANCE_ID

    expect(() => loadConfig(env)).toThrow(ConfigError)
  })

  it('should throw ConfigError when GREEN_API_TOKEN is missing', () => {
    const env = validEnv()
    delete env.GREEN_API_TOKEN

    expect(() => loadConfig(env)).toThrow(ConfigError)
  })
})
