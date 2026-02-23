import { describe, it, expect, vi } from 'vitest'
import { createPluginClient } from '../../src/plugin/client.js'
import { PluginApiError } from '../../src/errors.js'
import { createMockProduct } from '../mocks/plugin.js'

function createFetchMock(response: { ok: boolean; status: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body),
    text: () => Promise.resolve(JSON.stringify(response.body))
  })
}

const config = {
  shopUrl: 'https://test-shop.com',
  authToken: 'test-bearer-token'
}

describe('PluginClient', () => {
  describe('listProducts', () => {
    it('should fetch products with Bearer auth header', async () => {
      const products = [createMockProduct(), createMockProduct({ id: 2, name: 'Second' })]
      const mockFetch = createFetchMock({ ok: true, status: 200, body: products })

      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)
      const result = await client.listProducts()

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Test Product')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-shop.com/wp-json/wsi/v1/products',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-bearer-token'
          })
        })
      )
    })

    it('should return empty array when no products', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: [] })
      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)

      const result = await client.listProducts()
      expect(result).toEqual([])
    })

    it('should throw PluginApiError on 401', async () => {
      const mockFetch = createFetchMock({
        ok: false,
        status: 401,
        body: { code: 'wsi_unauthorized', message: 'Invalid token' }
      })
      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)

      await expect(client.listProducts()).rejects.toThrow(PluginApiError)
      await expect(client.listProducts()).rejects.toMatchObject({ errorCode: 'unauthorized' })
    })

    it('should throw PluginApiError on 500', async () => {
      const mockFetch = createFetchMock({
        ok: false,
        status: 500,
        body: { message: 'Internal Server Error' }
      })
      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)

      await expect(client.listProducts()).rejects.toThrow(PluginApiError)
      await expect(client.listProducts()).rejects.toMatchObject({ errorCode: 'server_error' })
    })

    it('should throw PluginApiError with network_error on fetch failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network failed'))
      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)

      await expect(client.listProducts()).rejects.toThrow(PluginApiError)
      await expect(client.listProducts()).rejects.toMatchObject({ errorCode: 'network_error' })
    })
  })

  describe('createProduct', () => {
    it('should POST product with correct body and auth', async () => {
      const created = { id: 42, name: 'New Widget', sku: 'NW-001', price: '19.99', stock_quantity: 10, status: 'publish' }
      const mockFetch = createFetchMock({ ok: true, status: 201, body: created })

      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)
      const result = await client.createProduct({
        name: 'New Widget',
        regular_price: '19.99',
        stock_quantity: 10
      })

      expect(result.id).toBe(42)
      expect(result.name).toBe('New Widget')

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.name).toBe('New Widget')
      expect(callBody.regular_price).toBe('19.99')
      expect(callBody.stock_quantity).toBe(10)
    })

    it('should throw PluginApiError on 400 with error message from body', async () => {
      const mockFetch = createFetchMock({
        ok: false,
        status: 400,
        body: { code: 'wsi_invalid_product', message: 'Product name is required.' }
      })
      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)

      try {
        await client.createProduct({ name: '', regular_price: '10', stock_quantity: 1 })
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(PluginApiError)
        expect((err as PluginApiError).errorCode).toBe('bad_request')
        expect((err as PluginApiError).message).toBe('Product name is required.')
      }
    })

    it('should throw PluginApiError with network_error on fetch failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
      const client = createPluginClient(config, undefined, mockFetch as unknown as typeof fetch)

      await expect(
        client.createProduct({ name: 'Test', regular_price: '10', stock_quantity: 1 })
      ).rejects.toMatchObject({ errorCode: 'network_error' })
    })
  })
})
