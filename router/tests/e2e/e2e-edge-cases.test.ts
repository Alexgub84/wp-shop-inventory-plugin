import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp, type App } from '../../src/app.js'
import { createMockPluginClient, createMockProduct } from '../mocks/plugin.js'
import { createMockSender } from '../mocks/greenapi.js'
import { PluginApiError } from '../../src/errors.js'
import {
  CHAT_ID,
  createTestConfig,
  createWebhookPayload,
  createExtendedTextPayload,
  createButtonReplyPayload
} from './helpers.js'

describe('E2E Edge Cases: Router Webhook Flow', () => {
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

  beforeEach(() => {
    sender.sendMessage.mockClear()
    sender.sendButtons.mockClear()
    pluginClient.listProducts.mockReset()
    pluginClient.listProducts.mockResolvedValue([])
    pluginClient.createProduct.mockReset()
    pluginClient.createProduct.mockImplementation(async (input) => ({
      id: 1,
      name: input.name,
      sku: 'MOCK-SKU-001',
      price: input.regular_price,
      stock_quantity: input.stock_quantity,
      status: 'publish'
    }))
    app.dependencies.sessionManager.delete(CHAT_ID)
  })

  describe('extended text messages', () => {
    it('should handle extendedTextMessage for list command', async () => {
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'ExtWidget', price: '15.00', stock_quantity: 5 })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createExtendedTextPayload('1')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
      expect(response.json().action).toBe('command_processed')
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('ExtWidget')
      )
    })

    it('should handle extendedTextMessage for menu command', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createExtendedTextPayload('menu')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
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

  describe('command aliases', () => {
    it('should handle "list" text alias for listing products', async () => {
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'AliasProduct', price: '8.00' })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('list')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('AliasProduct')
      )
    })

    it('should handle "products" text alias for listing products', async () => {
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'ProdAlias', price: '12.00' })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('products')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('ProdAlias')
      )
    })

    it('should handle "add" text alias for adding products', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('add')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )
    })

    it('should handle "new" text alias for adding products', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('new')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )
    })

    it('should handle "help" text alias for menu', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('help')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: CHAT_ID,
          buttons: expect.arrayContaining([
            expect.objectContaining({ buttonId: 'list' }),
            expect.objectContaining({ buttonId: 'add' }),
            expect.objectContaining({ buttonId: 'help' })
          ])
        })
      )
    })

    it('should handle "3" text alias for menu', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('3')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendButtons).toHaveBeenCalled()
    })
  })

  describe('case insensitivity', () => {
    it('should handle "MENU" (uppercase)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('MENU')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendButtons).toHaveBeenCalled()
    })

    it('should handle "List" (mixed case)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('List')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalled()
    })

    it('should handle "ADD" (uppercase)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('ADD')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )
    })
  })

  describe('button reply for help', () => {
    it('should show menu when help button is pressed', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createButtonReplyPayload('help')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
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

  describe('empty product list', () => {
    it('should return "No products found" message', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('1')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('No products found')
      )
    })
  })

  describe('plugin API errors', () => {
    it('should handle plugin error when listing products', async () => {
      pluginClient.listProducts.mockRejectedValue(
        new PluginApiError('Plugin API error: 500', 500, 'server_error')
      )

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('1')
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Error fetching products')
      )
    })

    it('should handle plugin network error when listing products', async () => {
      pluginClient.listProducts.mockRejectedValue(
        new PluginApiError('Network error fetching products', undefined, 'network_error')
      )

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('list')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Network error fetching products')
      )
    })

    it('should handle plugin error when creating product', async () => {
      pluginClient.createProduct.mockRejectedValue(
        new PluginApiError('Failed to create product', 500, 'server_error')
      )

      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('Error Product') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('10.00') })

      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('5')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Failed to create product')
      )
    })
  })

  describe('add product validation', () => {
    it('should reject invalid price and allow retry', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('Valid Product') })

      sender.sendMessage.mockClear()

      const invalidResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('abc')
      })

      expect(invalidResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Invalid price')
      )

      sender.sendMessage.mockClear()

      const negativeResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('-5')
      })

      expect(negativeResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Invalid price')
      )

      sender.sendMessage.mockClear()

      const validResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('19.99')
      })

      expect(validResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('stock')
      )
    })

    it('should reject invalid stock and allow retry', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('Stock Test') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('10.00') })

      sender.sendMessage.mockClear()

      const decimalResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('3.5')
      })

      expect(decimalResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Invalid stock')
      )

      sender.sendMessage.mockClear()

      const negativeResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('-1')
      })

      expect(negativeResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Invalid stock')
      )

      sender.sendMessage.mockClear()

      const validResponse = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('10')
      })

      expect(validResponse.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('✅')
      )
    })

    it('should handle zero price as invalid', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('add') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('Zero Price') })

      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('0')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('Invalid price')
      )
    })

    it('should accept zero stock as valid', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('add') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('Zero Stock') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('5.00') })

      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('0')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('✅')
      )
      expect(pluginClient.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ stock_quantity: 0 })
      )
    })
  })

  describe('"stop" as cancel keyword', () => {
    it('should cancel add flow when user sends "stop"', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })

      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('stop')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('cancelled')
      )
    })

    it('should cancel with "STOP" (uppercase)', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })

      sender.sendMessage.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('STOP')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('cancelled')
      )
    })
  })

  describe('product list formatting', () => {
    it('should show stock warnings for zero and null stock', async () => {
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'InStock', price: '10.00', stock_quantity: 5 }),
        createMockProduct({ id: 2, name: 'OutOfStock', price: '20.00', stock_quantity: 0 }),
        createMockProduct({ id: 3, name: 'NullStock', price: '30.00', stock_quantity: null })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('1')
      })

      expect(response.json().handled).toBe(true)

      const sentMessage = sender.sendMessage.mock.calls[0][1] as string
      expect(sentMessage).toContain('InStock')
      expect(sentMessage).toContain('OutOfStock')
      expect(sentMessage).toContain('NullStock')
      expect(sentMessage).toContain('⚠️')
      expect(sentMessage).toContain('Your Products (3)')
    })

    it('should number products sequentially', async () => {
      pluginClient.listProducts.mockResolvedValue([
        createMockProduct({ name: 'First', price: '1.00' }),
        createMockProduct({ id: 2, name: 'Second', price: '2.00' }),
        createMockProduct({ id: 3, name: 'Third', price: '3.00' })
      ])

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('list')
      })

      expect(response.json().handled).toBe(true)
      const sentMessage = sender.sendMessage.mock.calls[0][1] as string
      expect(sentMessage).toContain('1. First')
      expect(sentMessage).toContain('2. Second')
      expect(sentMessage).toContain('3. Third')
    })
  })

  describe('add product via extended text message', () => {
    it('should complete add flow using extendedTextMessage in session steps', async () => {
      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createExtendedTextPayload('add')
      })
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('product name')
      )

      sender.sendMessage.mockClear()

      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createExtendedTextPayload('Extended Product')
      })
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('price')
      )

      sender.sendMessage.mockClear()

      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('25.00')
      })
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('stock')
      )

      sender.sendMessage.mockClear()

      await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('100')
      })

      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('✅')
      )
      expect(pluginClient.createProduct).toHaveBeenCalledWith({
        name: 'Extended Product',
        regular_price: '25.00',
        stock_quantity: 100
      })
    })
  })

  describe('session cleanup after completion', () => {
    it('should not have active session after completing add flow', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('Post-Add Product') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('15.00') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('20') })

      sender.sendMessage.mockClear()
      sender.sendButtons.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('menu')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: CHAT_ID,
          buttons: expect.arrayContaining([
            expect.objectContaining({ buttonId: 'list' })
          ])
        })
      )
    })

    it('should not have active session after cancel', async () => {
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('2') })
      await server.inject({ method: 'POST', url: '/webhook', payload: createWebhookPayload('cancel') })

      sender.sendMessage.mockClear()
      sender.sendButtons.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/webhook',
        payload: createWebhookPayload('1')
      })

      expect(response.json().handled).toBe(true)
      expect(sender.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('No products found')
      )
    })
  })
})
