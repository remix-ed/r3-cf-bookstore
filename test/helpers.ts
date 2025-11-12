/**
 * Test Helpers for Cloudflare Workers
 *
 * Uses real Cloudflare bindings via Wrangler's getPlatformProxy API
 * for integration testing against actual D1, KV, and R2.
 *
 * Architecture:
 * - Tests run against local Wrangler environment (test env)
 * - Real D1 database (bookstore-db-test)
 * - Real KV namespaces (test-session-kv, test-cart-kv)
 * - Real R2 bucket (bookstore-uploads-test)
 */

import { SetCookie, Cookie } from '@remix-run/headers'
import { getPlatformProxy } from 'wrangler'
import { createAppRouter } from '../app/router'
import type { Env } from '../types/worker-configuration'

// Cache platform proxy to reuse across tests
let platformProxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>> | null = null

/**
 * Get or create platform proxy for testing
 * Reuses the same proxy across all tests for performance
 */
async function getPlatform() {
  if (!platformProxy) {
    platformProxy = await getPlatformProxy<Env>({
      environment: 'test',
      persist: true,
      configPath: './wrangler.jsonc',
    })
  }
  return platformProxy
}

/**
 * Cleanup platform proxy (call after all tests complete)
 * @param delayMs Optional delay in milliseconds after cleanup (useful for integration tests to avoid workerd fd cleanup issues)
 */
export async function cleanupPlatform(delayMs?: number) {
  if (platformProxy) {
    await platformProxy.dispose()
    platformProxy = null

    // Optional delay to allow workerd to cleanup file descriptors
    if (delayMs && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

/**
 * Create a test router with real Cloudflare bindings
 *
 * This creates the EXACT same router as `bun run dev` using real local
 * Cloudflare Worker bindings (D1, KV, R2) via Wrangler's getPlatformProxy.
 *
 * All middleware runs (cloudflare context, service injection, form data, etc.)
 * so tests run against the real application stack.
 *
 * Returns an object with:
 * - env: Real Cloudflare bindings (D1, KV, R2)
 * - ctx: Execution context
 * - fetch(): Router fetch method - USE THIS for all tests
 * - router: The full router instance
 */
export async function createTestRouter() {
  const platform = await getPlatform()

  // Use spread operator to get all bindings from platform, then override test-specific vars
  const env: Env = {
    ...platform.env,
    ENVIRONMENT: 'test',
    NODE_ENV: 'test',
  }

  const ctx: ExecutionContext = platform.ctx

  const router = createAppRouter(env, ctx)

  return {
    env,
    ctx,
    fetch: router.fetch.bind(router),
    router,
  }
}

/**
 * Extract session cookie from Set-Cookie header
 */
export function getSessionCookie(response: Response): string | null {
  let setCookieHeader = response.headers.get('Set-Cookie')
  if (!setCookieHeader) return null

  let setCookie = new SetCookie(setCookieHeader)
  return setCookie.name === 'sessionId' ? (setCookie.value ?? null) : null
}

/**
 * Create a request with a session cookie
 */
export function requestWithSession(url: string, sessionId: string, init?: RequestInit): Request {
  let cookie = new Cookie({ sessionId })

  return new Request(url, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: cookie.toString(),
    },
  })
}

/**
 * Assert that HTML contains a substring
 */
export function assertContains(html: string, text: string): void {
  if (!html.includes(text)) {
    throw new Error(`Expected HTML to contain "${text}"`)
  }
}

/**
 * Assert that HTML does not contain a substring
 */
export function assertNotContains(html: string, text: string): void {
  if (html.includes(text)) {
    throw new Error(`Expected HTML to not contain "${text}"`)
  }
}

/**
 * Login and return the session cookie
 */
export async function login(router: any, email: string, password: string): Promise<string> {
  let loginResponse = await router.fetch('http://localhost:3000/login', {
    method: 'POST',
    body: new URLSearchParams({ email, password }),
    redirect: 'manual',
  })

  let sessionId = getSessionCookie(loginResponse)
  if (!sessionId) {
    throw new Error('Failed to get session cookie from login response')
  }

  return sessionId
}

/**
 * Login as admin and return the session cookie
 */
export async function loginAsAdmin(router: any): Promise<string> {
  return login(router, 'admin@bookstore.com', 'admin123')
}

/**
 * Login as customer and return the session cookie
 */
export async function loginAsCustomer(router: any): Promise<string> {
  return login(router, 'customer@example.com', 'password123')
}

// Re-export seed functions for convenience
export { seedTestDatabase, clearTestDatabase } from './seed'
