import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createAndSeedDatabase, createDatabase, seedDatabase, type ConfigDatabase } from '../../src/db.js'
import { createMockLogger } from '../mocks/greenapi.js'
import Database from 'better-sqlite3'

describe('Database', () => {
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
  })

  describe('createDatabase', () => {
    let db: ConfigDatabase

    afterEach(() => {
      db?.close()
    })

    it('should create the config table', () => {
      db = createDatabase(':memory:', mockLogger)
      const config = db.getConfig()
      expect(config).toBeUndefined()
    })

    it('should log database_initialized', () => {
      db = createDatabase(':memory:', mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'database_initialized', path: ':memory:' })
      )
    })
  })

  describe('seedDatabase', () => {
    let rawDb: InstanceType<typeof Database>

    beforeEach(() => {
      rawDb = new Database(':memory:')
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          phone_number TEXT NOT NULL,
          shop_url TEXT NOT NULL,
          auth_token TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
    })

    afterEach(() => {
      rawDb?.close()
    })

    it('should insert config row', () => {
      seedDatabase(rawDb, '972501234567', 'https://shop.com', 'token-123', mockLogger)

      const row = rawDb.prepare('SELECT * FROM config WHERE id = 1').get() as { phone_number: string } | undefined
      expect(row).toBeDefined()
      expect(row!.phone_number).toBe('972501234567')
    })

    it('should log database_seeded on insert', () => {
      seedDatabase(rawDb, '972501234567', 'https://shop.com', 'token-123', mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'database_seeded', phoneNumber: '972501234567', shopUrl: 'https://shop.com' })
      )
    })

    it('should skip seed if config already exists', () => {
      seedDatabase(rawDb, '972501234567', 'https://shop.com', 'token-123', mockLogger)
      mockLogger.info.mockClear()

      seedDatabase(rawDb, '999999999', 'https://other.com', 'other-token', mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'database_config_exists' })
      )

      const row = rawDb.prepare('SELECT * FROM config WHERE id = 1').get() as { phone_number: string }
      expect(row.phone_number).toBe('972501234567')
    })
  })

  describe('createAndSeedDatabase', () => {
    let db: ConfigDatabase

    afterEach(() => {
      db?.close()
    })

    it('should create DB with seeded config and return it via getConfig', () => {
      db = createAndSeedDatabase(':memory:', '972501234567', 'https://shop.com', 'token-123', mockLogger)

      const config = db.getConfig()
      expect(config).toBeDefined()
      expect(config!.phoneNumber).toBe('972501234567')
      expect(config!.shopUrl).toBe('https://shop.com')
      expect(config!.authToken).toBe('token-123')
      expect(config!.id).toBe(1)
      expect(config!.createdAt).toBeTruthy()
    })

    it('should log database_seeded', () => {
      db = createAndSeedDatabase(':memory:', '972501234567', 'https://shop.com', 'token-123', mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'database_seeded' })
      )
    })
  })
})
