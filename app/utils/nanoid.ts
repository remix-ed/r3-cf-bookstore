/**
 * NanoID utilities for generating unique IDs
 *
 * Provides a consistent interface for generating IDs across the application
 * and validation patterns for testing.
 */

import { nanoid } from 'nanoid'
import { v } from './validation.ts'

/**
 * Generate a unique ID using nanoid
 *
 * @param size - Optional length of the ID (default: 21)
 * @returns A unique ID string
 */
export function generateId(size?: number): string {
  return size !== undefined ? nanoid(size) : nanoid()
}

/**
 * Regular expression pattern for validating nanoid format
 * Default nanoid uses URL-safe characters (A-Za-z0-9_-) with 21 character length
 */
export const NANOID_PATTERN = /^[A-Za-z0-9_-]{21}$/

/**
 * Create a regular expression pattern for validating nanoid format with custom length
 *
 * @param size - The expected length of the nanoid (default: 21)
 * @returns RegExp pattern for the specified length
 */
export function createNanoidPattern(size: number = 21): RegExp {
  return new RegExp(`^[A-Za-z0-9_-]{${size}}$`)
}

/**
 * Valibot validator for nanoid format
 *
 * Validates that a string matches the nanoid pattern (21 URL-safe characters by default).
 * Use this in schemas for ID fields.
 *
 * @param size - Optional length of the nanoid (default: 21)
 *
 * @example
 * const UserSchema = v.object({
 *   id: nanoidValidator(),
 *   name: v.string()
 * })
 *
 * @example
 * const TokenSchema = v.object({
 *   token: nanoidValidator(32) // Custom length
 * })
 *
 * @returns A Valibot schema for validating nanoid strings
 */
export function nanoidValidator(size: number = 21) {
  const pattern = size === 21 ? NANOID_PATTERN : createNanoidPattern(size)
  return v.pipe(
    v.string(),
    v.regex(pattern, 'Invalid ID format')
  )
}
