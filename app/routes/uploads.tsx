import type { BuildRouteHandler } from '@remix-run/fetch-router'

import { routes } from '~/app/routes'
import { getUploadedFile } from '~/app/utils/uploads'
import { getEnv } from '~/app/context.server'

export let uploadsHandler: BuildRouteHandler<'GET', typeof routes.uploads> = async ({ params, storage: context }) => {
  let env = getEnv(context)
  let file = await getUploadedFile(env.UPLOADS, params.key)

  if (!file) {
    return new Response('File not found', { status: 404 })
  }

  return new Response(file.body, {
    headers: {
      'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Length': file.size.toString(),
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}
