import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import { createTestRouter, getSessionCookie, requestWithSession, loginAsAdmin, loginAsCustomer, assertContains } from '../../test/helpers.ts'
import { seedTestDatabase, clearTestDatabase } from '../../test/seed.ts'

describe('checkout handlers', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
    // Seed database with test data
    await clearTestDatabase(router.env.DB)
    await seedTestDatabase(router.env.DB)
  })

  it('GET /checkout redirects when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/checkout')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('POST /checkout creates order when authenticated with items in cart', async () => {
    let sessionId = await loginAsCustomer(router)

    // Add item to cart
    let addRequest = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // BBQ book from seed data
        slug: 'bbq',
      }),
    })
    await router.fetch(addRequest)

    // Submit checkout
    let checkoutRequest = requestWithSession('http://localhost:3000/checkout', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
      }),
    })
    let checkoutResponse = await router.fetch(checkoutRequest)

    assert.equal(checkoutResponse.status, 302)
    assert.ok(checkoutResponse.headers.get('Location')?.includes('/checkout/'))
    assert.ok(checkoutResponse.headers.get('Location')?.includes('/confirmation'))
  })
})
