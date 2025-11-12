/**
 * Cart Model
 *
 * Provides functions for shopping cart management using KV-backed session storage.
 * Cart data is stored in the session and persists across requests.
 */

import type { AppContext } from '~/app/context.server'
import { getSessionService } from '~/app/services/container'

export interface CartItem {
  bookId: string
  slug: string
  title: string
  price: number
  quantity: number
}

export interface Cart {
  items: CartItem[]
}

export async function getCart(context: AppContext, sessionId: string): Promise<Cart> {
  const sessionService = getSessionService(context)
  const items = await sessionService.getCart(sessionId)
  return { items }
}

export async function addToCart(
  context: AppContext,
  sessionId: string,
  bookId: string,
  slug: string,
  title: string,
  price: number,
  quantity: number = 1,
): Promise<Cart> {
  const cart = await getCart(context, sessionId)

  const existingItem = cart.items.find((item) => item.bookId === bookId)
  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.items.push({ bookId, slug, title, price, quantity })
  }

  const sessionService = getSessionService(context)
  await sessionService.setCart(sessionId, cart.items)

  return cart
}

export async function updateCartItem(
  context: AppContext,
  sessionId: string,
  bookId: string,
  quantity: number,
): Promise<Cart | undefined> {
  const cart = await getCart(context, sessionId)
  const item = cart.items.find((item) => item.bookId === bookId)

  if (!item) return undefined

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => item.bookId !== bookId)
  } else {
    item.quantity = quantity
  }

  const sessionService = getSessionService(context)
  await sessionService.setCart(sessionId, cart.items)

  return cart
}

export async function removeFromCart(context: AppContext, sessionId: string, bookId: string): Promise<Cart> {
  const cart = await getCart(context, sessionId)
  cart.items = cart.items.filter((item) => item.bookId !== bookId)

  const sessionService = getSessionService(context)
  await sessionService.setCart(sessionId, cart.items)

  return cart
}

export async function clearCart(context: AppContext, sessionId: string): Promise<void> {
  const sessionService = getSessionService(context)
  await sessionService.clearCart(sessionId)
}

export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
