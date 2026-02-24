import { createNoopLogger, type Logger } from '../logger.js'
import type { PluginClient } from '../plugin/types.js'
import type { SessionManager } from '../session/types.js'
import { createListProductsAction } from './listProducts.js'
import { createAddProductAction } from './addProduct.js'
import { getMenuButtons, formatUnknownCommandText } from '../formatter.js'
import type { ButtonData } from '../greenapi/sender.js'

export interface TextResult {
  type: 'text'
  response: string
}

export interface ButtonsResult {
  type: 'buttons'
  body: string
  buttons: ButtonData[]
  header?: string
  footer?: string
}

export type CommandResult = TextResult | ButtonsResult

export interface CommandHandler {
  process(chatId: string, text: string): Promise<CommandResult>
}

export interface CommandHandlerDeps {
  pluginClient: PluginClient
  sessionManager: SessionManager
  logger?: Logger
}

const LIST_ALIASES = new Set(['1', 'list', 'products'])
const ADD_ALIASES = new Set(['2', 'add', 'new'])
const MENU_ALIASES = new Set(['3', 'help', 'menu'])

function menuResult(): ButtonsResult {
  const menu = getMenuButtons()
  return { type: 'buttons', ...menu }
}

export function createCommandHandler(deps: CommandHandlerDeps): CommandHandler {
  const { pluginClient, sessionManager } = deps
  const logger = deps.logger ?? createNoopLogger()

  const listAction = createListProductsAction(pluginClient, logger)
  const addAction = createAddProductAction(pluginClient, sessionManager, logger)

  async function process(chatId: string, text: string): Promise<CommandResult> {
    const normalized = text.trim().toLowerCase()

    const session = sessionManager.get(chatId)
    if (session) {
      logger.info({ event: 'session_active', chatId, step: session.step })
      const response = await addAction.handleStep(chatId, text, session)
      return { type: 'text', response }
    }

    if (LIST_ALIASES.has(normalized)) {
      logger.info({ event: 'command_list', chatId })
      const response = await listAction.execute()
      return { type: 'text', response }
    }

    if (ADD_ALIASES.has(normalized)) {
      logger.info({ event: 'command_add', chatId })
      const response = addAction.start(chatId)
      return { type: 'text', response }
    }

    if (MENU_ALIASES.has(normalized)) {
      logger.info({ event: 'command_menu', chatId })
      return menuResult()
    }

    logger.info({ event: 'command_unknown', chatId, text: normalized })
    const menu = getMenuButtons()
    return {
      type: 'buttons',
      ...menu,
      body: formatUnknownCommandText()
    }
  }

  return { process }
}
