import { vi } from 'vitest'
import type { PluginClient, Product, CreatedProduct } from '../../src/plugin/types.js'

export function createMockPluginClient(): PluginClient & {
  listProducts: ReturnType<typeof vi.fn>
  createProduct: ReturnType<typeof vi.fn>
} {
  return {
    listProducts: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn().mockImplementation(async (input) => ({
      id: 1,
      name: input.name,
      sku: 'MOCK-SKU-001',
      price: input.regular_price,
      stock_quantity: input.stock_quantity,
      status: 'publish'
    } satisfies CreatedProduct))
  }
}

export function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Test Product',
    sku: 'TST-001',
    price: '10.00',
    regular_price: '10.00',
    sale_price: '',
    stock_quantity: 100,
    stock_status: 'instock',
    status: 'publish',
    categories: ['General'],
    ...overrides
  }
}
