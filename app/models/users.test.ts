/**
 * Users Model Tests
 *
 * Tests for user CRUD operations with D1 database:
 * - getAllUsers, getUserById, getUserByEmail (case-insensitive)
 * - authenticateUser (password verification)
 * - createUser (password hashing, nanoid generation, default role)
 * - updateUser (partial updates, password rehashing)
 * - deleteUser
 * - createPasswordResetToken (expiration handling)
 * - resetPassword (token validation, expiration, cleanup)
 */

import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import { createTestRouter } from '../../test/helpers.ts'
import { cloudflareContextKey } from '../context.server.ts'
import type { RequestContext } from '@remix-run/fetch-router'
import { generateId, NANOID_PATTERN } from '../utils/nanoid.ts'
import { SERVICES_KEY } from '../services/container.ts'
import { createD1Service } from '../services/d1.server.ts'
import { createSessionService } from '../services/session.server.ts'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  authenticateUser,
  createUser,
  updateUser,
  deleteUser,
  createPasswordResetToken,
  resetPassword,
  type User,
} from './users.ts'
import { verifyPassword } from '../utils/password.ts'

describe('Users Model', () => {
  let router: any
  let context: RequestContext

  before(async () => {
    router = await createTestRouter()

    // Clear and seed database
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)

    const storage = new Map()
    storage.set(cloudflareContextKey, { env: router.env, ctx: router.ctx })
    storage.set(SERVICES_KEY, {
      d1: createD1Service(router.env),
      session: createSessionService(router.env.SESSION_KV)
    })

    context = storage as any
  })

  describe('getAllUsers', () => {
    it('returns all users ordered by createdAt DESC', async () => {
      // Act
      const users = await getAllUsers(context)

      // Assert
      assert.ok(Array.isArray(users), 'Should return array')
      assert.ok(users.length >= 2, 'Should have seed data users')

      // Check ordering (most recent first)
      for (let i = 1; i < users.length; i++) {
        assert.ok(
          users[i - 1].createdAt >= users[i].createdAt,
          `Users should be ordered by createdAt DESC: ${users[i - 1].createdAt} >= ${users[i].createdAt}`
        )
      }
    })

    it('returns empty array when no users exist', async () => {
      // Arrange - Clear all data (no seed)
      await resetSeed(router.env.DB)

      const storage = new Map()
      storage.set(cloudflareContextKey, { env: router.env, ctx: router.ctx })
      storage.set(SERVICES_KEY, {
        d1: createD1Service(router.env),
        session: createSessionService(router.env.SESSION_KV)
      })
      const emptyContext = storage as any

      // Act
      const users = await getAllUsers(emptyContext)

      // Assert
      assert.deepStrictEqual(users, [], 'Should return empty array')

      // Cleanup - Re-seed for subsequent tests
      await usersSeed(router.env.DB)
    })

    it('converts createdAt ISO string to Date', async () => {
      // Act
      const users = await getAllUsers(context)

      // Assert
      const user = users[0]
      assert.ok(user.createdAt instanceof Date, 'createdAt should be Date object')
    })
  })

  describe('getUserById', () => {
    it('finds user by ID', async () => {
      // Arrange
      const allUsers = await getAllUsers(context)
      const expectedUser = allUsers[0]

      // Act
      const user = await getUserById(context, expectedUser.id)

      // Assert
      assert.ok(user, 'Should find user')
      assert.strictEqual(user.id, expectedUser.id)
      assert.strictEqual(user.email, expectedUser.email)
    })

    it('returns undefined for non-existent ID', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const user = await getUserById(context, nonExistentId)

      // Assert
      assert.strictEqual(user, undefined)
    })

    it('converts createdAt to Date', async () => {
      // Arrange
      const allUsers = await getAllUsers(context)
      const userId = allUsers[0].id

      // Act
      const user = await getUserById(context, userId)

      // Assert
      assert.ok(user)
      assert.ok(user.createdAt instanceof Date)
    })
  })

  describe('getUserByEmail', () => {
    it('finds user by email', async () => {
      // Act
      const user = await getUserByEmail(context, 'admin@bookstore.com')

      // Assert
      assert.ok(user, 'Should find admin user')
      assert.strictEqual(user.email, 'admin@bookstore.com')
      assert.strictEqual(user.role, 'admin')
    })

    it('returns undefined for non-existent email', async () => {
      // Act
      const user = await getUserByEmail(context, 'nonexistent@example.com')

      // Assert
      assert.strictEqual(user, undefined)
    })

    it('is case-insensitive', async () => {
      // Act
      const lowercase = await getUserByEmail(context, 'admin@bookstore.com')
      const uppercase = await getUserByEmail(context, 'ADMIN@BOOKSTORE.COM')
      const mixedcase = await getUserByEmail(context, 'Admin@Bookstore.Com')

      // Assert
      assert.ok(lowercase, 'Should find with lowercase')
      assert.ok(uppercase, 'Should find with uppercase')
      assert.ok(mixedcase, 'Should find with mixed case')
      assert.strictEqual(lowercase?.id, uppercase?.id)
      assert.strictEqual(lowercase?.id, mixedcase?.id)
    })
  })

  describe('authenticateUser', () => {
    it('returns user for correct email/password', async () => {
      // Act
      const user = await authenticateUser(context, 'admin@bookstore.com', 'admin123')

      // Assert
      assert.ok(user, 'Should authenticate with correct credentials')
      assert.strictEqual(user.email, 'admin@bookstore.com')
      assert.strictEqual(user.role, 'admin')
    })

    it('returns undefined for incorrect password', async () => {
      // Act
      const user = await authenticateUser(context, 'admin@bookstore.com', 'wrongpassword')

      // Assert
      assert.strictEqual(user, undefined, 'Should not authenticate with wrong password')
    })

    it('returns undefined for non-existent email', async () => {
      // Act
      const user = await authenticateUser(context, 'nonexistent@example.com', 'anypassword')

      // Assert
      assert.strictEqual(user, undefined, 'Should not authenticate non-existent user')
    })

    it('is case-insensitive for email', async () => {
      // Act
      const user = await authenticateUser(context, 'ADMIN@BOOKSTORE.COM', 'admin123')

      // Assert
      assert.ok(user, 'Should authenticate with uppercase email')
    })
  })

  describe('createUser', () => {
    it('creates user with hashed password', async () => {
      // Arrange
      const email = `test-${Date.now()}@example.com`
      const password = 'plaintext-password'
      const name = 'Test User'

      // Act
      const user = await createUser(context, email, password, name)

      // Assert
      assert.ok(user.id, 'Should have generated ID')
      assert.strictEqual(user.email, email)
      assert.strictEqual(user.name, name)
      assert.notEqual(user.password, password, 'Password should be hashed')

      // Verify password hash format (salt:hash)
      assert.ok(user.password.includes(':'), 'Password should be in salt:hash format')

      // Verify password can be verified
      const verified = await verifyPassword(password, user.password)
      assert.strictEqual(verified, true, 'Hashed password should verify')
    })

    it('generates unique nanoid', async () => {
      // Act
      const user1 = await createUser(context, 'user1@example.com', 'password', 'User 1')
      const user2 = await createUser(context, 'user2@example.com', 'password', 'User 2')

      // Assert
      assert.notEqual(user1.id, user2.id, 'IDs should be unique')

      // nanoid format validation
      assert.match(user1.id, NANOID_PATTERN, 'ID should be valid nanoid')
      assert.match(user2.id, NANOID_PATTERN, 'ID should be valid nanoid')
    })

    it('sets default role to customer', async () => {
      // Act
      const user = await createUser(context, 'defaultrole@example.com', 'password', 'Default Role')

      // Assert
      assert.strictEqual(user.role, 'customer', 'Default role should be customer')
    })

    it('allows explicit admin role', async () => {
      // Act
      const user = await createUser(context, 'newadmin@example.com', 'password', 'New Admin', 'admin')

      // Assert
      assert.strictEqual(user.role, 'admin', 'Should allow admin role')
    })

    it('can be retrieved after creation', async () => {
      // Arrange
      const email = `retrieval-${Date.now()}@example.com`
      const password = 'test-password'
      const name = 'Retrieval Test'

      // Act
      const created = await createUser(context, email, password, name)
      const retrieved = await getUserById(context, created.id)

      // Assert
      assert.ok(retrieved)
      assert.strictEqual(retrieved.id, created.id)
      assert.strictEqual(retrieved.email, email)
      assert.strictEqual(retrieved.name, name)
    })

    it('email stored as provided (case preserved)', async () => {
      // Arrange
      const email = 'MixedCase@Example.Com'

      // Act
      const user = await createUser(context, email, 'password', 'Mixed Case User')

      // Assert
      assert.strictEqual(user.email, email, 'Email case should be preserved')

      // But should still be found case-insensitively
      const found = await getUserByEmail(context, 'mixedcase@example.com')
      assert.ok(found)
      assert.strictEqual(found.id, user.id)
    })
  })

  describe('updateUser', () => {
    it('updates name field', async () => {
      // Arrange
      const user = await createUser(context, 'update1@example.com', 'password', 'Original Name')
      const originalEmail = user.email

      // Act
      const updated = await updateUser(context, user.id, {
        name: 'Updated Name',
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.name, 'Updated Name')
      assert.strictEqual(updated.email, originalEmail, 'Email should be unchanged')
    })

    it('updates email field', async () => {
      // Arrange
      const user = await createUser(context, 'update2@example.com', 'password', 'Test User')
      const newEmail = 'newemail@example.com'

      // Act
      const updated = await updateUser(context, user.id, {
        email: newEmail,
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.email, newEmail)
    })

    it('updates and hashes new password', async () => {
      // Arrange
      const originalPassword = 'original-password'
      const user = await createUser(context, 'update3@example.com', originalPassword, 'Test User')
      const originalHash = user.password

      // Act
      const newPassword = 'new-password'
      const updated = await updateUser(context, user.id, {
        password: newPassword,
      })

      // Assert
      assert.ok(updated)
      assert.notEqual(updated.password, originalHash, 'Password hash should change')
      assert.notEqual(updated.password, newPassword, 'Password should be hashed')

      // Verify new password works
      const verified = await verifyPassword(newPassword, updated.password)
      assert.strictEqual(verified, true, 'New password should verify')

      // Verify old password no longer works
      const oldVerified = await verifyPassword(originalPassword, updated.password)
      assert.strictEqual(oldVerified, false, 'Old password should not verify')
    })

    it('updates role field', async () => {
      // Arrange
      const user = await createUser(context, 'update4@example.com', 'password', 'Test User', 'customer')

      // Act
      const updated = await updateUser(context, user.id, {
        role: 'admin',
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.role, 'admin')
    })

    it('handles partial updates', async () => {
      // Arrange
      const user = await createUser(context, 'update5@example.com', 'password', 'Original Name', 'customer')

      // Act
      const updated = await updateUser(context, user.id, {
        name: 'New Name',
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.name, 'New Name')
      assert.strictEqual(updated.email, user.email, 'Email unchanged')
      assert.strictEqual(updated.role, 'customer', 'Role unchanged')
    })

    it('returns undefined for non-existent user', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const updated = await updateUser(context, nonExistentId, {
        name: 'Should Not Work',
      })

      // Assert
      assert.strictEqual(updated, undefined)
    })

    it('returns existing user when no fields provided', async () => {
      // Arrange
      const user = await createUser(context, 'update6@example.com', 'password', 'Test User')

      // Act
      const result = await updateUser(context, user.id, {})

      // Assert
      assert.ok(result)
      assert.strictEqual(result.id, user.id)
      assert.strictEqual(result.name, user.name)
    })
  })

  describe('deleteUser', () => {
    it('removes user from database', async () => {
      // Arrange
      const user = await createUser(context, 'delete1@example.com', 'password', 'To Be Deleted')

      // Act
      const deleted = await deleteUser(context, user.id)

      // Assert
      assert.strictEqual(deleted, true, 'Delete should return true')

      // Verify user is gone
      const retrieved = await getUserById(context, user.id)
      assert.strictEqual(retrieved, undefined, 'User should no longer exist')
    })

    it('returns true on success', async () => {
      // Arrange
      const user = await createUser(context, 'delete2@example.com', 'password', 'Delete Test')

      // Act
      const result = await deleteUser(context, user.id)

      // Assert
      assert.strictEqual(result, true)
    })

    it('returns false for non-existent user', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const result = await deleteUser(context, nonExistentId)

      // Assert
      assert.strictEqual(result, false)
    })
  })

  describe('createPasswordResetToken', () => {
    it('creates reset token for valid email', async () => {
      // Arrange
      const email = 'admin@bookstore.com'

      // Act
      const token = await createPasswordResetToken(context, email)

      // Assert
      assert.ok(token, 'Should create token')

      // Password reset tokens are 32 characters (not the standard 21)
      assert.match(token, /^[A-Za-z0-9_-]{32}$/, 'Token should be 32-char nanoid')
    })

    it('returns undefined for non-existent email', async () => {
      // Act
      const token = await createPasswordResetToken(context, 'nonexistent@example.com')

      // Assert
      assert.strictEqual(token, undefined, 'Should not create token for non-existent email')
    })

    it('sets expiration to 1 hour from now', async () => {
      // Arrange
      const email = 'customer@example.com'
      const beforeTime = Date.now()

      // Act
      const token = await createPasswordResetToken(context, email)

      // Assert
      assert.ok(token)

      // Verify token can be used immediately
      const resetResult = await resetPassword(context, token, 'new-password-123')
      assert.strictEqual(resetResult, true, 'Token should be valid immediately after creation')
    })
  })

  describe('resetPassword', () => {
    it('updates password with valid token', async () => {
      // Arrange
      const user = await createUser(context, 'reset1@example.com', 'old-password', 'Reset Test')
      const token = await createPasswordResetToken(context, user.email)
      assert.ok(token)

      // Act
      const newPassword = 'new-password-123'
      const result = await resetPassword(context, token!, newPassword)

      // Assert
      assert.strictEqual(result, true, 'Reset should succeed')

      // Verify new password works
      const authResult = await authenticateUser(context, user.email, newPassword)
      assert.ok(authResult, 'Should authenticate with new password')

      // Verify old password no longer works
      const oldAuthResult = await authenticateUser(context, user.email, 'old-password')
      assert.strictEqual(oldAuthResult, undefined, 'Old password should not work')
    })

    it('deletes token after use', async () => {
      // Arrange
      const user = await createUser(context, 'reset2@example.com', 'password', 'Token Cleanup Test')
      const token = await createPasswordResetToken(context, user.email)
      assert.ok(token)

      // Act
      await resetPassword(context, token!, 'new-password')

      // Assert - Try to use token again
      const secondReset = await resetPassword(context, token!, 'another-password')
      assert.strictEqual(secondReset, false, 'Token should not be reusable')
    })

    it('returns false for non-existent token', async () => {
      // Arrange
      const nonExistentToken = generateId()

      // Act
      const result = await resetPassword(context, nonExistentToken, 'new-password')

      // Assert
      assert.strictEqual(result, false)
    })

    it('returns false for expired token', async () => {
      // Arrange
      const user = await createUser(context, 'reset3@example.com', 'password', 'Expiration Test')

      // Manually create an expired token
      const env = router.env
      const expiredToken = generateId()
      const expiredTimestamp = Math.floor((Date.now() - 7200000) / 1000) // 2 hours ago
      await env.DB.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(expiredToken, user.id, expiredTimestamp)
        .run()

      // Act
      const result = await resetPassword(context, expiredToken, 'new-password')

      // Assert
      assert.strictEqual(result, false, 'Expired token should not work')

      // Verify password was not changed
      const authResult = await authenticateUser(context, user.email, 'password')
      assert.ok(authResult, 'Original password should still work')
    })

    it('cleans up expired tokens', async () => {
      // Arrange
      const user = await createUser(context, 'reset4@example.com', 'password', 'Cleanup Test')

      // Create expired token
      const env = router.env
      const expiredToken = generateId()
      const expiredTimestamp = Math.floor((Date.now() - 7200000) / 1000)
      await env.DB.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(expiredToken, user.id, expiredTimestamp)
        .run()

      // Act
      const result = await resetPassword(context, expiredToken, 'new-password')

      // Assert
      assert.strictEqual(result, false)

      // Verify token was cleaned up
      const tokenCheck = await env.DB.prepare('SELECT * FROM password_reset_tokens WHERE token = ?')
        .bind(expiredToken)
        .first()
      assert.strictEqual(tokenCheck, null, 'Expired token should be deleted')
    })
  })

  describe('Integration Tests', () => {
    it('full user lifecycle: create → authenticate → update → delete', async () => {
      // Create
      const email = `lifecycle-${Date.now()}@example.com`
      const password = 'initial-password'
      const created = await createUser(context, email, password, 'Lifecycle User')

      assert.ok(created.id)
      assert.strictEqual(created.email, email)
      assert.strictEqual(created.role, 'customer')

      // Authenticate
      const authenticated = await authenticateUser(context, email, password)
      assert.ok(authenticated)
      assert.strictEqual(authenticated.id, created.id)

      // Update
      const updated = await updateUser(context, created.id, {
        name: 'Updated Name',
        role: 'admin',
      })
      assert.ok(updated)
      assert.strictEqual(updated.name, 'Updated Name')
      assert.strictEqual(updated.role, 'admin')

      // Delete
      const deleted = await deleteUser(context, created.id)
      assert.strictEqual(deleted, true)

      // Verify deletion
      const afterDelete = await getUserById(context, created.id)
      assert.strictEqual(afterDelete, undefined)
    })

    it('password reset flow: create token → reset → authenticate', async () => {
      // Arrange
      const email = `resetflow-${Date.now()}@example.com`
      const originalPassword = 'original-password'
      const user = await createUser(context, email, originalPassword, 'Reset Flow User')

      // Create reset token
      const token = await createPasswordResetToken(context, email)
      assert.ok(token)

      // Reset password
      const newPassword = 'new-password-456'
      const resetResult = await resetPassword(context, token!, newPassword)
      assert.strictEqual(resetResult, true)

      // Authenticate with new password
      const authResult = await authenticateUser(context, email, newPassword)
      assert.ok(authResult)
      assert.strictEqual(authResult.id, user.id)

      // Old password should fail
      const oldAuthResult = await authenticateUser(context, email, originalPassword)
      assert.strictEqual(oldAuthResult, undefined)
    })

    it('multiple users can exist with unique emails', async () => {
      // Act
      const user1 = await createUser(context, 'multi1@example.com', 'password1', 'User 1')
      const user2 = await createUser(context, 'multi2@example.com', 'password2', 'User 2')
      const user3 = await createUser(context, 'multi3@example.com', 'password3', 'User 3')

      // Assert
      const allUsers = await getAllUsers(context)
      assert.ok(allUsers.length >= 3)

      // Each user can authenticate independently
      const auth1 = await authenticateUser(context, 'multi1@example.com', 'password1')
      const auth2 = await authenticateUser(context, 'multi2@example.com', 'password2')
      const auth3 = await authenticateUser(context, 'multi3@example.com', 'password3')

      assert.ok(auth1)
      assert.ok(auth2)
      assert.ok(auth3)
      assert.strictEqual(auth1.id, user1.id)
      assert.strictEqual(auth2.id, user2.id)
      assert.strictEqual(auth3.id, user3.id)
    })
  })
})
