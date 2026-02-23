import { PluginApiError, type PluginApiErrorCode } from '../errors.js'
import { createNoopLogger, type Logger } from '../logger.js'
import type { Product, CreateProductInput, CreatedProduct, PluginClient } from './types.js'

export interface PluginClientConfig {
  shopUrl: string
  authToken: string
}

function parseErrorCode(statusCode: number): PluginApiErrorCode {
  if (statusCode === 401) return 'unauthorized'
  if (statusCode === 400) return 'bad_request'
  if (statusCode === 404) return 'not_found'
  if (statusCode >= 500) return 'server_error'
  return 'unknown'
}

export function createPluginClient(
  config: PluginClientConfig,
  logger?: Logger,
  fetchFunction: typeof fetch = fetch
): PluginClient {
  const log = logger ?? createNoopLogger()
  const baseUrl = `${config.shopUrl}/wp-json/wsi/v1`

  function buildHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${config.authToken}`,
      'Content-Type': 'application/json'
    }
  }

  async function listProducts(): Promise<Product[]> {
    const url = `${baseUrl}/products`

    log.info({ event: 'plugin_list_products_start' })

    let response: Response
    try {
      response = await fetchFunction(url, {
        method: 'GET',
        headers: buildHeaders()
      })
    } catch (err) {
      log.error({ event: 'plugin_network_error', error: err })
      throw new PluginApiError('Network error fetching products', undefined, 'network_error', { cause: err })
    }

    if (!response.ok) {
      const body = await response.text()
      log.error({ event: 'plugin_api_error', statusCode: response.status, body })
      const errorCode = parseErrorCode(response.status)
      throw new PluginApiError(`Plugin API error: ${response.status}`, response.status, errorCode)
    }

    const products = await response.json() as Product[]
    log.info({ event: 'plugin_list_products_success', count: products.length })

    return products
  }

  async function createProduct(input: CreateProductInput): Promise<CreatedProduct> {
    const url = `${baseUrl}/products`

    log.info({ event: 'plugin_create_product_start', name: input.name })

    let response: Response
    try {
      response = await fetchFunction(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(input)
      })
    } catch (err) {
      log.error({ event: 'plugin_network_error', error: err })
      throw new PluginApiError('Network error creating product', undefined, 'network_error', { cause: err })
    }

    if (!response.ok) {
      let body: string
      try {
        body = await response.text()
      } catch {
        body = 'Failed to read response body'
      }
      log.error({ event: 'plugin_api_error', statusCode: response.status, body })

      let userMessage: string
      try {
        const parsed = JSON.parse(body) as { message?: string }
        userMessage = parsed.message || 'Failed to create product'
      } catch {
        userMessage = 'Failed to create product'
      }

      const errorCode = parseErrorCode(response.status)
      throw new PluginApiError(userMessage, response.status, errorCode)
    }

    const product = await response.json() as CreatedProduct
    log.info({ event: 'plugin_create_product_success', productId: product.id })

    return product
  }

  return { listProducts, createProduct }
}
