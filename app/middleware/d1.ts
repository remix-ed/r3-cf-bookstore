/**
 * D1 Database Middleware
 *
 * Injects D1 database into request context.
 * Follows the same pattern as auth middleware - one storage key per service.
 */

import { createStorageKey } from '@remix-run/fetch-router'
import type { Middleware } from '@remix-run/fetch-router'
import type { AppContext } from '~/app/context.server'
import { getEnv } from '~/app/context.server'

/**
 * Storage key for D1 database
 */
export const DB_KEY = createStorageKey<D1Database>()

/**
 * Middleware that injects D1 database into request context
 * Must run after cloudflareContext middleware
 */
export const injectDB: Middleware = async ({ storage: context }, next) => {
  const env = getEnv(context)
  context.set(DB_KEY, env.DB)
  return await next()
}

/**
 * Get D1 database from request context
 *
 * @param context - Request storage context
 * @returns D1Database interface
 * @throws Error if D1 not initialized (middleware not run)
 */
export function getDB(context: AppContext): D1Database {
  const db = context.get(DB_KEY)
  if (!db) {
    throw new Error('D1 not initialized. Ensure injectDB middleware is running.')
  }
  return db
}
