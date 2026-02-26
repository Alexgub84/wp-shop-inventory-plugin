import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp, type App } from '../../src/app.js'
import { createMockPluginClient, createMockProduct } from '../mocks/plugin.js'
import { createMockSender } from '../mocks/greenapi.js'
import {
  CHAT_ID,
  createTestConfig,
  createWebhookPayload,
  createButtonReplyPayload
} from './helpers.js'

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
    it('should return menu when sending "menu"', async () => {
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

      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('1. List products')
      )
    })
  })

  describe('list products', () => {
    it('should fetch and format products when sending "1"', async () => {
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

      sender.sendMessage.mockClear()
      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('menu')
      })
      expect(sender.sendMessage).toHaveBeenLastCalledWith(
        CHAT_ID,
        expect.stringContaining('1. List products')
      )
    })
  })

  describe('unknown command', () => {
    it('should return menu with hint for unrecognized input', async () => {
      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('gibberish')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('didn\'t understand')
      )
    })
  })

  describe('wrong phone number', () => {
    it('should ignore messages from unknown numbers', async () => {
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
      expect(response.json().handled).toBe(false)
      expect(sender.sendMessage).not.toHaveBeenCalled()
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
