/**
 * Cart Persistence Integration Tests
 *
 * Tests cart persistence across sessions, login/logout, registration,
 * and checkout flows. Verifies that cart data in KV storage behaves
 * correctly in various scenarios.
 */

import * as assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'

import {
  createTestRouter,
  cleanupPlatform,
  getSessionCookie,
  requestWithSession,
  assertContains,
  assertNotContains,
} from '../helpers'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import booksSeed from '~/database/seeds/test/003-test-books.seed'
import ordersSeed from '~/database/seeds/test/004-test-orders.seed'

describe('Cart Persistence Integration Tests', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)
    await booksSeed(router.env.DB)
    await ordersSeed(router.env.DB)
  })

  after(async () => {
    // Add delay to allow workerd to cleanup file descriptors
    await cleanupPlatform(150)
  })

  it('guest cart persists when user logs in', async () => {
    // Step 1: Add items to cart as guest
    let addResponse1 = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // Ash & Smoke
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let guestSessionId = getSessionCookie(addResponse1)
    assert.ok(guestSessionId, 'Should get session ID from add to cart')

    // Add second item with same guest session
    let addRequest2 = requestWithSession('http://localhost:3000/cart/api/add', guestSessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '002', // Heavy Metal
        slug: 'heavy-metal',
      }),
      redirect: 'manual',
    })
    await router.fetch(addRequest2)

    // Step 2: Verify guest cart has 2 items
    let guestCartRequest = requestWithSession('http://localhost:3000/cart', guestSessionId)
    let guestCartResponse = await router.fetch(guestCartRequest)
    let guestCartHtml = await guestCartResponse.text()

    assertContains(guestCartHtml, 'Ash')
    assertContains(guestCartHtml, 'Heavy Metal Guitar Riffs')

    // Step 3: Login with guest session cookie
    let loginRequest = requestWithSession('http://localhost:3000/login', guestSessionId, {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    })
    let loginResponse = await router.fetch(loginRequest)

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/account')

    // Get session ID after login (should be the same)
    let loggedInSessionId = getSessionCookie(loginResponse)
    assert.equal(loggedInSessionId, guestSessionId, 'Session ID should remain the same after login')

    // Step 4: Verify cart still has both items after login
    let loggedInCartRequest = requestWithSession('http://localhost:3000/cart', loggedInSessionId)
    let loggedInCartResponse = await router.fetch(loggedInCartRequest)
    let loggedInCartHtml = await loggedInCartResponse.text()

    assertContains(loggedInCartHtml, 'Ash')
    assertContains(loggedInCartHtml, 'Heavy Metal Guitar Riffs')
  })

  it('guest cart persists when user registers', async () => {
    // Step 1: Add items to cart as guest
    let addResponse = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '003', // Three Ways
        slug: 'three-ways',
      }),
      redirect: 'manual',
    })

    let guestSessionId = getSessionCookie(addResponse)
    assert.ok(guestSessionId, 'Should get session ID from add to cart')

    // Step 2: Verify guest cart has the item
    let guestCartRequest = requestWithSession('http://localhost:3000/cart', guestSessionId)
    let guestCartResponse = await router.fetch(guestCartRequest)
    let guestCartHtml = await guestCartResponse.text()

    assertContains(guestCartHtml, 'Three Ways to Change Your Life')

    // Step 3: Register with guest session cookie
    let timestamp = Date.now()
    let registerRequest = requestWithSession('http://localhost:3000/register', guestSessionId, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'New User',
        email: `newuser${timestamp}@example.com`,
        password: 'password123',
      }),
      redirect: 'manual',
    })
    let registerResponse = await router.fetch(registerRequest)

    assert.equal(registerResponse.status, 302)
    assert.equal(registerResponse.headers.get('Location'), '/account')

    // Get session ID after registration (should be the same)
    let registeredSessionId = getSessionCookie(registerResponse)
    assert.equal(
      registeredSessionId,
      guestSessionId,
      'Session ID should remain the same after registration'
    )

    // Step 4: Verify cart still has the item after registration
    let registeredCartRequest = requestWithSession('http://localhost:3000/cart', registeredSessionId)
    let registeredCartResponse = await router.fetch(registeredCartRequest)
    let registeredCartHtml = await registeredCartResponse.text()

    assertContains(registeredCartHtml, 'Three Ways to Change Your Life')
  })

  it('different sessions have isolated carts', async () => {
    // Step 1: Create first session with one item
    let addResponse1 = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // Ash & Smoke
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let session1 = getSessionCookie(addResponse1)
    assert.ok(session1)

    // Step 2: Create second session with different item (no cookie = new session)
    let addResponse2 = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '002', // Heavy Metal
        slug: 'heavy-metal',
      }),
      redirect: 'manual',
    })

    let session2 = getSessionCookie(addResponse2)
    assert.ok(session2)
    assert.notEqual(session1, session2, 'Should have different session IDs')

    // Step 3: Verify session1 cart only has BBQ book
    let cart1Request = requestWithSession('http://localhost:3000/cart', session1)
    let cart1Response = await router.fetch(cart1Request)
    let cart1Html = await cart1Response.text()

    assertContains(cart1Html, 'Ash')
    assertNotContains(cart1Html, 'Heavy Metal Guitar Riffs')

    // Step 4: Verify session2 cart only has Heavy Metal book
    let cart2Request = requestWithSession('http://localhost:3000/cart', session2)
    let cart2Response = await router.fetch(cart2Request)
    let cart2Html = await cart2Response.text()

    assertNotContains(cart2Html, 'Ash')
    assertContains(cart2Html, 'Heavy Metal Guitar Riffs')
  })

  it('cart remains accessible after logout and re-login with same session', async () => {
    // Step 1: Login as customer
    let loginResponse = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(loginResponse)
    assert.ok(sessionId)

    // Step 2: Add item to cart
    let addRequest = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // Ash & Smoke
        slug: 'bbq',
      }),
      redirect: 'manual',
    })
    await router.fetch(addRequest)

    // Step 3: Verify cart has item
    let cartRequest1 = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse1 = await router.fetch(cartRequest1)
    let cartHtml1 = await cartResponse1.text()

    assertContains(cartHtml1, 'Ash')

    // Step 4: Logout (destroys session in SESSION_KV)
    let logoutRequest = requestWithSession('http://localhost:3000/logout', sessionId, {
      method: 'POST',
      redirect: 'manual',
    })
    await router.fetch(logoutRequest)

    // Step 5: View cart with old session cookie (cart should still exist in CART_KV)
    let cartRequest2 = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse2 = await router.fetch(cartRequest2)
    let cartHtml2 = await cartResponse2.text()

    // Cart data lives in CART_KV (separate from SESSION_KV), so it persists after logout
    assertContains(cartHtml2, 'Ash')
  })

  it('checkout clears cart after order is created', async () => {
    // Step 1: Login as customer
    let loginResponse = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(loginResponse)
    assert.ok(sessionId)

    // Step 2: Add item to cart
    let addRequest = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // Ash & Smoke
        slug: 'bbq',
      }),
      redirect: 'manual',
    })
    await router.fetch(addRequest)

    // Step 3: Complete checkout
    let checkoutRequest = requestWithSession('http://localhost:3000/checkout', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
      }),
      redirect: 'manual',
    })
    let checkoutResponse = await router.fetch(checkoutRequest)

    assert.equal(checkoutResponse.status, 302)
    assert.ok(checkoutResponse.headers.get('Location')?.includes('/checkout/'))
    assert.ok(checkoutResponse.headers.get('Location')?.includes('/confirmation'))

    // Step 4: Verify cart is now empty
    let cartRequest = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse = await router.fetch(cartRequest)
    let cartHtml = await cartResponse.text()

    assertContains(cartHtml, 'Shopping Cart')
    assertNotContains(cartHtml, 'Ash')
    // Should show empty cart message or total of $0.00
    assert.ok(
      cartHtml.includes('$0.00') || cartHtml.includes('empty') || cartHtml.includes('No items'),
      'Cart should be empty after checkout'
    )
  })

  it('cart updates are reflected immediately in the same session', async () => {
    // Step 1: Add item to cart
    let addResponse = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // Ash & Smoke ($16.99)
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    // Step 2: View cart
    let cartRequest1 = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse1 = await router.fetch(cartRequest1)
    let cartHtml1 = await cartResponse1.text()

    assertContains(cartHtml1, 'Ash')

    // Step 3: Add same item again (should increase quantity)
    let addRequest2 = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })
    await router.fetch(addRequest2)

    // Step 4: Verify quantity increased
    let cartRequest2 = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse2 = await router.fetch(cartRequest2)
    let cartHtml2 = await cartResponse2.text()

    assertContains(cartHtml2, 'Ash')
    // Should show quantity of 2 or price of $33.98 (2 x $16.99)
    assert.ok(
      cartHtml2.includes('$33.98') || /quantity[^>]*2/i.test(cartHtml2),
      'Cart should show increased quantity or doubled price'
    )
  })

  it('adding multiple different items to cart works correctly', async () => {
    // Step 1: Create a guest session by adding first item
    let addResponse1 = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // Ash & Smoke
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse1)
    assert.ok(sessionId)

    // Step 2: Add second item
    let addRequest2 = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '002', // Heavy Metal
        slug: 'heavy-metal',
      }),
      redirect: 'manual',
    })
    await router.fetch(addRequest2)

    // Step 3: Add third item
    let addRequest3 = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '003', // Three Ways
        slug: 'three-ways',
      }),
      redirect: 'manual',
    })
    await router.fetch(addRequest3)

    // Step 4: Verify cart has all three items
    let cartRequest = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse = await router.fetch(cartRequest)
    let cartHtml = await cartResponse.text()

    assertContains(cartHtml, 'Ash')
    assertContains(cartHtml, 'Heavy Metal Guitar Riffs')
    assertContains(cartHtml, 'Three Ways to Change Your Life')

    // Step 5: Verify total is correct ($16.99 + $27.00 + $28.99 = $72.98)
    assertContains(cartHtml, '$72.98')
  })

  it('cart persists across multiple page views', async () => {
    // Step 1: Add item to cart
    let addResponse = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    // Step 2: Navigate to different pages and verify cart persists
    let pages = [
      'http://localhost:3000/cart',
      'http://localhost:3000/books',
      'http://localhost:3000/',
      'http://localhost:3000/cart', // Return to cart
    ]

    for (const page of pages) {
      let request = requestWithSession(page, sessionId)
      let response = await router.fetch(request)
      assert.equal(response.status, 200, `Page ${page} should load successfully`)
    }

    // Step 3: Verify cart still has the item after navigation
    let finalCartRequest = requestWithSession('http://localhost:3000/cart', sessionId)
    let finalCartResponse = await router.fetch(finalCartRequest)
    let finalCartHtml = await finalCartResponse.text()

    assertContains(finalCartHtml, 'Ash')
  })
})
