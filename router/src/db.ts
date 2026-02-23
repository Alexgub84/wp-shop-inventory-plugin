import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { createNoopLogger, type Logger } from './logger.js'

export interface ShopConfig {
  id: number
  phoneNumber: string
  shopUrl: string
  authToken: string
  createdAt: string
}

export interface ConfigDatabase {
  getConfig(): ShopConfig | undefined
  close(): void
}

export function createDatabase(dbPath: string, logger?: Logger): ConfigDatabase {
  const log = logger ?? createNoopLogger()

  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      phone_number TEXT NOT NULL,
      shop_url TEXT NOT NULL,
      auth_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  log.info({ event: 'database_initialized', path: dbPath })

  function getConfig(): ShopConfig | undefined {
    const row = db.prepare('SELECT * FROM config WHERE id = 1').get() as
      | { id: number; phone_number: string; shop_url: string; auth_token: string; created_at: string }
      | undefined

    if (!row) return undefined

    return {
      id: row.id,
      phoneNumber: row.phone_number,
      shopUrl: row.shop_url,
      authToken: row.auth_token,
      createdAt: row.created_at
    }
  }

  function close(): void {
    db.close()
  }

  return { getConfig, close }
}

export function seedDatabase(
  db: Database.Database,
  phoneNumber: string,
  shopUrl: string,
  authToken: string,
  logger?: Logger
): void {
  const log = logger ?? createNoopLogger()

  const existing = db.prepare('SELECT id FROM config WHERE id = 1').get()
  if (existing) {
    log.info({ event: 'database_config_exists', message: 'Config row already exists, skipping seed' })
    return
  }

  db.prepare(
    'INSERT INTO config (id, phone_number, shop_url, auth_token) VALUES (1, ?, ?, ?)'
  ).run(phoneNumber, shopUrl, authToken)

  log.info({ event: 'database_seeded', phoneNumber, shopUrl })
}

export function createAndSeedDatabase(
  dbPath: string,
  phoneNumber: string,
  shopUrl: string,
  authToken: string,
  logger?: Logger
): ConfigDatabase {
  const log = logger ?? createNoopLogger()

  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      phone_number TEXT NOT NULL,
      shop_url TEXT NOT NULL,
      auth_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  seedDatabase(db, phoneNumber, shopUrl, authToken, log)

  function getConfig(): ShopConfig | undefined {
    const row = db.prepare('SELECT * FROM config WHERE id = 1').get() as
      | { id: number; phone_number: string; shop_url: string; auth_token: string; created_at: string }
      | undefined

    if (!row) return undefined

    return {
      id: row.id,
      phoneNumber: row.phone_number,
      shopUrl: row.shop_url,
      authToken: row.auth_token,
      createdAt: row.created_at
    }
  }

  function close(): void {
    db.close()
  }

  return { getConfig, close }
}
