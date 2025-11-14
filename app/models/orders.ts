/**
 * Order Model
 *
 * Provides functions for order management using D1 database.
 * All functions require AppContext to access D1 service.
 */

import type { AppContext } from '~/app/context.server'
import { getD1 } from '~/app/services/container'
import { v } from '~/app/utils/validation'
import { generateId, nanoidValidator } from '~/app/utils/nanoid'

export interface OrderItem {
  bookId: string
  title: string
  price: number
  quantity: number
}

export interface ShippingAddress {
  street: string
  city: string
  state: string
  zip: string
}

/**
 * Database row type (snake_case with JSON strings)
 */
interface OrderRow {
  id: string
  user_id: string
  items: string // JSON array stored as string
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered'
  shipping_address: string // JSON object stored as string
  created_at: number
}

/**
 * Parsed Order type for application use
 */
export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered'
  shippingAddress: ShippingAddress
  createdAt: Date
}

// =============================================================================
// Validation Schemas
// =============================================================================

export const OrderItemSchema = v.object({
  bookId: nanoidValidator(),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
  price: v.pipe(v.number(), v.minValue(0)),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export const ShippingAddressSchema = v.object({
  street: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  city: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  state: v.pipe(v.string(), v.minLength(2), v.maxLength(2)), // US state codes
  zip: v.pipe(
    v.union([v.string(), v.number()]),
    v.transform((val) => String(val)),
    v.regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format')
  ),
})

export const OrderSchema = v.object({
  id: nanoidValidator(),
  userId: nanoidValidator(),
  items: v.pipe(v.array(OrderItemSchema), v.minLength(1)),
  total: v.pipe(v.number(), v.minValue(0)),
  status: v.picklist(['pending', 'processing', 'shipped', 'delivered']),
  shippingAddress: ShippingAddressSchema,
  createdAt: v.date(),
})

export const OrderRowSchema = v.object({
  id: OrderSchema.entries.id,
  user_id: OrderSchema.entries.userId,
  items: v.string(), // JSON string (different from OrderSchema.items)
  total: OrderSchema.entries.total,
  status: OrderSchema.entries.status,
  shipping_address: v.string(), // JSON string (different from OrderSchema.shippingAddress)
  created_at: v.number(), // Different from OrderSchema.createdAt
})

export const InsertOrderSchema = v.pick(OrderSchema, ['userId', 'items', 'shippingAddress'])
export const UpdateOrderStatusSchema = v.pick(OrderSchema, ['status'])

export type InsertOrderInput = v.InferOutput<typeof InsertOrderSchema>
export type UpdateOrderStatusInput = v.InferOutput<typeof UpdateOrderStatusSchema>

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to convert DB order to app Order
 */
function parseOrder(dbOrder: OrderRow): Order {
  return {
    id: dbOrder.id,
    userId: dbOrder.user_id,
    items: JSON.parse(dbOrder.items || '[]'),
    total: dbOrder.total,
    status: dbOrder.status,
    shippingAddress: JSON.parse(dbOrder.shipping_address || '{}'),
    createdAt: new Date(dbOrder.created_at * 1000)
  }
}

export async function getAllOrders(context: AppContext): Promise<Order[]> {
  const d1 = getD1(context)
  const orders = await d1.orders.getAll() as OrderRow[]
  return orders.map(parseOrder)
}

export async function getOrderById(context: AppContext, id: string): Promise<Order | undefined> {
  const d1 = getD1(context)
  const order = await d1.orders.getById(id) as OrderRow | null
  return order ? parseOrder(order) : undefined
}

export async function getOrdersByUserId(context: AppContext, userId: string): Promise<Order[]> {
  const d1 = getD1(context)
  const orders = await d1.orders.getByUserId(userId) as OrderRow[]
  return orders.map(parseOrder)
}

export async function createOrder(
  context: AppContext,
  userId: string,
  items: OrderItem[],
  shippingAddress: ShippingAddress,
): Promise<Order> {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const d1 = getD1(context)
  const order = await d1.orders.create({
    id: generateId(),
    user_id: userId,
    items: JSON.stringify(items),
    total,
    status: 'pending',
    shipping_address: JSON.stringify(shippingAddress)
  }) as OrderRow

  return parseOrder(order)
}

export async function updateOrderStatus(context: AppContext, id: string, status: Order['status']): Promise<Order | undefined> {
  const d1 = getD1(context)
  const order = await d1.orders.updateStatus(id, status) as OrderRow | null
  return order ? parseOrder(order) : undefined
}
