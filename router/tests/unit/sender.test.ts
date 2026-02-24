import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGreenApiSender } from '../../src/greenapi/sender.js'
import { GreenApiError } from '../../src/errors.js'
import { createMockLogger } from '../mocks/greenapi.js'

const GREENAPI_CONFIG = { instanceId: '123', token: 'api-token' }
const CHAT_ID = '972501234567@c.us'

function createFetchMock(response: { ok: boolean; status: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body),
    text: () => Promise.resolve(JSON.stringify(response.body))
  })
}

describe('GreenApiSender', () => {
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
  })

  describe('sendMessage', () => {
    it('should POST to the correct Green API URL', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'MSG-1' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await sender.sendMessage(CHAT_ID, 'Hello')

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.green-api.com/waInstance123/sendMessage/api-token`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ chatId: CHAT_ID, message: 'Hello' })
        })
      )
    })

    it('should return idMessage on success', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'MSG-ABC' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      const result = await sender.sendMessage(CHAT_ID, 'Hi')
      expect(result.idMessage).toBe('MSG-ABC')
    })

    it('should throw GreenApiError on non-ok response', async () => {
      const mockFetch = createFetchMock({ ok: false, status: 429, body: 'rate limited' })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await expect(sender.sendMessage(CHAT_ID, 'Hi')).rejects.toThrow(GreenApiError)
    })

    it('should throw GreenApiError on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await expect(sender.sendMessage(CHAT_ID, 'Hi')).rejects.toThrow(GreenApiError)
    })

    it('should log info on send start and success', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'MSG-1' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await sender.sendMessage(CHAT_ID, 'Hi')

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_send_start', chatId: CHAT_ID })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_send_success', chatId: CHAT_ID, idMessage: 'MSG-1' })
      )
    })

    it('should log error on API error response', async () => {
      const mockFetch = createFetchMock({ ok: false, status: 500, body: 'server error' })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      try { await sender.sendMessage(CHAT_ID, 'Hi') } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_api_error', chatId: CHAT_ID, statusCode: 500 })
      )
    })

    it('should log error on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      try { await sender.sendMessage(CHAT_ID, 'Hi') } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_network_error', chatId: CHAT_ID })
      )
    })
  })

  describe('sendButtons', () => {
    const payload = {
      chatId: CHAT_ID,
      body: 'Pick one',
      buttons: [
        { buttonId: 'list', buttonText: '📦 List' },
        { buttonId: 'add', buttonText: '➕ Add' }
      ],
      footer: 'Tap a button'
    }

    it('should POST to the sendInteractiveButtonsReply endpoint', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'BTN-1' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await sender.sendButtons(payload)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.green-api.com/waInstance123/sendInteractiveButtonsReply/api-token`,
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should include body, buttons, and footer in the request', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'BTN-1' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await sender.sendButtons(payload)

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.chatId).toBe(CHAT_ID)
      expect(sentBody.body).toBe('Pick one')
      expect(sentBody.buttons).toHaveLength(2)
      expect(sentBody.footer).toBe('Tap a button')
    })

    it('should omit header and footer when not provided', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'BTN-1' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await sender.sendButtons({ chatId: CHAT_ID, body: 'Pick', buttons: [{ buttonId: '1', buttonText: 'One' }] })

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(sentBody.header).toBeUndefined()
      expect(sentBody.footer).toBeUndefined()
    })

    it('should return idMessage on success', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'BTN-ABC' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      const result = await sender.sendButtons(payload)
      expect(result.idMessage).toBe('BTN-ABC')
    })

    it('should throw GreenApiError on non-ok response', async () => {
      const mockFetch = createFetchMock({ ok: false, status: 400, body: 'bad request' })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await expect(sender.sendButtons(payload)).rejects.toThrow(GreenApiError)
    })

    it('should throw GreenApiError on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await expect(sender.sendButtons(payload)).rejects.toThrow(GreenApiError)
    })

    it('should log info on send start and success', async () => {
      const mockFetch = createFetchMock({ ok: true, status: 200, body: { idMessage: 'BTN-1' } })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      await sender.sendButtons(payload)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_send_buttons_start', chatId: CHAT_ID, buttonCount: 2 })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_send_buttons_success', chatId: CHAT_ID, idMessage: 'BTN-1' })
      )
    })

    it('should log error on API error response', async () => {
      const mockFetch = createFetchMock({ ok: false, status: 500, body: 'error' })
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      try { await sender.sendButtons(payload) } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_api_error', chatId: CHAT_ID, statusCode: 500 })
      )
    })

    it('should log error on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const sender = createGreenApiSender(GREENAPI_CONFIG, mockLogger, mockFetch as unknown as typeof fetch)

      try { await sender.sendButtons(payload) } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'greenapi_network_error', chatId: CHAT_ID })
      )
    })
  })
})
