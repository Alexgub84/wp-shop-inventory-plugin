import { loadConfig, type Config } from './config.js'
import { createLogger, type Logger } from './logger.js'
import { createGreenApiSender, createMockSender, type GreenApiSender } from './greenapi/sender.js'
import { createPluginClient } from './plugin/client.js'
import type { PluginClient } from './plugin/types.js'
import { createSessionManager } from './session/manager.js'
import type { SessionManager } from './session/types.js'
import { createCommandHandler, type CommandHandler } from './commands/handler.js'
import { createWebhookHandler, type WebhookHandler } from './webhook/handler.js'
import { createAndSeedDatabase, type ConfigDatabase } from './db.js'
import { createServer } from './server.js'
import type { FastifyInstance } from 'fastify'

export interface AppDependencies {
  config: Config
  logger?: Logger
  sender: GreenApiSender
  pluginClient: PluginClient
  sessionManager: SessionManager
  commandHandler: CommandHandler
  webhookHandler: WebhookHandler
  db: ConfigDatabase
}

export interface App {
  server: FastifyInstance
  dependencies: AppDependencies
}

export function createApp(overrides?: Partial<AppDependencies>): App {
  const config = overrides?.config ?? loadConfig()
  const logger = overrides?.logger ?? createLogger('wsi-router')

  const db = overrides?.db ?? createAndSeedDatabase(
    config.dbPath,
    config.phoneNumber,
    config.shopUrl,
    config.authToken,
    logger
  )

  let sender: GreenApiSender
  if (overrides?.sender) {
    sender = overrides.sender
  } else if (config.mockMode) {
    sender = createMockSender(logger)
    logger.warn({ event: 'mock_mode_enabled' })
  } else {
    sender = createGreenApiSender(config.greenApi, logger)
  }

  const pluginClient = overrides?.pluginClient ?? createPluginClient(
    { shopUrl: config.shopUrl, authToken: config.authToken },
    logger
  )

  const sessionManager = overrides?.sessionManager ?? createSessionManager(config.sessionTimeoutMs)

  const commandHandler = overrides?.commandHandler ?? createCommandHandler({
    pluginClient,
    sessionManager,
    logger
  })

  const webhookHandler = overrides?.webhookHandler ?? createWebhookHandler({
    commandHandler,
    sender,
    config,
    logger
  })

  logger.info({ event: 'dependencies_loaded' })

  const server = createServer(config, logger, webhookHandler)

  return {
    server,
    dependencies: { config, logger, sender, pluginClient, sessionManager, commandHandler, webhookHandler, db }
  }
}
