import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp, type App } from '../../src/app.js'
import { createMockPluginClient, createMockProduct } from '../mocks/plugin.js'
import { createMockSender } from '../mocks/greenapi.js'
import type { Config } from '../../src/config.js'

const PHONE = '972501234567'
const CHAT_ID = `${PHONE}@c.us`

function createTestConfig(): Config {
  return {
    port: 0,
    logLevel: 'silent',
    mockMode: true,
    sessionTimeoutMs: 300000,
    dbPath: ':memory:',
    phoneNumber: PHONE,
    shopUrl: 'https://test-shop.com',
    authToken: 'test-token',
    greenApi: { instanceId: 'test', token: 'test' }
  }
}

function createWebhookPayload(text: string) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: 'bot@c.us' },
    senderData: { chatId: CHAT_ID, sender: CHAT_ID },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: text }
    },
    idMessage: `MSG-${Date.now()}-${Math.random()}`
  }
}

function createButtonReplyPayload(selectedId: string) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: 'bot@c.us' },
    senderData: { chatId: CHAT_ID, sender: CHAT_ID },
    messageData: {
      typeMessage: 'templateButtonsReplyMessage',
      templateButtonReplyMessage: {
        stanzaId: 'STANZA-123',
        selectedIndex: 0,
        selectedId,
        selectedDisplayText: `Button ${selectedId}`
      }
    },
    idMessage: `MSG-BTN-${Date.now()}-${Math.random()}`
  }
}

describe('E2E: Router Webhook Flow', () => {
  let app: App
  let server: FastifyInstance
  let pluginClient: ReturnType<typeof createMockPluginClient>
  let sender: ReturnType<typeof createMockSender>

  beforeAll(async () => {
    pluginClient = createMockPluginClient()
    sender = createMockSender()

    app = createApp({
      config: createTestConfig(),
      pluginClient,
      sender
    })
    server = app.server
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
    app.dependencies.db.close()
  })

  describe('health check', () => {
    it('should return ok status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeDefined()
    })
  })

  describe('menu command', () => {
    it('should send buttons when sending "menu"', async () => {
      sender.sendButtons.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('menu')
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.ok).toBe(true)
      expect(body.handled).toBe(true)
      expect(body.action).toBe('command_processed')

      expect(sender.sendButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: CHAT_ID,
          buttons: expect.arrayContaining([
            expect.objectContaining({ buttonId: 'list' }),
            expect.objectContaining({ buttonId: 'add' })
          ])
        })
      )
    })
  })

  describe('button reply flow', () => {
    it('should handle button reply for list products', async () => {
      sender.sendMessage.mockClear()
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'BtnWidget', price: '5.00', stock_quantity: 10 })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createButtonReplyPayload('list')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('BtnWidget')
      )
    })
  })

  describe('list products', () => {
    it('should fetch and format products when sending "1"', async () => {
      sender.sendMessage.mockClear()
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'Widget', price: '19.99', stock_quantity: 50 }),
        createMockProduct({ id: 2, name: 'Gadget', price: '9.99', stock_quantity: 0 })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('1')
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.handled).toBe(true)

      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Widget')
      )
    })
  })

  describe('add product multi-turn flow', () => {
    it('should complete full add product conversation', async () => {
      sender.sendMessage.mockClear()

      const step1 = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('2')
      })
      expect(step1.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )

      const step2 = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('Blue Widget')
      })
      expect(step2.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('price')
      )

      const step3 = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('29.99')
      })
      expect(step3.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('stock')
      )

      const step4 = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('50')
      })
      expect(step4.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('✅')
      )

      expect(pluginClient.createProduct).toHaveBeenCalledWith({
        name: 'Blue Widget',
        regular_price: '29.99',
        stock_quantity: 50
      })
    })

    it('should handle cancel mid-flow', async () => {
      sender.sendMessage.mockClear()

      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('2')
      })

      const cancelResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('cancel')
      })

      expect(cancelResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('cancelled')
      )

      sender.sendButtons.mockClear()
      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('menu')
      })
      expect(sender.sendButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: CHAT_ID,
          buttons: expect.arrayContaining([
            expect.objectContaining({ buttonId: 'list' })
          ])
        })
      )
    })
  })

  describe('unknown command', () => {
    it('should return buttons with hint for unrecognized input', async () => {
      sender.sendButtons.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('gibberish')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
      expect(sender.sendButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: CHAT_ID,
          body: expect.stringContaining("didn't quite get that")
        })
      )
    })
  })

  describe('unregistered phone number', () => {
    it('should send funny message to unknown numbers', async () => {
      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          typeWebhook: 'incomingMessageReceived',
          instanceData: { idInstance: 123, wid: 'bot@c.us' },
          senderData: { chatId: 'unknown@c.us', sender: 'unknown@c.us' },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'menu' }
          },
          idMessage: 'MSG-WRONG'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
      expect(response.json().action).toBe('unregistered_replied')
      expect(sender.sendMessage).toHaveBeenCalledWith(
        'unknown@c.us',
        expect.stringContaining('Shop Inventory plugin')
      )
    })
  })

  describe('button reply triggering add product', () => {
    it('should start add product flow via button reply', async () => {
      sender.sendMessage.mockClear()

      const step1 = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createButtonReplyPayload('add')
      })
      expect(step1.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )

      const step2 = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('Fancy Gadget')
      })
      expect(step2.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('price')
      )
    })
  })

  describe('unsupported message from registered user', () => {
    it('should ignore audio messages from registered user', async () => {
      sender.sendMessage.mockClear()
      sender.sendButtons.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          typeWebhook: 'incomingMessageReceived',
          instanceData: { idInstance: 123, wid: 'bot@c.us' },
          senderData: { chatId: CHAT_ID, sender: CHAT_ID },
          messageData: { typeMessage: 'audioMessage' },
          idMessage: 'MSG-AUDIO'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(false)
      expect(response.json().action).toBe('ignored_unsupported')
      expect(sender.sendMessage).not.toHaveBeenCalled()
      expect(sender.sendButtons).not.toHaveBeenCalled()
    })
  })

  describe('sequential operations', () => {
    it('should handle list then add in sequence', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('cancel') })

      sender.sendMessage.mockClear()
      sender.sendButtons.mockClear()
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'SeqWidget', price: '5.00', stock_quantity: 3 })
      ])

      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('1')
      })
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('SeqWidget')
      )

      sender.sendMessage.mockClear()
      const addStep = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('2')
      })
      expect(addStep.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )
    })
  })

  describe('outgoing webhook type', () => {
    it('should ignore outgoing message webhooks', async () => {
      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: {
          typeWebhook: 'outgoingMessageReceived',
          instanceData: { idInstance: 123, wid: 'bot@c.us' },
          senderData: { chatId: CHAT_ID, sender: CHAT_ID },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'echo' }
          },
          idMessage: 'MSG-OUT'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(false)
      expect(response.json().action).toBe('ignored_webhook_type')
    })
  })

  describe('invalid payload', () => {
    it('should return ok:false for invalid webhook payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: { invalid: 'data' }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.ok).toBe(false)
    })
  })
})
