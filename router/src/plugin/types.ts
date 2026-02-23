export interface Product {
  id: number
  name: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  stock_quantity: number | null
  stock_status: string
  status: string
  categories: string[]
}

export interface CreateProductInput {
  name: string
  regular_price: string
  stock_quantity: number
  description?: string
  sku?: string
}

export interface CreatedProduct {
  id: number
  name: string
  sku: string
  price: string
  stock_quantity: number | null
  status: string
}

export interface PluginClient {
  listProducts(): Promise<Product[]>
  createProduct(input: CreateProductInput): Promise<CreatedProduct>
}
