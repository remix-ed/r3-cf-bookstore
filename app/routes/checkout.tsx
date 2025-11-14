import type { RouteHandlers } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '~/app/routes'
import { requireAuth, SESSION_ID_KEY, USER_KEY } from '~/app/middleware/auth'
import { getCart, clearCart, getCartTotal } from '~/app/models/cart'
import { createOrder, getOrderById, ShippingAddressSchema } from '~/app/models/orders'
import { Layout } from '~/app/layout'
import { render } from '~/app/utils/render'
import { validateForm } from '~/app/utils/validation'
import { renderNotFound, renderValidationError } from '~/app/utils/errors'
import { SuccessAlert } from '~/app/components/success-alert'

export default {
  middleware: [requireAuth],
  handlers: {
    async index({ storage: context }) {
      let user = context.get(USER_KEY)!
      let sessionId = context.get(SESSION_ID_KEY)
      let cart = await getCart(context, sessionId)
      let total = getCartTotal(cart)

      if (cart.items.length === 0) {
        return render(
          <Layout user={user}>
            <div class="card">
              <h1>Checkout</h1>
              <p>Your cart is empty. Add some books before checking out.</p>
              <p style="margin-top: 1rem;">
                <a href={routes.books.index.href()} class="btn">
                  Browse Books
                </a>
              </p>
            </div>
          </Layout>, context,
        )
      }

      return render(
        <Layout user={user}>
          <h1>Checkout</h1>

          <div class="card">
            <h2>Order Summary</h2>
            <table style="margin-top: 1rem;">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((item) => (
                  <tr>
                    <td>{item.title}</td>
                    <td>{item.quantity}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style="text-align: right; font-weight: bold;">
                    Total:
                  </td>
                  <td style="font-weight: bold;">${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="card" style="margin-top: 1.5rem;">
            <h2>Shipping Information</h2>
            <form method="POST" action={routes.checkout.action.href()}>
              <div class="form-group">
                <label for="street">Street Address</label>
                <input type="text" id="street" name="street" required />
              </div>

              <div class="form-group">
                <label for="city">City</label>
                <input type="text" id="city" name="city" required />
              </div>

              <div class="form-group">
                <label for="state">State</label>
                <input type="text" id="state" name="state" required />
              </div>

              <div class="form-group">
                <label for="zip">ZIP Code</label>
                <input type="text" id="zip" name="zip" required />
              </div>

              <button type="submit" class="btn">
                Place Order
              </button>
              <a
                href={routes.cart.index.href()}
                class="btn btn-secondary"
                style="margin-left: 0.5rem;"
              >
                Back to Cart
              </a>
            </form>
          </div>
        </Layout>, context,
      )
    },

    async action({ request, formData, storage: context }) {
      let user = context.get(USER_KEY)!
      let sessionId = context.get(SESSION_ID_KEY)
      let cart = await getCart(context, sessionId)
      let total = getCartTotal(cart)

      if (cart.items.length === 0) {
        return redirect(routes.cart.index.href())
      }

      // Validate shipping address
      const validation = validateForm(formData, ShippingAddressSchema)

      if (!validation.success) {
        return renderValidationError(context, validation, {
          user,
          title: 'Invalid Shipping Address',
          backUrl: routes.checkout.index.href(),
          backLabel: 'Back to Checkout',
        })
      }

      let order = await createOrder(context,
        user.id,
        cart.items.map((item) => ({
          bookId: item.bookId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
        })),
        validation.data,
      )

      await clearCart(context, sessionId)

      return redirect(routes.checkout.confirmation.href({ orderId: order.id }))
    },

    async confirmation({ params, storage: context }) {
      let user = context.get(USER_KEY)!
      let order = await getOrderById(context, params.orderId)

      if (!order || order.userId !== user.id) {
        return renderNotFound(context, {
          user,
          title: 'Order Not Found',
          message: 'The order you are looking for does not exist or does not belong to you.',
          actions: [
            { label: 'View My Orders', href: routes.account.orders.index.href() },
          ],
        })
      }

      return render(
        <Layout user={user}>
          <SuccessAlert title="Order Confirmed!">
            <p>Thank you for your purchase. Your order has been placed successfully.</p>
          </SuccessAlert>

          <div class="card">
            <h2>Order #{order.id}</h2>
            <p>
              <strong>Order Date:</strong> {order.createdAt.toLocaleDateString()}
            </p>
            <p>
              <strong>Total:</strong> ${order.total.toFixed(2)}
            </p>
            <p>
              <strong>Status:</strong> <span class="badge badge-info">{order.status}</span>
            </p>

            <p style="margin-top: 2rem;">
              We'll send you a confirmation email shortly. You can track your order status in your
              account.
            </p>

            <div style="margin-top: 2rem;">
              <a href={routes.account.orders.show.href({ orderId: order.id })} class="btn">
                View Order Details
              </a>
              <a
                href={routes.books.index.href()}
                class="btn btn-secondary"
                style="margin-left: 0.5rem;"
              >
                Continue Shopping
              </a>
            </div>
          </div>
        </Layout>, context,
      )
    },
  },
} satisfies RouteHandlers<typeof routes.checkout>
