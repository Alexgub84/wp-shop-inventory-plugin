import { GreenApiError } from '../errors.js'
import { createNoopLogger, type Logger } from '../logger.js'

export interface GreenApiConfig {
  instanceId: string
  token: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface ButtonData {
  buttonId: string
  buttonText: string
}

export interface SendButtonsPayload {
  chatId: string
  body: string
  buttons: ButtonData[]
  header?: string
  footer?: string
}

export interface GreenApiSender {
  sendMessage(chatId: string, message: string): Promise<SendMessageResponse>
  sendButtons(payload: SendButtonsPayload): Promise<SendMessageResponse>
}

export function createGreenApiSender(
  config: GreenApiConfig,
  logger?: Logger,
  fetchFunction: typeof fetch = fetch
): GreenApiSender {
  const log = logger ?? createNoopLogger()
  const baseUrl = `https://api.green-api.com/waInstance${config.instanceId}`

  async function sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
    const url = `${baseUrl}/sendMessage/${config.token}`

    log.info({ event: 'greenapi_send_start', chatId })

    let response: Response
    try {
      response = await fetchFunction(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      })
    } catch (err) {
      log.error({ event: 'greenapi_network_error', chatId, error: err })
      throw new GreenApiError('Network error sending message', undefined, { cause: err })
    }

    if (!response.ok) {
      const body = await response.text()
      log.error({ event: 'greenapi_api_error', chatId, statusCode: response.status, body })
      throw new GreenApiError(`Green API error: ${response.status}`, response.status)
    }

    const data = await response.json() as SendMessageResponse
    log.info({ event: 'greenapi_send_success', chatId, idMessage: data.idMessage })

    return data
  }

  async function sendButtons(payload: SendButtonsPayload): Promise<SendMessageResponse> {
    const url = `${baseUrl}/sendInteractiveButtonsReply/${config.token}`

    log.info({ event: 'greenapi_send_buttons_start', chatId: payload.chatId, buttonCount: payload.buttons.length })

    const body: Record<string, unknown> = {
      chatId: payload.chatId,
      body: payload.body,
      buttons: payload.buttons
    }
    if (payload.header) body.header = payload.header
    if (payload.footer) body.footer = payload.footer

    let response: Response
    try {
      response = await fetchFunction(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (err) {
      log.error({ event: 'greenapi_network_error', chatId: payload.chatId, error: err })
      throw new GreenApiError('Network error sending buttons', undefined, { cause: err })
    }

    if (!response.ok) {
      const responseBody = await response.text()
      log.error({ event: 'greenapi_api_error', chatId: payload.chatId, statusCode: response.status, body: responseBody })
      throw new GreenApiError(`Green API error: ${response.status}`, response.status)
    }

    const data = await response.json() as SendMessageResponse
    log.info({ event: 'greenapi_send_buttons_success', chatId: payload.chatId, idMessage: data.idMessage })

    return data
  }

  return { sendMessage, sendButtons }
}

export function createMockSender(logger?: Logger): GreenApiSender {
  const log = logger ?? createNoopLogger()
  let messageCounter = 0

  async function sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
    messageCounter++
    const idMessage = `mock-msg-${messageCounter}`

    log.info({
      event: 'mock_send',
      chatId,
      message,
      idMessage
    })

    return { idMessage }
  }

  async function sendButtons(payload: SendButtonsPayload): Promise<SendMessageResponse> {
    messageCounter++
    const idMessage = `mock-btn-${messageCounter}`

    log.info({
      event: 'mock_send_buttons',
      chatId: payload.chatId,
      body: payload.body,
      buttons: payload.buttons,
      idMessage
    })

    return { idMessage }
  }

  return { sendMessage, sendButtons }
}
