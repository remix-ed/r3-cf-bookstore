import { createRouter, type Router } from '@remix-run/fetch-router'

import { routeRegistry, createMiddlewareChain } from '~/app/router.main'
import { cloudflareContext } from '~/app/middleware/cloudflare-context'

export function createAppRouter(env: Env, ctx: ExecutionContext): Router {
  // This middleware provides env/ctx to all subsequent middleware and handlers
  const cloudflareMiddleware = cloudflareContext({ env, ctx })
  const middlewareChain = createMiddlewareChain(env, ctx)
  const router = createRouter({ middleware: [cloudflareMiddleware, ...middlewareChain] })

  // Route registration from routes registry
  Object.values(routeRegistry).forEach((config: any) => {
    const { route, handler, method = 'map' } = config

    // Type-safe dynamic method invocation - Supports: get, post, put, delete, patch, head, options, map
    // Use call() to maintain 'this' context
    const routerMethod = (router as any)[method] as (route: any, handler: any) => void
    routerMethod.call(router, route, handler)
  })

  return router
}
