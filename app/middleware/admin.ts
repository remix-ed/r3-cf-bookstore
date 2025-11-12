import type { Middleware } from '@remix-run/fetch-router'

import { USER_KEY } from '~/app/middleware/auth'

/**
 * Middleware that requires a user to have admin role.
 * Returns 403 Forbidden if user is not an admin.
 * Must be used after requireAuth middleware.
 */
export let requireAdmin: Middleware = async ({ storage: context }) => {
  let user = context.get(USER_KEY)

  if (!user || user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }
}
