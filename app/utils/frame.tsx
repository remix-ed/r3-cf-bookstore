import type { AppContext } from '~/app/context.server'
import { routes } from '~/app/routes'

import { getBookBySlug } from '~/app/models/books'
import { BookCard } from '~/app/components/book-card'
import { getCart } from '~/app/models/cart'
import { SESSION_ID_KEY } from '~/app/middleware/auth'

export function createResolveFrame(context: AppContext) {
  return async function resolveFrame(frameSrc: string) {
    let url = new URL(frameSrc, 'http://localhost:5173')

    // Simulate network latency when resolving frames
    // await new Promise((resolve) => setTimeout(resolve, 500))

    let bookCardMatch = routes.fragments.bookCard.match(url)
    if (bookCardMatch) {
      let slug = bookCardMatch.params.slug
      let book = await getBookBySlug(context, slug)

      if (!book) {
        throw new Error(`Book not found: ${slug}`)
      }

      let cart = await getCart(context, context.get(SESSION_ID_KEY))
      let inCart = cart.items.some((item) => item.slug === slug)

      return <BookCard book={book} inCart={inCart} />
    }

    throw new Error(`Failed to fetch ${frameSrc}`)
  }
}
