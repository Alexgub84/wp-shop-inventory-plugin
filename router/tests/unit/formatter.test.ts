import { describe, it, expect } from 'vitest'
import {
  formatMenu,
  formatProductList,
  formatProductCreated,
  formatProductCreateError,
  formatAskName,
  formatAskPrice,
  formatAskStock,
  formatCancelled,
  formatInvalidPrice,
  formatInvalidStock,
  formatUnknownCommand,
  formatSessionExpired
} from '../../src/formatter.js'
import { createMockProduct } from '../mocks/plugin.js'

describe('formatter', () => {
  describe('formatMenu', () => {
    it('should include all menu options', () => {
      const menu = formatMenu()
      expect(menu).toContain('1. List products')
      expect(menu).toContain('2. Add product')
      expect(menu).toContain('3. Help')
    })
  })

  describe('formatProductList', () => {
    it('should format multiple products with header and count', () => {
      const products = [
        createMockProduct({ id: 1, name: 'Widget', price: '19.99', stock_quantity: 50 }),
        createMockProduct({ id: 2, name: 'Gadget', price: '29.99', stock_quantity: 12 })
      ]

      const result = formatProductList(products)

      expect(result).toContain('Your Products (2)')
      expect(result).toContain('1. Widget')
      expect(result).toContain('₪19.99')
      expect(result).toContain('Stock: 50')
      expect(result).toContain('2. Gadget')
      expect(result).toContain('₪29.99')
      expect(result).toContain('Stock: 12')
    })

    it('should show warning for zero-stock products', () => {
      const products = [
        createMockProduct({ name: 'Out of Stock Item', stock_quantity: 0 })
      ]

      const result = formatProductList(products)
      expect(result).toContain('⚠️')
    })

    it('should show warning for null stock products', () => {
      const products = [
        createMockProduct({ name: 'No Stock Info', stock_quantity: null })
      ]

      const result = formatProductList(products)
      expect(result).toContain('⚠️')
    })

    it('should show empty message when no products', () => {
      const result = formatProductList([])
      expect(result).toContain('No products found')
      expect(result).toContain('Send 2')
    })
  })

  describe('formatProductCreated', () => {
    it('should format created product confirmation', () => {
      const result = formatProductCreated({
        id: 1,
        name: 'Blue Widget',
        sku: 'BW-001',
        price: '29.99',
        stock_quantity: 50,
        status: 'publish'
      })

      expect(result).toContain('✅')
      expect(result).toContain('Blue Widget')
      expect(result).toContain('₪29.99')
      expect(result).toContain('Stock: 50')
    })
  })

  describe('formatProductCreateError', () => {
    it('should format error message', () => {
      const result = formatProductCreateError('Product name is required.')
      expect(result).toContain('❌')
      expect(result).toContain('Product name is required.')
    })
  })

  describe('step prompts', () => {
    it('formatAskName should ask for product name', () => {
      expect(formatAskName()).toContain('product name')
    })

    it('formatAskPrice should ask for price', () => {
      expect(formatAskPrice()).toContain('price')
    })

    it('formatAskStock should ask for stock', () => {
      expect(formatAskStock()).toContain('stock')
    })

    it('all prompts should include cancel option', () => {
      expect(formatAskName()).toContain('cancel')
      expect(formatAskPrice()).toContain('cancel')
      expect(formatAskStock()).toContain('cancel')
    })
  })

  describe('misc formatters', () => {
    it('formatCancelled should confirm cancellation', () => {
      expect(formatCancelled()).toContain('cancelled')
    })

    it('formatInvalidPrice should prompt for valid price', () => {
      expect(formatInvalidPrice()).toContain('Invalid price')
    })

    it('formatInvalidStock should prompt for valid stock', () => {
      expect(formatInvalidStock()).toContain('Invalid stock')
    })

    it('formatUnknownCommand should include menu', () => {
      const result = formatUnknownCommand()
      expect(result).toContain('didn\'t understand')
      expect(result).toContain('1. List products')
    })

    it('formatSessionExpired should mention expired', () => {
      expect(formatSessionExpired()).toContain('expired')
    })
  })
})
