import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import {
  createTestRouter,
  requestWithSession,
  loginAsAdmin,
  loginAsCustomer,
  assertContains,
  assertNotContains,
} from '~/test/helpers'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import booksSeed from '~/database/seeds/test/003-test-books.seed'

describe('Admin Books Routes', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)
    await booksSeed(router.env.DB)
  })

  // =============================================================================
  // Authorization Tests
  // =============================================================================

  describe('authorization', () => {
    it('GET /admin/books redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/books')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('GET /admin/books returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('GET /admin/books/new redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/books/new')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('GET /admin/books/new returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/books/new', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('POST /admin/books returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'hacker-book',
          title: 'Hacker Book',
          author: 'Evil Hacker',
          description: 'Test',
          price: '99.99',
          genre: 'hacking',
          isbn: '978-9999999999',
          publishedYear: '2024',
          inStock: 'true',
        }),
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('DELETE /admin/books/:bookId returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/books/001', sessionId, {
        method: 'DELETE',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })
  })

  // =============================================================================
  // Book Listing Tests (index)
  // =============================================================================

  describe('book listing', () => {
    it('GET /admin/books shows list of books for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      assertContains(html, 'Manage Books')
      assertContains(html, 'Add New Book')
      assertContains(html, 'Back to Dashboard')
    })

    it('GET /admin/books displays seeded books correctly', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check seeded books
      assertContains(html, 'Ash & Smoke')
      assertContains(html, 'Rusty Char-Broil')
      assertContains(html, 'cookbook')
      assertContains(html, '$16.99')

      assertContains(html, 'Heavy Metal Guitar Riffs')
      assertContains(html, 'Axe Master Krush')
      assertContains(html, 'music')
      assertContains(html, '$27.00')

      assertContains(html, 'Three Ways to Change Your Life')
      assertContains(html, 'Britney Spears')
      assertContains(html, 'self-help')
      assertContains(html, '$28.99')
    })

    it('GET /admin/books shows Edit and Delete buttons', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      assertContains(html, 'Edit')
      assertContains(html, 'Delete')
      assertContains(html, '/admin/books/001/edit')
    })

    it('GET /admin/books shows stock status badges', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      assertContains(html, 'badge-success')
      assertContains(html, 'Yes')
    })
  })

  // =============================================================================
  // Book Show Tests
  // =============================================================================

  describe('book show', () => {
    it('GET /admin/books/:bookId shows book details for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/001', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      assertContains(html, 'Book Details')
      assertContains(html, 'Ash & Smoke')
      assertContains(html, 'Rusty Char-Broil')
      assertContains(html, 'bbq')
      assertContains(html, 'cookbook')
      assertContains(html, '978-0525559474')
      assertContains(html, '2020')
      assertContains(html, '$16.99')
      assertContains(html, 'Edit')
      assertContains(html, 'Back to List')
    })

    it('GET /admin/books/:bookId returns 404 for non-existent book', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/999', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      let html = await response.text()

      assertContains(html, 'Book Not Found')
    })

    it('GET /admin/books/:bookId redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/books/001')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })
  })

  // =============================================================================
  // Book Creation Tests
  // =============================================================================

  describe('book creation', () => {
    it('GET /admin/books/new shows create form for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/new', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      assertContains(html, 'Add New Book')
      assertContains(html, 'name="title"')
      assertContains(html, 'name="author"')
      assertContains(html, 'name="slug"')
      assertContains(html, 'name="description"')
      assertContains(html, 'name="price"')
      assertContains(html, 'name="genre"')
      assertContains(html, 'name="isbn"')
      assertContains(html, 'name="publishedYear"')
      assertContains(html, 'name="inStock"')
      assertContains(html, 'name="cover"')
      assertContains(html, 'Create Book')
      assertContains(html, 'Cancel')
    })

    it('POST /admin/books creates new book', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'new-test-book',
          title: 'New Test Book',
          author: 'Test Author',
          description: 'A great test book',
          price: '29.99',
          genre: 'test',
          isbn: '978-1234567890',
          publishedYear: '2024',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/admin/books')

      // Verify book was created
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, 'New Test Book')
      assertContains(html, 'Test Author')
      assertContains(html, '$29.99')
    })

    it('POST /admin/books creates book with inStock=false', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'out-of-stock-book',
          title: 'Out of Stock Book',
          author: 'Test Author',
          description: 'Not available',
          price: '19.99',
          genre: 'test',
          isbn: '978-0987654321',
          publishedYear: '2023',
          inStock: 'false',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify book was created with out of stock badge
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, 'Out of Stock Book')
      assertContains(html, 'badge-warning')
      assertContains(html, 'No')
    })
  })

  // =============================================================================
  // Book Edit Tests
  // =============================================================================

  describe('book edit', () => {
    it('GET /admin/books/:bookId/edit shows edit form for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/001/edit', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      assertContains(html, 'Edit Book')
      assertContains(html, 'value="Ash &amp; Smoke"')
      assertContains(html, 'value="Rusty Char-Broil"')
      assertContains(html, 'value="bbq"')
      assertContains(html, 'value="cookbook"')
      assertContains(html, 'value="978-0525559474"')
      assertContains(html, 'value="2020"')
      assertContains(html, 'Update Book')
      assertContains(html, 'Cancel')
    })

    it('GET /admin/books/:bookId/edit returns 404 for non-existent book', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/999/edit', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      let html = await response.text()

      assertContains(html, 'Book Not Found')
    })

    it('GET /admin/books/:bookId/edit redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/books/001/edit')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })
  })

  // =============================================================================
  // Book Update Tests
  // =============================================================================

  describe('book update', () => {
    it('PUT /admin/books/:bookId updates book details', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/001', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          slug: 'bbq-updated',
          title: 'Ash & Smoke - Updated Edition',
          author: 'Rusty Char-Broil Jr.',
          description: 'Updated BBQ guide',
          price: '19.99',
          genre: 'cookbook',
          isbn: '978-0525559474',
          publishedYear: '2021',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/admin/books')

      // Verify update
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, 'Ash & Smoke - Updated Edition')
      assertContains(html, 'Rusty Char-Broil Jr.')
      assertContains(html, '$19.99')
    })

    it('PUT /admin/books/:bookId can mark book as out of stock', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/001', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          slug: 'bbq',
          title: 'Ash & Smoke',
          author: 'Rusty Char-Broil',
          description: 'The perfect gift for the BBQ enthusiast in your life!',
          price: '16.99',
          genre: 'cookbook',
          isbn: '978-0525559474',
          publishedYear: '2020',
          inStock: 'false',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify stock status changed
      let showRequest = requestWithSession('http://localhost:3000/admin/books/001', sessionId)
      let showResponse = await router.fetch(showRequest)
      let html = await showResponse.text()

      assertContains(html, 'badge-warning')
      assertContains(html, 'No')
    })

    it('PUT /admin/books/:bookId returns 404 for non-existent book', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books/999', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          slug: 'fake',
          title: 'Fake Book',
          author: 'Nobody',
          description: 'Nope',
          price: '9.99',
          genre: 'fake',
          isbn: '978-0000000000',
          publishedYear: '2000',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
    })
  })

  // =============================================================================
  // Book Deletion Tests
  // =============================================================================

  describe('book deletion', () => {
    it('DELETE /admin/books/:bookId deletes book', async () => {
      let sessionId = await loginAsAdmin(router)

      // First verify book exists
      let beforeRequest = requestWithSession('http://localhost:3000/admin/books/001', sessionId)
      let beforeResponse = await router.fetch(beforeRequest)
      assert.equal(beforeResponse.status, 200)

      // Delete the book
      let request = requestWithSession('http://localhost:3000/admin/books/001', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'DELETE',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/admin/books')

      // Verify book is deleted (should return 404)
      let afterRequest = requestWithSession('http://localhost:3000/admin/books/001', sessionId)
      let afterResponse = await router.fetch(afterRequest)

      assert.equal(afterResponse.status, 404)
    })

    it('DELETE /admin/books/:bookId removes book from list', async () => {
      let sessionId = await loginAsAdmin(router)

      // Delete book
      let request = requestWithSession('http://localhost:3000/admin/books/002', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'DELETE',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify book is not in list
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertNotContains(html, 'Heavy Metal Guitar Riffs')
      assertNotContains(html, 'Axe Master Krush')
    })

    it('DELETE /admin/books/:bookId redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/books/001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'DELETE',
        }),
        redirect: 'manual',
      })

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })
  })

  // =============================================================================
  // Edge Cases & Input Validation
  // =============================================================================

  describe('edge cases', () => {
    it('handles Unicode characters in book title and author', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'unicode-book',
          title: '�,�n���� (Japanese Title)',
          author: '  (Zhng Wi)',
          description: 'A book with Unicode characters -� �,� \ ',
          price: '24.99',
          genre: 'international',
          isbn: '978-1111111111',
          publishedYear: '2024',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify Unicode is preserved
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, '�,�n����')
      assertContains(html, ' ')
    })

    it('handles decimal prices correctly', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'decimal-test',
          title: 'Decimal Price Test',
          author: 'Price Tester',
          description: 'Testing decimal prices',
          price: '12.50',
          genre: 'test',
          isbn: '978-2222222222',
          publishedYear: '2024',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify price displays correctly
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, '$12.50')
    })

    it('handles very long descriptions', async () => {
      let sessionId = await loginAsAdmin(router)

      let longDescription = 'A'.repeat(1000)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'long-description',
          title: 'Long Description Book',
          author: 'Verbose Writer',
          description: longDescription,
          price: '15.99',
          genre: 'test',
          isbn: '978-3333333333',
          publishedYear: '2024',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify book was created
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, 'Long Description Book')
    })

    it('handles special characters in slugs', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'special-characters-123',
          title: 'Special Characters Book',
          author: 'Special Author',
          description: 'Testing special characters in slug',
          price: '18.99',
          genre: 'test',
          isbn: '978-4444444444',
          publishedYear: '2024',
          inStock: 'true',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)
    })

    it('handles year boundaries correctly', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/books', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          slug: 'old-book',
          title: 'Very Old Book',
          author: 'Ancient Author',
          description: 'A book from long ago',
          price: '99.99',
          genre: 'history',
          isbn: '978-5555555555',
          publishedYear: '1900',
          inStock: 'false',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify year is stored correctly
      let listRequest = requestWithSession('http://localhost:3000/admin/books', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, 'Very Old Book')
    })
  })
})
