/**
 * Provides type-safe access to Cloudflare Workers bindings
 * (env and ctx) from within route handlers and middleware.
 *
 * The Cloudflare context is injected into RequestContext.storage by the
 * cloudflareContext middleware and can be retrieved anywhere in the request
 * lifecycle using these helper functions.
 */

import { createStorageKey, type AppStorage } from "@remix-run/fetch-router"

/**
 * Type alias for AppStorage - represents the request context that holds environment, services, user data, etc.
 *
 * We use "context" throughout the application to better convey its purpose
 * as the request-scoped context container, rather than implying a persistence layer.
 */
export type AppContext = AppStorage

export interface CloudflareContext {
  env: Env
  ctx: ExecutionContext
}

/**
 * Storage key for accessing Cloudflare context from RequestContext.storage
 */
export const cloudflareContextKey = createStorageKey<CloudflareContext>()

/**
 * gets Cloudflare context from request context
 */
export function getCloudflareContext(context: AppContext): CloudflareContext {
  const cloudflareContext = context.get(cloudflareContextKey)
  if (!cloudflareContext) {
    throw new Error(
      "Cloudflare context not found. Ensure cloudflareContext middleware is properly configured."
    )
  }
  return cloudflareContext
}

/**
 * gets just the env bindings (D1, KV, R2, etc.)
 */
export function getEnv(context: AppContext): Env {
  return getCloudflareContext(context).env
}

/**
 * gets just the execution context
 */
export function getCtx(context: AppContext): ExecutionContext {
  return getCloudflareContext(context).ctx
}
