import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createTestRouter } from '~/test/helpers'
import { loginAsCustomer, requestWithSession } from '~/test/helpers'

describe('admin handlers', () => {
  it('GET /admin redirects when not authenticated', async () => {
    const router = await createTestRouter()
    let response = await router.fetch('http://localhost:3000/admin')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('GET /admin returns 403 for non-admin users', async () => {
    const router = await createTestRouter()
    let sessionId = await loginAsCustomer(router)

    // Try to access admin
    let request = requestWithSession('http://localhost:3000/admin', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 403)
  })
})
