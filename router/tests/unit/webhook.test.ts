import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWebhookHandler } from '../../src/webhook/handler.js'
import { WebhookError } from '../../src/errors.js'
import type { CommandHandler } from '../../src/commands/handler.js'
import type { Config } from '../../src/config.js'
import { createMockSender, createMockLogger, createValidWebhookPayload, createExtendedTextPayload, createButtonReplyPayload } from '../mocks/greenapi.js'

function createTestConfig(overrides?: Partial<Config>): Config {
  return {
    port: 3000,
    logLevel: 'silent',
    mockMode: true,
    sessionTimeoutMs: 300000,
    dbPath: ':memory:',
    phoneNumber: '972501234567',
    shopUrl: 'https://test-shop.com',
    authToken: 'test-token',
    greenApi: { instanceId: 'test', token: 'test' },
    ...overrides
  }
}

describe('WebhookHandler', () => {
  let mockSender: ReturnType<typeof createMockSender>
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockCommandHandler: CommandHandler
  let config: Config

  beforeEach(() => {
    mockSender = createMockSender()
    mockLogger = createMockLogger()
    mockCommandHandler = {
      process: vi.fn().mockResolvedValue({ type: 'text', response: 'OK' })
    }
    config = createTestConfig()
  })

  function createHandler() {
    return createWebhookHandler({
      commandHandler: mockCommandHandler,
      sender: mockSender,
      config,
      logger: mockLogger
    })
  }

  describe('handle', () => {
    it('should process text message and send via sendMessage', async () => {
      vi.mocked(mockCommandHandler.process).mockResolvedValue({ type: 'text', response: 'Product list here' })

      const handler = createHandler()
      const payload = createValidWebhookPayload('1')

      const result = await handler.handle(payload)

      expect(result.handled).toBe(true)
      expect(result.action).toBe('command_processed')
      expect(mockCommandHandler.process).toHaveBeenCalledWith('972501234567@c.us', '1')
      expect(mockSender.sendMessage).toHaveBeenCalledWith('972501234567@c.us', 'Product list here')
    })

    it('should send buttons when command returns buttons result', async () => {
      vi.mocked(mockCommandHandler.process).mockResolvedValue({
        type: 'buttons',
        body: 'Pick one',
        buttons: [{ buttonId: 'list', buttonText: '📦 List' }],
        footer: 'Tap a button'
      })

      const handler = createHandler()
      const payload = createValidWebhookPayload('menu')

      const result = await handler.handle(payload)

      expect(result.handled).toBe(true)
      expect(mockSender.sendButtons).toHaveBeenCalledWith({
        chatId: '972501234567@c.us',
        body: 'Pick one',
        buttons: [{ buttonId: 'list', buttonText: '📦 List' }],
        footer: 'Tap a button'
      })
      expect(mockSender.sendMessage).not.toHaveBeenCalled()
    })

    it('should process extended text messages', async () => {
      vi.mocked(mockCommandHandler.process).mockResolvedValue({ type: 'text', response: 'Menu' })

      const handler = createHandler()
      const payload = createExtendedTextPayload('menu')

      const result = await handler.handle(payload)

      expect(result.handled).toBe(true)
      expect(mockCommandHandler.process).toHaveBeenCalledWith('972501234567@c.us', 'menu')
    })

    it('should process button reply messages', async () => {
      vi.mocked(mockCommandHandler.process).mockResolvedValue({ type: 'text', response: 'Products...' })

      const handler = createHandler()
      const payload = createButtonReplyPayload('list')

      const result = await handler.handle(payload)

      expect(result.handled).toBe(true)
      expect(result.action).toBe('command_processed')
      expect(mockCommandHandler.process).toHaveBeenCalledWith('972501234567@c.us', 'list')
    })

    it('should send funny message to unregistered phone number', async () => {
      const handler = createHandler()
      const payload = createValidWebhookPayload('1', 'wrong-number@c.us')

      const result = await handler.handle(payload)

      expect(result.handled).toBe(true)
      expect(result.action).toBe('unregistered_replied')
      expect(mockCommandHandler.process).not.toHaveBeenCalled()
      expect(mockSender.sendMessage).toHaveBeenCalledWith(
        'wrong-number@c.us',
        expect.stringContaining('Shop Inventory plugin')
      )
    })

    it('should ignore non-incomingMessageReceived webhooks', async () => {
      const handler = createHandler()
      const payload = {
        ...createValidWebhookPayload('test'),
        typeWebhook: 'outgoingMessageReceived'
      }

      const result = await handler.handle(payload)

      expect(result.handled).toBe(false)
      expect(result.action).toBe('ignored_webhook_type')
      expect(mockCommandHandler.process).not.toHaveBeenCalled()
    })

    it('should ignore unsupported message types', async () => {
      const handler = createHandler()
      const payload = {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 123, wid: '123@c.us' },
        senderData: { chatId: '972501234567@c.us', sender: '972501234567@c.us' },
        messageData: { typeMessage: 'audioMessage' },
        idMessage: 'MSG-123'
      }

      const result = await handler.handle(payload)

      expect(result.handled).toBe(false)
      expect(result.action).toBe('ignored_unsupported')
      expect(mockCommandHandler.process).not.toHaveBeenCalled()
    })
  })

  describe('invalid payloads', () => {
    it('should throw WebhookError for missing chatId', async () => {
      const handler = createHandler()
      const payload = {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 123, wid: 'test' },
        senderData: { sender: 'test' },
        messageData: { typeMessage: 'textMessage' },
        idMessage: 'ABC'
      }

      await expect(handler.handle(payload)).rejects.toThrow(WebhookError)
    })

    it('should throw WebhookError for missing idMessage', async () => {
      const handler = createHandler()
      const payload = {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 123, wid: 'test' },
        senderData: { chatId: 'test@c.us', sender: 'test' },
        messageData: { typeMessage: 'textMessage' }
      }

      await expect(handler.handle(payload)).rejects.toThrow(WebhookError)
    })

    it('should throw WebhookError for completely invalid payload', async () => {
      const handler = createHandler()

      await expect(handler.handle({ invalid: 'data' })).rejects.toThrow(WebhookError)
    })

    it('should log parse error', async () => {
      const handler = createHandler()

      try {
        await handler.handle({ invalid: 'data' })
      } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'webhook_parse_error' })
      )
    })
  })

  describe('logging', () => {
    it('should log webhook received event', async () => {
      vi.mocked(mockCommandHandler.process).mockResolvedValue({ type: 'text', response: 'OK' })

      const handler = createHandler()
      await handler.handle(createValidWebhookPayload('test'))

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'webhook_received',
          phone: '972501234567@c.us'
        })
      )
    })

    it('should log command processed event', async () => {
      vi.mocked(mockCommandHandler.process).mockResolvedValue({ type: 'text', response: 'OK' })

      const handler = createHandler()
      await handler.handle(createValidWebhookPayload('test'))

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'command_processed',
          handled: true
        })
      )
    })

    it('should log warn on ignored webhook type', async () => {
      const handler = createHandler()
      const payload = {
        ...createValidWebhookPayload('test'),
        typeWebhook: 'outgoingMessageReceived'
      }

      await handler.handle(payload)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'ignored_webhook_type', typeWebhook: 'outgoingMessageReceived' })
      )
    })

    it('should log warn on unregistered number', async () => {
      const handler = createHandler()
      await handler.handle(createValidWebhookPayload('hi', 'stranger@c.us'))

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'unregistered_number', chatId: 'stranger@c.us' })
      )
    })

    it('should log warn on unsupported message type', async () => {
      const handler = createHandler()
      const payload = {
        typeWebhook: 'incomingMessageReceived',
        instanceData: { idInstance: 123, wid: '123@c.us' },
        senderData: { chatId: '972501234567@c.us', sender: '972501234567@c.us' },
        messageData: { typeMessage: 'audioMessage' },
        idMessage: 'MSG-123'
      }

      await handler.handle(payload)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'ignored_unsupported', typeMessage: 'audioMessage' })
      )
    })
  })
})
