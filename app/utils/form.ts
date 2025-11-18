import * as v from 'valibot'
import type { ValidationError } from './validation'

/**
 * Generic form state type inferred from a Valibot schema
 * Automatically includes all schema fields (as optional) plus errors and success
 */
export type FormState<TSchema extends v.ObjectSchema<any, any>> = Partial<v.InferOutput<TSchema>> & {
  errors?: ValidationError[]
  success?: boolean
}

/**
 * Type representing all field names in a schema
 * Maps each field name to itself for type-safe field access
 */
export type SchemaFields<TSchema extends v.ObjectSchema<any, any>> = {
  [K in keyof TSchema['entries']]: K
}

/**
 * Type representing error messages for each field in a schema
 * Mirrors the SchemaFields pattern for consistent API
 * Includes a special "form" field for general form-level errors
 */
export type FormErrors<TSchema extends v.ObjectSchema<any, any>> = {
  [K in keyof TSchema['entries']]?: string
} & {
  form?: string
}

/**
 * Creates a form state object from FormData with validation errors
 * Automatically extracts field names from the provided Valibot schema
 */
export function createFormState<TSchema extends v.ObjectSchema<any, any>>(
  formData: FormData,
  schema: TSchema,
  errors: ValidationError[]
): Record<string, any> {
  const state: Record<string, any> = {}

  for (const fieldName of Object.keys(schema.entries)) {
    state[fieldName] = formData.get(fieldName) as string
  }

  return { ...state, errors }
}

/**
 * Creates a type-safe object containing all field names from a schema
 * Eliminates hard-coded field name constants
 */
export function createSchemaFields<TSchema extends v.ObjectSchema<any, any>>(
  schema: TSchema
): SchemaFields<TSchema> {
  const formFields = {} as any
  for (const key of Object.keys(schema.entries)) {
    formFields[key] = key
  }
  return formFields
}

/**
 * Creates a type-safe object containing error messages for form fields
 * Provides property-based access to errors, mirroring the formFields API
 * Includes a special "form" field for general form-level errors
 *
 * @example
 * const formErrors = createFormErrors(InsertContactSchema, formState?.errors || [])
 * formErrors.name    // ✅ "Name is required" or undefined
 * formErrors.email   // ✅ Type-safe access
 * formErrors.form    // ✅ General form error
 * formErrors.xyz     // ❌ TypeScript error - field doesn't exist
 */
export function createFormErrors<TSchema extends v.ObjectSchema<any, any>>(
  schema: TSchema,
  errors: ValidationError[]
): FormErrors<TSchema> {
  const formErrors: any = {}

  // Map errors by field name
  for (const error of errors) {
    formErrors[error.field] = error.message
  }

  return formErrors
}
