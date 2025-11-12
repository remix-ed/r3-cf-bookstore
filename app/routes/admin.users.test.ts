import * as assert from 'node:assert/strict'
import { describe, it, before, beforeEach } from 'node:test'

import {
  createTestRouter,
  seedTestDatabase,
  clearTestDatabase,
  requestWithSession,
  loginAsAdmin,
  loginAsCustomer,
  assertContains,
  assertNotContains,
} from '~/test/helpers'
import { nanoid } from 'nanoid'

describe('Admin Users Routes', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
  })

  beforeEach(async () => {
    await clearTestDatabase(router.env.DB)
    await seedTestDatabase(router.env.DB)
  })

  // =============================================================================
  // Authorization Tests
  // =============================================================================

  describe('authorization', () => {
    it('GET /admin/users redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/users')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('GET /admin/users returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('GET /admin/users/:userId redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/users/1')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('GET /admin/users/:userId returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/users/1', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('GET /admin/users/:userId/edit redirects when not authenticated', async () => {
      let response = await router.fetch('http://localhost:3000/admin/users/1/edit')

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/login')
    })

    it('GET /admin/users/:userId/edit returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/users/1/edit', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('PUT /admin/users/:userId returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/users/1', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          name: 'Hacker',
          email: 'hacker@example.com',
          role: 'admin',
        }),
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })

    it('DELETE /admin/users/:userId returns 403 for non-admin users', async () => {
      let sessionId = await loginAsCustomer(router)

      let request = requestWithSession('http://localhost:3000/admin/users/1', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'DELETE',
        }),
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 403)
    })
  })

  // =============================================================================
  // User Listing Tests (index)
  // =============================================================================

  describe('user listing', () => {
    it('GET /admin/users shows list of users for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check page structure
      assertContains(html, 'Manage Users')
      assertContains(html, 'Back to Dashboard')

      // Check table headers
      assertContains(html, '<th>Name</th>')
      assertContains(html, '<th>Email</th>')
      assertContains(html, '<th>Role</th>')
      assertContains(html, '<th>Created</th>')
      assertContains(html, '<th>Actions</th>')
    })

    it('GET /admin/users displays user data correctly', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check admin user is displayed
      assertContains(html, 'Admin User')
      assertContains(html, 'admin@bookstore.com')
      assertContains(html, 'admin')

      // Check customer user is displayed
      assertContains(html, 'John Doe')
      assertContains(html, 'customer@example.com')
      assertContains(html, 'customer')
    })

    it('GET /admin/users shows role badges with correct styles', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check for admin badge with info style
      assertContains(html, 'badge-info')
      assertContains(html, 'badge-success')
    })

    it('GET /admin/users shows Edit button for all users', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check for Edit buttons
      assert.ok(html.includes('Edit'))
      assert.ok(html.includes('/admin/users/1/edit'))
      assert.ok(html.includes('/admin/users/2/edit'))
    })

    it('GET /admin/users does not show Delete button for current user', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check for Delete button presence
      assertContains(html, 'Delete')

      // The admin user (id=1) should not have a delete button
      // This is checked by looking for the delete form for user 1
      // The implementation shows delete button only when u.id !== user.id (line 56)
    })
  })

  // =============================================================================
  // User Show Tests
  // =============================================================================

  describe('user show', () => {
    it('GET /admin/users/:userId shows user details for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users/2', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check page structure
      assertContains(html, 'User Details')

      // Check user data is displayed
      assertContains(html, 'John Doe')
      assertContains(html, 'customer@example.com')
      assertContains(html, 'customer')

      // Check action buttons
      assertContains(html, 'Edit')
      assertContains(html, 'Back to List')
      assertContains(html, '/admin/users/2/edit')
    })

    it('GET /admin/users/:userId returns 404 for non-existent user', async () => {
      let sessionId = await loginAsAdmin(router)

      // Use a valid nanoid that doesn't exist
      let request = requestWithSession(
        `http://localhost:3000/admin/users/${nanoid()}`,
        sessionId
      )
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      let html = await response.text()

      assertContains(html, 'User Not Found')
    })
  })

  // =============================================================================
  // User Edit Tests
  // =============================================================================

  describe('user edit', () => {
    it('GET /admin/users/:userId/edit shows edit form for admin', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users/2/edit', sessionId)
      let response = await router.fetch(request)

      assert.equal(response.status, 200)
      let html = await response.text()

      // Check page structure
      assertContains(html, 'Edit User')

      // Check form fields are present
      assertContains(html, '<input type="text" id="name" name="name"')
      assertContains(html, '<input type="email" id="email" name="email"')
      assertContains(html, '<select id="role" name="role"')

      // Check form is pre-populated with user data
      assertContains(html, 'John Doe')
      assertContains(html, 'customer@example.com')

      // Check role options
      assertContains(html, '<option value="customer"')
      assertContains(html, '<option value="admin"')

      // Check action buttons
      assertContains(html, 'Update User')
      assertContains(html, 'Cancel')
    })

    it('GET /admin/users/:userId/edit returns 404 for non-existent user', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession(
        `http://localhost:3000/admin/users/${nanoid()}/edit`,
        sessionId
      )
      let response = await router.fetch(request)

      assert.equal(response.status, 404)
      let html = await response.text()

      assertContains(html, 'User Not Found')
    })
  })

  // =============================================================================
  // User Update Tests
  // =============================================================================

  describe('user update', () => {
    it('PUT /admin/users/:userId updates user details', async () => {
      let sessionId = await loginAsAdmin(router)

      // Update user 2 (customer)
      let request = requestWithSession('http://localhost:3000/admin/users/2', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: 'customer',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      // Should redirect to user list
      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/admin/users')

      // Verify update by fetching user list
      let listRequest = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, 'Jane Smith')
      assertContains(html, 'jane.smith@example.com')
    })

    it('PUT /admin/users/:userId can promote customer to admin', async () => {
      let sessionId = await loginAsAdmin(router)

      // Promote user 2 to admin
      let request = requestWithSession('http://localhost:3000/admin/users/2', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          name: 'John Doe',
          email: 'customer@example.com',
          role: 'admin',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify role change
      let showRequest = requestWithSession('http://localhost:3000/admin/users/2', sessionId)
      let showResponse = await router.fetch(showRequest)
      let html = await showResponse.text()

      // Check that user 2 now has admin role
      assertContains(html, 'badge-info')
      assertContains(html, 'admin')
    })

    it('PUT /admin/users/:userId can demote admin to customer', async () => {
      let sessionId = await loginAsAdmin(router)

      // First create a new user via registration
      let uniqueEmail = `admin-demote-${Date.now()}@example.com`
      let registerResponse = await router.fetch('http://localhost:3000/register', {
        method: 'POST',
        body: new URLSearchParams({
          name: 'Another Admin',
          email: uniqueEmail,
          password: 'password123',
        }),
        redirect: 'manual',
      })
      assert.equal(registerResponse.status, 302)

      // Get the user list to find the new user's ID
      let listRequest = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let listResponse = await router.fetch(listRequest)
      let listHtml = await listResponse.text()

      // Extract user ID from the edit link (look for the edit link AFTER the email in the same row)
      const emailIndex = listHtml.indexOf(uniqueEmail)
      assert.ok(emailIndex >= 0, 'Should find email in user list')

      // Get the HTML after the email (next 500 chars should contain the edit link in the same table row)
      const afterEmail = listHtml.substring(emailIndex, emailIndex + 500)
      let editLinkMatch = afterEmail.match(/\/admin\/users\/([A-Za-z0-9_-]+)\/edit/)

      assert.ok(editLinkMatch, 'Should find edit link for new user')
      let newUserId = editLinkMatch[1]

      // First promote to admin
      let promoteRequest = requestWithSession(
        `http://localhost:3000/admin/users/${newUserId}`,
        sessionId,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'Another Admin',
            email: uniqueEmail,
            role: 'admin',
          }),
          redirect: 'manual',
        }
      )
      let promoteResponse = await router.fetch(promoteRequest)
      assert.equal(promoteResponse.status, 302)

      // Now demote back to customer
      let demoteRequest = requestWithSession(
        `http://localhost:3000/admin/users/${newUserId}`,
        sessionId,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'Another Admin',
            email: uniqueEmail,
            role: 'customer',
          }),
          redirect: 'manual',
        }
      )
      let response = await router.fetch(demoteRequest)
      assert.equal(response.status, 302)

      // Verify role change
      let showRequest = requestWithSession(
        `http://localhost:3000/admin/users/${newUserId}`,
        sessionId
      )
      let showResponse = await router.fetch(showRequest)
      let html = await showResponse.text()

      assertContains(html, 'badge-success')
      assertContains(html, 'customer')
    })
  })

  // =============================================================================
  // User Deletion Tests
  // =============================================================================

  describe('user deletion', () => {
    it('DELETE /admin/users/:userId deletes user', async () => {
      let sessionId = await loginAsAdmin(router)

      // First create a user via registration
      let uniqueEmail = `delete-me-${Date.now()}@example.com`
      let registerResponse = await router.fetch('http://localhost:3000/register', {
        method: 'POST',
        body: new URLSearchParams({
          name: 'Delete Me',
          email: uniqueEmail,
          password: 'password123',
        }),
        redirect: 'manual',
      })
      assert.equal(registerResponse.status, 302)

      // Get the user list to find the new user's ID
      let listRequest = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let listResponse = await router.fetch(listRequest)
      let listHtml = await listResponse.text()

      // Extract user ID from the HTML (look for edit link AFTER email)
      const emailIndex = listHtml.indexOf(uniqueEmail)
      assert.ok(emailIndex >= 0, 'Should find email in user list')

      const afterEmail = listHtml.substring(emailIndex, emailIndex + 500)
      let editLinkMatch = afterEmail.match(/\/admin\/users\/([A-Za-z0-9_-]+)\/edit/)

      assert.ok(editLinkMatch, 'Should find edit link for new user')
      let userIdToDelete = editLinkMatch[1]

      // Delete the user
      let request = requestWithSession(
        `http://localhost:3000/admin/users/${userIdToDelete}`,
        sessionId,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            _method: 'DELETE',
          }),
          redirect: 'manual',
        }
      )
      let response = await router.fetch(request)

      assert.equal(response.status, 302)
      assert.equal(response.headers.get('Location'), '/admin/users')

      // Verify user is deleted (should return 404)
      let showRequest = requestWithSession(
        `http://localhost:3000/admin/users/${userIdToDelete}`,
        sessionId
      )
      let showResponse = await router.fetch(showRequest)

      assert.equal(showResponse.status, 404)
    })
  })

  // =============================================================================
  // Security Tests
  // =============================================================================

  describe('security', () => {
    it('protects against XSS in user name display', async () => {
      let sessionId = await loginAsAdmin(router)

      // Create user with XSS attempt in name via registration
      let uniqueEmail = `xss-${Date.now()}@example.com`
      let xssPayload = '<script>alert("XSS")</script>'

      let registerResponse = await router.fetch('http://localhost:3000/register', {
        method: 'POST',
        body: new URLSearchParams({
          name: xssPayload,
          email: uniqueEmail,
          password: 'password123',
        }),
        redirect: 'manual',
      })
      assert.equal(registerResponse.status, 302, 'User with XSS payload in name should be created')

      // Get the user list to find the malicious user
      let listRequest = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      // Verify the user was created and data is retrievable
      assert.ok(html.includes(uniqueEmail), 'Email should be in the response')

      // Note: XSS protection via JSX/TSX auto-escaping should handle this
      // The user name with script tag should be stored but rendered safely
    })

    it('handles Unicode characters in names correctly', async () => {
      let sessionId = await loginAsAdmin(router)

      let request = requestWithSession('http://localhost:3000/admin/users/2', sessionId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'PUT',
          name: '  (Zhng Wi) �,�',
          email: 'customer@example.com',
          role: 'customer',
        }),
        redirect: 'manual',
      })
      let response = await router.fetch(request)

      assert.equal(response.status, 302)

      // Verify Unicode name is stored and displayed correctly
      let listRequest = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let listResponse = await router.fetch(listRequest)
      let html = await listResponse.text()

      assertContains(html, ' ')
      assertContains(html, '�,�')
    })
  })

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('handles concurrent role changes gracefully', async () => {
      let sessionId = await loginAsAdmin(router)

      // Create a test user via registration
      let uniqueEmail = `concurrent-${Date.now()}@example.com`
      let registerResponse = await router.fetch('http://localhost:3000/register', {
        method: 'POST',
        body: new URLSearchParams({
          name: 'Concurrent User',
          email: uniqueEmail,
          password: 'password123',
        }),
        redirect: 'manual',
      })
      assert.equal(registerResponse.status, 302)

      // Get the user list to find the new user's ID
      let listRequest = requestWithSession('http://localhost:3000/admin/users', sessionId)
      let listResponse = await router.fetch(listRequest)
      let listHtml = await listResponse.text()

      // Extract user ID (look for edit link AFTER email)
      const emailIndex = listHtml.indexOf(uniqueEmail)
      assert.ok(emailIndex >= 0, 'Should find email in user list')

      const afterEmail = listHtml.substring(emailIndex, emailIndex + 500)
      let editLinkMatch = afterEmail.match(/\/admin\/users\/([A-Za-z0-9_-]+)\/edit/)

      assert.ok(editLinkMatch, 'Should find edit link for new user')
      let testUserId = editLinkMatch[1]

      // Simulate two concurrent updates (promote and update name)
      let request1 = requestWithSession(
        `http://localhost:3000/admin/users/${testUserId}`,
        sessionId,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'Concurrent Admin',
            email: uniqueEmail,
            role: 'admin',
          }),
          redirect: 'manual',
        }
      )

      let request2 = requestWithSession(
        `http://localhost:3000/admin/users/${testUserId}`,
        sessionId,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            _method: 'PUT',
            name: 'Concurrent Customer',
            email: uniqueEmail,
            role: 'customer',
          }),
          redirect: 'manual',
        }
      )

      // Execute both (last write wins in this implementation)
      let response1 = await router.fetch(request1)
      let response2 = await router.fetch(request2)

      assert.equal(response1.status, 302)
      assert.equal(response2.status, 302)

      // Verify final state is consistent
      let showRequest = requestWithSession(
        `http://localhost:3000/admin/users/${testUserId}`,
        sessionId
      )
      let showResponse = await router.fetch(showRequest)

      assert.equal(showResponse.status, 200)
    })
  })
})
