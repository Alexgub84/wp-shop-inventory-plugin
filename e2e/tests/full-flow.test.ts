import { describe, it, expect } from 'vitest'

const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3000'
const PLUGIN_URL = process.env.PLUGIN_URL || 'http://localhost:8080'
const AUTH_TOKEN = 'test-e2e-token-12345'
const PHONE = '972501234567'
const CHAT_ID = `${PHONE}@c.us`

function webhookPayload(text: string) {
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

async function sendWebhook(text: string) {
  const res = await fetch(`${ROUTER_URL}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload(text))
  })
  return { status: res.status, body: await res.json() }
}

async function listProductsViaPlugin() {
  const res = await fetch(`${PLUGIN_URL}/wp-json/wsi/v1/products`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  })
  return { status: res.status, body: await res.json() }
}

describe('Full Stack E2E', () => {
  describe('health endpoints', () => {
    it('plugin health returns WooCommerce status', async () => {
      const res = await fetch(`${PLUGIN_URL}/wp-json/wsi/v1/health`)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.plugin_version).toBeDefined()
      expect(data.woocommerce).toBe(true)
    })

    it('router health returns ok', async () => {
      const res = await fetch(`${ROUTER_URL}/health`)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.status).toBe('ok')
    })
  })

  describe('plugin API direct access', () => {
    it('rejects requests without auth token', async () => {
      const res = await fetch(`${PLUGIN_URL}/wp-json/wsi/v1/products`)
      expect(res.status).toBe(401)
    })

    it('rejects requests with wrong auth token', async () => {
      const res = await fetch(`${PLUGIN_URL}/wp-json/wsi/v1/products`, {
        headers: { 'Authorization': 'Bearer wrong-token' }
      })
      expect(res.status).toBe(401)
    })

    it('accepts requests with valid auth token', async () => {
      const { status, body } = await listProductsViaPlugin()
      expect(status).toBe(200)
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('webhook flow: menu command', () => {
    it('processes menu command through router', async () => {
      const { status, body } = await sendWebhook('menu')
      expect(status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.handled).toBe(true)
      expect(body.action).toBe('command_processed')
    })
  })

  describe('webhook flow: list products', () => {
    it('lists products through full stack (initially empty)', async () => {
      const { status, body } = await sendWebhook('1')
      expect(status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.handled).toBe(true)
    })
  })

  describe('webhook flow: add product end-to-end', () => {
    it('creates a product through multi-step conversation', async () => {
      const step1 = await sendWebhook('2')
      expect(step1.body.handled).toBe(true)

      const step2 = await sendWebhook('E2E Test Widget')
      expect(step2.body.handled).toBe(true)

      const step3 = await sendWebhook('29.99')
      expect(step3.body.handled).toBe(true)

      const step4 = await sendWebhook('50')
      expect(step4.body.ok).toBe(true)
      expect(step4.body.handled).toBe(true)

      const { body: products } = await listProductsViaPlugin()
      const created = products.find((p: { name: string }) => p.name === 'E2E Test Widget')
      expect(created).toBeDefined()
      expect(created.price).toBe('29.99')
      expect(created.stock_quantity).toBe(50)
    })

    it('lists the created product through router webhook', async () => {
      const { body } = await sendWebhook('1')
      expect(body.ok).toBe(true)
      expect(body.handled).toBe(true)
    })

    it('creates a second product and verifies both exist', async () => {
      await sendWebhook('add')
      await sendWebhook('E2E Gadget')
      await sendWebhook('9.99')
      const final = await sendWebhook('10')
      expect(final.body.ok).toBe(true)

      const { body: products } = await listProductsViaPlugin()
      const names = products.map((p: { name: string }) => p.name)
      expect(names).toContain('E2E Test Widget')
      expect(names).toContain('E2E Gadget')
    })
  })

  describe('webhook flow: cancel add product', () => {
    it('cancels mid-flow and returns to normal command processing', async () => {
      const start = await sendWebhook('2')
      expect(start.body.handled).toBe(true)

      const cancel = await sendWebhook('cancel')
      expect(cancel.body.handled).toBe(true)

      const menu = await sendWebhook('menu')
      expect(menu.body.action).toBe('command_processed')
    })
  })

  describe('webhook flow: unregistered phone', () => {
    it('ignores messages from unknown phone numbers', async () => {
      const res = await fetch(`${ROUTER_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeWebhook: 'incomingMessageReceived',
          instanceData: { idInstance: 123, wid: 'bot@c.us' },
          senderData: { chatId: 'unknown@c.us', sender: 'unknown@c.us' },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'hello' }
          },
          idMessage: 'MSG-UNKNOWN'
        })
      })

      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.handled).toBe(false)
      expect(body.action).toBe('ignored_wrong_number')
    })
  })

  describe('webhook flow: invalid payload', () => {
    it('rejects malformed webhook payloads gracefully', async () => {
      const res = await fetch(`${ROUTER_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' })
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.ok).toBe(false)
    })
  })
})
