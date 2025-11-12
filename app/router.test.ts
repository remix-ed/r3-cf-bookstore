import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import { createTestRouter } from '~/test/helpers'

describe('router', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
  })

  it('responds to basic GET request', async () => {
    let response = await router.fetch('http://localhost:3000/')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let html = await response.text()
    assert.ok(html.includes('Welcome to the Bookstore'))
  })

  it('returns 404 for unknown routes', async () => {
    let response = await router.fetch('http://localhost:3000/does-not-exist')

    assert.equal(response.status, 404)
  })
})
