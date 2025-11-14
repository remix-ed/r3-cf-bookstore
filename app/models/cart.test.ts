/**
 * Cart Model Tests
 *
 * Tests for shopping cart operations using Cloudflare KV storage:
 * - getCart: KV retrieval, empty carts, JSON parsing
 * - addToCart: Adding items, quantity incrementing
 * - updateCartItem: Quantity updates, item removal
 * - removeFromCart: Item deletion
 * - clearCart: KV deletion
 * - getCartTotal: Total calculation
 * - Integration: Full cart lifecycle
 */

import * as assert from 'node:assert/strict'
import { describe, it, before, beforeEach } from 'node:test'
import type { RequestContext } from '@remix-run/fetch-router'
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartTotal,
  type Cart,
} from './cart.ts'
import { createTestRouter } from '../../test/helpers.ts'
import { cloudflareContextKey } from '../context.server.ts'
import { generateId } from '../utils/nanoid.ts'
import { SERVICES_KEY } from '../services/container.ts'
import { createD1Service } from '../services/d1.server.ts'
import { createSessionService } from '../services/session.server.ts'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import booksSeed from '~/database/seeds/test/003-test-books.seed'
import ordersSeed from '~/database/seeds/test/004-test-orders.seed'

describe('Cart Model', () => {
  let router: any
  let context: RequestContext
  let sessionId: string

  before(async () => {
    router = await createTestRouter()

    // Clear and seed database
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)
    await booksSeed(router.env.DB)
    await ordersSeed(router.env.DB)

    const storage = new Map()
    storage.set(cloudflareContextKey, { env: router.env, ctx: router.ctx })
    storage.set(SERVICES_KEY, {
      d1: createD1Service(router.env),
      session: createSessionService(router.env.SESSION_KV)
    })
    context = storage as any
  })

  beforeEach(() => {
    // Generate a unique session ID for each test
    sessionId = generateId()
  })

  // =============================================================================
  // getCart Tests
  // =============================================================================

  describe('getCart', () => {
    it('returns empty cart when no cart exists', async () => {
      // Act
      const cart = await getCart(context, sessionId)

      // Assert
      assert.ok(cart, 'Should return cart object')
      assert.ok(Array.isArray(cart.items), 'Should have items array')
      assert.strictEqual(cart.items.length, 0, 'Should be empty')
    })

    it('returns cart with existing items', async () => {
      // Arrange - Add items first
      await addToCart(context, sessionId, generateId(), 'book-1', 'Test Book 1', 10.0, 1)
      await addToCart(context, sessionId, generateId(), 'book-2', 'Test Book 2', 20.0, 2)

      // Act
      const cart = await getCart(context, sessionId)

      // Assert
      assert.strictEqual(cart.items.length, 2, 'Should have 2 items')
      assert.strictEqual(cart.items[0].title, 'Test Book 1', 'Should have first item')
      assert.strictEqual(cart.items[1].title, 'Test Book 2', 'Should have second item')
    })

    it('returns empty cart for invalid JSON', async () => {
      // Arrange - Put invalid JSON in KV
      await router.env.CART_KV.put(`cart:${sessionId}`, 'invalid json{')

      // Act
      const cart = await getCart(context, sessionId)

      // Assert
      assert.ok(cart, 'Should return cart object')
      assert.strictEqual(cart.items.length, 0, 'Should return empty cart for invalid JSON')
    })

    it('isolates carts by session ID', async () => {
      // Arrange
      const session1 = generateId()
      const session2 = generateId()

      await addToCart(context, session1, generateId(), 'book-1', 'Session 1 Book', 10.0, 1)
      await addToCart(context, session2, generateId(), 'book-2', 'Session 2 Book', 20.0, 1)

      // Act
      const cart1 = await getCart(context, session1)
      const cart2 = await getCart(context, session2)

      // Assert
      assert.strictEqual(cart1.items.length, 1, 'Session 1 should have 1 item')
      assert.strictEqual(cart1.items[0].title, 'Session 1 Book', 'Session 1 should have correct item')
      assert.strictEqual(cart2.items.length, 1, 'Session 2 should have 1 item')
      assert.strictEqual(cart2.items[0].title, 'Session 2 Book', 'Session 2 should have correct item')
    })
  })

  // =============================================================================
  // addToCart Tests
  // =============================================================================

  describe('addToCart', () => {
    it('adds new item to empty cart', async () => {
      // Arrange
      const bookId = generateId()

      // Act
      const cart = await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)

      // Assert
      assert.strictEqual(cart.items.length, 1, 'Should have 1 item')
      assert.strictEqual(cart.items[0].bookId, bookId, 'Should have correct bookId')
      assert.strictEqual(cart.items[0].slug, 'test-book', 'Should have slug')
      assert.strictEqual(cart.items[0].title, 'Test Book', 'Should have title')
      assert.strictEqual(cart.items[0].price, 29.99, 'Should have price')
      assert.strictEqual(cart.items[0].quantity, 1, 'Should have quantity')
    })

    it('adds multiple different items', async () => {
      // Arrange
      const book1 = generateId()
      const book2 = generateId()
      const book3 = generateId()

      // Act
      await addToCart(context, sessionId, book1, 'book-1', 'Book 1', 10.0, 1)
      await addToCart(context, sessionId, book2, 'book-2', 'Book 2', 20.0, 1)
      const cart = await addToCart(context, sessionId, book3, 'book-3', 'Book 3', 30.0, 1)

      // Assert
      assert.strictEqual(cart.items.length, 3, 'Should have 3 items')
    })

    it('increments quantity when adding existing item', async () => {
      // Arrange
      const bookId = generateId()

      // Act
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 2)
      const cart = await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)

      // Assert
      assert.strictEqual(cart.items.length, 1, 'Should still have 1 item')
      assert.strictEqual(cart.items[0].quantity, 4, 'Quantity should be incremented (1 + 2 + 1)')
    })

    it('adds item with default quantity of 1', async () => {
      // Arrange
      const bookId = generateId()

      // Act
      const cart = await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99)

      // Assert
      assert.strictEqual(cart.items[0].quantity, 1, 'Should default to quantity 1')
    })

    it('adds item with quantity greater than 1', async () => {
      // Arrange
      const bookId = generateId()

      // Act
      const cart = await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 5)

      // Assert
      assert.strictEqual(cart.items[0].quantity, 5, 'Should add with quantity 5')
    })

    it('persists cart to KV storage', async () => {
      // Arrange
      const bookId = generateId()

      // Act
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)

      // Assert - Retrieve directly from SESSION_KV (cart is stored in session data)
      const sessionJson = await router.env.SESSION_KV.get(sessionId)
      assert.ok(sessionJson, 'Session should be saved in KV')
      const sessionData = JSON.parse(sessionJson!)
      assert.ok(sessionData.cart, 'Session should have cart')
      assert.strictEqual(sessionData.cart.length, 1, 'KV cart should have 1 item')
    })
  })

  // =============================================================================
  // updateCartItem Tests
  // =============================================================================

  describe('updateCartItem', () => {
    it('updates item quantity', async () => {
      // Arrange
      const bookId = generateId()
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)

      // Act
      const cart = await updateCartItem(context, sessionId, bookId, 5)

      // Assert
      assert.ok(cart, 'Should return updated cart')
      assert.strictEqual(cart.items.length, 1, 'Should have 1 item')
      assert.strictEqual(cart.items[0].quantity, 5, 'Quantity should be updated to 5')
    })

    it('removes item when quantity is 0', async () => {
      // Arrange
      const bookId = generateId()
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 3)

      // Act
      const cart = await updateCartItem(context, sessionId, bookId, 0)

      // Assert
      assert.ok(cart, 'Should return updated cart')
      assert.strictEqual(cart.items.length, 0, 'Item should be removed when quantity is 0')
    })

    it('removes item when quantity is negative', async () => {
      // Arrange
      const bookId = generateId()
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 3)

      // Act
      const cart = await updateCartItem(context, sessionId, bookId, -1)

      // Assert
      assert.ok(cart, 'Should return updated cart')
      assert.strictEqual(cart.items.length, 0, 'Item should be removed when quantity is negative')
    })

    it('returns undefined for non-existent item', async () => {
      // Arrange
      const nonExistentBookId = generateId()

      // Act
      const cart = await updateCartItem(context, sessionId, nonExistentBookId, 5)

      // Assert
      assert.strictEqual(cart, undefined, 'Should return undefined for non-existent item')
    })

    it('updates only the specified item in multi-item cart', async () => {
      // Arrange
      const book1 = generateId()
      const book2 = generateId()
      const book3 = generateId()

      await addToCart(context, sessionId, book1, 'book-1', 'Book 1', 10.0, 1)
      await addToCart(context, sessionId, book2, 'book-2', 'Book 2', 20.0, 2)
      await addToCart(context, sessionId, book3, 'book-3', 'Book 3', 30.0, 3)

      // Act
      const cart = await updateCartItem(context, sessionId, book2, 10)

      // Assert
      assert.strictEqual(cart!.items.length, 3, 'Should still have 3 items')
      const updatedItem = cart!.items.find((i) => i.bookId === book2)
      assert.strictEqual(updatedItem!.quantity, 10, 'Book 2 quantity should be updated')

      const item1 = cart!.items.find((i) => i.bookId === book1)
      const item3 = cart!.items.find((i) => i.bookId === book3)
      assert.strictEqual(item1!.quantity, 1, 'Book 1 quantity should be unchanged')
      assert.strictEqual(item3!.quantity, 3, 'Book 3 quantity should be unchanged')
    })
  })

  // =============================================================================
  // removeFromCart Tests
  // =============================================================================

  describe('removeFromCart', () => {
    it('removes item from cart', async () => {
      // Arrange
      const bookId = generateId()
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)

      // Act
      const cart = await removeFromCart(context, sessionId, bookId)

      // Assert
      assert.strictEqual(cart.items.length, 0, 'Item should be removed')
    })

    it('does not error when removing non-existent item', async () => {
      // Arrange
      const bookId = generateId()
      await addToCart(context, sessionId, bookId, 'test-book', 'Test Book', 29.99, 1)

      const nonExistentBookId = generateId()

      // Act
      const cart = await removeFromCart(context, sessionId, nonExistentBookId)

      // Assert
      assert.strictEqual(cart.items.length, 1, 'Cart should still have original item')
    })

    it('removes only specified item from multi-item cart', async () => {
      // Arrange
      const book1 = generateId()
      const book2 = generateId()
      const book3 = generateId()

      await addToCart(context, sessionId, book1, 'book-1', 'Book 1', 10.0, 1)
      await addToCart(context, sessionId, book2, 'book-2', 'Book 2', 20.0, 1)
      await addToCart(context, sessionId, book3, 'book-3', 'Book 3', 30.0, 1)

      // Act
      const cart = await removeFromCart(context, sessionId, book2)

      // Assert
      assert.strictEqual(cart.items.length, 2, 'Should have 2 items remaining')
      assert.ok(!cart.items.find((i) => i.bookId === book2), 'Book 2 should be removed')
      assert.ok(cart.items.find((i) => i.bookId === book1), 'Book 1 should remain')
      assert.ok(cart.items.find((i) => i.bookId === book3), 'Book 3 should remain')
    })
  })

  // =============================================================================
  // clearCart Tests
  // =============================================================================

  describe('clearCart', () => {
    it('removes cart from KV storage', async () => {
      // Arrange
      await addToCart(context, sessionId, generateId(), 'test-book', 'Test Book', 29.99, 1)

      // Verify cart exists
      const beforeClear = await getCart(context, sessionId)
      assert.strictEqual(beforeClear.items.length, 1, 'Cart should have items before clear')

      // Act
      await clearCart(context, sessionId)

      // Assert
      const afterClear = await getCart(context, sessionId)
      assert.strictEqual(afterClear.items.length, 0, 'Cart should be empty after clear')
    })

    it('does not error when clearing empty cart', async () => {
      // Act & Assert - Should not throw
      await clearCart(context, sessionId)

      const cart = await getCart(context, sessionId)
      assert.strictEqual(cart.items.length, 0, 'Cart should be empty')
    })

    it('clears only the specified session cart', async () => {
      // Arrange
      const session1 = generateId()
      const session2 = generateId()

      await addToCart(context, session1, generateId(), 'book-1', 'Session 1 Book', 10.0, 1)
      await addToCart(context, session2, generateId(), 'book-2', 'Session 2 Book', 20.0, 1)

      // Act
      await clearCart(context, session1)

      // Assert
      const cart1 = await getCart(context, session1)
      const cart2 = await getCart(context, session2)

      assert.strictEqual(cart1.items.length, 0, 'Session 1 cart should be cleared')
      assert.strictEqual(cart2.items.length, 1, 'Session 2 cart should be untouched')
    })
  })

  // =============================================================================
  // getCartTotal Tests
  // =============================================================================

  describe('getCartTotal', () => {
    it('returns 0 for empty cart', () => {
      // Arrange
      const cart: Cart = { items: [] }

      // Act
      const total = getCartTotal(cart)

      // Assert
      assert.strictEqual(total, 0, 'Empty cart should have total of 0')
    })

    it('calculates total for single item', () => {
      // Arrange
      const cart: Cart = {
        items: [
          {
            bookId: generateId(),
            slug: 'test-book',
            title: 'Test Book',
            price: 29.99,
            quantity: 2,
          },
        ],
      }

      // Act
      const total = getCartTotal(cart)

      // Assert
      assert.strictEqual(total, 59.98, 'Should calculate price * quantity')
    })

    it('calculates total for multiple items', () => {
      // Arrange
      const cart: Cart = {
        items: [
          {
            bookId: generateId(),
            slug: 'book-1',
            title: 'Book 1',
            price: 10.0,
            quantity: 2,
          },
          {
            bookId: generateId(),
            slug: 'book-2',
            title: 'Book 2',
            price: 15.5,
            quantity: 3,
          },
          {
            bookId: generateId(),
            slug: 'book-3',
            title: 'Book 3',
            price: 20.0,
            quantity: 1,
          },
        ],
      }

      // Act
      const total = getCartTotal(cart)

      // Assert
      // (10 * 2) + (15.5 * 3) + (20 * 1) = 20 + 46.5 + 20 = 86.5
      assert.strictEqual(total, 86.5, 'Should calculate sum of all items')
    })

    it('handles quantity of 1', () => {
      // Arrange
      const cart: Cart = {
        items: [
          {
            bookId: generateId(),
            slug: 'test-book',
            title: 'Test Book',
            price: 99.99,
            quantity: 1,
          },
        ],
      }

      // Act
      const total = getCartTotal(cart)

      // Assert
      assert.strictEqual(total, 99.99, 'Should handle quantity of 1')
    })

    it('is a pure function (does not modify cart)', () => {
      // Arrange
      const cart: Cart = {
        items: [
          {
            bookId: generateId(),
            slug: 'test-book',
            title: 'Test Book',
            price: 10.0,
            quantity: 5,
          },
        ],
      }

      const originalLength = cart.items.length
      const originalQuantity = cart.items[0].quantity

      // Act
      getCartTotal(cart)

      // Assert
      assert.strictEqual(cart.items.length, originalLength, 'Cart items should not be modified')
      assert.strictEqual(cart.items[0].quantity, originalQuantity, 'Item quantity should not be modified')
    })
  })

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('Integration Tests', () => {
    it('full cart lifecycle: add → update → remove → clear', async () => {
      // Arrange
      const book1 = generateId()
      const book2 = generateId()

      // Act & Assert - Add items
      await addToCart(context, sessionId, book1, 'book-1', 'Book 1', 10.0, 1)
      let cart = await addToCart(context, sessionId, book2, 'book-2', 'Book 2', 20.0, 2)
      assert.strictEqual(cart.items.length, 2, 'Should have 2 items after adding')

      // Act & Assert - Update item
      cart = (await updateCartItem(context, sessionId, book1, 5))!
      assert.strictEqual(cart.items.find((i) => i.bookId === book1)!.quantity, 5, 'Should update quantity')

      // Act & Assert - Remove item
      cart = await removeFromCart(context, sessionId, book2)
      assert.strictEqual(cart.items.length, 1, 'Should have 1 item after removal')

      // Act & Assert - Clear cart
      await clearCart(context, sessionId)
      cart = await getCart(context, sessionId)
      assert.strictEqual(cart.items.length, 0, 'Cart should be empty after clear')
    })

    it('cart total updates correctly through lifecycle', async () => {
      // Arrange
      const book1 = generateId()
      const book2 = generateId()

      // Act & Assert - Empty cart
      let cart = await getCart(context, sessionId)
      assert.strictEqual(getCartTotal(cart), 0, 'Empty cart total should be 0')

      // Add items
      cart = await addToCart(context, sessionId, book1, 'book-1', 'Book 1', 10.0, 2)
      assert.strictEqual(getCartTotal(cart), 20.0, 'Total should be 20 after adding')

      cart = await addToCart(context, sessionId, book2, 'book-2', 'Book 2', 15.0, 1)
      assert.strictEqual(getCartTotal(cart), 35.0, 'Total should be 35 after adding second item')

      // Update quantity
      cart = (await updateCartItem(context, sessionId, book1, 5))!
      assert.strictEqual(getCartTotal(cart), 65.0, 'Total should be 65 after update')

      // Remove item
      cart = await removeFromCart(context, sessionId, book2)
      assert.strictEqual(getCartTotal(cart), 50.0, 'Total should be 50 after removal')
    })

    it('multiple sessions have independent carts', async () => {
      // Arrange
      const session1 = generateId()
      const session2 = generateId()
      const session3 = generateId()

      const book1 = generateId()
      const book2 = generateId()
      const book3 = generateId()

      // Act
      await addToCart(context, session1, book1, 'book-1', 'Book 1', 10.0, 1)
      await addToCart(context, session2, book2, 'book-2', 'Book 2', 20.0, 2)
      await addToCart(context, session3, book3, 'book-3', 'Book 3', 30.0, 3)

      // Assert
      const cart1 = await getCart(context, session1)
      const cart2 = await getCart(context, session2)
      const cart3 = await getCart(context, session3)

      assert.strictEqual(cart1.items.length, 1, 'Session 1 should have 1 item')
      assert.strictEqual(cart2.items.length, 1, 'Session 2 should have 1 item')
      assert.strictEqual(cart3.items.length, 1, 'Session 3 should have 1 item')

      assert.strictEqual(getCartTotal(cart1), 10.0, 'Session 1 total should be 10')
      assert.strictEqual(getCartTotal(cart2), 40.0, 'Session 2 total should be 40')
      assert.strictEqual(getCartTotal(cart3), 90.0, 'Session 3 total should be 90')
    })
  })
})
