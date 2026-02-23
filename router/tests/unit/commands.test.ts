import { describe, it, expect, beforeEach } from 'vitest'
import { createCommandHandler } from '../../src/commands/handler.js'
import { createMockPluginClient, createMockProduct } from '../mocks/plugin.js'
import { createSessionManager } from '../../src/session/manager.js'

describe('CommandHandler', () => {
  let pluginClient: ReturnType<typeof createMockPluginClient>
  let sessionManager: ReturnType<typeof createSessionManager>
  let handler: ReturnType<typeof createCommandHandler>

  beforeEach(() => {
    pluginClient = createMockPluginClient()
    sessionManager = createSessionManager(300000)
    handler = createCommandHandler({ pluginClient, sessionManager })
  })

  describe('menu commands', () => {
    it.each(['3', 'help', 'menu'])('should show menu for input "%s"', async (input) => {
      const result = await handler.process('user@c.us', input)
      expect(result.response).toContain('1. List products')
      expect(result.response).toContain('2. Add product')
      expect(result.response).toContain('3. Help')
    })
  })

  describe('unknown commands', () => {
    it('should show menu with hint for unknown input', async () => {
      const result = await handler.process('user@c.us', 'gibberish')
      expect(result.response).toContain('didn\'t understand')
      expect(result.response).toContain('1. List products')
    })
  })

  describe('list products', () => {
    it.each(['1', 'list', 'products'])('should list products for input "%s"', async (input) => {
      const products = [
        createMockProduct({ name: 'Widget', price: '19.99', stock_quantity: 50 }),
        createMockProduct({ id: 2, name: 'Gadget', price: '9.99', stock_quantity: 5 })
      ]
      pluginClient.listProducts.mockResolvedValue(products)

      const result = await handler.process('user@c.us', input)

      expect(result.response).toContain('Your Products (2)')
      expect(result.response).toContain('Widget')
      expect(result.response).toContain('Gadget')
      expect(pluginClient.listProducts).toHaveBeenCalled()
    })

    it('should show empty message when no products', async () => {
      pluginClient.listProducts.mockResolvedValue([])

      const result = await handler.process('user@c.us', '1')
      expect(result.response).toContain('No products found')
    })

    it('should show error when plugin API fails', async () => {
      pluginClient.listProducts.mockRejectedValue(new Error('Connection refused'))

      const result = await handler.process('user@c.us', '1')
      expect(result.response).toContain('Error fetching products')
    })
  })

  describe('add product flow', () => {
    it.each(['2', 'add', 'new'])('should start add flow for input "%s"', async (input) => {
      const result = await handler.process('user@c.us', input)
      expect(result.response).toContain('product name')
    })

    it('should walk through full add product flow', async () => {
      const chatId = 'user@c.us'

      const step1 = await handler.process(chatId, '2')
      expect(step1.response).toContain('product name')

      const step2 = await handler.process(chatId, 'Blue Widget')
      expect(step2.response).toContain('price')

      const step3 = await handler.process(chatId, '29.99')
      expect(step3.response).toContain('stock')

      const step4 = await handler.process(chatId, '50')
      expect(step4.response).toContain('✅')
      expect(step4.response).toContain('Blue Widget')

      expect(pluginClient.createProduct).toHaveBeenCalledWith({
        name: 'Blue Widget',
        regular_price: '29.99',
        stock_quantity: 50
      })
    })

    it('should reject invalid price and re-prompt', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')

      const result = await handler.process(chatId, 'not-a-number')
      expect(result.response).toContain('Invalid price')

      const retry = await handler.process(chatId, '19.99')
      expect(retry.response).toContain('stock')
    })

    it('should reject invalid stock and re-prompt', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')

      const result = await handler.process(chatId, '3.5')
      expect(result.response).toContain('Invalid stock')

      const retry = await handler.process(chatId, '10')
      expect(retry.response).toContain('✅')
    })

    it('should reject negative stock', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')

      const result = await handler.process(chatId, '-5')
      expect(result.response).toContain('Invalid stock')
    })

    it('should cancel flow with "cancel"', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      const result = await handler.process(chatId, 'cancel')

      expect(result.response).toContain('cancelled')
      expect(pluginClient.createProduct).not.toHaveBeenCalled()
    })

    it('should cancel flow with "stop"', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')

      const result = await handler.process(chatId, 'stop')
      expect(result.response).toContain('cancelled')
    })

    it('should show error when plugin API fails on create', async () => {
      const chatId = 'user@c.us'
      pluginClient.createProduct.mockRejectedValue(new Error('Server error'))

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')

      const result = await handler.process(chatId, '5')
      expect(result.response).toContain('❌')
      expect(result.response).toContain('Server error')
    })

    it('should clear session after successful product creation', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')
      await handler.process(chatId, '5')

      const result = await handler.process(chatId, '1')
      expect(result.response).not.toContain('product name')
    })
  })
})
