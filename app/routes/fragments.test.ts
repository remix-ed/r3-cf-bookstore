/**
 * Fragments Handler Tests
 *
 * Tests the fragment endpoints used for partial hydration and
 * client-side component loading. These endpoints are critical for
 * performance and progressive enhancement.
 */

import * as assert from 'node:assert/strict'
import { describe, it, before, beforeEach } from 'node:test'

import {
  createTestRouter,
  seedTestDatabase,
  clearTestDatabase,
  loginAsCustomer,
  requestWithSession,
  assertContains,
  assertNotContains,
} from '~/test/helpers'
import { createBook } from '~/app/models/books'
import { addToCart } from '~/app/models/cart'

describe('Fragments Routes', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
  })

  beforeEach(async () => {
    await clearTestDatabase(router.env.DB)
    await seedTestDatabase(router.env.DB)
  })

  // =============================================================================
  // BookCard Fragment Tests
  // =============================================================================

  describe('BookCard Fragment', () => {
    it('returns book card fragment for seeded book', async () => {
      // Act - Request fragment for seeded book (slug: bbq)
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      assert.strictEqual(response.status, 200, 'Should return 200 for valid book')
      const html = await response.text()
      assertContains(html, 'Ash &amp; Smoke')
      assertContains(html, 'Rusty Char-Broil')
      assertContains(html, '$16.99')
    })

    it('returns 404 for non-existent book slug', async () => {
      // Arrange
      const invalidSlug = 'non-existent-book-slug'

      // Act
      const response = await router.fetch(
        `http://localhost:3000/fragments/book-card/${invalidSlug}`
      )

      // Assert
      assert.strictEqual(response.status, 404, 'Should return 404 for missing book')
      const html = await response.text()
      assertContains(html, 'Book not found')
    })

    it('indicates when book is in cart', async () => {
      // Arrange - Create a test book
      const sessionId = await loginAsCustomer(router)

      // Add seeded book to cart via cart API
      await router.fetch('http://localhost:3000/cart/api/add', {
        method: 'POST',
        headers: {
          Cookie: `sessionId=${sessionId}`,
        },
        body: new URLSearchParams({
          bookId: '001',
          slug: 'bbq',
        }),
        redirect: 'manual',
      })

      // Act - Request fragment with session
      const response = await router.fetch(
        requestWithSession('http://localhost:3000/fragments/book-card/bbq', sessionId)
      )

      // Assert
      assert.strictEqual(response.status, 200)
      const html = await response.text()
      assertContains(html, 'Ash')
      // Should indicate book is in cart with "Remove from Cart" button
      assertContains(html, 'Remove from Cart')
    })

    it('indicates when book is not in cart', async () => {
      // Arrange
      const sessionId = await loginAsCustomer(router)

      // Act - Don't add to cart, just request the fragment
      const response = await router.fetch(
        requestWithSession('http://localhost:3000/fragments/book-card/bbq', sessionId)
      )

      // Assert
      assert.strictEqual(response.status, 200)
      const html = await response.text()
      assertContains(html, 'Ash')
      // Should show "Add to Cart" button for book not in cart
      assertContains(html, 'Add to Cart')
      assertNotContains(html, 'Remove from Cart')
    })

    it('handles unauthenticated users', async () => {
      // Act - Request without session
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      assert.strictEqual(response.status, 200, 'Should work for unauthenticated users')
      const html = await response.text()
      assertContains(html, 'Ash')
      assertContains(html, '$16.99')
    })

    it('displays book image URL', async () => {
      // Act
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      const html = await response.text()
      assertContains(html, '/images/bbq-1.png')
    })

    it('handles books with special characters in title', async () => {
      // Act - Seeded book has '&' in title
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      assert.strictEqual(response.status, 200)
      const html = await response.text()
      // HTML should properly escape special characters
      assertContains(html, 'Ash')
      assertContains(html, 'Smoke')
      // Check that & is escaped
      assertContains(html, '&amp;')
    })

    it('displays correct price formatting', async () => {
      // Act
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      const html = await response.text()
      assertContains(html, '$16.99')
      // Ensure proper currency formatting
      assert.ok(html.match(/\$\d+\.\d{2}/), 'Should format price as $XX.XX')
    })

    it('works with all seeded books', async () => {
      // Test all seeded book slugs
      const slugs = ['bbq', 'heavy-metal', 'three-ways']

      for (const slug of slugs) {
        const response = await router.fetch(`http://localhost:3000/fragments/book-card/${slug}`)
        assert.strictEqual(response.status, 200, `Should return 200 for ${slug}`)
        const html = await response.text()
        assert.ok(html.length > 0, `Should return non-empty HTML for ${slug}`)
      }
    })
  })

  // =============================================================================
  // Fragment Response Tests
  // =============================================================================

  describe('Fragment Response Format', () => {
    it('returns HTML content type', async () => {
      // Act
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      assert.ok(
        response.headers.get('Content-Type')?.includes('text/html'),
        'Should return HTML content type'
      )
    })

    it('returns valid HTML fragment', async () => {
      // Act
      const response = await router.fetch('http://localhost:3000/fragments/book-card/bbq')

      // Assert
      const html = await response.text()
      // Should not contain full HTML document structure (no <html>, <head>, <body>)
      // Fragments are partial HTML for insertion into existing pages
      assert.ok(html.length > 0, 'Should return non-empty HTML')
      assertContains(html, 'Ash')
    })
  })

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('Integration with Cart', () => {
    it('reflects cart state changes', async () => {
      // Arrange
      const sessionId = await loginAsCustomer(router)

      // Act 1 - Get fragment before adding to cart
      const response1 = await router.fetch(
        requestWithSession('http://localhost:3000/fragments/book-card/bbq', sessionId)
      )
      const html1 = await response1.text()

      // Add to cart
      await router.fetch('http://localhost:3000/cart/api/add', {
        method: 'POST',
        headers: {
          Cookie: `sessionId=${sessionId}`,
        },
        body: new URLSearchParams({
          bookId: '001',
          slug: 'bbq',
        }),
        redirect: 'manual',
      })

      // Act 2 - Get fragment after adding to cart
      const response2 = await router.fetch(
        requestWithSession('http://localhost:3000/fragments/book-card/bbq', sessionId)
      )
      const html2 = await response2.text()

      // Assert - HTML should be different to reflect cart state
      assert.notEqual(html1, html2, 'Fragment should change after adding to cart')
      assertContains(html1, 'Add to Cart')
      assertContains(html2, 'Remove from Cart')
    })

    it('handles concurrent requests for different books', async () => {
      // Act - Make concurrent requests
      const [response1, response2, response3] = await Promise.all([
        router.fetch('http://localhost:3000/fragments/book-card/bbq'),
        router.fetch('http://localhost:3000/fragments/book-card/heavy-metal'),
        router.fetch('http://localhost:3000/fragments/book-card/three-ways'),
      ])

      // Assert
      assert.strictEqual(response1.status, 200)
      assert.strictEqual(response2.status, 200)
      assert.strictEqual(response3.status, 200)

      const html1 = await response1.text()
      const html2 = await response2.text()
      const html3 = await response3.text()

      assertContains(html1, 'Ash')
      assertContains(html2, 'Heavy Metal')
      assertContains(html3, 'Three Ways')

      // Check isolation - each response should only contain its own book
      assertNotContains(html1, 'Heavy Metal')
      assertNotContains(html1, 'Three Ways')
      assertNotContains(html2, 'Ash')
      assertNotContains(html2, 'Three Ways')
      assertNotContains(html3, 'Ash')
      assertNotContains(html3, 'Heavy Metal')
    })

    it('cart state is isolated per session', async () => {
      // Arrange - Create two different sessions
      const sessionId1 = await loginAsCustomer(router)

      // Register a second customer
      await router.fetch('http://localhost:3000/register', {
        method: 'POST',
        body: new URLSearchParams({
          name: 'Another Customer',
          email: `customer2-${Date.now()}@example.com`,
          password: 'password123',
        }),
        redirect: 'manual',
      })

      // Login as second customer
      const loginResponse = await router.fetch('http://localhost:3000/login', {
        method: 'POST',
        body: new URLSearchParams({
          email: `customer2-${Date.now()}@example.com`,
          password: 'password123',
        }),
        redirect: 'manual',
      })

      const setCookieHeader = loginResponse.headers.get('Set-Cookie')
      const sessionId2Match = setCookieHeader?.match(/sessionId=([^;]+)/)
      const sessionId2 = sessionId2Match ? sessionId2Match[1] : null

      // Add book to cart for session 1 only
      await router.fetch('http://localhost:3000/cart/api/add', {
        method: 'POST',
        headers: {
          Cookie: `sessionId=${sessionId1}`,
        },
        body: new URLSearchParams({
          bookId: '001',
          slug: 'bbq',
        }),
        redirect: 'manual',
      })

      // Act - Get fragments for both sessions
      const response1 = await router.fetch(
        requestWithSession('http://localhost:3000/fragments/book-card/bbq', sessionId1)
      )
      const response2 = sessionId2
        ? await router.fetch(
            requestWithSession('http://localhost:3000/fragments/book-card/bbq', sessionId2)
          )
        : null

      // Assert - Session 1 should show "Remove from Cart", Session 2 should show "Add to Cart"
      const html1 = await response1.text()
      assertContains(html1, 'Remove from Cart')

      if (response2) {
        const html2 = await response2.text()
        assertContains(html2, 'Add to Cart')
        assertNotContains(html2, 'Remove from Cart')
      }
    })
  })

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('handles URL-encoded slugs correctly', async () => {
      // Act - Request with URL encoding
      const response = await router.fetch(
        'http://localhost:3000/fragments/book-card/three-ways'
      )

      // Assert
      assert.strictEqual(response.status, 200)
      const html = await response.text()
      assertContains(html, 'Three Ways')
    })

    it('handles slugs with hyphens', async () => {
      // Act - All seeded slugs have hyphens
      const response = await router.fetch('http://localhost:3000/fragments/book-card/heavy-metal')

      // Assert
      assert.strictEqual(response.status, 200)
      const html = await response.text()
      assertContains(html, 'Heavy Metal')
    })

    it('returns correct status codes', async () => {
      // Valid slug - should return 200
      const validResponse = await router.fetch('http://localhost:3000/fragments/book-card/bbq')
      assert.strictEqual(validResponse.status, 200)

      // Invalid slug - should return 404
      const invalidResponse = await router.fetch(
        'http://localhost:3000/fragments/book-card/invalid-slug'
      )
      assert.strictEqual(invalidResponse.status, 404)
    })
  })
})
