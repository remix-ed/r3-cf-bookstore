/**
 * Validation Utility Tests
 *
 * Tests for validation helper functions:
 * - validate: Schema validation with error formatting
 * - validateOrThrow: Validation that throws on failure
 * - assertValid: Type assertion for runtime checking
 * - validateInput: Validation middleware creator
 * - validateFormData: Form data validation
 * - validateJSON: JSON body validation
 */

import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as v from 'valibot'
import {
  validate,
  validateOrThrow,
  assertValid,
  validateInput,
  validateFormData,
  validateJSON,
} from './validation.ts'

// Test schemas
const SimpleSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  age: v.pipe(v.number(), v.minValue(0)),
})

// Form-specific schema with transformations (for FormData which returns strings)
const SimpleFormSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  age: v.pipe(
    v.string(),
    v.transform((s) => parseInt(s, 10)),
    v.number(),
    v.minValue(0)
  ),
})

const NestedSchema = v.object({
  user: v.object({
    email: v.pipe(v.string(), v.email()),
    profile: v.object({
      bio: v.string(),
    }),
  }),
})

const OptionalFieldsSchema = v.object({
  required: v.string(),
  optional: v.optional(v.string()),
})

describe('Validation Utilities', () => {
  // =============================================================================
  // validate() Tests
  // =============================================================================

  describe('validate', () => {
    it('returns success result for valid data', () => {
      // Arrange
      const data = { name: 'John', age: 30 }

      // Act
      const result = validate(SimpleSchema, data)

      // Assert
      assert.strictEqual(result.success, true, 'Should succeed')
      if (result.success) {
        assert.strictEqual(result.data.name, 'John', 'Should have name')
        assert.strictEqual(result.data.age, 30, 'Should have age')
      }
    })

    it('returns error result for invalid data', () => {
      // Arrange
      const data = { name: '', age: -5 }

      // Act
      const result = validate(SimpleSchema, data)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail')
      if (!result.success) {
        assert.ok(result.errors.length > 0, 'Should have errors')
        assert.ok(result.errors.some((e) => e.field === 'name'), 'Should have name error')
        assert.ok(result.errors.some((e) => e.field === 'age'), 'Should have age error')
      }
    })

    it('formats error messages correctly', () => {
      // Arrange
      const data = { name: '', age: -5 }

      // Act
      const result = validate(SimpleSchema, data)

      // Assert
      if (!result.success) {
        result.errors.forEach((error) => {
          assert.ok(error.field, 'Error should have field')
          assert.ok(error.message, 'Error should have message')
          assert.strictEqual(typeof error.field, 'string', 'Field should be string')
          assert.strictEqual(typeof error.message, 'string', 'Message should be string')
        })
      }
    })

    it('handles nested field errors', () => {
      // Arrange
      const data = {
        user: {
          email: 'invalid-email',
          profile: {
            bio: '',
          },
        },
      }

      // Act
      const result = validate(NestedSchema, data)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for invalid nested data')
      if (!result.success) {
        assert.ok(result.errors.length > 0, 'Should have errors')
        // Check that nested field paths are included
        const emailError = result.errors.find((e) => e.field.includes('email'))
        assert.ok(emailError, 'Should have email error with nested path')
      }
    })

    it('handles missing required fields', () => {
      // Arrange
      const data = {}

      // Act
      const result = validate(SimpleSchema, data)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for missing fields')
      if (!result.success) {
        assert.ok(result.errors.length >= 2, 'Should have errors for both missing fields')
      }
    })

    it('allows optional fields', () => {
      // Arrange
      const data = { required: 'present' }

      // Act
      const result = validate(OptionalFieldsSchema, data)

      // Assert
      assert.strictEqual(result.success, true, 'Should succeed with only required field')
      if (result.success) {
        assert.strictEqual(result.data.required, 'present', 'Should have required field')
        assert.strictEqual(result.data.optional, undefined, 'Optional field should be undefined')
      }
    })

    it('handles wrong type errors', () => {
      // Arrange
      const data = { name: 123, age: 'thirty' }

      // Act
      const result = validate(SimpleSchema, data)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for wrong types')
    })

    it('validates empty objects', () => {
      // Arrange
      const EmptySchema = v.object({})
      const data = {}

      // Act
      const result = validate(EmptySchema, data)

      // Assert
      assert.strictEqual(result.success, true, 'Empty object should validate against empty schema')
    })
  })

  // =============================================================================
  // validateOrThrow() Tests
  // =============================================================================

  describe('validateOrThrow', () => {
    it('returns validated data for valid input', () => {
      // Arrange
      const data = { name: 'Alice', age: 25 }

      // Act
      const result = validateOrThrow(SimpleSchema, data)

      // Assert
      assert.strictEqual(result.name, 'Alice', 'Should return validated name')
      assert.strictEqual(result.age, 25, 'Should return validated age')
    })

    it('throws error for invalid input', () => {
      // Arrange
      const data = { name: '', age: -1 }

      // Act & Assert
      assert.throws(
        () => validateOrThrow(SimpleSchema, data),
        (error: any) => {
          assert.ok(error, 'Should throw an error')
          return true
        },
        'Should throw for invalid data'
      )
    })

    it('throws error for missing fields', () => {
      // Arrange
      const data = { name: 'Bob' }

      // Act & Assert
      assert.throws(
        () => validateOrThrow(SimpleSchema, data),
        'Should throw for missing required field'
      )
    })

    it('throws error for wrong types', () => {
      // Arrange
      const data = { name: 123, age: 'invalid' }

      // Act & Assert
      assert.throws(
        () => validateOrThrow(SimpleSchema, data),
        'Should throw for wrong types'
      )
    })
  })

  // =============================================================================
  // assertValid() Tests
  // =============================================================================

  describe('assertValid', () => {
    it('does not throw for valid data', () => {
      // Arrange
      const data = { name: 'Charlie', age: 35 }

      // Act & Assert - Should not throw
      assertValid(SimpleSchema, data)
      assert.ok(true, 'Should not throw for valid data')
    })

    it('throws for invalid data', () => {
      // Arrange
      const data = { name: '', age: -10 }

      // Act & Assert
      assert.throws(
        () => assertValid(SimpleSchema, data),
        'Should throw for invalid data'
      )
    })

    it('narrows type after assertion', () => {
      // Arrange
      const data: unknown = { name: 'Dave', age: 40 }

      // Act
      assertValid(SimpleSchema, data)

      // Assert - Type is now narrowed (TypeScript would verify this)
      // At runtime, we can access properties
      assert.strictEqual(data.name, 'Dave', 'Type should be narrowed to allow property access')
    })
  })

  // =============================================================================
  // validateInput() Tests
  // =============================================================================

  describe('validateInput', () => {
    it('calls handler with validated data for valid input', () => {
      // Arrange
      let handlerCalled = false
      let receivedInput: any = null

      const handler = (_context: any, input: any) => {
        handlerCalled = true
        receivedInput = input
        return new Response('Success')
      }

      const validatedHandler = validateInput(SimpleSchema, handler)
      const data = { name: 'Eve', age: 28 }

      // Act
      const result = validatedHandler({}, data)

      // Assert
      assert.strictEqual(handlerCalled, true, 'Handler should be called')
      assert.deepEqual(receivedInput, data, 'Handler should receive validated data')
      assert.ok(result instanceof Response, 'Should return Response from handler')
    })

    it('returns 400 error response for invalid input', () => {
      // Arrange
      let handlerCalled = false

      const handler = () => {
        handlerCalled = true
        return new Response('Success')
      }

      const validatedHandler = validateInput(SimpleSchema, handler)
      const invalidData = { name: '', age: -5 }

      // Act
      const result = validatedHandler({}, invalidData)

      // Assert
      assert.strictEqual(handlerCalled, false, 'Handler should not be called for invalid data')
      assert.ok(result instanceof Response, 'Should return Response')
      assert.strictEqual(result.status, 400, 'Should return 400 status')
    })

    it('includes validation errors in error response', async () => {
      // Arrange
      const handler = () => new Response('Success')
      const validatedHandler = validateInput(SimpleSchema, handler)
      const invalidData = { name: '', age: -5 }

      // Act
      const result = validatedHandler({}, invalidData) as Response
      const body = (await result.json()) as any

      // Assert
      assert.ok(body.error, 'Should have error field')
      assert.ok(body.errors, 'Should have errors array')
      assert.ok(Array.isArray(body.errors), 'Errors should be array')
      assert.ok(body.errors.length > 0, 'Should have validation errors')
    })

    it('passes context to handler', () => {
      // Arrange
      let receivedContext: any = null

      const handler = (context: any, _input: any) => {
        receivedContext = context
        return new Response('Success')
      }

      const validatedHandler = validateInput(SimpleSchema, handler)
      const data = { name: 'Frank', age: 45 }
      const context = { userId: '123' }

      // Act
      validatedHandler(context, data)

      // Assert
      assert.deepEqual(receivedContext, context, 'Handler should receive context')
    })
  })

  // =============================================================================
  // validateFormData() Tests
  // =============================================================================

  describe('validateFormData', () => {
    it('validates and converts form data', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'George')
      formData.append('age', '50')

      const request = new Request('http://localhost', {
        method: 'POST',
        body: formData,
      })

      // Act
      const result = await validateFormData(request, SimpleFormSchema)

      // Assert
      assert.strictEqual(result.success, true, 'Should succeed')
      if (result.success) {
        assert.strictEqual(result.data.name, 'George', 'Should have name')
        assert.strictEqual(result.data.age, 50, 'Should convert age to number')
      }
    })

    it('returns errors for invalid form data', async () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', '')
      formData.append('age', '-10')

      const request = new Request('http://localhost', {
        method: 'POST',
        body: formData,
      })

      // Act
      const result = await validateFormData(request, SimpleFormSchema)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail')
      if (!result.success) {
        assert.ok(result.errors.length > 0, 'Should have errors')
      }
    })

    it('handles empty form data', async () => {
      // Arrange
      const formData = new FormData()
      const request = new Request('http://localhost', {
        method: 'POST',
        body: formData,
      })

      // Act
      const result = await validateFormData(request, SimpleFormSchema)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for empty form')
    })
  })

  // =============================================================================
  // validateJSON() Tests
  // =============================================================================

  describe('validateJSON', () => {
    it('validates JSON request body', async () => {
      // Arrange
      const data = { name: 'Helen', age: 33 }
      const request = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      // Act
      const result = await validateJSON(request, SimpleSchema)

      // Assert
      assert.strictEqual(result.success, true, 'Should succeed')
      if (result.success) {
        assert.strictEqual(result.data.name, 'Helen', 'Should have name')
        assert.strictEqual(result.data.age, 33, 'Should have age')
      }
    })

    it('returns errors for invalid JSON data', async () => {
      // Arrange
      const data = { name: '', age: -1 }
      const request = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      // Act
      const result = await validateJSON(request, SimpleSchema)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail')
      if (!result.success) {
        assert.ok(result.errors.length > 0, 'Should have validation errors')
      }
    })

    it('handles malformed JSON', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json{',
      })

      // Act
      const result = await validateJSON(request, SimpleSchema)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for malformed JSON')
      if (!result.success) {
        assert.strictEqual(result.errors.length, 1, 'Should have one error')
        assert.strictEqual(result.errors[0].field, 'body', 'Error should be for body')
        assert.ok(result.errors[0].message.includes('Invalid JSON'), 'Should mention invalid JSON')
      }
    })

    it('handles empty JSON body', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })

      // Act
      const result = await validateJSON(request, SimpleSchema)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for empty object')
    })

    it('handles null JSON', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      })

      // Act
      const result = await validateJSON(request, SimpleSchema)

      // Assert
      assert.strictEqual(result.success, false, 'Should fail for null')
    })
  })
})
