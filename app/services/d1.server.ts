/**
 * D1 Database Service
 *
 * Provides a type-safe interface for interacting with Cloudflare D1 database.
 * This service wraps D1 database operations with proper error handling and
 * type safety for the bookstore application.
 *
 * Usage:
 * ```ts
 * const d1 = createD1Service(env)
 * const user = await d1.users.getByEmail('user@example.com')
 * ```
 */

/**
 * Creates a D1 service instance with typed query methods
 *
 * @param env - Cloudflare environment bindings
 * @returns D1Service instance
 */
export function createD1Service(env: Env) {
  const db = env.DB

  return {
    /**
     * Raw database access for custom queries
     */
    get raw() {
      return db
    },

    /**
     * User database operations
     */
    users: {
      async getAll() {
        const result = await db.prepare("SELECT * FROM users").all()
        return result.results as any[]
      },

      async getById(id: string) {
        const result = await db
          .prepare("SELECT * FROM users WHERE id = ?")
          .bind(id)
          .first()
        return result as any
      },

      async getByEmail(email: string) {
        const result = await db
          .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
          .bind(email)
          .first()
        return result as any
      },

      async create(data: {
        id: string
        email: string
        password: string
        name: string
        role: string
      }) {
        await db
          .prepare(
            "INSERT INTO users (id, email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))"
          )
          .bind(data.id, data.email, data.password, data.name, data.role)
          .run()
        return this.getById(data.id)
      },

      async update(id: string, data: Partial<{ email: string; password: string; name: string; role: string }>) {
        const updates: string[] = []
        const values: any[] = []

        if (data.email !== undefined) {
          updates.push("email = ?")
          values.push(data.email)
        }
        if (data.password !== undefined) {
          updates.push("password = ?")
          values.push(data.password)
        }
        if (data.name !== undefined) {
          updates.push("name = ?")
          values.push(data.name)
        }
        if (data.role !== undefined) {
          updates.push("role = ?")
          values.push(data.role)
        }

        if (updates.length === 0) {
          return this.getById(id)
        }

        values.push(id)
        await db
          .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
          .bind(...values)
          .run()
        return this.getById(id)
      },

      async delete(id: string) {
        const result = await db
          .prepare("DELETE FROM users WHERE id = ?")
          .bind(id)
          .run()
        return result.success
      },

      async authenticate(email: string, password: string) {
        const user = await this.getByEmail(email)
        if (!user || user.password !== password) {
          return undefined
        }
        return user
      }
    },

    /**
     * Book database operations
     */
    books: {
      async getAll() {
        const result = await db.prepare("SELECT * FROM books").all()
        return result.results as any[]
      },

      async getById(id: string) {
        const result = await db
          .prepare("SELECT * FROM books WHERE id = ?")
          .bind(id)
          .first()
        return result as any
      },

      async getBySlug(slug: string) {
        const result = await db
          .prepare("SELECT * FROM books WHERE slug = ?")
          .bind(slug)
          .first()
        return result as any
      },

      async getByGenre(genre: string) {
        const result = await db
          .prepare("SELECT * FROM books WHERE LOWER(genre) = LOWER(?)")
          .bind(genre)
          .all()
        return result.results as any[]
      },

      async search(query: string) {
        const searchTerm = `%${query.toLowerCase()}%`
        const result = await db
          .prepare(
            "SELECT * FROM books WHERE LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(description) LIKE ?"
          )
          .bind(searchTerm, searchTerm, searchTerm)
          .all()
        return result.results as any[]
      },

      async create(data: {
        id: string
        slug: string
        title: string
        author: string
        description: string
        price: number
        genre: string
        image_urls: string
        cover_url: string
        isbn: string
        published_year: number
        in_stock: number
      }) {
        await db
          .prepare(
            "INSERT INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            data.id,
            data.slug,
            data.title,
            data.author,
            data.description,
            data.price,
            data.genre,
            data.image_urls,
            data.cover_url,
            data.isbn,
            data.published_year,
            data.in_stock
          )
          .run()
        return this.getById(data.id)
      },

      async update(id: string, data: Partial<any>) {
        const updates: string[] = []
        const values: any[] = []

        const fields = ['slug', 'title', 'author', 'description', 'price', 'genre', 'image_urls', 'cover_url', 'isbn', 'published_year', 'in_stock']
        for (const field of fields) {
          if (data[field] !== undefined) {
            updates.push(`${field} = ?`)
            values.push(data[field])
          }
        }

        if (updates.length === 0) {
          return this.getById(id)
        }

        values.push(id)
        await db
          .prepare(`UPDATE books SET ${updates.join(", ")} WHERE id = ?`)
          .bind(...values)
          .run()
        return this.getById(id)
      },

      async delete(id: string) {
        const result = await db
          .prepare("DELETE FROM books WHERE id = ?")
          .bind(id)
          .run()
        return result.success
      }
    },

    /**
     * Order database operations
     */
    orders: {
      async getAll() {
        const result = await db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all()
        return result.results as any[]
      },

      async getById(id: string) {
        const result = await db
          .prepare("SELECT * FROM orders WHERE id = ?")
          .bind(id)
          .first()
        return result as any
      },

      async getByUserId(userId: string) {
        const result = await db
          .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
          .bind(userId)
          .all()
        return result.results as any[]
      },

      async create(data: {
        id: string
        user_id: string
        items: string
        total: number
        status: string
        shipping_address: string
      }) {
        await db
          .prepare(
            "INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
          )
          .bind(
            data.id,
            data.user_id,
            data.items,
            data.total,
            data.status,
            data.shipping_address
          )
          .run()
        return this.getById(data.id)
      },

      async updateStatus(id: string, status: string) {
        await db
          .prepare("UPDATE orders SET status = ? WHERE id = ?")
          .bind(status, id)
          .run()
        return this.getById(id)
      }
    },

    /**
     * Password reset token operations
     */
    passwordResetTokens: {
      async create(token: string, userId: string, expiresAt: number) {
        await db
          .prepare(
            "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)"
          )
          .bind(token, userId, expiresAt)
          .run()
      },

      async get(token: string) {
        const result = await db
          .prepare("SELECT * FROM password_reset_tokens WHERE token = ?")
          .bind(token)
          .first()
        return result as any
      },

      async delete(token: string) {
        await db
          .prepare("DELETE FROM password_reset_tokens WHERE token = ?")
          .bind(token)
          .run()
      },

      async deleteExpired() {
        await db
          .prepare("DELETE FROM password_reset_tokens WHERE expires_at < strftime('%s', 'now')")
          .run()
      }
    }
  }
}

export type D1Service = ReturnType<typeof createD1Service>
