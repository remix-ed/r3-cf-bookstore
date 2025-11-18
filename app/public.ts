/**
 * Static Asset Handlers for Workers Static Assets
 *
 * Serves static assets (JS bundles, images) from Workers Static Assets.
 * Files are served from the ./public directory.
 *
 * @see https://developers.cloudflare.com/workers/static-assets/
 */

import type { BuildRouteHandler } from '@remix-run/fetch-router'
import { getEnv } from '~/app/context.server'
import { routes } from '~/app/routes'

/**
 * Serve JavaScript/CSS assets from Workers Static Assets
 */
export let assets: BuildRouteHandler<'GET', typeof routes.assets> = async ({ params, storage: context, request }) => {
  const env = getEnv(context)
  // Construct the full path for the asset
  const url = new URL(request.url)
  url.pathname = `/assets/${params.path}`

  return await env.ASSETS.fetch(url)
}

/**
 * Serve images from Workers Static Assets
 */
export let images: BuildRouteHandler<'GET', typeof routes.images> = async ({ params, storage: context, request }) => {
  const env = getEnv(context)
  // Construct the full path for the image
  const url = new URL(request.url)
  url.pathname = `/images/${params.path}`

  return await env.ASSETS.fetch(url)
}
