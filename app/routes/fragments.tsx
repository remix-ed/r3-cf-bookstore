import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '~/app/routes'

import { BookCard } from '~/app/components/book-card'
import { loadAuth, SESSION_ID_KEY } from '~/app/middleware/auth'
import { getCart } from '~/app/models/cart'
import { getBookBySlug } from '~/app/models/books'
import { render } from '~/app/utils/render'

export default {
  middleware: [loadAuth],
  handlers: {
    async bookCard({ params, storage: context }) {
      // Simulate network latency
      // await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()))

      let book = await getBookBySlug(context, params.slug)

      if (!book) {
        return render(<div>Book not found</div>, context, { status: 404 })
      }

      let cart = await getCart(context, context.get(SESSION_ID_KEY))
      let inCart = cart.items.some((item) => item.slug === params.slug)

      return render(<BookCard book={book} inCart={inCart} />, context)
    },
  },
} satisfies RouteHandlers<typeof routes.fragments>
