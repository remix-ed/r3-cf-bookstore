import type { Remix } from '@remix-run/dom'
import type { AppContext } from '~/app/context.server'
import { renderToStream } from '@remix-run/dom/server'
import { html } from '@remix-run/fetch-router/response-helpers'

import { createResolveFrame } from '~/app/utils/frame'

export function render(element: Remix.RemixElement, context: AppContext, init?: ResponseInit) {
  const resolveFrame = createResolveFrame(context)
  return html(renderToStream(element, { resolveFrame }), init)
}
