import type { RouteHandlers } from '@remix-run/fetch-router'
import { redirect } from '@remix-run/fetch-router/response-helpers'

import { routes } from '~/app/routes'
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  InsertBookFormSchema,
  UpdateBookFormSchema,
} from '~/app/models/books'
import { Layout } from '~/app/layout'
import { USER_KEY } from '~/app/middleware/auth'
import { render } from '~/app/utils/render'
import { RestfulForm } from '~/app/components/restful-form'
import { validateForm } from '~/app/utils/validation'
import { renderNotFound, renderValidationError } from '~/app/utils/errors'

export default {
  async index({ storage: context }) {
    let user = context.get(USER_KEY)!
    let books = await getAllBooks(context)

    return render(
      <Layout user={user}>
        <h1>Manage Books</h1>

        <p style="margin-bottom: 1rem;">
          <a href={routes.admin.books.new.href()} class="btn">
            Add New Book
          </a>
          <a
            href={routes.admin.index.href()}
            class="btn btn-secondary"
            style="margin-left: 0.5rem;"
          >
            Back to Dashboard
          </a>
        </p>

        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Genre</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr>
                  <td>{book.title}</td>
                  <td>{book.author}</td>
                  <td>{book.genre}</td>
                  <td>${book.price.toFixed(2)}</td>
                  <td>
                    <span class={`badge ${book.inStock ? 'badge-success' : 'badge-warning'}`}>
                      {book.inStock ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td class="actions">
                    <a
                      href={routes.admin.books.edit.href({ bookId: book.id })}
                      class="btn btn-secondary"
                      style="font-size: 0.875rem; padding: 0.25rem 0.5rem;"
                    >
                      Edit
                    </a>
                    <RestfulForm
                      method="DELETE"
                      action={routes.admin.books.destroy.href({ bookId: book.id })}
                      style={{ display: 'inline' }}
                    >
                      <button
                        type="submit"
                        class="btn btn-danger"
                        style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                      >
                        Delete
                      </button>
                    </RestfulForm>
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
    let book = await getBookById(context, params.bookId)

    if (!book) {
      return renderNotFound(context, {
        user,
        title: 'Book Not Found',
        message: 'The book you are looking for does not exist.',
        actions: [
          { label: 'Back to Books', href: routes.admin.books.index.href() },
          { label: 'Add New Book', href: routes.admin.books.new.href(), variant: 'secondary' },
        ],
      })
    }

    return render(
      <Layout user={user}>
        <h1>Book Details</h1>

        <div class="card">
          <p>
            <strong>Title:</strong> {book.title}
          </p>
          <p>
            <strong>Author:</strong> {book.author}
          </p>
          <p>
            <strong>Slug:</strong> {book.slug}
          </p>
          <p>
            <strong>Description:</strong> {book.description}
          </p>
          <p>
            <strong>Price:</strong> ${book.price.toFixed(2)}
          </p>
          <p>
            <strong>Genre:</strong> {book.genre}
          </p>
          <p>
            <strong>ISBN:</strong> {book.isbn}
          </p>
          <p>
            <strong>Published:</strong> {book.publishedYear}
          </p>
          <p>
            <strong>In Stock:</strong>{' '}
            <span class={`badge ${book.inStock ? 'badge-success' : 'badge-warning'}`}>
              {book.inStock ? 'Yes' : 'No'}
            </span>
          </p>

          <div style="margin-top: 2rem;">
            <a href={routes.admin.books.edit.href({ bookId: book.id })} class="btn">
              Edit
            </a>
            <a
              href={routes.admin.books.index.href()}
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

  new({ storage: context }) {
    let user = context.get(USER_KEY)!
    return render(
      <Layout user={user}>
        <h1>Add New Book</h1>

        <div class="card">
          <form
            method="POST"
            action={routes.admin.books.create.href()}
            encType="multipart/form-data"
          >
            <div class="form-group">
              <label for="title">Title</label>
              <input type="text" id="title" name="title" required />
            </div>

            <div class="form-group">
              <label for="author">Author</label>
              <input type="text" id="author" name="author" required />
            </div>

            <div class="form-group">
              <label for="slug">Slug (URL-friendly name)</label>
              <input type="text" id="slug" name="slug" required />
            </div>

            <div class="form-group">
              <label for="description">Description</label>
              <textarea id="description" name="description" required></textarea>
            </div>

            <div class="form-group">
              <label for="price">Price</label>
              <input type="number" id="price" name="price" step="0.01" required />
            </div>

            <div class="form-group">
              <label for="genre">Genre</label>
              <input type="text" id="genre" name="genre" required />
            </div>

            <div class="form-group">
              <label for="isbn">ISBN</label>
              <input type="text" id="isbn" name="isbn" required />
            </div>

            <div class="form-group">
              <label for="publishedYear">Published Year</label>
              <input type="number" id="publishedYear" name="publishedYear" required />
            </div>

            <div class="form-group">
              <label for="inStock">In Stock</label>
              <select id="inStock" name="inStock">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div class="form-group">
              <label for="cover">Book Cover Image</label>
              <input type="file" id="cover" name="cover" accept="image/*" />
              <small style="color: #666;">Optional. Upload a cover image for this book.</small>
            </div>

            <button type="submit" class="btn">
              Create Book
            </button>
            <a
              href={routes.admin.books.index.href()}
              class="btn btn-secondary"
              style="margin-left: 0.5rem;"
            >
              Cancel
            </a>
          </form>
        </div>
      </Layout>, context,
    )
  },

  async create({ request, formData, storage: context }) {
    let user = context.get(USER_KEY)!

    // Validate book creation data
    const validation = validateForm(formData, InsertBookFormSchema)

    if (!validation.success) {
      return renderValidationError(context, validation, {
        user,
        title: 'Validation Errors',
        backUrl: routes.admin.books.new.href(),
        backLabel: 'Back to Form',
      })
    }

    await createBook(context, validation.data)

    return redirect(routes.admin.books.index.href())
  },

  async edit({ params, storage: context }) {
    let user = context.get(USER_KEY)!
    let book = await getBookById(context, params.bookId)

    if (!book) {
      return renderNotFound(context, {
        user,
        title: 'Book Not Found',
        message: 'The book you want to edit does not exist.',
        actions: [
          { label: 'Back to Books', href: routes.admin.books.index.href() },
        ],
      })
    }

    return render(
      <Layout user={user}>
        <h1>Edit Book</h1>

        <div class="card">
          <RestfulForm
            method="PUT"
            action={routes.admin.books.update.href({ bookId: book.id })}
            encType="multipart/form-data"
          >
            <div class="form-group">
              <label for="title">Title</label>
              <input type="text" id="title" name="title" value={book.title} required />
            </div>

            <div class="form-group">
              <label for="author">Author</label>
              <input type="text" id="author" name="author" value={book.author} required />
            </div>

            <div class="form-group">
              <label for="slug">Slug (URL-friendly name)</label>
              <input type="text" id="slug" name="slug" value={book.slug} required />
            </div>

            <div class="form-group">
              <label for="description">Description</label>
              <textarea id="description" name="description" required>
                {book.description}
              </textarea>
            </div>

            <div class="form-group">
              <label for="price">Price</label>
              <input
                type="number"
                id="price"
                name="price"
                step="0.01"
                value={book.price}
                required
              />
            </div>

            <div class="form-group">
              <label for="genre">Genre</label>
              <input type="text" id="genre" name="genre" value={book.genre} required />
            </div>

            <div class="form-group">
              <label for="isbn">ISBN</label>
              <input type="text" id="isbn" name="isbn" value={book.isbn} required />
            </div>

            <div class="form-group">
              <label for="publishedYear">Published Year</label>
              <input
                type="number"
                id="publishedYear"
                name="publishedYear"
                value={book.publishedYear}
                required
              />
            </div>

            <div class="form-group">
              <label for="inStock">In Stock</label>
              <select id="inStock" name="inStock">
                <option value="true" selected={book.inStock}>
                  Yes
                </option>
                <option value="false" selected={!book.inStock}>
                  No
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="cover">Book Cover Image</label>
              {book.coverUrl !== '/images/placeholder.jpg' && (
                <div style="margin-bottom: 0.5rem;">
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    style="max-width: 200px; height: auto; border-radius: 4px;"
                  />
                  <p style="font-size: 0.875rem; color: #666;">Current cover image</p>
                </div>
              )}
              <input type="file" id="cover" name="cover" accept="image/*" />
              <small style="color: #666;">
                Optional. Upload a new cover image to replace the current one.
              </small>
            </div>

            <button type="submit" class="btn">
              Update Book
            </button>
            <a
              href={routes.admin.books.index.href()}
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

  async update({ request, formData, params, storage: context }) {
    let user = context.get(USER_KEY)!
    let book = await getBookById(context, params.bookId)

    if (!book) {
      return renderNotFound(context, {
        user,
        title: 'Book Not Found',
        message: 'The book you want to update does not exist.',
        actions: [
          { label: 'Back to Books', href: routes.admin.books.index.href() },
        ],
      })
    }

    // Validate book update data
    const validation = validateForm(formData, UpdateBookFormSchema)

    if (!validation.success) {
      return renderValidationError(context, validation, {
        user,
        title: 'Validation Errors',
        backUrl: routes.admin.books.edit.href({ bookId: params.bookId }),
        backLabel: 'Back to Form',
      })
    }

    // Handle cover URL: if a new one was uploaded, use it; otherwise keep existing
    const updateData = {
      ...validation.data,
      coverUrl: validation.data.coverUrl || book.coverUrl,
    }

    await updateBook(context, params.bookId, updateData)

    return redirect(routes.admin.books.index.href())
  },

  async destroy({ params, storage: context }) {
    await deleteBook(context, params.bookId)

    return redirect(routes.admin.books.index.href())
  },
} satisfies RouteHandlers<typeof routes.admin.books>
