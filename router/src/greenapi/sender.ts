import { GreenApiError } from '../errors.js'
import { createNoopLogger, type Logger } from '../logger.js'

export interface GreenApiConfig {
  instanceId: string
  token: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface GreenApiSender {
  sendMessage(chatId: string, message: string): Promise<SendMessageResponse>
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

  return { sendMessage }
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

  return { sendMessage }
}
