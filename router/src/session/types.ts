export type AddProductStep = 'name' | 'price' | 'stock'

export interface AddProductData {
  name?: string
  price?: string
  stock?: number
}

export interface Session {
  chatId: string
  action: 'addProduct'
  step: AddProductStep
  data: AddProductData
  createdAt: number
  updatedAt: number
  expiresAt: number
}

export interface SessionManager {
  get(chatId: string): Session | undefined
  set(chatId: string, session: Session): void
  delete(chatId: string): void
  cleanup(): void
  createSession(chatId: string): Session
}
