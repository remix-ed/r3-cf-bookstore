/**
 * Validation Utilities
 *
 * Helper functions for validating data using Valibot schemas.
 * Provides consistent error handling and type-safe validation.
 *
 * All application code should import validation from this module,
 * not directly from 'valibot'.
 */

import * as v from 'valibot'

// Re-export valibot for centralized imports
export { v }

/**
 * Validation error response
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Validation result
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] }

/**
 * Validate data against a Valibot schema
 *
 * @example
 * const result = validate(CreateUserInputSchema, formData)
 * if (!result.success) {
 *   return Response.json({ errors: result.errors }, { status: 400 })
 * }
 * const user = await createUser(context, result.data)
 */
export function validate<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  data: unknown
): ValidationResult<v.InferOutput<TSchema>> {
  const result = v.safeParse(schema, data)

  if (result.success) {
    return { success: true, data: result.output }
  }

  // Convert Valibot issues to our ValidationError format
  const errors: ValidationError[] = []

  if (result.issues) {
    for (const issue of result.issues) {
      errors.push({
        field: issue.path?.map((p) => p.key).join('.') || 'unknown',
        message: issue.message,
      })
    }
  }

  return { success: false, errors }
}

/**
 * Validate data and throw an error if validation fails
 *
 * @example
 * const validData = validateOrThrow(CreateUserInputSchema, formData)
 * const user = await createUser(context, validData)
 */
export function validateOrThrow<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  data: unknown
): v.InferOutput<TSchema> {
  return v.parse(schema, data)
}

/**
 * Assert that data matches a schema (for runtime type checking)
 *
 * @example
 * const user = await getUserById(context, id)
 * assertValid(UserSchema, user) // Throws if user doesn't match schema
 */
export function assertValid<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: TSchema,
  data: unknown
): asserts data is v.InferOutput<TSchema> {
  v.parse(schema, data)
}

/**
 * Create a validation middleware for route handlers
 *
 * @example
 * export const createUser = validateInput(CreateUserInputSchema, async (context, input) => {
 *   const user = await createUser(context, input.email, input.password, input.name)
 *   return Response.json(user)
 * })
 */
export function validateInput<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>, TResult>(
  schema: TSchema,
  handler: (context: any, input: v.InferOutput<TSchema>) => TResult
): (context: any, input: unknown) => TResult | Response {
  return (context: any, input: unknown) => {
    const result = validate(schema, input)

    if (!result.success) {
      return Response.json(
        {
          error: 'Validation failed',
          errors: result.errors,
        },
        { status: 400 }
      )
    }

    return handler(context, result.data)
  }
}

/**
 * Validate form data from a FormData object
 * Note: FormData always returns string values. Use schema-driven type coercion
 * with v.pipe() and v.transform() for proper type conversion.
 *
 * @example
 * // explicit transformation
 *  quantity: v.pipe( v.string(), v.transform(s => parseInt(s, 10)), v.number(), v.integer(), v.minValue(1) ),
 *  price: v.pipe( v.string(), v.transform(s => parseFloat(s)), v.number(), v.minValue(0) )
 */
export function validateForm<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  formData: FormData,
  schema: TSchema
): ValidationResult<v.InferOutput<TSchema>> {
  const data: Record<string, any> = {}

  formData.forEach((value, key) => {
    data[key] = value
  })

  return validate(schema, data)
}

/**
 * Validate form data from a Request
 *
 * @example
 * const result = await validateFormData(request, CreateUserInputSchema)
 * if (!result.success) {
 *   return Response.json({ errors: result.errors }, { status: 400 })
 * }
 */
export async function validateFormData<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  request: Request,
  schema: TSchema
): Promise<ValidationResult<v.InferOutput<TSchema>>> {
  const formData = await request.formData()
  return validateForm(formData, schema)
}


/**
 * Validate JSON body from a Request
 *
 * @example
 * const result = await validateJSON(request, CreateBookInputSchema)
 * if (!result.success) {
 *   return Response.json({ errors: result.errors }, { status: 400 })
 * }
 */
export async function validateJSON<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  request: Request,
  schema: TSchema
): Promise<ValidationResult<v.InferOutput<TSchema>>> {
  try {
    const data = await request.json()
    return validate(schema, data)
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: 'body',
          message: 'Invalid JSON',
        },
      ],
    }
  }
}
