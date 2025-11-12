/**
 * Service Container
 *
 * Provides a hybrid eager/lazy service initialization pattern:
 * - Eager services (D1, Session) are created by middleware at request start
 * - Lazy services (Uploads, Assets) are created on-demand
 * - Unified storage mechanism for both approaches
 * - Transparent API - consumers don't know which strategy is used
 */

import { createStorageKey } from '@remix-run/fetch-router'
import { getEnv, type AppContext } from '~/app/context.server'
import { createD1Service, type D1Service } from '~/app/services/d1.server'
import { createSessionService, type SessionService } from '~/app/services/session.server'
import { createR2Service, type R2Service } from '~/app/services/r2.server'

/**
 * Service container interface
 * - Required properties are eagerly initialized
 * - Optional properties are lazily initialized
 */
export interface ServiceContainer {
  // Eager services (created by middleware)
  d1: D1Service
  session: SessionService

  // Lazy services (created on first access)
  uploads?: R2Service
  assets?: R2Service
}

/**
 * Storage key for service container
 */
export const SERVICES_KEY = createStorageKey<ServiceContainer>()

/**
 * Get the service container from storage
 * Throws if services haven't been initialized (middleware not run)
 */
export function getServices(context: AppContext): ServiceContainer {
  const services = context.get(SERVICES_KEY)

  if (!services) {
    throw new Error(
      'Services not initialized. Ensure injectServices middleware is running.'
    )
  }

  return services
}

/**
 * Get D1 database service (eager - always available)
 */
export function getD1(context: AppContext): D1Service {
  const services = getServices(context)
  return services.d1
}

/**
 * Get session service (eager - always available)
 */
export function getSessionService(context: AppContext): SessionService {
  const services = getServices(context)
  return services.session
}

/**
 * Get uploads R2 service (lazy - created on first access)
 */
export function getUploadsService(context: AppContext): R2Service {
  const services = getServices(context)

  // Lazy initialization on first access
  if (!services.uploads) {
    const env = getEnv(context)
    services.uploads = createR2Service(env.UPLOADS)
  }

  return services.uploads
}

/**
 * Get assets R2 service (lazy - created on first access)
 *
 * NOTE: Currently disabled because env.ASSETS is a Fetcher, not an R2Bucket.
 * Assets are served directly via env.ASSETS.fetch() in app/public.ts
 */
/*
export function getAssetsService(context: AppContext): R2Service {
  const services = getServices(context)

  // Lazy initialization on first access
  if (!services.assets) {
    const env = getEnv(context)
    services.assets = createR2Service(env.ASSETS)
  }

  return services.assets
}
*/
