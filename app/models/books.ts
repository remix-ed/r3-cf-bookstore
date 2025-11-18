/**
 * Book Model
 *
 * Provides functions for book management using D1 database.
 * All functions require AppContext to access D1 service.
 */

import type { AppContext } from '~/app/context.server'
import { getDB } from '~/app/middleware/d1'
import { v } from '~/app/utils/validation'
import { generateId, nanoidValidator } from '~/app/utils/nanoid'

/**
 * Database row type (snake_case from D1)
 */
interface BookRow {
  id: string
  slug: string
  title: string
  author: string
  description: string
  price: number
  genre: string
  image_urls: string // JSON array stored as string
  cover_url: string
  isbn: string
  published_year: number
  in_stock: number // SQLite uses 0/1 for boolean
}

/**
 * Parsed Book type for application use (camelCase)
 */
export interface Book {
  id: string
  slug: string
  title: string
  author: string
  description: string
  price: number
  genre: string
  imageUrls: string[]
  coverUrl: string
  isbn: string
  publishedYear: number
  inStock: boolean
}

// =============================================================================
// Validation Schemas
// =============================================================================

export const BookSchema = v.object({
  id: nanoidValidator(),
  slug: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
  author: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  description: v.pipe(v.string(), v.minLength(1)),
  price: v.pipe(v.number(), v.minValue(0)),
  genre: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  imageUrls: v.array(v.string()),
  coverUrl: v.string(),
  isbn: v.pipe(v.string(), v.minLength(10), v.maxLength(17)), // ISBN-10 or ISBN-13
  publishedYear: v.pipe(v.number(), v.minValue(1000), v.maxValue(9999)),
  inStock: v.boolean(),
})

export const BookRowSchema = v.object({
  id: BookSchema.entries.id,
  slug: BookSchema.entries.slug,
  title: BookSchema.entries.title,
  author: BookSchema.entries.author,
  description: BookSchema.entries.description,
  price: BookSchema.entries.price,
  genre: BookSchema.entries.genre,
  image_urls: v.string(), // JSON string (different from BookSchema.imageUrls)
  cover_url: v.string(), // Different from BookSchema.coverUrl
  isbn: BookSchema.entries.isbn,
  published_year: BookSchema.entries.publishedYear,
  in_stock: v.pipe(v.number(), v.minValue(0), v.maxValue(1)), // SQLite boolean (0 or 1)
})

export const InsertBookSchema = v.object({
  ...v.omit(BookSchema, ['id', 'imageUrls', 'coverUrl']).entries,
  imageUrls: v.optional(v.array(v.string()), []),
  coverUrl: v.optional(v.string(), '/images/placeholder.jpg'),
})

export const UpdateBookSchema = v.partial(InsertBookSchema)

// Form-specific schemas with explicit string-to-type transformations
// Use these with validateForm() since FormData always returns strings
export const InsertBookFormSchema = v.object({
  title: BookSchema.entries.title,
  author: BookSchema.entries.author,
  slug: BookSchema.entries.slug,
  description: BookSchema.entries.description,
  price: v.pipe(
    v.string(),
    v.transform((s) => parseFloat(s)),
    v.number(),
    v.minValue(0)
  ),
  genre: BookSchema.entries.genre,
  isbn: BookSchema.entries.isbn,
  publishedYear: v.pipe(
    v.string(),
    v.transform((s) => parseInt(s, 10)),
    v.number(),
    v.minValue(1000),
    v.maxValue(9999)
  ),
  inStock: v.pipe(
    v.string(),
    v.transform((s) => s === 'true'),
    v.boolean()
  ),
  imageUrls: v.optional(v.array(v.string()), []),
  coverUrl: v.optional(v.string(), '/images/placeholder.jpg'),
})

export const UpdateBookFormSchema = v.partial(InsertBookFormSchema)

export const SearchBooksSchema = v.object({
  query: v.optional(v.string()),
  genre: v.optional(v.string()),
  minPrice: v.optional(v.pipe(v.number(), v.minValue(0))),
  maxPrice: v.optional(v.pipe(v.number(), v.minValue(0))),
  inStock: v.optional(v.boolean()),
})

export type InsertBookInput = v.InferOutput<typeof InsertBookSchema>
export type UpdateBookInput = v.InferOutput<typeof UpdateBookSchema>
export type SearchBooksInput = v.InferOutput<typeof SearchBooksSchema>

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to convert DB book to app Book
 */
function parseBook(dbBook: BookRow): Book {
  return {
    id: dbBook.id,
    slug: dbBook.slug,
    title: dbBook.title,
    author: dbBook.author,
    description: dbBook.description,
    price: dbBook.price,
    genre: dbBook.genre,
    imageUrls: JSON.parse(dbBook.image_urls || '[]'),
    coverUrl: dbBook.cover_url,
    isbn: dbBook.isbn,
    publishedYear: dbBook.published_year,
    inStock: dbBook.in_stock === 1
  }
}

export async function getAllBooks(context: AppContext): Promise<Book[]> {
  const db = getDB(context)
  const result = await db.prepare('SELECT * FROM books').all()
  const books = result.results as unknown as BookRow[]
  return books.map(parseBook)
}

export async function getBookBySlug(context: AppContext, slug: string): Promise<Book | undefined> {
  const db = getDB(context)
  const book = await db.prepare('SELECT * FROM books WHERE slug = ?').bind(slug).first() as BookRow | null
  return book ? parseBook(book) : undefined
}

export async function getBookById(context: AppContext, id: string): Promise<Book | undefined> {
  const db = getDB(context)
  const book = await db.prepare('SELECT * FROM books WHERE id = ?').bind(id).first() as BookRow | null
  return book ? parseBook(book) : undefined
}

export async function getBooksByGenre(context: AppContext, genre: string): Promise<Book[]> {
  const db = getDB(context)
  const result = await db.prepare('SELECT * FROM books WHERE LOWER(genre) = LOWER(?)').bind(genre).all()
  const books = result.results as unknown as BookRow[]
  return books.map(parseBook)
}

export async function searchBooks(context: AppContext, query: string): Promise<Book[]> {
  const db = getDB(context)
  const searchTerm = `%${query.toLowerCase()}%`
  const result = await db
    .prepare('SELECT * FROM books WHERE LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(description) LIKE ?')
    .bind(searchTerm, searchTerm, searchTerm)
    .all()
  const books = result.results as unknown as BookRow[]
  return books.map(parseBook)
}

export async function getAvailableGenres(context: AppContext): Promise<string[]> {
  const books = await getAllBooks(context)
  return Array.from(new Set(books.map((book) => book.genre)))
}

export async function createBook(context: AppContext, data: Omit<Book, 'id'>): Promise<Book> {
  const db = getDB(context)
  const id = generateId()

  await db
    .prepare('INSERT INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(
      id,
      data.slug,
      data.title,
      data.author,
      data.description,
      data.price,
      data.genre,
      JSON.stringify(data.imageUrls),
      data.coverUrl,
      data.isbn,
      data.publishedYear,
      data.inStock ? 1 : 0
    )
    .run()

  const book = await db.prepare('SELECT * FROM books WHERE id = ?').bind(id).first() as BookRow | null
  if (!book) {
    throw new Error('Failed to create book')
  }
  return parseBook(book)
}

export async function updateBook(context: AppContext, id: string, data: Partial<Book>): Promise<Book | undefined> {
  const db = getDB(context)

  const updates: string[] = []
  const values: any[] = []

  if (data.slug !== undefined) {
    updates.push('slug = ?')
    values.push(data.slug)
  }
  if (data.title !== undefined) {
    updates.push('title = ?')
    values.push(data.title)
  }
  if (data.author !== undefined) {
    updates.push('author = ?')
    values.push(data.author)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    values.push(data.description)
  }
  if (data.price !== undefined) {
    updates.push('price = ?')
    values.push(data.price)
  }
  if (data.genre !== undefined) {
    updates.push('genre = ?')
    values.push(data.genre)
  }
  if (data.imageUrls !== undefined) {
    updates.push('image_urls = ?')
    values.push(JSON.stringify(data.imageUrls))
  }
  if (data.coverUrl !== undefined) {
    updates.push('cover_url = ?')
    values.push(data.coverUrl)
  }
  if (data.isbn !== undefined) {
    updates.push('isbn = ?')
    values.push(data.isbn)
  }
  if (data.publishedYear !== undefined) {
    updates.push('published_year = ?')
    values.push(data.publishedYear)
  }
  if (data.inStock !== undefined) {
    updates.push('in_stock = ?')
    values.push(data.inStock ? 1 : 0)
  }

  if (updates.length === 0) {
    return getBookById(context, id)
  }

  values.push(id)
  await db
    .prepare(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const book = await db.prepare('SELECT * FROM books WHERE id = ?').bind(id).first() as BookRow | null
  return book ? parseBook(book) : undefined
}

export async function deleteBook(context: AppContext, id: string): Promise<boolean> {
  const db = getDB(context)
  const result = await db.prepare('DELETE FROM books WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}
