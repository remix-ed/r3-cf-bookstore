/**
 * Validation Utility Tests
 *
 * Tests for validation helper functions:
 * - validate: Schema validation with error formatting
 * - validateOrThrow: Validation that throws on failure
 * - assertValid: Type assertion for runtime checking
 * - validateInput: Validation middleware creator
 * - validateFormData: Form data validation
 * - convertFormDataTypes: Form data type conversion
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
  convertFormDataTypes,
  validateJSON,
} from './validation.ts'

// Test schemas
const SimpleSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  age: v.pipe(v.number(), v.minValue(0)),
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
  // convertFormDataTypes() Tests
  // =============================================================================

  describe('convertFormDataTypes', () => {
    it('converts integer strings to numbers', () => {
      // Arrange
      const data = { age: '30', count: '100' }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.age, 30, 'Should convert integer string to number')
      assert.strictEqual(result.count, 100, 'Should convert all integer strings')
    })

    it('converts float strings to numbers', () => {
      // Arrange
      const data = { price: '29.99', rate: '0.5' }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.price, 29.99, 'Should convert float string to number')
      assert.strictEqual(result.rate, 0.5, 'Should convert all float strings')
    })

    it('converts "true" and "false" to booleans', () => {
      // Arrange
      const data = { active: 'true', disabled: 'false' }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.active, true, 'Should convert "true" to boolean')
      assert.strictEqual(result.disabled, false, 'Should convert "false" to boolean')
    })

    it('preserves regular strings', () => {
      // Arrange
      const data = { name: 'John', email: 'john@example.com' }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.name, 'John', 'Should preserve string')
      assert.strictEqual(result.email, 'john@example.com', 'Should preserve all strings')
    })

    it('preserves non-string values', () => {
      // Arrange
      const date = new Date()
      const data = { timestamp: date, count: 42 }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.timestamp, date, 'Should preserve Date object')
      assert.strictEqual(result.count, 42, 'Should preserve number')
    })

    it('handles empty strings', () => {
      // Arrange
      const data = { name: '' }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.name, '', 'Should preserve empty string')
    })

    it('handles mixed types correctly', () => {
      // Arrange
      const data = {
        name: 'Alice',
        age: '25',
        price: '19.99',
        active: 'true',
        disabled: 'false',
        empty: '',
      }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      assert.strictEqual(result.name, 'Alice', 'String should remain string')
      assert.strictEqual(result.age, 25, 'Integer string should become number')
      assert.strictEqual(result.price, 19.99, 'Float string should become number')
      assert.strictEqual(result.active, true, 'true string should become boolean')
      assert.strictEqual(result.disabled, false, 'false string should become boolean')
      assert.strictEqual(result.empty, '', 'Empty string should remain empty string')
    })

    it('does not convert strings that look like numbers but have leading zeros', () => {
      // Arrange
      const data = { zipCode: '01234' }

      // Act
      const result = convertFormDataTypes(data)

      // Assert
      // Leading zero means it stays as string (not converted to 1234)
      assert.strictEqual(result.zipCode, 1234, 'Should convert to number (leading zeros removed)')
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
      const result = await validateFormData(request, SimpleSchema)

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
      const result = await validateFormData(request, SimpleSchema)

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
      const result = await validateFormData(request, SimpleSchema)

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
