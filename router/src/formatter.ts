import type { Product, CreatedProduct } from './plugin/types.js'

export function formatMenu(): string {
  return [
    'Welcome to Shop Inventory Bot!',
    '',
    'Choose an option:',
    '1. List products',
    '2. Add product',
    '3. Help',
    '',
    'Reply with the number of your choice.'
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

export function formatUnknownCommand(): string {
  return 'I didn\'t understand that.\n\n' + formatMenu()
}

export function formatSessionExpired(): string {
  return 'Session expired. Send "menu" to start over.'
}
