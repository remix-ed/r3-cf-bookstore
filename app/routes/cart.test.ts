import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import { createTestRouter, getSessionCookie, requestWithSession, assertContains } from '../../test/helpers.ts'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import booksSeed from '~/database/seeds/test/003-test-books.seed'
import ordersSeed from '~/database/seeds/test/004-test-orders.seed'

describe('cart handlers', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
    // Seed database with test data
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)
    await booksSeed(router.env.DB)
    await ordersSeed(router.env.DB)
  })

  it('POST /cart/api/add adds book to cart', async () => {
    let response = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // BBQ book from seed data
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/cart'))
  })

  it('GET /cart shows cart items', async () => {
    // First, add item to cart to get a session
    let addResponse = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '002', // Heavy Metal book from seed data
        slug: 'heavy-metal',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId, 'Expected session cookie to be set')

    // Now view cart with session
    let request = requestWithSession('http://localhost:3000/cart', sessionId!)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Shopping Cart')
    assertContains(html, 'Heavy Metal Guitar Riffs')
  })

  it('cart persists state across requests with same session', async () => {
    // Add first item
    let addResponse1 = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001', // BBQ book from seed data
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse1)
    assert.ok(sessionId, 'Expected session cookie to be set')

    // Add second item with same session
    let addRequest2 = requestWithSession('http://localhost:3000/cart/api/add', sessionId!, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '003', // Three Ways book from seed data
        slug: 'three-ways',
      }),
    })
    await router.fetch(addRequest2)

    // View cart - should have both items
    let cartRequest = requestWithSession('http://localhost:3000/cart', sessionId!)
    let cartResponse = await router.fetch(cartRequest)

    let html = await cartResponse.text()
    assertContains(html, 'Ash & Smoke')
    assertContains(html, 'Three Ways to Change Your Life')
  })
})
