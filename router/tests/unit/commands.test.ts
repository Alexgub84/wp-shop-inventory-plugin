import { describe, it, expect, beforeEach } from 'vitest'
import { createCommandHandler, type CommandResult } from '../../src/commands/handler.js'
import { createMockPluginClient, createMockProduct } from '../mocks/plugin.js'
import { createMockLogger } from '../mocks/greenapi.js'
import { createSessionManager } from '../../src/session/manager.js'

function getTextResponse(result: CommandResult): string {
  if (result.type === 'text') return result.response
  return result.body
}

describe('CommandHandler', () => {
  let pluginClient: ReturnType<typeof createMockPluginClient>
  let sessionManager: ReturnType<typeof createSessionManager>
  let mockLogger: ReturnType<typeof createMockLogger>
  let handler: ReturnType<typeof createCommandHandler>

  beforeEach(() => {
    pluginClient = createMockPluginClient()
    sessionManager = createSessionManager(300000)
    mockLogger = createMockLogger()
    handler = createCommandHandler({ pluginClient, sessionManager, logger: mockLogger })
  })

  describe('menu commands', () => {
    it.each(['3', 'help', 'menu'])('should return buttons for input "%s"', async (input) => {
      const result = await handler.process('user@c.us', input)
      expect(result.type).toBe('buttons')
      if (result.type === 'buttons') {
        expect(result.buttons).toHaveLength(3)
        expect(result.buttons[0].buttonId).toBe('list')
        expect(result.buttons[1].buttonId).toBe('add')
        expect(result.buttons[2].buttonId).toBe('help')
      }
    })
  })

  describe('unknown commands', () => {
    it('should return buttons with hint for unknown input', async () => {
      const result = await handler.process('user@c.us', 'gibberish')
      expect(result.type).toBe('buttons')
      if (result.type === 'buttons') {
        expect(result.body).toContain("didn't quite get that")
        expect(result.buttons.length).toBeGreaterThan(0)
      }
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

      expect(result.type).toBe('text')
      const text = getTextResponse(result)
      expect(text).toContain('Your Products (2)')
      expect(text).toContain('Widget')
      expect(text).toContain('Gadget')
      expect(pluginClient.listProducts).toHaveBeenCalled()
    })

    it('should show empty message when no products', async () => {
      pluginClient.listProducts.mockResolvedValue([])

      const result = await handler.process('user@c.us', '1')
      expect(getTextResponse(result)).toContain('No products found')
    })

    it('should show error when plugin API fails', async () => {
      pluginClient.listProducts.mockRejectedValue(new Error('Connection refused'))

      const result = await handler.process('user@c.us', '1')
      expect(getTextResponse(result)).toContain('Error fetching products')
    })
  })

  describe('add product flow', () => {
    it.each(['2', 'add', 'new'])('should start add flow for input "%s"', async (input) => {
      const result = await handler.process('user@c.us', input)
      expect(getTextResponse(result)).toContain('product name')
    })

    it('should walk through full add product flow', async () => {
      const chatId = 'user@c.us'

      const step1 = await handler.process(chatId, '2')
      expect(getTextResponse(step1)).toContain('product name')

      const step2 = await handler.process(chatId, 'Blue Widget')
      expect(getTextResponse(step2)).toContain('price')

      const step3 = await handler.process(chatId, '29.99')
      expect(getTextResponse(step3)).toContain('stock')

      const step4 = await handler.process(chatId, '50')
      expect(getTextResponse(step4)).toContain('✅')
      expect(getTextResponse(step4)).toContain('Blue Widget')

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
      expect(getTextResponse(result)).toContain('Invalid price')

      const retry = await handler.process(chatId, '19.99')
      expect(getTextResponse(retry)).toContain('stock')
    })

    it('should reject invalid stock and re-prompt', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')

      const result = await handler.process(chatId, '3.5')
      expect(getTextResponse(result)).toContain('Invalid stock')

      const retry = await handler.process(chatId, '10')
      expect(getTextResponse(retry)).toContain('✅')
    })

    it('should reject negative stock', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')

      const result = await handler.process(chatId, '-5')
      expect(getTextResponse(result)).toContain('Invalid stock')
    })

    it('should cancel flow with "cancel"', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      const result = await handler.process(chatId, 'cancel')

      expect(getTextResponse(result)).toContain('cancelled')
      expect(pluginClient.createProduct).not.toHaveBeenCalled()
    })

    it('should cancel flow with "stop"', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')

      const result = await handler.process(chatId, 'stop')
      expect(getTextResponse(result)).toContain('cancelled')
    })

    it('should show error when plugin API fails on create', async () => {
      const chatId = 'user@c.us'
      pluginClient.createProduct.mockRejectedValue(new Error('Server error'))

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')

      const result = await handler.process(chatId, '5')
      expect(getTextResponse(result)).toContain('❌')
      expect(getTextResponse(result)).toContain('Server error')
    })

    it('should clear session after successful product creation', async () => {
      const chatId = 'user@c.us'

      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10.00')
      await handler.process(chatId, '5')

      const result = await handler.process(chatId, '1')
      expect(getTextResponse(result)).not.toContain('product name')
    })
  })

  describe('logging', () => {
    it('should log command_menu for menu commands', async () => {
      await handler.process('user@c.us', 'menu')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'command_menu', chatId: 'user@c.us' })
      )
    })

    it('should log command_list for list commands', async () => {
      await handler.process('user@c.us', '1')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'command_list', chatId: 'user@c.us' })
      )
    })

    it('should log command_add for add commands', async () => {
      await handler.process('user@c.us', '2')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'command_add', chatId: 'user@c.us' })
      )
    })

    it('should log command_unknown for unrecognized input', async () => {
      await handler.process('user@c.us', 'xyzzy')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'command_unknown', chatId: 'user@c.us', text: 'xyzzy' })
      )
    })

    it('should log session_active when session exists', async () => {
      const chatId = 'user@c.us'
      await handler.process(chatId, '2')
      mockLogger.info.mockClear()

      await handler.process(chatId, 'Widget')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'session_active', chatId, step: 'name' })
      )
    })

    it('should log list_products_fetched on successful list', async () => {
      pluginClient.listProducts.mockResolvedValue([createMockProduct()])
      await handler.process('user@c.us', '1')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'list_products_fetched', count: 1 })
      )
    })

    it('should log list_products_error on failed list', async () => {
      pluginClient.listProducts.mockRejectedValue(new Error('fail'))
      await handler.process('user@c.us', '1')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'list_products_error' })
      )
    })

    it('should log add_product_started when starting add flow', async () => {
      await handler.process('user@c.us', '2')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'add_product_started', chatId: 'user@c.us' })
      )
    })

    it('should log add_product_cancelled on cancel', async () => {
      await handler.process('user@c.us', '2')
      await handler.process('user@c.us', 'cancel')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'add_product_cancelled', chatId: 'user@c.us' })
      )
    })

    it('should log add_product_success on successful creation', async () => {
      const chatId = 'user@c.us'
      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10')
      await handler.process(chatId, '5')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'add_product_success', chatId })
      )
    })

    it('should log add_product_error on failed creation', async () => {
      pluginClient.createProduct.mockRejectedValue(new Error('API down'))
      const chatId = 'user@c.us'
      await handler.process(chatId, '2')
      await handler.process(chatId, 'Widget')
      await handler.process(chatId, '10')
      await handler.process(chatId, '5')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'add_product_error', chatId })
      )
    })
  })
})
