/**
 * Session Service Middleware
 *
 * Injects session service into request context.
 * Follows the same pattern as D1 middleware - one storage key per service.
 */

import { createStorageKey } from '@remix-run/fetch-router'
import type { Middleware } from '@remix-run/fetch-router'
import type { AppContext } from '~/app/context.server'
import { getEnv } from '~/app/context.server'
import { createSessionService, type SessionService } from '~/app/services/session.server'

/**
 * Storage key for session service
 */
export const SESSION_KEY = createStorageKey<SessionService>()

/**
 * Middleware that injects session service into request context
 * Must run after cloudflareContext middleware
 */
export const injectSession: Middleware = async ({ storage: context }, next) => {
  const env = getEnv(context)
  const sessionService = createSessionService(env.SESSION_KV)
  context.set(SESSION_KEY, sessionService)
  return await next()
}

/**
 * Get session service from request context
 *
 * @param context - Request storage context
 * @returns SessionService instance
 * @throws Error if session service not initialized (middleware not run)
 */
export function getSessionService(context: AppContext): SessionService {
  const service = context.get(SESSION_KEY)
  if (!service) {
    throw new Error('Session service not initialized. Ensure injectSession middleware is running.')
  }
  return service
}
