import type { RouteMap, Route, Middleware } from '@remix-run/fetch-router'
import type { RoutePattern } from '@remix-run/route-pattern'
import type { RouteHandler, RouteHandlers } from '@remix-run/fetch-router'
import type { FileUploadHandler } from '@remix-run/fetch-router/form-data-middleware'

import { formData } from '@remix-run/fetch-router/form-data-middleware'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'

import { routes } from '~/app/routes'
import { injectServices } from '~/app/middleware/services'
import { createUploadHandler } from '~/app/utils/uploads'

// Import all route handlers
import { home, about, contact, search } from '~/app/routes/marketing'
import booksHandlers from '~/app/routes/books'
import authHandlers from '~/app/routes/auth'
import accountHandlers from '~/app/routes/account'
import cartHandlers from '~/app/routes/cart'
import checkoutHandlers from '~/app/routes/checkout'
import adminHandlers from '~/app/routes/admin'
import fragmentsHandlers from '~/app/routes/fragments'
import { uploadsHandler } from '~/app/routes/uploads'
import { assets as assetsHandler, images as imagesHandler } from '~/app/public'

export type RouteEntry = {
  route: string | RoutePattern | Route<any, any> | RouteMap
  handler: RouteHandler<any, any> | RouteHandlers<any>
  method?: 'map' | 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'
}

/**
 * Maps handlers to routes
 */
export const routeRegistry = {
  assets: { route: routes.assets, handler: assetsHandler },
  images: { route: routes.images, handler: imagesHandler },
  uploads: { route: routes.uploads, handler: uploadsHandler },
  home: { route: routes.home, handler: home },
  about: { route: routes.about, handler: about },
  contact: { route: routes.contact, handler: contact },
  search: { route: routes.search, handler: search },
  fragments: { route: routes.fragments, handler: fragmentsHandlers },
  books: { route: routes.books, handler: booksHandlers },
  auth: { route: routes.auth, handler: authHandlers },
  account: { route: routes.account, handler: accountHandlers },
  cart: { route: routes.cart, handler: cartHandlers },
  checkout: { route: routes.checkout, handler: checkoutHandlers },
  admin: { route: routes.admin, handler: adminHandlers },
} as const

/**
 * Creates the middleware chain with access to env and ctx
 */
export function createMiddlewareChain( env: Env, ctx: ExecutionContext): Middleware[] {
  const middleware: Middleware[] = []

  // Initialize services (D1, Session eager; Uploads, Assets lazy)
  middleware.push(injectServices)

  // Conditionally add development logging
  const enableLogging = env.NODE_ENV === 'development' || env.ENABLE_DEBUG_LOGGING === 'true'
  if (enableLogging) {
    middleware.push(logger({ log: console.log }))
  }

  // Form data parsing with R2 upload handler
  const uploadHandler = createUploadHandler(env.UPLOADS)
  middleware.push(formData({ uploadHandler }))

  // Method override for PUT/DELETE via forms
  middleware.push(methodOverride())

  return middleware
}
