/**
 * Book Model
 *
 * Provides functions for book management using D1 database.
 * All functions require AppContext to access D1 service.
 */

import type { AppContext } from '~/app/context.server'
import { nanoid } from 'nanoid'
import { getD1 } from '~/app/services/container'

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
  const d1 = getD1(context)
  const books = await d1.books.getAll() as BookRow[]
  return books.map(parseBook)
}

export async function getBookBySlug(context: AppContext, slug: string): Promise<Book | undefined> {
  const d1 = getD1(context)
  const book = await d1.books.getBySlug(slug) as BookRow | null
  return book ? parseBook(book) : undefined
}

export async function getBookById(context: AppContext, id: string): Promise<Book | undefined> {
  const d1 = getD1(context)
  const book = await d1.books.getById(id) as BookRow | null
  return book ? parseBook(book) : undefined
}

export async function getBooksByGenre(context: AppContext, genre: string): Promise<Book[]> {
  const d1 = getD1(context)
  const books = await d1.books.getByGenre(genre) as BookRow[]
  return books.map(parseBook)
}

export async function searchBooks(context: AppContext, query: string): Promise<Book[]> {
  const d1 = getD1(context)
  const books = await d1.books.search(query) as BookRow[]
  return books.map(parseBook)
}

export async function getAvailableGenres(context: AppContext): Promise<string[]> {
  const books = await getAllBooks(context)
  return Array.from(new Set(books.map((book) => book.genre)))
}

export async function createBook(context: AppContext, data: Omit<Book, 'id'>): Promise<Book> {
  const d1 = getD1(context)
  const book = await d1.books.create({
    id: nanoid(),
    slug: data.slug,
    title: data.title,
    author: data.author,
    description: data.description,
    price: data.price,
    genre: data.genre,
    image_urls: JSON.stringify(data.imageUrls),
    cover_url: data.coverUrl,
    isbn: data.isbn,
    published_year: data.publishedYear,
    in_stock: data.inStock ? 1 : 0
  }) as BookRow
  return parseBook(book)
}

export async function updateBook(context: AppContext, id: string, data: Partial<Book>): Promise<Book | undefined> {
  const d1 = getD1(context)

  // Convert camelCase to snake_case for DB
  const dbData: any = {}
  if (data.slug !== undefined) dbData.slug = data.slug
  if (data.title !== undefined) dbData.title = data.title
  if (data.author !== undefined) dbData.author = data.author
  if (data.description !== undefined) dbData.description = data.description
  if (data.price !== undefined) dbData.price = data.price
  if (data.genre !== undefined) dbData.genre = data.genre
  if (data.imageUrls !== undefined) dbData.image_urls = JSON.stringify(data.imageUrls)
  if (data.coverUrl !== undefined) dbData.cover_url = data.coverUrl
  if (data.isbn !== undefined) dbData.isbn = data.isbn
  if (data.publishedYear !== undefined) dbData.published_year = data.publishedYear
  if (data.inStock !== undefined) dbData.in_stock = data.inStock ? 1 : 0

  const book = await d1.books.update(id, dbData) as BookRow | null
  return book ? parseBook(book) : undefined
}

export async function deleteBook(context: AppContext, id: string): Promise<boolean> {
  const d1 = getD1(context)
  return await d1.books.delete(id)
}
