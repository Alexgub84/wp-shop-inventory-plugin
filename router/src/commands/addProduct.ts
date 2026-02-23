import { createNoopLogger, type Logger } from '../logger.js'
import type { PluginClient } from '../plugin/types.js'
import type { SessionManager, Session } from '../session/types.js'
import {
  formatAskName,
  formatAskPrice,
  formatAskStock,
  formatCancelled,
  formatInvalidPrice,
  formatInvalidStock,
  formatProductCreated,
  formatProductCreateError
} from '../formatter.js'

export interface AddProductAction {
  start(chatId: string): string
  handleStep(chatId: string, text: string, session: Session): Promise<string>
}

export function createAddProductAction(
  pluginClient: PluginClient,
  sessionManager: SessionManager,
  logger?: Logger
): AddProductAction {
  const log = logger ?? createNoopLogger()

  function start(chatId: string): string {
    const session = sessionManager.createSession(chatId)
    sessionManager.set(chatId, session)
    log.info({ event: 'add_product_started', chatId })
    return formatAskName()
  }

  async function handleStep(chatId: string, text: string, session: Session): Promise<string> {
    if (text.trim().toLowerCase() === 'cancel' || text.trim().toLowerCase() === 'stop') {
      sessionManager.delete(chatId)
      log.info({ event: 'add_product_cancelled', chatId, step: session.step })
      return formatCancelled()
    }

    switch (session.step) {
      case 'name':
        return handleName(chatId, text, session)
      case 'price':
        return handlePrice(chatId, text, session)
      case 'stock':
        return await handleStock(chatId, text, session)
      default:
        sessionManager.delete(chatId)
        return formatCancelled()
    }
  }

  function handleName(chatId: string, text: string, session: Session): string {
    const name = text.trim()
    if (name.length === 0) {
      return formatAskName()
    }

    session.data.name = name
    session.step = 'price'
    sessionManager.set(chatId, session)

    log.info({ event: 'add_product_name_set', chatId, name })
    return formatAskPrice()
  }

  function handlePrice(chatId: string, text: string, session: Session): string {
    const priceNum = parseFloat(text.trim())
    if (isNaN(priceNum) || priceNum <= 0) {
      return formatInvalidPrice()
    }

    session.data.price = priceNum.toFixed(2)
    session.step = 'stock'
    sessionManager.set(chatId, session)

    log.info({ event: 'add_product_price_set', chatId, price: session.data.price })
    return formatAskStock()
  }

  async function handleStock(chatId: string, text: string, session: Session): Promise<string> {
    const trimmed = text.trim()
    const stockNum = Number(trimmed)
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      return formatInvalidStock()
    }

    session.data.stock = stockNum
    sessionManager.delete(chatId)

    log.info({ event: 'add_product_submitting', chatId, data: session.data })

    try {
      const product = await pluginClient.createProduct({
        name: session.data.name!,
        regular_price: session.data.price!,
        stock_quantity: stockNum
      })

      log.info({ event: 'add_product_success', chatId, productId: product.id })
      return formatProductCreated(product)
    } catch (err) {
      log.error({ event: 'add_product_error', chatId, error: err })
      const message = err instanceof Error ? err.message : 'Unknown error'
      return formatProductCreateError(message)
    }
  }

  return { start, handleStep }
}
