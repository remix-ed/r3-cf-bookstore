/**
 * Orders Model Tests
 *
 * Tests for order data operations:
 * - getAllOrders: JOIN queries, ordering, relationship grouping
 * - getOrderById: Single order retrieval with items
 * - getOrdersByUserId: User-specific orders with filtering
 * - createOrder: Order creation with items, total calculation
 * - updateOrderStatus: Status updates
 * - Integration: Full order lifecycle
 */

import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import type { RequestContext } from '@remix-run/fetch-router'
import {
  getAllOrders,
  getOrderById,
  getOrdersByUserId,
  createOrder,
  updateOrderStatus,
  type Order,
  type OrderItem,
  type ShippingAddress,
} from './orders.ts'
import { createTestRouter } from '../../test/helpers.ts'
import { cloudflareContextKey } from '../context.server.ts'
import { generateId, NANOID_PATTERN } from '../utils/nanoid.ts'
import { SERVICES_KEY } from '../services/container.ts'
import { createD1Service } from '../services/d1.server.ts'
import { createSessionService } from '../services/session.server.ts'
import { seedTestDatabase, clearTestDatabase } from '../../test/seed.ts'

describe('Orders Model', () => {
  let router: any
  let context: RequestContext

  before(async () => {
    router = await createTestRouter()

    // Clear and seed database
    await clearTestDatabase(router.env.DB)
    await seedTestDatabase(router.env.DB)

    const storage = new Map()
    storage.set(cloudflareContextKey, { env: router.env, ctx: router.ctx })
    storage.set(SERVICES_KEY, {
      d1: createD1Service(router.env),
      session: createSessionService(router.env.SESSION_KV)
    })
    context = storage as any
  })

  // =============================================================================
  // getAllOrders Tests
  // =============================================================================

  describe('getAllOrders', () => {
    it('returns all orders with items using JOIN query', async () => {
      // Act
      const orders = await getAllOrders(context)

      // Assert
      assert.ok(Array.isArray(orders), 'Should return array')
      assert.ok(orders.length > 0, 'Should have seed data orders')

      // Check order structure
      const order = orders[0]
      assert.ok(order.id, 'Should have id')
      assert.ok(order.userId, 'Should have userId')
      assert.ok(typeof order.total === 'number', 'Should have total')
      assert.ok(['pending', 'processing', 'shipped', 'delivered'].includes(order.status), 'Should have valid status')
      assert.ok(order.shippingAddress, 'Should have shippingAddress')
      assert.ok(order.shippingAddress.street, 'ShippingAddress should have street')
      assert.ok(order.shippingAddress.city, 'ShippingAddress should have city')
      assert.ok(order.shippingAddress.state, 'ShippingAddress should have state')
      assert.ok(order.shippingAddress.zip, 'ShippingAddress should have zip')
      assert.ok(Array.isArray(order.items), 'Should have items array')
      assert.ok(order.createdAt instanceof Date, 'createdAt should be Date object')
    })

    it('returns orders sorted by createdAt DESC', async () => {
      // Arrange - Create orders with different createdAt dates
      const userId = '2' // Use seeded customer user
      const shippingAddress: ShippingAddress = {
        street: '100 Sort St',
        city: 'Sort City',
        state: 'CA',
        zip: '12345',
      }

      // Create 3 orders at different times
      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          generateId(),
          userId,
          '[]',
          100,
          'pending',
          JSON.stringify(shippingAddress),
          Math.floor(new Date('2024-01-01').getTime() / 1000),
        )
        .run()

      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          generateId(),
          userId,
          '[]',
          200,
          'shipped',
          JSON.stringify(shippingAddress),
          Math.floor(new Date('2024-03-01').getTime() / 1000),
        )
        .run()

      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          generateId(),
          userId,
          '[]',
          300,
          'delivered',
          JSON.stringify(shippingAddress),
          Math.floor(new Date('2024-02-01').getTime() / 1000),
        )
        .run()

      // Act
      const orders = await getAllOrders(context)

      // Assert - Should be sorted with most recent first
      assert.ok(orders.length >= 3, 'Should have at least 3 orders')
      for (let i = 1; i < orders.length; i++) {
        assert.ok(
          orders[i - 1].createdAt >= orders[i].createdAt,
          `Orders should be ordered by createdAt DESC: ${orders[i - 1].createdAt} >= ${orders[i].createdAt}`,
        )
      }
    })

    it('groups order items correctly using groupOneToMany', async () => {
      // Act
      const orders = await getAllOrders(context)

      // Assert - Find an order with multiple items
      const orderWithMultipleItems = orders.find((o) => o.items.length > 1)
      if (orderWithMultipleItems) {
        assert.ok(orderWithMultipleItems.items.length > 1, 'Should have multiple items')

        // Check each item has correct structure
        orderWithMultipleItems.items.forEach((item) => {
          assert.ok(item.bookId, 'Item should have bookId')
          assert.ok(item.title, 'Item should have title')
          assert.ok(typeof item.price === 'number', 'Item should have price')
          assert.ok(typeof item.quantity === 'number', 'Item should have quantity')
        })
      }
    })

    it('handles orders without items (LEFT JOIN behavior)', async () => {
      // Arrange - Create an order without items (edge case)
      const orderId = generateId()
      const userId = '2' // Use seeded customer user
      const shippingAddress = JSON.stringify({
        street: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
      })

      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(orderId, userId, '[]', 0, 'pending', shippingAddress, Math.floor(Date.now() / 1000))
        .run()

      // Act
      const orders = await getAllOrders(context)

      // Assert
      const emptyOrder = orders.find((o) => o.id === orderId)
      assert.ok(emptyOrder, 'Should find order without items')
      assert.strictEqual(emptyOrder.items.length, 0, 'Order should have empty items array')
    })
  })

  // =============================================================================
  // getOrderById Tests
  // =============================================================================

  describe('getOrderById', () => {
    it('returns order by id with all items', async () => {
      // Arrange
      const allOrders = await getAllOrders(context)
      const targetOrder = allOrders[0]

      // Act
      const order = await getOrderById(context, targetOrder.id)

      // Assert
      assert.ok(order, 'Should return order')
      assert.strictEqual(order.id, targetOrder.id, 'Should return correct order')
      assert.strictEqual(order.userId, targetOrder.userId, 'Should have correct userId')
      assert.strictEqual(order.total, targetOrder.total, 'Should have correct total')
      assert.strictEqual(order.status, targetOrder.status, 'Should have correct status')
      assert.strictEqual(order.items.length, targetOrder.items.length, 'Should have all items')
    })

    it('returns undefined for non-existent order id', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const order = await getOrderById(context, nonExistentId)

      // Assert
      assert.strictEqual(order, undefined, 'Should return undefined for non-existent id')
    })

    it('returns order with multiple items correctly grouped', async () => {
      // Arrange - Create order with multiple items
      const orderId = generateId()
      const userId = '2' // Use seeded customer user
      const shippingAddress = JSON.stringify({
        street: '456 Multi St',
        city: 'Multi City',
        state: 'NY',
        zip: '67890',
      })

      // Add 3 items
      const items = [
        { bookId: generateId(), title: 'Book 1', price: 10, quantity: 1 },
        { bookId: generateId(), title: 'Book 2', price: 15, quantity: 2 },
        { bookId: generateId(), title: 'Book 3', price: 20, quantity: 1 },
      ]

      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(orderId, userId, JSON.stringify(items), 50, 'pending', shippingAddress, Math.floor(Date.now() / 1000))
        .run()

      // Act
      const order = await getOrderById(context, orderId)

      // Assert
      assert.ok(order, 'Should return order')
      assert.strictEqual(order.items.length, 3, 'Should have 3 items')
      assert.strictEqual(order.items[0].title, 'Book 1', 'Should have first item')
      assert.strictEqual(order.items[1].title, 'Book 2', 'Should have second item')
      assert.strictEqual(order.items[2].title, 'Book 3', 'Should have third item')
    })
  })

  // =============================================================================
  // getOrdersByUserId Tests
  // =============================================================================

  describe('getOrdersByUserId', () => {
    it('returns all orders for a specific user', async () => {
      // Arrange - Create user with multiple orders
      const userId = '2' // Use seeded customer user
      const shippingAddress = JSON.stringify({
        street: '789 User St',
        city: 'User City',
        state: 'TX',
        zip: '54321',
      })

      // Create 2 orders for this user
      const order1Id = generateId()
      const order2Id = generateId()

      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(order1Id, userId, '[]', 100, 'pending', shippingAddress, Math.floor(new Date('2024-01-01').getTime() / 1000))
        .run()

      await router.env.DB.prepare(
        'INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(order2Id, userId, '[]', 200, 'shipped', shippingAddress, Math.floor(new Date('2024-02-01').getTime() / 1000))
        .run()

      // Act
      const orders = await getOrdersByUserId(context, userId)

      // Assert - Account for seeded orders (2 from seed + 2 from test = 4 total)
      assert.ok(orders.length >= 2, `Should return at least 2 orders, got ${orders.length}`)
      assert.ok(orders.every((o) => o.userId === userId), 'All orders should belong to user')

      // Verify our test orders are in the results
      const testOrders = orders.filter(o => o.id === order1Id || o.id === order2Id)
      assert.strictEqual(testOrders.length, 2, 'Should find both test orders')
    })

    it('returns orders for user sorted by createdAt DESC', async () => {
      // Arrange - Get any user with multiple orders
      const allOrders = await getAllOrders(context)
      const userWithMultipleOrders = allOrders.find(
        (order) => allOrders.filter((o) => o.userId === order.userId).length > 1,
      )

      if (userWithMultipleOrders) {
        // Act
        const userOrders = await getOrdersByUserId(context, userWithMultipleOrders.userId)

        // Assert
        assert.ok(userOrders.length >= 2, 'User should have multiple orders')
        for (let i = 1; i < userOrders.length; i++) {
          assert.ok(
            userOrders[i - 1].createdAt >= userOrders[i].createdAt,
            'Orders should be sorted by createdAt DESC',
          )
        }
      }
    })

    it('returns empty array for user with no orders', async () => {
      // Arrange
      const nonExistentUserId = generateId()

      // Act
      const orders = await getOrdersByUserId(context, nonExistentUserId)

      // Assert
      assert.ok(Array.isArray(orders), 'Should return array')
      assert.strictEqual(orders.length, 0, 'Should return empty array')
    })
  })

  // =============================================================================
  // createOrder Tests
  // =============================================================================

  describe('createOrder', () => {
    it('creates order with single item', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Test Book',
          price: 29.99,
          quantity: 1,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '123 Create St',
        city: 'Create City',
        state: 'CA',
        zip: '12345',
      }

      // Act
      const order = await createOrder(context, userId, items, shippingAddress)

      // Assert
      assert.ok(order, 'Should return order')
      assert.ok(order.id, 'Should have UUID id')
      assert.strictEqual(order.userId, userId, 'Should have correct userId')
      assert.strictEqual(order.items.length, 1, 'Should have 1 item')
      assert.strictEqual(order.total, 29.99, 'Should calculate correct total')
      assert.strictEqual(order.status, 'pending', 'Should have pending status')
      assert.deepEqual(order.shippingAddress, shippingAddress, 'Should have correct shipping address')
      assert.ok(order.createdAt instanceof Date, 'Should have Date createdAt')
    })

    it('creates order with multiple items', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Book 1',
          price: 10.0,
          quantity: 2,
        },
        {
          bookId: generateId(),
          title: 'Book 2',
          price: 15.5,
          quantity: 1,
        },
        {
          bookId: generateId(),
          title: 'Book 3',
          price: 20.0,
          quantity: 3,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '456 Multi St',
        city: 'Multi City',
        state: 'NY',
        zip: '67890',
      }

      // Act
      const order = await createOrder(context, userId, items, shippingAddress)

      // Assert
      assert.ok(order, 'Should return order')
      assert.strictEqual(order.items.length, 3, 'Should have 3 items')
      // Total: (10 * 2) + (15.5 * 1) + (20 * 3) = 20 + 15.5 + 60 = 95.5
      assert.strictEqual(order.total, 95.5, 'Should calculate correct total for multiple items')
    })

    it('calculates total correctly', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Expensive Book',
          price: 99.99,
          quantity: 5,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '789 Total St',
        city: 'Total City',
        state: 'TX',
        zip: '54321',
      }

      // Act
      const order = await createOrder(context, userId, items, shippingAddress)

      // Assert
      // Total: 99.99 * 5 = 499.95
      assert.strictEqual(order.total, 499.95, 'Should calculate total as price * quantity')
    })

    it('generates unique nanoid for order id', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Nanoid Test Book',
          price: 10.0,
          quantity: 1,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '321 Nanoid St',
        city: 'Nanoid City',
        state: 'FL',
        zip: '11111',
      }

      // Act
      const order1 = await createOrder(context, userId, items, shippingAddress)
      const order2 = await createOrder(context, userId, items, shippingAddress)

      // Assert
      assert.notEqual(order1.id, order2.id, 'Should generate unique nanoids')
      assert.match(order1.id, NANOID_PATTERN, 'Should be valid nanoid')
    })

    it('stores shipping address correctly', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Shipping Test Book',
          price: 10.0,
          quantity: 1,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '999 Shipping Ln',
        city: 'Shipping City',
        state: 'WA',
        zip: '98765-4321', // Test ZIP+4 format
      }

      // Act
      const order = await createOrder(context, userId, items, shippingAddress)

      // Assert
      assert.deepEqual(order.shippingAddress, shippingAddress, 'Should store complete shipping address')
      assert.strictEqual(order.shippingAddress.zip, '98765-4321', 'Should support ZIP+4 format')
    })
  })

  // =============================================================================
  // updateOrderStatus Tests
  // =============================================================================

  describe('updateOrderStatus', () => {
    it('updates order status successfully', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Status Test Book',
          price: 10.0,
          quantity: 1,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '111 Status St',
        city: 'Status City',
        state: 'OR',
        zip: '97201',
      }

      const order = await createOrder(context, userId, items, shippingAddress)
      assert.strictEqual(order.status, 'pending', 'Initial status should be pending')

      // Act
      const updated = await updateOrderStatus(context, order.id, 'processing')

      // Assert
      assert.ok(updated, 'Should return updated order')
      assert.strictEqual(updated.status, 'processing', 'Status should be updated to processing')
      assert.strictEqual(updated.id, order.id, 'Should be same order')
    })

    it('returns undefined for non-existent order', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const updated = await updateOrderStatus(context, nonExistentId, 'shipped')

      // Assert
      assert.strictEqual(updated, undefined, 'Should return undefined for non-existent order')
    })

    it('supports all valid status values', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'All Status Test Book',
          price: 10.0,
          quantity: 1,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '222 AllStatus St',
        city: 'AllStatus City',
        state: 'MA',
        zip: '02108',
      }

      const order = await createOrder(context, userId, items, shippingAddress)
      const statuses: Order['status'][] = ['pending', 'processing', 'shipped', 'delivered']

      // Act & Assert
      for (const status of statuses) {
        const updated = await updateOrderStatus(context, order.id, status)
        assert.ok(updated, `Should update to ${status}`)
        assert.strictEqual(updated.status, status, `Status should be ${status}`)
      }
    })
  })

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('Integration Tests', () => {
    it('full order lifecycle: create → get → update status → get', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const items: OrderItem[] = [
        {
          bookId: generateId(),
          title: 'Lifecycle Book',
          price: 25.0,
          quantity: 2,
        },
      ]
      const shippingAddress: ShippingAddress = {
        street: '333 Lifecycle Ave',
        city: 'Lifecycle City',
        state: 'CO',
        zip: '80202',
      }

      // Act & Assert - Create
      const created = await createOrder(context, userId, items, shippingAddress)
      assert.ok(created, 'Should create order')
      assert.strictEqual(created.status, 'pending', 'Should start as pending')
      assert.strictEqual(created.total, 50.0, 'Should calculate total')

      // Act & Assert - Get by ID
      const retrieved = await getOrderById(context, created.id)
      assert.ok(retrieved, 'Should retrieve order')
      assert.strictEqual(retrieved.id, created.id, 'Should retrieve correct order')

      // Act & Assert - Update status
      const processing = await updateOrderStatus(context, created.id, 'processing')
      assert.ok(processing, 'Should update to processing')
      assert.strictEqual(processing.status, 'processing', 'Status should be processing')

      const shipped = await updateOrderStatus(context, created.id, 'shipped')
      assert.ok(shipped, 'Should update to shipped')
      assert.strictEqual(shipped.status, 'shipped', 'Status should be shipped')

      // Act & Assert - Final get
      const final = await getOrderById(context, created.id)
      assert.ok(final, 'Should retrieve final order')
      assert.strictEqual(final.status, 'shipped', 'Final status should be shipped')
    })

    it('user can have multiple orders', async () => {
      // Arrange
      const userId = '2' // Use seeded customer user
      const shippingAddress: ShippingAddress = {
        street: '444 MultiOrder St',
        city: 'MultiOrder City',
        state: 'IL',
        zip: '60601',
      }

      // Act - Create 3 orders for same user
      const order1 = await createOrder(
        context,
        userId,
        [{ bookId: generateId(), title: 'Book 1', price: 10.0, quantity: 1 }],
        shippingAddress,
      )
      const order2 = await createOrder(
        context,
        userId,
        [{ bookId: generateId(), title: 'Book 2', price: 20.0, quantity: 1 }],
        shippingAddress,
      )
      const order3 = await createOrder(
        context,
        userId,
        [{ bookId: generateId(), title: 'Book 3', price: 30.0, quantity: 1 }],
        shippingAddress,
      )

      // Assert - Get user orders
      const userOrders = await getOrdersByUserId(context, userId)
      assert.ok(userOrders.length >= 3, 'User should have at least 3 orders')

      const orderIds = userOrders.map((o) => o.id)
      assert.ok(orderIds.includes(order1.id), 'Should include order 1')
      assert.ok(orderIds.includes(order2.id), 'Should include order 2')
      assert.ok(orderIds.includes(order3.id), 'Should include order 3')
    })
  })
})
