/**
 * Password Utility Tests
 *
 * Tests for PBKDF2-based password hashing with security focus:
 * - Salt randomness (same password → different hashes)
 * - Hash format validation (salt:hash in base64)
 * - Constant-time comparison (via verifyPassword)
 * - Edge cases (empty strings, unicode, long passwords)
 */

import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashPassword, verifyPassword } from './password.ts'

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('generates unique salts for same password', async () => {
      // Arrange
      const password = 'test-password-123'

      // Act
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      // Assert
      assert.notEqual(hash1, hash2, 'Same password should produce different hashes due to random salt')
    })

    it('produces valid salt:hash format', async () => {
      // Arrange
      const password = 'myPassword123'

      // Act
      const hash = await hashPassword(password)

      // Assert
      const parts = hash.split(':')
      assert.strictEqual(parts.length, 2, 'Hash should be in format salt:hash')

      const [salt, hashPart] = parts
      assert.ok(salt.length > 0, 'Salt should not be empty')
      assert.ok(hashPart.length > 0, 'Hash should not be empty')

      // Base64 encoded 16-byte salt should be 24 characters (with padding)
      assert.ok(salt.length >= 20, 'Salt should be at least 20 characters (base64 encoded)')

      // Base64 encoded 32-byte hash should be 44 characters (with padding)
      assert.ok(hashPart.length >= 40, 'Hash should be at least 40 characters (base64 encoded)')
    })

    it('handles empty string password', async () => {
      // Arrange
      const password = ''

      // Act
      const hash = await hashPassword(password)

      // Assert
      assert.ok(hash.includes(':'), 'Should still produce valid hash for empty password')
      const verified = await verifyPassword('', hash)
      assert.strictEqual(verified, true, 'Empty password should verify against its hash')
    })

    it('handles unicode characters', async () => {
      // Arrange
      const password = '密码🔒emoji™'

      // Act
      const hash = await hashPassword(password)

      // Assert
      const verified = await verifyPassword(password, hash)
      assert.strictEqual(verified, true, 'Unicode password should verify correctly')
    })

    it('handles very long passwords (1000+ chars)', async () => {
      // Arrange
      const password = 'a'.repeat(1500)

      // Act
      const hash = await hashPassword(password)

      // Assert
      const verified = await verifyPassword(password, hash)
      assert.strictEqual(verified, true, 'Very long password should verify correctly')
    })

    it('handles passwords with special characters', async () => {
      // Arrange
      const password = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`'

      // Act
      const hash = await hashPassword(password)

      // Assert
      const verified = await verifyPassword(password, hash)
      assert.strictEqual(verified, true, 'Special characters should be handled correctly')
    })
  })

  describe('verifyPassword', () => {
    it('accepts correct password', async () => {
      // Arrange
      const password = 'correct-password-123'
      const hash = await hashPassword(password)

      // Act
      const result = await verifyPassword(password, hash)

      // Assert
      assert.strictEqual(result, true, 'Correct password should verify')
    })

    it('rejects incorrect password', async () => {
      // Arrange
      const correctPassword = 'correct-password'
      const incorrectPassword = 'wrong-password'
      const hash = await hashPassword(correctPassword)

      // Act
      const result = await verifyPassword(incorrectPassword, hash)

      // Assert
      assert.strictEqual(result, false, 'Incorrect password should not verify')
    })

    it('rejects password with single character difference', async () => {
      // Arrange
      const password = 'password123'
      const wrongPassword = 'password124' // Last character changed
      const hash = await hashPassword(password)

      // Act
      const result = await verifyPassword(wrongPassword, hash)

      // Assert
      assert.strictEqual(result, false, 'Password with single character difference should fail')
    })

    it('handles malformed hash without colon', async () => {
      // Arrange
      const password = 'test'
      const malformedHash = 'invalid-hash-no-colon'

      // Act
      const result = await verifyPassword(password, malformedHash)

      // Assert
      assert.strictEqual(result, false, 'Malformed hash without colon should return false')
    })

    it('handles hash with only salt part', async () => {
      // Arrange
      const password = 'test'
      const malformedHash = 'onlysalt:'

      // Act
      const result = await verifyPassword(password, malformedHash)

      // Assert
      assert.strictEqual(result, false, 'Hash with missing hash part should return false')
    })

    it('handles hash with only hash part', async () => {
      // Arrange
      const password = 'test'
      const malformedHash = ':onlyhash'

      // Act
      const result = await verifyPassword(password, malformedHash)

      // Assert
      assert.strictEqual(result, false, 'Hash with missing salt part should return false')
    })

    it('handles invalid base64 in salt', async () => {
      // Arrange
      const password = 'test'
      const malformedHash = '!!!invalid-base64!!!:aGVsbG8='

      // Act
      const result = await verifyPassword(password, malformedHash)

      // Assert
      assert.strictEqual(result, false, 'Hash with invalid base64 salt should return false')
    })

    it('handles invalid base64 in hash', async () => {
      // Arrange
      const password = 'test'
      const malformedHash = 'aGVsbG8=:!!!invalid-base64!!!'

      // Act
      const result = await verifyPassword(password, malformedHash)

      // Assert
      assert.strictEqual(result, false, 'Hash with invalid base64 hash should return false')
    })

    it('is case-sensitive', async () => {
      // Arrange
      const password = 'Password123'
      const wrongCasePassword = 'password123'
      const hash = await hashPassword(password)

      // Act
      const result = await verifyPassword(wrongCasePassword, hash)

      // Assert
      assert.strictEqual(result, false, 'Password verification should be case-sensitive')
    })

    it('performs constant-time comparison (same length)', async () => {
      // This test verifies that verifyPassword uses constant-time comparison
      // by checking that different passwords with same length are rejected
      // The actual timing is not measured (flaky in tests), but we ensure
      // the code path through constantTimeEqual() is exercised

      // Arrange
      const password = 'password1'
      const hash = await hashPassword(password)

      // Act - Try passwords with same length but different characters
      const result1 = await verifyPassword('password2', hash)
      const result2 = await verifyPassword('password3', hash)
      const result3 = await verifyPassword('xxxxxxxxx', hash)

      // Assert - All should fail
      assert.strictEqual(result1, false)
      assert.strictEqual(result2, false)
      assert.strictEqual(result3, false)
    })

    it('handles empty password verification', async () => {
      // Arrange
      const password = ''
      const hash = await hashPassword(password)

      // Act
      const correctResult = await verifyPassword('', hash)
      const wrongResult = await verifyPassword('a', hash)

      // Assert
      assert.strictEqual(correctResult, true, 'Empty password should verify')
      assert.strictEqual(wrongResult, false, 'Non-empty password should not match empty hash')
    })
  })

  describe('Integration Tests', () => {
    it('full password workflow: hash → store → verify', async () => {
      // Arrange - Simulate user registration
      const userPassword = 'mySecurePassword123!'

      // Act - Hash password on registration
      const storedHash = await hashPassword(userPassword)

      // Act - Verify password on login
      const loginResult = await verifyPassword(userPassword, storedHash)
      const wrongPasswordResult = await verifyPassword('wrongPassword', storedHash)

      // Assert
      assert.strictEqual(loginResult, true, 'Correct password should authenticate')
      assert.strictEqual(wrongPasswordResult, false, 'Wrong password should not authenticate')
    })

    it('multiple users with same password get different hashes', async () => {
      // Arrange - Two users choose the same password
      const password = 'common-password'

      // Act - Hash for each user
      const user1Hash = await hashPassword(password)
      const user2Hash = await hashPassword(password)
      const user3Hash = await hashPassword(password)

      // Assert - All hashes should be different (unique salts)
      assert.notEqual(user1Hash, user2Hash, 'User 1 and 2 should have different hashes')
      assert.notEqual(user2Hash, user3Hash, 'User 2 and 3 should have different hashes')
      assert.notEqual(user1Hash, user3Hash, 'User 1 and 3 should have different hashes')

      // But all should verify with the same password
      assert.strictEqual(await verifyPassword(password, user1Hash), true)
      assert.strictEqual(await verifyPassword(password, user2Hash), true)
      assert.strictEqual(await verifyPassword(password, user3Hash), true)
    })

    it('realistic password complexity requirements', async () => {
      // Arrange - Common password patterns
      const passwords = [
        'Short1!', // 7 chars
        'Medium123!@#', // 12 chars
        'VeryLongPasswordWithNumbersAndSpecialCharacters123!@#$%', // 54 chars
        'Has Spaces 123!', // with spaces
        'CamelCasePassword123', // mixed case
        'all-lowercase-with-dashes-123',
        'ALL-UPPERCASE-WITH-DASHES-123',
      ]

      // Act & Assert - All should hash and verify correctly
      for (const password of passwords) {
        const hash = await hashPassword(password)
        const verified = await verifyPassword(password, hash)
        assert.strictEqual(
          verified,
          true,
          `Password "${password}" should hash and verify correctly`
        )
      }
    })
  })
})
