import type { Product, CreatedProduct } from './plugin/types.js'
import type { ButtonData } from './greenapi/sender.js'

export interface MenuButtonsData {
  body: string
  buttons: ButtonData[]
  footer?: string
}

export function getMenuButtons(): MenuButtonsData {
  return {
    body: '👋 Welcome to Shop Inventory!\nWhat would you like to do?',
    buttons: [
      { buttonId: 'list', buttonText: '📦 List Products' },
      { buttonId: 'add', buttonText: '➕ Add Product' },
      { buttonId: 'help', buttonText: '❓ Help' }
    ],
    footer: 'Tap a button to get started'
  }
}

export function formatUnknownCommandText(): string {
  return "Hmm, I didn't quite get that 🤔"
}

export function formatUnregistered(): string {
  return [
    "Hey! 👋",
    "",
    "Want to manage your shop inventory straight from WhatsApp?",
    "Just install the Shop Inventory plugin on your WooCommerce store and you're in! 🚀",
    "",
    "🔗 https://wordpress.org/plugins/wp-shop-inventory",
    "",
    "Already installed? Ask your developer to connect your phone number 😊"
  ].join('\n')
}

export function formatProductList(products: Product[]): string {
  if (products.length === 0) {
    return 'No products found. Send 2 to add your first product.'
  }

  const header = `📦 Your Products (${products.length}):\n`

  const lines = products.map((p, i) => {
    const stockWarning = (p.stock_quantity === 0 || p.stock_quantity === null) ? ' ⚠️' : ''
    const stock = p.stock_quantity ?? 0
    return `${i + 1}. ${p.name} — ₪${p.price} — Stock: ${stock}${stockWarning}`
  })

  return `${header}\n${lines.join('\n')}\n\nReply "menu" for main menu.`
}

export function formatProductCreated(product: CreatedProduct): string {
  const stock = product.stock_quantity ?? 0
  return `✅ Product created!\n${product.name} — ₪${product.price} — Stock: ${stock}\n\nReply "menu" for main menu.`
}

export function formatProductCreateError(errorMessage: string): string {
  return `❌ Failed to create product: ${errorMessage}\n\nSend 2 to try again, or "menu" for main menu.`
}

export function formatAskName(): string {
  return 'What is the product name?\n\nSend "cancel" to abort.'
}

export function formatAskPrice(): string {
  return 'What is the price?\n\nSend "cancel" to abort.'
}

export function formatAskStock(): string {
  return 'How many in stock?\n\nSend "cancel" to abort.'
}

export function formatCancelled(): string {
  return 'Product creation cancelled.\n\nReply "menu" for main menu.'
}

export function formatInvalidPrice(): string {
  return 'Invalid price. Please enter a number (e.g. 29.99).\n\nSend "cancel" to abort.'
}

export function formatInvalidStock(): string {
  return 'Invalid stock. Please enter a whole number (e.g. 50).\n\nSend "cancel" to abort.'
}

export function formatSessionExpired(): string {
  return 'Session expired. Send "menu" to start over.'
}
