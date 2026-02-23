import { createNoopLogger, type Logger } from '../logger.js'
import type { PluginClient } from '../plugin/types.js'
import { formatProductList } from '../formatter.js'

export interface ListProductsAction {
  execute(): Promise<string>
}

export function createListProductsAction(
  pluginClient: PluginClient,
  logger?: Logger
): ListProductsAction {
  const log = logger ?? createNoopLogger()

  async function execute(): Promise<string> {
    try {
      const products = await pluginClient.listProducts()
      log.info({ event: 'list_products_fetched', count: products.length })
      return formatProductList(products)
    } catch (err) {
      log.error({ event: 'list_products_error', error: err })
      const message = err instanceof Error ? err.message : 'Unknown error'
      return `❌ Error fetching products: ${message}\n\nReply "menu" for main menu.`
    }
  }

  return { execute }
}
