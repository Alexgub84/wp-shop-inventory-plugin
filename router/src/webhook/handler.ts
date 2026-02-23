import { WebhookError } from '../errors.js'
import { createNoopLogger, type Logger } from '../logger.js'
import type { GreenApiSender } from '../greenapi/sender.js'
import type { CommandHandler } from '../commands/handler.js'
import type { Config } from '../config.js'
import { incomingMessageSchema, extractMessageContent, type IncomingMessage } from './types.js'

export interface WebhookHandlerDeps {
  commandHandler: CommandHandler
  sender: GreenApiSender
  config: Config
  logger?: Logger
}

export interface WebhookHandlerResult {
  handled: boolean
  action?: 'command_processed' | 'ignored_unsupported' | 'ignored_webhook_type' | 'ignored_wrong_number'
}

export function createWebhookHandler(deps: WebhookHandlerDeps) {
  const { commandHandler, sender, config } = deps
  const logger = deps.logger ?? createNoopLogger()

  function parsePayload(body: unknown): IncomingMessage {
    const result = incomingMessageSchema.safeParse(body)
    if (!result.success) {
      const field = result.error.errors[0]?.path.join('.') ?? 'unknown'
      logger.error({ event: 'webhook_parse_error', error: result.error.message, field })
      throw new WebhookError(`Invalid webhook payload: ${result.error.message}`, field)
    }
    return result.data
  }

  async function handle(body: unknown): Promise<WebhookHandlerResult> {
    const payload = parsePayload(body)

    logger.info({
      event: 'webhook_received',
      phone: payload.senderData.chatId,
      messageId: payload.idMessage,
      typeWebhook: payload.typeWebhook,
      typeMessage: payload.messageData.typeMessage
    })

    if (payload.typeWebhook !== 'incomingMessageReceived') {
      logger.warn({ event: 'ignored_webhook_type', typeWebhook: payload.typeWebhook })
      return { handled: false, action: 'ignored_webhook_type' }
    }

    const chatId = payload.senderData.chatId
    const expectedChatId = `${config.phoneNumber}@c.us`

    if (chatId !== expectedChatId) {
      logger.warn({ event: 'ignored_wrong_number', chatId, expected: expectedChatId })
      return { handled: false, action: 'ignored_wrong_number' }
    }

    const extractedMessage = extractMessageContent(payload)

    if (extractedMessage === null) {
      logger.warn({
        event: 'ignored_unsupported',
        typeMessage: payload.messageData.typeMessage,
        chatId
      })
      return { handled: false, action: 'ignored_unsupported' }
    }

    const result = await commandHandler.process(chatId, extractedMessage.content)

    await sender.sendMessage(chatId, result.response)

    logger.info({ event: 'command_processed', chatId, handled: true })
    return { handled: true, action: 'command_processed' }
  }

  return { handle, parsePayload }
}

export type WebhookHandler = ReturnType<typeof createWebhookHandler>
