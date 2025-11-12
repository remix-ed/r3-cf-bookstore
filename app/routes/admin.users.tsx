import type { RouteHandlers } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '~/app/routes'
import { getAllUsers, getUserById, updateUser, deleteUser } from '~/app/models/users'
import { Layout } from '~/app/layout'
import { render } from '~/app/utils/render'
import { USER_KEY } from '~/app/middleware/auth'
import { RestfulForm } from '~/app/components/restful-form'

export default {
  async index({ storage: context }) {
    let user = context.get(USER_KEY)!
    let users = await getAllUsers(context)

    return render(
      <Layout user={user}>
        <h1>Manage Users</h1>

        <p style="margin-bottom: 1rem;">
          <a href={routes.admin.index.href()} class="btn btn-secondary">
            Back to Dashboard
          </a>
        </p>

        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span class={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.createdAt.toLocaleDateString()}</td>
                  <td class="actions">
                    <a
                      href={routes.admin.users.edit.href({ userId: u.id })}
                      class="btn btn-secondary"
                      style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                    >
                      Edit
                    </a>
                    {u.id !== user.id ? (
                      <RestfulForm
                        method="DELETE"
                        action={routes.admin.users.destroy.href({ userId: u.id })}
                        style="display: inline;"
                      >
                        <button
                          type="submit"
                          class="btn btn-danger"
                          style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                        >
                          Delete
                        </button>
                      </RestfulForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Layout>, context,
    )
  },

  async show({ params, storage: context }) {
    let user = context.get(USER_KEY)!
    let targetUser = await getUserById(context, params.userId)

    if (!targetUser) {
      return render(
        <Layout user={user}>
          <div class="card">
            <h1>User Not Found</h1>
          </div>
        </Layout>, context, { status: 404 },
      )
    }

    return render(
      <Layout user={user}>
        <h1>User Details</h1>

        <div class="card">
          <p>
            <strong>Name:</strong> {targetUser.name}
          </p>
          <p>
            <strong>Email:</strong> {targetUser.email}
          </p>
          <p>
            <strong>Role:</strong>{' '}
            <span class={`badge ${targetUser.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
              {targetUser.role}
            </span>
          </p>
          <p>
            <strong>Created:</strong> {targetUser.createdAt.toLocaleDateString()}
          </p>

          <div style="margin-top: 2rem;">
            <a href={routes.admin.users.edit.href({ userId: targetUser.id })} class="btn">
              Edit
            </a>
            <a
              href={routes.admin.users.index.href()}
              class="btn btn-secondary"
              style="margin-left: 0.5rem;"
            >
              Back to List
            </a>
          </div>
        </div>
      </Layout>, context,
    )
  },

  async edit({ params, storage: context }) {
    let user = context.get(USER_KEY)!
    let targetUser = await getUserById(context, params.userId)

    if (!targetUser) {
      return render(
        <Layout user={user}>
          <div class="card">
            <h1>User Not Found</h1>
          </div>
        </Layout>, context, { status: 404 },
      )
    }

    return render(
      <Layout user={user}>
        <h1>Edit User</h1>

        <div class="card">
          <RestfulForm
            method="PUT"
            action={routes.admin.users.update.href({ userId: targetUser.id })}
          >
            <div class="form-group">
              <label for="name">Name</label>
              <input type="text" id="name" name="name" value={targetUser.name} required />
            </div>

            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" value={targetUser.email} required />
            </div>

            <div class="form-group">
              <label for="role">Role</label>
              <select id="role" name="role">
                <option value="customer" selected={targetUser.role === 'customer'}>
                  Customer
                </option>
                <option value="admin" selected={targetUser.role === 'admin'}>
                  Admin
                </option>
              </select>
            </div>

            <button type="submit" class="btn">
              Update User
            </button>
            <a
              href={routes.admin.users.index.href()}
              class="btn btn-secondary"
              style="margin-left: 0.5rem;"
            >
              Cancel
            </a>
          </RestfulForm>
        </div>
      </Layout>, context,
    )
  },

  async update({ formData, params, storage: context }) {
    await updateUser(context, params.userId, {
      name: formData.get('name')?.toString() ?? '',
      email: formData.get('email')?.toString() ?? '',
      role: (formData.get('role')?.toString() ?? 'customer') as 'customer' | 'admin',
    })

    return redirect(routes.admin.users.index.href())
  },

  async destroy({ params, storage: context }) {
    await deleteUser(context, params.userId)

    return redirect(routes.admin.users.index.href())
  },
} satisfies RouteHandlers<typeof routes.admin.users>
