import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '~/app/routes'
import adminBooksHandlers from '~/app/routes/admin.books'
import adminOrdersHandlers from '~/app/routes/admin.orders'
import adminUsersHandlers from '~/app/routes/admin.users'
import { Layout } from '~/app/layout'
import { requireAuth, USER_KEY } from '~/app/middleware/auth'
import { requireAdmin } from '~/app/middleware/admin'
import { render } from '~/app/utils/render'

export default {
  middleware: [requireAuth, requireAdmin],
  handlers: {
    index({ storage: context }) {
      let user = context.get(USER_KEY)!
      return render(
        <Layout user={user}>
          <h1>Admin Dashboard</h1>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="card">
              <h2>Manage Books</h2>
              <p>Add, edit, or remove books from the catalog.</p>
              <a href={routes.admin.books.index.href()} class="btn" style="margin-top: 1rem;">
                View Books
              </a>
            </div>

            <div class="card">
              <h2>Manage Users</h2>
              <p>View and manage user accounts.</p>
              <a href={routes.admin.users.index.href()} class="btn" style="margin-top: 1rem;">
                View Users
              </a>
            </div>

            <div class="card">
              <h2>View Orders</h2>
              <p>Monitor and manage customer orders.</p>
              <a href={routes.admin.orders.index.href()} class="btn" style="margin-top: 1rem;">
                View Orders
              </a>
            </div>
          </div>
        </Layout>, context,
      )
    },

    books: adminBooksHandlers,
    users: adminUsersHandlers,
    orders: adminOrdersHandlers,
  },
} satisfies RouteHandlers<typeof routes.admin>
