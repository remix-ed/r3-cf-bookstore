/**
 * Cloudflare Worker Entry Point - Integrates Remix v3 fetch-router with Cloudflare Workers runtime
 *
 * - Creates router with Cloudflare context injected
 * - Handles all incoming HTTP requests
 * - Provides error handling responses
 */

import * as res from "@remix-run/fetch-router/response-helpers"
import { createAppRouter } from "~/app/router"

// Main worker export - Cloudflare Workers entry point
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Create router with Cloudflare context injected
      const router = createAppRouter(env, ctx)

      // Handle request through router
      return await router.fetch(request)

    } catch (error) {
      console.error("Worker error:", error)

      // Return error response
      return res.json(
        {
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error)
        },
        {
          status: 500
        }
      )
    }
  }
}
