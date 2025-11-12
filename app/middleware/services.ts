/**
 * Services Middleware
 *
 * Eagerly initializes commonly-used services at the start of each request.
 * This middleware creates D1 and Session services upfront since they're used
 * on nearly every request. Other services (Uploads, Assets) are lazily created
 * on-demand via the service container getters.
 */

import type { Middleware } from '@remix-run/fetch-router'
import { getEnv } from '~/app/context.server'
import { SERVICES_KEY, type ServiceContainer } from '~/app/services/container'
import { createD1Service } from '~/app/services/d1.server'
import { createSessionService } from '~/app/services/session.server'

/**
 * Middleware that initializes eager services and stores in container
 */
export const injectServices: Middleware = async ({ storage: context }, next) => {
  const env = getEnv(context)

  // Create service container with eager services
  const services: ServiceContainer = {
    // Eager: Created immediately (used on most requests)
    d1: createD1Service(env),
    session: createSessionService(env.SESSION_KV),

    // Lazy: Will be created on first access (rarely used)
    // uploads and assets are undefined initially
  }

  // Store in request context
  context.set(SERVICES_KEY, services)

  return await next()
}
