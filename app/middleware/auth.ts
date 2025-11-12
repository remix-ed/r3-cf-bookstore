/**
 * Authentication Middleware
 *
 * Provides middleware for loading and requiring authenticated users.
 * Uses KV-backed session storage and D1 user database.
 */

import { createStorageKey } from '@remix-run/fetch-router'
import type { Middleware } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '~/app/routes'
import { getUserById } from '~/app/models/users'
import type { User } from '~/app/models/users'
import { getSession, getUserIdFromSession } from '~/app/utils/session'

// Storage keys for attaching data to request context
export const USER_KEY = createStorageKey<User | null>()
export const SESSION_ID_KEY = createStorageKey<string>()

/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) and sessionId to request context.
 */
export let loadAuth: Middleware = async ({ request, storage: context }) => {
  const session = await getSession(context, request)
  const userId = await getUserIdFromSession(context, session.sessionId)

  // Always set session ID for cart/guest functionality
  context.set(SESSION_ID_KEY, session.sessionId)

  // Set USER_KEY to user or null
  if (userId) {
    const user = await getUserById(context, userId)
    context.set(USER_KEY, user ?? null)
  } else {
    context.set(USER_KEY, null)
  }
}

/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user and sessionId to request context.
 */
export let requireAuth: Middleware = async ({ request, storage: context }) => {
  const session = await getSession(context, request)
  const userId = await getUserIdFromSession(context, session.sessionId)

  if (!userId) {
    return redirect(routes.auth.login.index.href(), 302)
  }

  const user = await getUserById(context, userId)
  if (!user) {
    return redirect(routes.auth.login.index.href(), 302)
  }

  context.set(USER_KEY, user)
  context.set(SESSION_ID_KEY, session.sessionId)
}

/**
 * Middleware that requires a user to be an admin.
 * Use AFTER requireAuth middleware.
 * Returns 403 Forbidden if user is not an admin.
 */
export let requireAdmin: Middleware = async ({ storage: context }) => {
  const user = context.get(USER_KEY) as User | null

  if (!user || user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }
}
