import { describe, it, expect, beforeEach } from 'vitest'
import { loadConfig } from '../../src/config.js'
import { ConfigError } from '../../src/errors.js'
import { createMockLogger } from '../mocks/greenapi.js'

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
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
  })

  it('should load valid config from env', () => {
    const config = loadConfig(validEnv(), mockLogger)

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

    const config = loadConfig(env, mockLogger)

    expect(config.port).toBe(3000)
    expect(config.logLevel).toBe('info')
    expect(config.mockMode).toBe(false)
    expect(config.sessionTimeoutMs).toBe(300000)
    expect(config.dbPath).toBe('./data/router.db')
  })

  it('should parse MOCK_MODE=true', () => {
    const env = validEnv()
    env.MOCK_MODE = 'true'

    const config = loadConfig(env, mockLogger)
    expect(config.mockMode).toBe(true)
  })

  it('should throw ConfigError when PHONE_NUMBER is missing', () => {
    const env = validEnv()
    delete env.PHONE_NUMBER

    expect(() => loadConfig(env, mockLogger)).toThrow(ConfigError)
  })

  it('should throw ConfigError when SHOP_URL is missing', () => {
    const env = validEnv()
    delete env.SHOP_URL

    expect(() => loadConfig(env, mockLogger)).toThrow(ConfigError)
  })

  it('should throw ConfigError when AUTH_TOKEN is missing', () => {
    const env = validEnv()
    delete env.AUTH_TOKEN

    expect(() => loadConfig(env, mockLogger)).toThrow(ConfigError)
  })

  it('should throw ConfigError when GREEN_API_INSTANCE_ID is missing', () => {
    const env = validEnv()
    delete env.GREEN_API_INSTANCE_ID

    expect(() => loadConfig(env, mockLogger)).toThrow(ConfigError)
  })

  it('should throw ConfigError when GREEN_API_TOKEN is missing', () => {
    const env = validEnv()
    delete env.GREEN_API_TOKEN

    expect(() => loadConfig(env, mockLogger)).toThrow(ConfigError)
  })

  describe('logging', () => {
    it('should log config_loaded on success', () => {
      loadConfig(validEnv(), mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'config_loaded', port: 3000, logLevel: 'info' })
      )
    })

    it('should log config_validation_failed on invalid config', () => {
      const env = validEnv()
      delete env.PHONE_NUMBER

      try { loadConfig(env, mockLogger) } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'config_validation_failed' })
      )
    })

    it('should log missing_environment_variables when env vars are undefined', () => {
      const env = validEnv()
      delete env.PHONE_NUMBER
      delete env.AUTH_TOKEN

      try { loadConfig(env, mockLogger) } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'missing_environment_variables',
          missing: expect.arrayContaining(['PHONE_NUMBER'])
        })
      )
    })
  })
})
