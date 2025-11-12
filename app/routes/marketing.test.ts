import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import { createTestRouter } from '~/test/helpers'
import { assertContains } from '~/test/helpers'

describe('marketing handlers', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
  })

  it('GET / returns home page', async () => {
    let response = await router.fetch('http://localhost:3000/')

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Welcome to the Bookstore')
    assertContains(html, 'Browse Books')
  })

  it('POST /contact returns success message', async () => {
    let response = await router.fetch('http://localhost:3000/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message',
      }).toString(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Thank you for your message')
  })
})
