/**
 * Session Service
 *
 * Provides KV-backed session storage for the bookstore application.
 * Sessions are stored in Cloudflare KV with automatic expiration.
 * Cart data is stored directly in the session.
 *
 * Usage:
 * ```ts
 * const sessionService = createSessionService(env.SESSION_KV)
 * const session = await sessionService.getSession(request)
 * await sessionService.setUserId(sessionId, userId)
 * ```
 */

import { Cookie, SetCookie } from "@remix-run/headers"
import { nanoid } from "nanoid"
import { createKVService } from "~/app/services/kv.server"
import type { CartItem } from "~/app/models/cart"

/**
 * Session data structure
 */
export interface SessionData {
  sessionId: string
  userId?: string
  cart?: CartItem[]
  createdAt: number
  lastAccessedAt: number
}

const SESSION_TTL = 30 * 24 * 60 * 60 // 30 days in seconds
const SESSION_COOKIE_NAME = "sessionId"

/**
 * Creates a session service instance
 *
 * @param kvNamespace - Cloudflare KV namespace for session storage
 * @returns SessionService instance
 */
export function createSessionService(kvNamespace: KVNamespace) {
  const kv = createKVService(kvNamespace)

  return {
    /**
     * Get session ID from cookie or create a new one
     *
     * @param request - HTTP request
     * @returns Session ID
     */
    getSessionId(request: Request): string {
      const cookieHeader = request.headers.get("Cookie")
      if (!cookieHeader) return nanoid()

      const cookie = new Cookie(cookieHeader)
      const sessionId = cookie.get(SESSION_COOKIE_NAME)

      return sessionId || nanoid()
    },

    /**
     * Get session data from KV
     *
     * @param request - HTTP request
     * @returns Session data
     */
    async getSession(request: Request): Promise<SessionData> {
      const sessionId = this.getSessionId(request)
      const session = await kv.get<SessionData>(sessionId)

      if (session) {
        // Update last accessed time
        session.lastAccessedAt = Date.now()
        await kv.set(sessionId, session, { expirationTtl: SESSION_TTL })
        return session
      }

      // Create new session
      const newSession: SessionData = {
        sessionId,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      }

      await kv.set(sessionId, newSession, { expirationTtl: SESSION_TTL })
      return newSession
    },

    /**
     * Update session data in KV
     *
     * @param sessionId - Session ID
     * @param data - Partial session data to update
     */
    async updateSession(sessionId: string, data: Partial<Omit<SessionData, "sessionId">>): Promise<void> {
      const session = await kv.get<SessionData>(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      const updated: SessionData = {
        ...session,
        ...data,
        lastAccessedAt: Date.now()
      }

      await kv.set(sessionId, updated, { expirationTtl: SESSION_TTL })
    },

    /**
     * Set session cookie header
     *
     * @param headers - Response headers
     * @param sessionId - Session ID
     */
    setSessionCookie(headers: Headers, sessionId: string): void {
      const cookie = new SetCookie({
        name: SESSION_COOKIE_NAME,
        value: sessionId,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: SESSION_TTL
      })

      headers.set("Set-Cookie", cookie.toString())
    },

    /**
     * Log in a user by setting userId in session
     *
     * @param sessionId - Session ID
     * @param userId - User ID
     */
    async login(sessionId: string, userId: string): Promise<void> {
      await this.updateSession(sessionId, { userId })
    },

    /**
     * Log out a user by removing userId from session
     *
     * @param sessionId - Session ID
     */
    async logout(sessionId: string): Promise<void> {
      await this.updateSession(sessionId, { userId: undefined })
    },

    /**
     * Get user ID from session
     *
     * @param sessionId - Session ID
     * @returns User ID or undefined
     */
    async getUserId(sessionId: string): Promise<string | undefined> {
      const session = await kv.get<SessionData>(sessionId)
      return session?.userId
    },

    /**
     * Get cart from session
     *
     * @param sessionId - Session ID
     * @returns Cart items array
     */
    async getCart(sessionId: string): Promise<CartItem[]> {
      const session = await kv.get<SessionData>(sessionId)
      return session?.cart || []
    },

    /**
     * Set cart in session
     *
     * @param sessionId - Session ID
     * @param cart - Cart items array
     */
    async setCart(sessionId: string, cart: CartItem[]): Promise<void> {
      await this.updateSession(sessionId, { cart })
    },

    /**
     * Clear cart in session
     *
     * @param sessionId - Session ID
     */
    async clearCart(sessionId: string): Promise<void> {
      await this.updateSession(sessionId, { cart: [] })
    },

    /**
     * Delete session from KV
     *
     * @param sessionId - Session ID
     */
    async deleteSession(sessionId: string): Promise<void> {
      await kv.delete(sessionId)
    }
  }
}

export type SessionService = ReturnType<typeof createSessionService>
