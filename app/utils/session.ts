/**
 * Session Utilities
 *
 * Wrapper functions that use the SessionService from context.
 * These functions maintain backward compatibility with existing code
 * while using KV-backed session storage under the hood.
 */

import type { AppContext } from '~/app/context.server'
import { getSessionService } from '~/app/services/container'
import { createSessionService, type SessionData } from '~/app/services/session.server'
import type { User } from '~/app/models/users'
import { nanoid } from 'nanoid'

/**
 * Get session ID from request
 *
 * @param request - HTTP request
 * @returns Session ID
 */
export function getSessionId(request: Request): string {
  const sessionService = createSessionService({} as KVNamespace) // Temporary for ID extraction
  return sessionService.getSessionId(request)
}

/**
 * Get session data from KV
 *
 * @param storage - App storage
 * @param request - HTTP request
 * @returns Session data
 */
export async function getSession(context: AppContext, request: Request): Promise<SessionData> {
  const sessionService = getSessionService(context)
  return await sessionService.getSession(request)
}

/**
 * Set session cookie
 *
 * @param headers - Response headers
 * @param sessionId - Session ID
 */
export function setSessionCookie(headers: Headers, sessionId: string): void {
  const sessionService = createSessionService({} as KVNamespace) // Temporary for cookie setting
  sessionService.setSessionCookie(headers, sessionId)
}

/**
 * Log in a user
 *
 * @param storage - App storage
 * @param sessionId - Session ID
 * @param user - User object
 */
export async function login(context: AppContext, sessionId: string, user: User): Promise<void> {
  const sessionService = getSessionService(context)
  await sessionService.login(sessionId, user.id)
}

/**
 * Log out a user
 *
 * @param storage - App storage
 * @param sessionId - Session ID
 */
export async function logout(context: AppContext, sessionId: string): Promise<void> {
  const sessionService = getSessionService(context)
  await sessionService.logout(sessionId)
}

/**
 * Get user ID from session
 *
 * @param storage - App storage
 * @param sessionId - Session ID
 * @returns User ID or undefined
 */
export async function getUserIdFromSession(context: AppContext, sessionId: string): Promise<string | undefined> {
  const sessionService = getSessionService(context)
  return await sessionService.getUserId(sessionId)
}

/**
 * Create a new session ID
 *
 * @returns New session ID
 */
export function createSessionId(): string {
  return nanoid()
}

// Re-export SessionData type
export type { SessionData }
