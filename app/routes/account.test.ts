import * as assert from 'node:assert/strict'
import { describe, it, before, beforeEach } from 'node:test'

import { createTestRouter } from '~/test/helpers'
import { loginAsCustomer, loginAsAdmin, requestWithSession, assertContains, assertNotContains } from '~/test/helpers'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import booksSeed from '~/database/seeds/test/003-test-books.seed'
import ordersSeed from '~/database/seeds/test/004-test-orders.seed'

describe('Account Routes', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
  })

  // Non-mutating tests - read-only, can share seeded data
  describe('Read-only tests', () => {
    before(async () => {
      await resetSeed(router.env.DB)
      await usersSeed(router.env.DB)
      await booksSeed(router.env.DB)
      await ordersSeed(router.env.DB)
    })

    describe('GET /account', () => {
    it('redirects to login when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/account')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('returns account page when authenticated', async () => {
      let sessionId = await loginAsCustomer(router)

      // Now access account page with session
      let request = requestWithSession('http://localhost:3000/account', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()
      assertContains(html, 'My Account')
      assertContains(html, 'Account Information')
      assertContains(html, 'John Doe')
      assertContains(html, 'customer@example.com')
      assertContains(html, 'customer')
    })

    it('shows quick links to orders and books', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/account', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()
      assertContains(html, 'View Orders')
      assertContains(html, 'Browse Books')
      assertContains(html, 'Edit Settings')
    })
  })

    describe('GET /account/settings', () => {
      it('redirects to login when not authenticated', async () => {
        let response = await router.fetch('http://localhost:3000/account/settings')

        assert.equal(response.status, 302)
        assert.equal(response.headers.get('Location'), '/login')
      })

      it('shows settings form when authenticated', async () => {
        let sessionId = await loginAsCustomer(router)

        let request = requestWithSession('http://localhost:3000/account/settings', sessionId)
        let response = await router.fetch(request)

        assert.equal(response.status, 200)
        let html = await response.text()
        assertContains(html, 'Account Settings')
        assertContains(html, 'name="name"')
        assertContains(html, 'name="email"')
        assertContains(html, 'name="password"')
        assertContains(html, 'John Doe')
        assertContains(html, 'customer@example.com')
      })
    })

    describe('GET /account/orders', () => {
    it('redirects to login when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/account/orders')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('shows list of orders for authenticated user', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/account/orders', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()
      assertContains(html, 'My Orders')
      assertContains(html, '#1001')
      assertContains(html, '#1002')
      assertContains(html, 'delivered')
      assertContains(html, 'shipped')
      assertContains(html, '$45.98')
      assertContains(html, '$54.00')
    })

    it('shows message when user has no orders', async () => {
      // Login as admin who has no orders
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/account/orders', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()
      assertContains(html, 'You have no orders yet')
    })
  })

  describe('GET /account/orders/:orderId', () => {
    it('redirects to login when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/account/orders/1001')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('shows order details for authenticated user', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/account/orders/1001', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()
      assertContains(html, 'Order #1001')
      assertContains(html, 'Ash & Smoke')
      assertContains(html, 'Three Ways to Change Your Life')
      assertContains(html, '$16.99')
      assertContains(html, '$28.99')
      assertContains(html, '$45.98')
      assertContains(html, 'delivered')
      assertContains(html, '123 Main St')
      assertContains(html, 'Boston')
      assertContains(html, 'MA')
      assertContains(html, '02101')
    })

    it('returns 404 for non-existent order', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/account/orders/9999', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      let html = await response.text()
      assertContains(html, 'Order Not Found')
    })

    it('returns 404 when accessing another user\'s order', async () => {
      // Login as admin (user id 1)
      let sessionId = await loginAsAdmin(router)

      // Try to access customer's order (user id 2)
      let request = requestWithSession('http://localhost:3000/account/orders/1001', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      let html = await response.text()
      assertContains(html, 'Order Not Found')
      assertNotContains(html, 'Ash & Smoke')
    })

      it('shows correct items and quantities in order', async () => {
        let sessionId = await loginAsCustomer(router)

        // Check order 1001 (2 items)
        let request1 = requestWithSession('http://localhost:3000/account/orders/1001', sessionId)
        let response1 = await router.fetch(request1)
        let html1 = await response1.text()
        assertContains(html1, 'Ash & Smoke')
        assertContains(html1, 'Three Ways to Change Your Life')

        // Check order 1002 (1 item, quantity 2)
        let request2 = requestWithSession('http://localhost:3000/account/orders/1002', sessionId)
        let response2 = await router.fetch(request2)
        let html2 = await response2.text()
        assertContains(html2, 'Heavy Metal Guitar Riffs')
        assertContains(html2, '$54.00')
      })
    })
  })

  // Mutating tests - modify user data, need fresh seeds each test
  describe('Mutating tests', () => {
    beforeEach(async () => {
      await resetSeed(router.env.DB)
      await usersSeed(router.env.DB)
      await booksSeed(router.env.DB)
      await ordersSeed(router.env.DB)
    })

    describe('PUT /account/settings', () => {
      it('redirects to login when not authenticated', async () => {
        let response = await router.fetch('http://localhost:3000/account/settings', {
          method: 'POST',
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'New Name',
            email: 'newemail@example.com',
          }),
          redirect: 'manual',
        })

        assert.equal(response.status, 302)
        assert.equal(response.headers.get('Location'), '/login')
      })

      it('updates user name and email', async () => {
        let sessionId = await loginAsCustomer(router)

        // Update settings
        let updateResponse = await router.fetch('http://localhost:3000/account/settings', {
          method: 'POST',
          headers: {
            Cookie: `sessionId=${sessionId}`,
          },
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'Jane Doe',
            email: 'jane@example.com',
            password: '', // Don't change password
          }),
          redirect: 'manual',
        })

        assert.equal(updateResponse.status, 302)
        assert.equal(updateResponse.headers.get('Location'), '/account')

        // Verify updated on account page
        let accountRequest = requestWithSession('http://localhost:3000/account', sessionId)
        let accountResponse = await router.fetch(accountRequest)

        let html = await accountResponse.text()
        assertContains(html, 'Jane Doe')
        assertContains(html, 'jane@example.com')
      })

      it('updates user password', async () => {
        let sessionId = await loginAsCustomer(router)

        // Update password
        let updateResponse = await router.fetch('http://localhost:3000/account/settings', {
          method: 'POST',
          headers: {
            Cookie: `sessionId=${sessionId}`,
          },
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'Jane Doe',
            email: 'jane@example.com',
            password: 'newpassword456',
          }),
          redirect: 'manual',
        })

        assert.equal(updateResponse.status, 302)
        assert.equal(updateResponse.headers.get('Location'), '/account')

        // Verify can login with new password
        let loginResponse = await router.fetch('http://localhost:3000/login', {
          method: 'POST',
          body: new URLSearchParams({
            email: 'jane@example.com',
            password: 'newpassword456',
          }),
          redirect: 'manual',
        })

        assert.equal(loginResponse.status, 302)
        assert.equal(loginResponse.headers.get('Location'), '/account')
      })
    })
  })
})
