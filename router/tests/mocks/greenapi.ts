import { vi } from 'vitest'
import type { GreenApiSender } from '../../src/greenapi/sender.js'

export function createMockSender(): GreenApiSender & {
  sendMessage: ReturnType<typeof vi.fn>
  sendButtons: ReturnType<typeof vi.fn>
} {
  return {
    sendMessage: vi.fn().mockResolvedValue({ idMessage: 'mock-msg-id' }),
    sendButtons: vi.fn().mockResolvedValue({ idMessage: 'mock-btn-id' })
  }
}

export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}

export function createValidWebhookPayload(text: string, chatId = '972501234567@c.us') {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: '123456789@c.us' },
    senderData: { chatId, sender: chatId },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: text }
    },
    idMessage: `MSG-${Date.now()}`
  }
}

export function createExtendedTextPayload(text: string, chatId = '972501234567@c.us') {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: '123456789@c.us' },
    senderData: { chatId, sender: chatId },
    messageData: {
      typeMessage: 'extendedTextMessage',
      extendedTextMessageData: { text }
    },
    idMessage: `MSG-${Date.now()}`
  }
}

export function createButtonReplyPayload(selectedId: string, chatId = '972501234567@c.us') {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: '123456789@c.us' },
    senderData: { chatId, sender: chatId },
    messageData: {
      typeMessage: 'templateButtonsReplyMessage',
      templateButtonReplyMessage: {
        stanzaId: 'STANZA-123',
        selectedIndex: 0,
        selectedId,
        selectedDisplayText: `Button ${selectedId}`
      }
    },
    idMessage: `MSG-BTN-${Date.now()}`
  }
}
