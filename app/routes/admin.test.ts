import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import { createTestRouter } from '~/test/helpers'
import { loginAsCustomer, requestWithSession } from '~/test/helpers'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'

describe('admin handlers', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)
  })

  it('GET /admin redirects when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/admin')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('GET /admin returns 403 for non-admin users', async () => {
    let sessionId = await loginAsCustomer(router)

    // Try to access admin
    let request = requestWithSession('http://localhost:3000/admin', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 403)
  })
})
