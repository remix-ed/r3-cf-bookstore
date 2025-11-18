import { createRouter, type Router } from '@remix-run/fetch-router'
import { routes, createRouteMiddleware } from '~/app/routes'
import { cloudflareContext } from '~/app/middleware/cloudflare-context'

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

export function createAppRouter(env: Env, ctx: ExecutionContext): Router {
  // Inject cloudflare Context middleware env/ctx first
  const middleware = [cloudflareContext({ env, ctx }), ...createRouteMiddleware(env)]
  const router = createRouter({ middleware })

  // Dynamically register route handlers
  Object.values(routeRegistry).forEach((config: any) => {
    const { route, handler, method = 'map' } = config
    const routerMethod = (router as any)[method]
    if (routerMethod) {
      routerMethod.call(router, route, handler)
    }
  })

  return router
}
