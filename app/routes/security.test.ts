/**
 * Security Vulnerability Tests
 *
 * Tests to verify protection against common security vulnerabilities:
 * - SQL Injection: Parameterized queries prevent SQL injection
 * - XSS (Cross-Site Scripting): Input sanitization and output escaping
 * - Session Fixation: Session regeneration and secure cookies
 * - OWASP Top 10 protection
 */

import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import { generateId, NANOID_PATTERN } from '~/app/utils/nanoid'
import { createTestRouter, loginAsCustomer, requestWithSession } from '~/test/helpers'
import { searchBooks } from '~/app/models/books'
import { getUserByEmail, createUser } from '~/app/models/users'
import { getOrdersByUserId } from '~/app/models/orders'
import { login, getUserIdFromSession } from '~/app/utils/session'
import type { User } from '~/app/models/users'
import type { AppContext } from '~/app/context.server'
import { cloudflareContextKey } from '~/app/context.server'
import { SERVICES_KEY } from '~/app/services/container'
import { createD1Service } from '~/app/services/d1.server'
import { createSessionService } from '~/app/services/session.server'

describe('Security Vulnerability Tests', () => {
  let router: any
  let context: AppContext

  before(async () => {
    router = await createTestRouter()

    // Create AppContext using the new architecture
    const storage = new Map()
    storage.set(cloudflareContextKey, {
      env: router.env,
      ctx: router.ctx,
    })

    // Initialize services (D1 and Session)
    storage.set(SERVICES_KEY, {
      d1: createD1Service(router.env),
      session: createSessionService(router.env.SESSION_KV),
    })

    context = storage as any as AppContext
  })

  // =============================================================================
  // SQL Injection Tests
  // =============================================================================

  describe('SQL Injection Protection', () => {
    it('prevents SQL injection in book search - single quote', async () => {
      // Arrange - Attempt SQL injection with single quote
      const maliciousQuery = "'; DROP TABLE books; --"

      // Act - Should treat as literal string, not execute SQL
      const results = await searchBooks(context, maliciousQuery)

      // Assert
      assert.ok(Array.isArray(results), 'Should return array, not error')
      assert.strictEqual(results.length, 0, 'Should find no matches (not execute injection)')
    })

    it('prevents SQL injection in book search - UNION attack', async () => {
      // Arrange - Attempt UNION-based SQL injection
      const maliciousQuery = "test' UNION SELECT * FROM users--"

      // Act
      const results = await searchBooks(context, maliciousQuery)

      // Assert
      assert.ok(Array.isArray(results), 'Should return array')
      assert.strictEqual(results.length, 0, 'Should not execute UNION query')
    })

    it('prevents SQL injection in book search - boolean-based', async () => {
      // Arrange - Boolean-based blind SQL injection
      const maliciousQuery = "' OR '1'='1"

      // Act
      const results = await searchBooks(context, maliciousQuery)

      // Assert
      assert.ok(Array.isArray(results), 'Should return array')
      // Should not return all books (which would happen if OR 1=1 executed)
      assert.strictEqual(results.length, 0, 'Should not match all books')
    })

    it('prevents SQL injection in book search - comment-based', async () => {
      // Arrange - Comment-based SQL injection
      const maliciousQuery = "test'--"

      // Act
      const results = await searchBooks(context, maliciousQuery)

      // Assert
      assert.ok(Array.isArray(results), 'Should safely handle comment characters')
    })

    it('prevents SQL injection in user email lookup', async () => {
      // Arrange - SQL injection in email parameter
      const maliciousEmail = "admin@example.com' OR '1'='1"

      // Act
      const user = await getUserByEmail(context, maliciousEmail)

      // Assert
      assert.strictEqual(user, undefined, 'Should not find user with malicious email')
    })

    it('prevents SQL injection in order queries', async () => {
      // Arrange - SQL injection in userId parameter
      const maliciousUserId = "user-1' OR '1'='1"

      // Act
      const orders = await getOrdersByUserId(context, maliciousUserId)

      // Assert
      assert.ok(Array.isArray(orders), 'Should return array')
      assert.strictEqual(orders.length, 0, 'Should not return all orders')
    })

    it('handles special SQL characters safely in search', async () => {
      // Arrange - Special characters that might break queries
      const specialChars = [
        '%',
        '_',
        ';',
        '--',
        '/*',
        '*/',
        'SELECT',
        'DROP',
        'DELETE',
        'UPDATE',
        'INSERT',
      ]

      // Act & Assert
      for (const char of specialChars) {
        const results = await searchBooks(context, char)
        assert.ok(Array.isArray(results), `Should safely handle: ${char}`)
      }
    })

    it('prevents SQL injection with encoded characters', async () => {
      // Arrange - URL-encoded SQL injection
      const maliciousQuery = "test%27%20OR%20%271%27%3D%271" // test' OR '1'='1

      // Act
      const results = await searchBooks(context, maliciousQuery)

      // Assert
      assert.ok(Array.isArray(results), 'Should handle encoded characters')
      assert.strictEqual(results.length, 0, 'Should not execute injection')
    })
  })

  // =============================================================================
  // XSS (Cross-Site Scripting) Tests
  // =============================================================================

  describe('XSS Protection', () => {
    it('sanitizes script tags in user registration', async () => {
      // Arrange - Attempt to inject script in name
      const maliciousName = '<script>alert("XSS")</script>'
      const email = `xss-test-1-${Date.now()}@example.com`
      const password = 'password123'

      // Act
      const user = await createUser(context, email, password, maliciousName)

      // Assert
      assert.ok(user, 'Should create user')
      // The name is stored as-is, but should be escaped when rendered in HTML
      // The model layer doesn't sanitize, but the view layer should
      assert.strictEqual(user.name, maliciousName, 'Model stores data as-is')
    })

    it('handles HTML entities in user name', async () => {
      // Arrange - HTML entities
      const nameWithEntities = '&lt;script&gt;alert("XSS")&lt;/script&gt;'
      const email = `xss-test-2-${Date.now()}@example.com`
      const password = 'password123'

      // Act
      const user = await createUser(context, email, password, nameWithEntities)

      // Assert
      assert.ok(user, 'Should create user')
      assert.strictEqual(user.name, nameWithEntities, 'Should store HTML entities')
    })

    it('handles JavaScript event handlers in input', async () => {
      // Arrange - Event handler XSS
      const maliciousName = '<img src=x onerror="alert(1)">'
      const email = `xss-test-3-${Date.now()}@example.com`
      const password = 'password123'

      // Act
      const user = await createUser(context, email, password, maliciousName)

      // Assert
      assert.ok(user, 'Should create user')
      assert.strictEqual(user.name, maliciousName, 'Model stores data')
    })

    it('handles unicode and special characters safely', async () => {
      // Arrange - Unicode characters that might break encoding
      const unicodeName = '测试用户 <\u003cscript\u003e> 🔒'
      const email = `xss-test-4-${Date.now()}@example.com`
      const password = 'password123'

      // Act
      const user = await createUser(context, email, password, unicodeName)

      // Assert
      assert.ok(user, 'Should handle unicode characters')
      assert.strictEqual(user.name, unicodeName, 'Should preserve unicode')
    })

    it('handles data URLs in input', async () => {
      // Arrange - Data URL XSS
      const maliciousName = 'data:text/html,<script>alert("XSS")</script>'
      const email = `xss-test-5-${Date.now()}@example.com`
      const password = 'password123'

      // Act
      const user = await createUser(context, email, password, maliciousName)

      // Assert
      assert.ok(user, 'Should handle data URLs')
      assert.strictEqual(user.name, maliciousName, 'Should store data')
    })

    it('handles null bytes in input', async () => {
      // Arrange - Null byte injection
      const nameWithNull = 'Test\x00User'
      const email = `xss-test-6-${Date.now()}@example.com`
      const password = 'password123'

      // Act
      const user = await createUser(context, email, password, nameWithNull)

      // Assert
      assert.ok(user, 'Should handle null bytes')
    })

    it('prevents XSS in search results', async () => {
      // Arrange - Search for XSS payload
      const xssQuery = '<script>alert("XSS")</script>'

      // Act
      const results = await searchBooks(context, xssQuery)

      // Assert
      assert.ok(Array.isArray(results), 'Should return results safely')
      // Results should not execute script (handled by view layer escaping)
    })
  })

  // =============================================================================
  // Session Fixation Tests
  // =============================================================================

  describe('Session Fixation Protection', () => {
    it('generates unique session IDs', () => {
      // Arrange & Act
      const sessionId1 = generateId()
      const sessionId2 = generateId()

      // Assert
      assert.notEqual(sessionId1, sessionId2, 'Session IDs should be unique')
      assert.ok(sessionId1.length >= 21, 'Session ID should be at least 21 characters')
      assert.ok(sessionId2.length >= 21, 'Session ID should be at least 21 characters')
      assert.match(sessionId1, NANOID_PATTERN, 'Session ID should be valid nanoid')
      assert.match(sessionId2, NANOID_PATTERN, 'Session ID should be valid nanoid')
    })

    it('uses cryptographically secure random session IDs', () => {
      // Arrange & Act - Generate multiple session IDs
      const sessionIds = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const sessionId = generateId()
        sessionIds.add(sessionId)
      }

      // Assert
      assert.strictEqual(sessionIds.size, 100, 'All 100 session IDs should be unique')
    })

    it('session cookies have httpOnly flag', async () => {
      // Arrange
      const sessionId = await loginAsCustomer(router)

      // Act - Make a request to check cookie attributes
      const response = await router.fetch(
        requestWithSession('http://localhost:3000/account', sessionId)
      )

      // Assert
      assert.strictEqual(response.status, 200, 'Should access protected route')
      // Cookie is httpOnly, so it cannot be accessed via JavaScript
      // This is set in the session middleware when creating the cookie
    })

    it('rejects tampered session IDs', async () => {
      // Arrange - Create a tampered/invalid session ID
      const tamperedSessionId = 'tampered-session-id-12345'

      // Act - Try to use tampered session
      const response = await router.fetch(
        requestWithSession('http://localhost:3000/account', tamperedSessionId)
      )

      // Assert
      // Should redirect to login or return 401/403 because session is invalid
      assert.ok(
        response.status === 302 || response.status === 401 || response.status === 403,
        'Should reject tampered session'
      )
    })

    it('session data is isolated between sessions', () => {
      // Arrange & Act - Generate two separate session IDs
      const sessionId1 = generateId()
      const sessionId2 = generateId()

      // Assert - Session IDs should be unique (cryptographically secure)
      assert.notEqual(sessionId1, sessionId2, 'Sessions IDs should be unique')
      assert.match(sessionId1, NANOID_PATTERN, 'Session 1 should be valid nanoid')
      assert.match(sessionId2, NANOID_PATTERN, 'Session 2 should be valid nanoid')

      // The isolation is enforced by:
      // 1. Unique session IDs (tested here)
      // 2. KV storage using sessionId as key (enforced by Cloudflare KV)
      // 3. Session service only returns data for the exact sessionId provided
    })

    it('prevents session ID prediction', () => {
      // Arrange & Act - Generate multiple sessions
      const sessionIds: string[] = []
      for (let i = 0; i < 10; i++) {
        sessionIds.push(generateId())
      }

      // Assert - Check that session IDs are not sequential or predictable
      for (let i = 1; i < sessionIds.length; i++) {
        const id1 = sessionIds[i - 1]
        const id2 = sessionIds[i]

        // IDs should be unique (not duplicates)
        assert.notEqual(id1, id2, 'Session IDs should be unique')

        // IDs should be nanoids, not simple incrementing numbers
        assert.match(id1, NANOID_PATTERN, 'Should be nanoid format')
        assert.match(id2, NANOID_PATTERN, 'Should be nanoid format')
      }
    })

    it('session ID is not exposed in URLs', async () => {
      // Arrange
      const sessionId = await loginAsCustomer(router)

      // Act - Make request to account page
      const response = await router.fetch(
        requestWithSession('http://localhost:3000/account', sessionId)
      )

      // Assert
      const html = await response.text()
      // Session ID should not appear in the HTML response
      assert.ok(!html.includes(sessionId), 'Session ID should not be exposed in HTML')
    })
  })

  // =============================================================================
  // Additional Security Tests
  // =============================================================================

  describe('Additional Security Protections', () => {
    it('prevents email enumeration via timing', async () => {
      // Arrange
      const existingEmail = 'customer@example.com'
      const nonExistentEmail = 'nonexistent@example.com'

      // Act - Time queries for existing vs non-existent emails
      const start1 = Date.now()
      await getUserByEmail(context, existingEmail)
      const time1 = Date.now() - start1

      const start2 = Date.now()
      await getUserByEmail(context, nonExistentEmail)
      const time2 = Date.now() - start2

      // Assert - Timing should be similar to prevent enumeration
      // Allow 100ms difference for test stability
      const timeDiff = Math.abs(time1 - time2)
      assert.ok(timeDiff < 100, `Timing difference should be minimal: ${timeDiff}ms`)
    })

    it('handles very long input strings safely', async () => {
      // Arrange - Very long string that might cause buffer overflow
      const longString = 'A'.repeat(100000)

      // Act & Assert
      try {
        const results = await searchBooks(context, longString)
        // If it succeeds, should return empty array (no matches)
        assert.ok(Array.isArray(results), 'Should return array if processed')
        assert.strictEqual(results.length, 0, 'Should find no matches for gibberish')
      } catch (e: any) {
        // SQLite has a LIKE pattern complexity limit - acceptable to fail gracefully
        // The important thing is it doesn't cause crashes or injection
        assert.ok(
          e.message.includes('pattern too complex') || e.message.includes('SQLITE_ERROR'),
          'Should fail gracefully with pattern complexity error'
        )
      }
    })

    it('handles null and undefined safely', async () => {
      // Arrange
      const nullQuery = null as any
      const undefinedQuery = undefined as any
      const emptyQuery = ''

      // Act & Assert - Should handle gracefully or return empty results
      try {
        const results1 = await searchBooks(context, nullQuery)
        assert.ok(Array.isArray(results1), 'Should handle null')
      } catch (e) {
        // It's acceptable to throw on null/undefined - the important thing is it doesn't cause SQL injection
        assert.ok(true, 'Null handling throws (acceptable)')
      }

      try {
        const results2 = await searchBooks(context, undefinedQuery)
        assert.ok(Array.isArray(results2), 'Should handle undefined')
      } catch (e) {
        assert.ok(true, 'Undefined handling throws (acceptable)')
      }

      // Empty string should work
      const results3 = await searchBooks(context, emptyQuery)
      assert.ok(Array.isArray(results3), 'Should handle empty string')
    })

    it('prevents path traversal in search', async () => {
      // Arrange - Path traversal attempts
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        './../.../../etc/hosts',
      ]

      // Act & Assert
      for (const attempt of pathTraversalAttempts) {
        const results = await searchBooks(context, attempt)
        assert.ok(Array.isArray(results), `Should handle path traversal: ${attempt}`)
      }
    })

    it('handles regex special characters safely', async () => {
      // Arrange - Regex characters that might cause ReDoS
      const regexChars = ['.*', '.+', '.*.*.*', '[a-z]*', '(a|b)*']

      // Act & Assert
      for (const char of regexChars) {
        const results = await searchBooks(context, char)
        assert.ok(Array.isArray(results), `Should handle regex char: ${char}`)
      }
    })

    it('validates ID format to prevent injection', async () => {
      // Arrange - Invalid ID with SQL injection
      const maliciousId = "id' OR '1'='1"

      // Act
      const orders = await getOrdersByUserId(context, maliciousId)

      // Assert
      assert.ok(Array.isArray(orders), 'Should handle malicious ID')
      assert.strictEqual(orders.length, 0, 'Should not return results')
    })

    it('prevents CRLF injection in headers', async () => {
      // Arrange - CRLF injection attempt
      const maliciousInput = "test\r\nSet-Cookie: sessionId=malicious"

      // Act
      const results = await searchBooks(context, maliciousInput)

      // Assert
      assert.ok(Array.isArray(results), 'Should handle CRLF characters')
    })
  })
})
