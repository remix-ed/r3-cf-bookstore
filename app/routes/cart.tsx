import type { RouteHandlers } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '~/app/routes'

import { Layout } from '~/app/layout'
import { loadAuth, SESSION_ID_KEY, USER_KEY } from '~/app/middleware/auth'
import { getBookById } from '~/app/models/books'
import { getCart, addToCart, updateCartItem, removeFromCart, getCartTotal } from '~/app/models/cart'
import { render } from '~/app/utils/render'
import { setSessionCookie } from '~/app/utils/session'
import { RestfulForm } from '~/app/components/restful-form'

export default {
  middleware: [loadAuth],
  handlers: {
    async index({ storage: context }) {
      let sessionId = context.get(SESSION_ID_KEY)
      let cart = await getCart(context, sessionId)
      let total = getCartTotal(cart)

      let user = context.get(USER_KEY) ?? null

      return render(
        <Layout user={user}>
          <h1>Shopping Cart</h1>

          <div class="card">
            {cart.items.length > 0 ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr>
                        <td>
                          <a href={routes.books.show.href({ slug: item.slug })}>{item.title}</a>
                        </td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>
                          <RestfulForm
                            method="PUT"
                            action={routes.cart.api.update.href()}
                            style="display: inline-flex; gap: 0.5rem; align-items: center;"
                          >
                            <input type="hidden" name="bookId" value={item.bookId} />
                            <input
                              type="number"
                              name="quantity"
                              value={item.quantity}
                              min="1"
                              style="width: 70px;"
                            />
                            <button
                              type="submit"
                              class="btn btn-secondary"
                              style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                            >
                              Update
                            </button>
                          </RestfulForm>
                        </td>
                        <td>${(item.price * item.quantity).toFixed(2)}</td>
                        <td>
                          <RestfulForm
                            method="DELETE"
                            action={routes.cart.api.remove.href()}
                            style="display: inline;"
                          >
                            <input type="hidden" name="bookId" value={item.bookId} />
                            <button
                              type="submit"
                              class="btn btn-danger"
                              style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                            >
                              Remove
                            </button>
                          </RestfulForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style="text-align: right; font-weight: bold;">
                        Total:
                      </td>
                      <td style="font-weight: bold;">${total.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                  <a href={routes.books.index.href()} class="btn btn-secondary">
                    Continue Shopping
                  </a>
                  {user ? (
                    <a href={routes.checkout.index.href()} class="btn">
                      Proceed to Checkout
                    </a>
                  ) : (
                    <a href={routes.auth.login.index.href()} class="btn">
                      Login to Checkout
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <p>Your cart is empty.</p>
                <p style="margin-top: 1rem;">
                  <a href={routes.books.index.href()} class="btn">
                    Browse Books
                  </a>
                </p>
              </>
            )}
          </div>
        </Layout>, context,
      )
    },

    api: {
      async add({ storage: context, formData }) {
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 1000))

        let sessionId = context.get(SESSION_ID_KEY)
        let bookId = formData.get('bookId')?.toString() ?? ''

        let book = await getBookById(context, bookId)
        if (!book) {
          return new Response('Book not found', { status: 404 })
        }

        await addToCart(context, sessionId, book.id, book.slug, book.title, book.price, 1)

        let headers = new Headers()
        setSessionCookie(headers, sessionId)

        if (formData.get('redirect') === 'none') {
          return new Response(null, { status: 204 })
        }

        return redirect(routes.cart.index.href(), { headers })
      },

      async update({ storage: context, formData }) {
        let sessionId = context.get(SESSION_ID_KEY)
        let bookId = formData.get('bookId')?.toString() ?? ''
        let quantity = parseInt(formData.get('quantity')?.toString() ?? '1', 10)

        await updateCartItem(context, sessionId, bookId, quantity)

        let headers = new Headers()
        setSessionCookie(headers, sessionId)

        if (formData.get('redirect') === 'none') {
          return new Response(null, { status: 204 })
        }

        return redirect(routes.cart.index.href(), { headers })
      },

      async remove({ storage: context, formData }) {
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 1000))

        let sessionId = context.get(SESSION_ID_KEY)
        let bookId = formData.get('bookId')?.toString() ?? ''

        await removeFromCart(context, sessionId, bookId)

        let headers = new Headers()
        setSessionCookie(headers, sessionId)

        if (formData.get('redirect') === 'none') {
          return new Response(null, { status: 204 })
        }

        return redirect(routes.cart.index.href(), { headers })
      },
    },
  },
} satisfies RouteHandlers<typeof routes.cart>
