import type { RouteHandlers } from '@remix-run/fetch-router'
import { Frame } from '@remix-run/dom'

import { routes } from '~/app/routes'

import { getAllBooks, getBookBySlug, getBooksByGenre, getAvailableGenres } from '~/app/models/books'
import { Layout } from '~/app/layout'
import { loadAuth, USER_KEY } from '~/app/middleware/auth'
import { render } from '~/app/utils/render'
import { ImageCarousel } from '~/app/assets/image-carousel'
import { renderNotFound } from '~/app/utils/errors'

export default {
  middleware: [loadAuth],
  handlers: {
    async index({ storage: context }) {
      let user = context.get(USER_KEY) ?? null
      let books = await getAllBooks(context)
      let genres = await getAvailableGenres(context)

      return render(
        <Layout user={user}>
          <h1>Browse Books</h1>

          <div class="card" style="margin-bottom: 2rem;">
            <form action={routes.search.href()} method="GET" style="display: flex; gap: 0.5rem;">
              <input
                type="search"
                name="q"
                placeholder="Search books by title, author, or description..."
                css={{ flex: 1, padding: '0.5rem' }}
              />
              <button type="submit" class="btn">
                Search
              </button>
            </form>
          </div>

          <div class="card" style="margin-bottom: 2rem;">
            <h3>Browse by Genre</h3>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
              {genres.map((genre) => (
                <a href={routes.books.genre.href({ genre })} class="btn btn-secondary">
                  {genre}
                </a>
              ))}
            </div>
          </div>

          <div class="grid">
            {books.map((book) => (
              <Frame
                fallback={<div>Loading...</div>}
                src={routes.fragments.bookCard.href({ slug: book.slug })}
              />
            ))}
          </div>
        </Layout>, context,
      )
    },

    async genre({ params, storage: context }) {
      let user = context.get(USER_KEY) ?? null
      let genre = params.genre
      let books = await getBooksByGenre(context, genre)

      if (books.length === 0) {
        return renderNotFound(context, {
          user,
          title: 'Genre Not Found',
          message: `No books found in the "${genre}" genre.`,
          actions: [
            { label: 'Browse All Books', href: routes.books.index.href() },
          ],
        })
      }

      return render(
        <Layout user={user}>
          <h1>{genre.charAt(0).toUpperCase() + genre.slice(1)} Books</h1>
          <p style="margin: 1rem 0;">
            <a href={routes.books.index.href()} class="btn btn-secondary">
              View All Books
            </a>
          </p>

          <div class="grid" style="margin-top: 2rem;">
            {books.map((book) => (
              <Frame
                fallback={<div>Loading...</div>}
                src={routes.fragments.bookCard.href({ slug: book.slug })}
              />
            ))}
          </div>
        </Layout>, context,
      )
    },

    async show({ params, storage: context }) {
      let user = context.get(USER_KEY) ?? null
      let book = await getBookBySlug(context, params.slug)

      if (!book) {
        return renderNotFound(context, {
          user,
          title: 'Book Not Found',
          message: 'The book you are looking for does not exist.',
          actions: [
            { label: 'Browse All Books', href: routes.books.index.href() },
          ],
        })
      }

      return render(
        <Layout user={user}>
          <div style="display: grid; grid-template-columns: 300px 1fr; gap: 2rem;">
            <div
              css={{
                height: '400px',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              <ImageCarousel images={book.imageUrls} />
            </div>

            <div class="card">
              <h1>{book.title}</h1>
              <p class="author" style="font-size: 1.2rem; margin: 0.5rem 0;">
                by {book.author}
              </p>

              <p style="margin: 1rem 0;">
                <span class="badge badge-info">{book.genre}</span>
                <span
                  class={`badge ${book.inStock ? 'badge-success' : 'badge-warning'}`}
                  style="margin-left: 0.5rem;"
                >
                  {book.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </p>

              <p class="price" style="font-size: 2rem; margin: 1rem 0;">
                ${book.price.toFixed(2)}
              </p>

              <p style="margin: 1.5rem 0; line-height: 1.8;">{book.description}</p>

              <div style="margin: 1.5rem 0; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                <p>
                  <strong>ISBN:</strong> {book.isbn}
                </p>
                <p>
                  <strong>Published:</strong> {book.publishedYear}
                </p>
              </div>

              {book.inStock ? (
                <form method="POST" action={routes.cart.api.add.href()} style="margin-top: 2rem;">
                  <input type="hidden" name="bookId" value={book.id} />
                  <input type="hidden" name="slug" value={book.slug} />
                  <button
                    type="submit"
                    class="btn"
                    style="font-size: 1.1rem; padding: 0.75rem 1.5rem;"
                  >
                    Add to Cart
                  </button>
                </form>
              ) : (
                <p style="color: #e74c3c; font-weight: 500;">
                  This book is currently out of stock.
                </p>
              )}

              <p style="margin-top: 1.5rem;">
                <a href={routes.books.index.href()} class="btn btn-secondary">
                  Back to Books
                </a>
              </p>
            </div>
          </div>
        </Layout>, context,
      )
    },
  },
} satisfies RouteHandlers<typeof routes.books>
