import type { Config } from '../../src/config.js'

export const PHONE = '972501234567'
export const CHAT_ID = `${PHONE}@c.us`

export function createTestConfig(): Config {
  return {
    port: 0,
    logLevel: 'silent',
    mockMode: true,
    sessionTimeoutMs: 300000,
    dbPath: ':memory:',
    phoneNumber: PHONE,
    shopUrl: 'https://test-shop.com',
    authToken: 'test-token',
    greenApi: { instanceId: 'test', token: 'test' }
  }
}

export function createWebhookPayload(text: string) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: 'bot@c.us' },
    senderData: { chatId: CHAT_ID, sender: CHAT_ID },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: { textMessage: text }
    },
    idMessage: `MSG-${Date.now()}-${Math.random()}`
  }
}

export function createExtendedTextPayload(text: string) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: 'bot@c.us' },
    senderData: { chatId: CHAT_ID, sender: CHAT_ID },
    messageData: {
      typeMessage: 'extendedTextMessage',
      extendedTextMessageData: { text }
    },
    idMessage: `MSG-EXT-${Date.now()}-${Math.random()}`
  }
}

export function createButtonReplyPayload(selectedId: string) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 123, wid: 'bot@c.us' },
    senderData: { chatId: CHAT_ID, sender: CHAT_ID },
    messageData: {
      typeMessage: 'templateButtonsReplyMessage',
      templateButtonReplyMessage: {
        stanzaId: 'STANZA-123',
        selectedIndex: 0,
        selectedId,
        selectedDisplayText: `Button ${selectedId}`
      }
    },
    idMessage: `MSG-BTN-${Date.now()}-${Math.random()}`
  }
}
