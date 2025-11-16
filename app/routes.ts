import { route, formAction, resources, type Middleware } from '@remix-run/fetch-router'
import { formData, type FileUploadHandler } from '@remix-run/fetch-router/form-data-middleware'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'
import { injectDB } from '~/app/middleware/d1'
import { injectSession } from '~/app/middleware/session'
import { createUploadHandler } from '~/app/utils/uploads'
import { isDevelopment } from '~/app/utils/mode'

// Route patterns - defined once and reused for type safety
export const ROUTE_PATTERNS = {
  assets: '/assets/*path',
  images: '/images/*path',
  uploads: '/uploads/*key',
} as const

export const routes = route({
  assets: ROUTE_PATTERNS.assets,
  images: ROUTE_PATTERNS.images,
  uploads: ROUTE_PATTERNS.uploads,

  // Simple static routes
  home: '/',
  about: '/about',
  contact: route('/contact', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
  }),
  search: '/search',

  // Fragments
  fragments: {
    bookCard: '/fragments/book-card/:slug',
  },

  // Public book routes
  books: {
    index: '/books',
    genre: '/books/genre/:genre',
    show: '/books/:slug',
  },

  // Auth routes
  auth: {
    login: formAction('login'),
    register: formAction('register'),
    logout: { method: 'POST', pattern: '/logout' },
    forgotPassword: formAction('forgot-password'),
    resetPassword: formAction('reset-password/:token'),
  },

  // Account section (protected, nested routes)
  account: route('/account', {
    index: '/',
    settings: formAction('settings', {
      formMethod: 'PUT',
      names: {
        action: 'update',
      },
    }),

    // Orders as nested resources with custom param
    orders: resources('orders', {
      only: ['index', 'show'],
      param: 'orderId',
    }),
  }),

  // Cart and shopping
  cart: route('/cart', {
    index: { method: 'GET', pattern: '/' },

    // API-style endpoints under /cart/api
    api: {
      add: { method: 'POST', pattern: '/api/add' },
      update: { method: 'PUT', pattern: '/api/update' },
      remove: { method: 'DELETE', pattern: '/api/remove' },
    },
  }),

  // Checkout flow
  checkout: route('/checkout', {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
    confirmation: { method: 'GET', pattern: '/:orderId/confirmation' },
  }),

  // Admin section (protected, showcases full CRUD on multiple resources)
  admin: route('/admin', {
    index: { method: 'GET', pattern: '/' },

    // Full CRUD on books
    books: resources('books', { param: 'bookId' }),

    // Partial CRUD on users (no create, users self-register)
    users: resources('users', {
      only: ['index', 'show', 'edit', 'update', 'destroy'],
      param: 'userId',
    }),

    // Orders view-only
    orders: resources('orders', {
      only: ['index', 'show'],
      param: 'orderId',
    }),
  }),
})

/**
 * Create route middleware array
 *
 * Middleware order is important:
 * 1. injectDB - Provides database access
 * 2. injectSession - Provides session service
 * 3. formData - Parses form data from requests (with R2 upload handler)
 * 4. methodOverride - Enables PUT/DELETE via _method field
 * 5. logger - (Development only) Request logging
 */
export function createRouteMiddleware(env: Env): Middleware[] {
  const middleware: Middleware[] = [
    injectDB,
    injectSession,
  ]

  // Form data parsing with R2 upload handler
  const uploadHandler = createUploadHandler(env.UPLOADS_BUCKET)
  middleware.push(formData({ uploadHandler }))

  // Method override for PUT/DELETE via forms
  middleware.push(methodOverride())

  // Conditionally add development logging
  if (isDevelopment()) {
    middleware.push(logger({ log: console.log }))
  }

  return middleware
}
