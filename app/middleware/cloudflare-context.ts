/**
 * Cloudflare Context Middleware
 *
 * This middleware injects Cloudflare Workers bindings (env and ctx) into
 * the request storage, making it available throughout the request lifecycle.
 *
 * IMPORTANT: This middleware should be in the middleware chain before any
 * downstream middleware and handlers that require access to Cloudflare bindings.
 */

import type { Middleware } from "@remix-run/fetch-router"
import { cloudflareContextKey, type CloudflareContext } from "~/app/context.server"

/**
 * Creates a middleware that injects Cloudflare context into request storage
 *
 * @param context - CloudflareContext containing env and ctx
 * @returns Middleware function
 *
 * @example
 * ```ts
 * const router = createRouter({
 *   middleware: [
 *     cloudflareContext({ env, ctx }),
 *     // ... other middleware
 *   ]
 * })
 * ```
 */
export function cloudflareContext(context: CloudflareContext): Middleware {
  return async (requestContext, next) => {
    // Inject Cloudflare context into request storage
    requestContext.storage.set(cloudflareContextKey, context)

    // Continue to next middleware/handler
    return await next()
  }
}
