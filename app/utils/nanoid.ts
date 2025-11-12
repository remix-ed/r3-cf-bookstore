/**
 * NanoID utilities for generating unique IDs
 *
 * Provides a consistent interface for generating IDs across the application
 * and validation patterns for testing.
 */

import { nanoid } from 'nanoid'

/**
 * Generate a unique ID using nanoid
 *
 * @returns A unique ID string
 */
export function generateId(): string {
  return nanoid()
}

/**
 * Regular expression pattern for validating nanoid format
 * Default nanoid uses URL-safe characters (A-Za-z0-9_-) with 21 character length
 */
export const NANOID_PATTERN = /^[A-Za-z0-9_-]{21}$/
