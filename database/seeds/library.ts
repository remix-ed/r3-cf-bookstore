/**
 * Seed Library - Shared utilities for database seeding
 *
 * This module contains seed-specific helper functions that can be used by:
 * - Seed files in database/seeds/
 * - Test files in test/
 * - CLI scripts in scripts/
 *
 * Note: Application utilities (hashPassword, nanoid, etc.) should remain in
 * app/utils/ and be imported directly by seed files when needed.
 */

/**
 * Example seed-specific utility (currently unused, but demonstrates pattern)
 *
 * Logs seed progress with consistent formatting
 */
export function logSeedProgress(message: string, count?: number) {
  if (count !== undefined) {
    console.log(`   ✓ ${message}: ${count} records`)
  } else {
    console.log(`   ✓ ${message}`)
  }
}

/**
 * Add more seed-specific utilities here as needed
 */
