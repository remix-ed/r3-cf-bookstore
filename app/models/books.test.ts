/**
 * Books Model Tests
 *
 * Tests for book CRUD operations with D1 database:
 * - getAllBooks, getBookById, getBookBySlug
 * - getBooksByGenre, searchBooks, getAvailableGenres
 * - createBook (with nanoid generation)
 * - updateBook (partial updates)
 * - deleteBook
 * - Data transformations (JSON imageUrls, boolean inStock)
 */

import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import { createTestRouter } from '../../test/helpers.ts'
import { cloudflareContextKey, type AppContext } from '../context.server.ts'
import { generateId, NANOID_PATTERN } from '../utils/nanoid.ts'
import { DB_KEY } from '../middleware/d1.ts'
import { SESSION_KEY } from '../middleware/session.ts'
import { createSessionService } from '../services/session.server.ts'
import resetSeed from '~/database/seeds/test/001-test-reset.seed'
import usersSeed from '~/database/seeds/test/002-test-users.seed'
import booksSeed from '~/database/seeds/test/003-test-books.seed'
import {
  getAllBooks,
  getBookById,
  getBookBySlug,
  getBooksByGenre,
  searchBooks,
  getAvailableGenres,
  createBook,
  updateBook,
  deleteBook,
  type Book,
} from './books.ts'

describe('Books Model', () => {
  let router: any
  let context: AppContext

  before(async () => {
    router = await createTestRouter()

    // Clear and seed database
    await resetSeed(router.env.DB)
    await usersSeed(router.env.DB)
    await booksSeed(router.env.DB)

    const storage = new Map()
    storage.set(cloudflareContextKey, { env: router.env, ctx: router.ctx })
    storage.set(DB_KEY, router.env.DB)
    storage.set(SESSION_KEY, createSessionService(router.env.SESSION_KV))

    context = storage as any
  })

  describe('getAllBooks', () => {
    it('returns all books from database', async () => {
      // Act
      const books = await getAllBooks(context)

      // Assert
      assert.ok(Array.isArray(books), 'Should return array')
      assert.ok(books.length >= 3, 'Should have seed data books')
    })

    it('returns empty array when no books exist', async () => {
      // Arrange - Clear all data (no seed)
      await resetSeed(router.env.DB)

      const storage = new Map()
      storage.set(cloudflareContextKey, { env: router.env, ctx: router.ctx })
      storage.set(DB_KEY, router.env.DB)
      storage.set(SESSION_KEY, createSessionService(router.env.SESSION_KV))
      const emptyContext = storage as any

      // Act
      const books = await getAllBooks(emptyContext)

      // Assert
      assert.deepStrictEqual(books, [], 'Should return empty array')

      // Cleanup - Re-seed for subsequent tests
      await usersSeed(router.env.DB)
      await booksSeed(router.env.DB)
    })

    it('converts JSON imageUrls to array', async () => {
      // Act
      const books = await getAllBooks(context)

      // Assert
      const book = books[0]
      assert.ok(Array.isArray(book.imageUrls), 'imageUrls should be array')
      assert.ok(book.imageUrls.length > 0, 'imageUrls should have entries')
    })

    it('converts inStock integer to boolean', async () => {
      // Act
      const books = await getAllBooks(context)

      // Assert
      const book = books[0]
      assert.strictEqual(typeof book.inStock, 'boolean', 'inStock should be boolean')
    })

    it('returns books ordered by title', async () => {
      // Act
      const books = await getAllBooks(context)

      // Assert - Check if sorted
      for (let i = 1; i < books.length; i++) {
        assert.ok(
          books[i - 1].title <= books[i].title,
          `Books should be ordered by title: "${books[i - 1].title}" should come before "${books[i].title}"`
        )
      }
    })
  })

  describe('getBookById', () => {
    it('finds book by valid ID', async () => {
      // Arrange
      const allBooks = await getAllBooks(context)
      const expectedBook = allBooks[0]

      // Act
      const book = await getBookById(context, expectedBook.id)

      // Assert
      assert.ok(book, 'Should find book')
      assert.strictEqual(book.id, expectedBook.id)
      assert.strictEqual(book.title, expectedBook.title)
    })

    it('returns undefined for non-existent ID', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const book = await getBookById(context, nonExistentId)

      // Assert
      assert.strictEqual(book, undefined, 'Should return undefined')
    })

    it('parses imageUrls correctly', async () => {
      // Arrange
      const allBooks = await getAllBooks(context)
      const bookWithImages = allBooks[0]

      // Act
      const book = await getBookById(context, bookWithImages.id)

      // Assert
      assert.ok(book)
      assert.ok(Array.isArray(book.imageUrls))
      assert.strictEqual(book.imageUrls.length, bookWithImages.imageUrls.length)
    })

    it('converts inStock to boolean', async () => {
      // Arrange
      const allBooks = await getAllBooks(context)
      const bookId = allBooks[0].id

      // Act
      const book = await getBookById(context, bookId)

      // Assert
      assert.ok(book)
      assert.strictEqual(typeof book.inStock, 'boolean')
    })
  })

  describe('getBookBySlug', () => {
    it('finds book by slug', async () => {
      // Arrange - Get a book with known slug from seed data
      const allBooks = await getAllBooks(context)
      const expectedBook = allBooks.find(b => b.slug === 'bbq')

      // Act
      const book = await getBookBySlug(context, 'bbq')

      // Assert
      assert.ok(book, 'Should find book')
      assert.strictEqual(book.slug, 'bbq')
      assert.strictEqual(book.title, expectedBook?.title)
    })

    it('returns undefined for non-existent slug', async () => {
      // Act
      const book = await getBookBySlug(context, 'non-existent-slug-xyz')

      // Assert
      assert.strictEqual(book, undefined)
    })

    it('handles special characters in slug', async () => {
      // Arrange - Create book with hyphens
      const newBook: Omit<Book, 'id'> = {
        slug: 'test-book-with-hyphens',
        title: 'Test Book',
        author: 'Test Author',
        description: 'A test book',
        price: 19.99,
        genre: 'test',
        coverUrl: '/test.jpg',
        imageUrls: ['/test.jpg'],
        isbn: '978-9999999987', // Unique ISBN for test
        publishedYear: 2020,
        inStock: true,
      }
      await createBook(context, newBook)

      // Act
      const book = await getBookBySlug(context, 'test-book-with-hyphens')

      // Assert
      assert.ok(book)
      assert.strictEqual(book.slug, 'test-book-with-hyphens')
    })
  })

  describe('getBooksByGenre', () => {
    it('filters books by genre', async () => {
      // Act
      const cookbookBooks = await getBooksByGenre(context, 'cookbook')

      // Assert
      assert.ok(Array.isArray(cookbookBooks))
      assert.ok(cookbookBooks.length > 0, 'Should find cookbook books')
      cookbookBooks.forEach(book => {
        assert.strictEqual(book.genre.toLowerCase(), 'cookbook')
      })
    })

    it('returns empty array for no matches', async () => {
      // Act
      const books = await getBooksByGenre(context, 'non-existent-genre')

      // Assert
      assert.deepStrictEqual(books, [])
    })

    it('is case-insensitive', async () => {
      // Act
      const lowercase = await getBooksByGenre(context, 'cookbook')
      const uppercase = await getBooksByGenre(context, 'COOKBOOK')
      const mixedcase = await getBooksByGenre(context, 'CookBook')

      // Assert
      assert.strictEqual(lowercase.length, uppercase.length)
      assert.strictEqual(lowercase.length, mixedcase.length)
    })

    it('returns books ordered by title', async () => {
      // Act
      const books = await getBooksByGenre(context, 'cookbook')

      // Assert
      if (books.length > 1) {
        for (let i = 1; i < books.length; i++) {
          assert.ok(books[i - 1].title <= books[i].title)
        }
      }
    })
  })

  describe('searchBooks', () => {
    it('finds books by title match', async () => {
      // Act
      const books = await searchBooks(context, 'Ash')

      // Assert
      assert.ok(books.length > 0, 'Should find books')
      const foundBook = books.find(b => b.title.includes('Ash'))
      assert.ok(foundBook, 'Should find book with "Ash" in title')
    })

    it('finds books by author match', async () => {
      // Act
      const books = await searchBooks(context, 'Rusty')

      // Assert
      assert.ok(books.length > 0, 'Should find books by author')
      const foundBook = books.find(b => b.author.includes('Rusty'))
      assert.ok(foundBook, 'Should find book by author "Rusty"')
    })

    it('finds books by description match', async () => {
      // Act
      const books = await searchBooks(context, 'gift')

      // Assert
      assert.ok(books.length > 0, 'Should find books by description')
      const foundBook = books.find(b => b.description.toLowerCase().includes('gift'))
      assert.ok(foundBook, 'Should find book with "gift" in description')
    })

    it('returns empty array for no matches', async () => {
      // Act
      const books = await searchBooks(context, 'xyznonexistentquery')

      // Assert
      assert.deepStrictEqual(books, [])
    })

    it('is case-insensitive (LIKE pattern)', async () => {
      // Act
      const lowercase = await searchBooks(context, 'ash')
      const uppercase = await searchBooks(context, 'ASH')

      // Assert
      assert.ok(lowercase.length > 0)
      assert.strictEqual(lowercase.length, uppercase.length)
    })
  })

  describe('getAvailableGenres', () => {
    it('returns distinct genres', async () => {
      // Act
      const genres = await getAvailableGenres(context)

      // Assert
      assert.ok(Array.isArray(genres))
      assert.ok(genres.length > 0)

      // Check for uniqueness
      const uniqueGenres = new Set(genres)
      assert.strictEqual(genres.length, uniqueGenres.size, 'Genres should be unique')
    })

    it('returns genres ordered alphabetically', async () => {
      // Act
      const genres = await getAvailableGenres(context)

      // Assert
      for (let i = 1; i < genres.length; i++) {
        assert.ok(genres[i - 1] <= genres[i], `Genres should be ordered: ${genres[i - 1]} <= ${genres[i]}`)
      }
    })
  })

  describe('createBook', () => {
    it('creates book with all valid fields', async () => {
      // Arrange
      const newBook: Omit<Book, 'id'> = {
        slug: 'new-test-book',
        title: 'New Test Book',
        author: 'Test Author',
        description: 'This is a new test book description.',
        price: 29.99,
        genre: 'fiction',
        coverUrl: '/images/test-cover.jpg',
        imageUrls: ['/images/test-1.jpg', '/images/test-2.jpg'],
        isbn: '978-9999999991', // Unique ISBN for test
        publishedYear: 2023,
        inStock: true,
      }

      // Act
      const createdBook = await createBook(context, newBook)

      // Assert
      assert.ok(createdBook.id, 'Should have generated ID')
      assert.strictEqual(createdBook.title, newBook.title)
      assert.strictEqual(createdBook.author, newBook.author)
      assert.strictEqual(createdBook.price, newBook.price)
      assert.strictEqual(createdBook.inStock, newBook.inStock)
      assert.deepStrictEqual(createdBook.imageUrls, newBook.imageUrls)
    })

    it('generates unique nanoid', async () => {
      // Arrange
      const bookData: Omit<Book, 'id'> = {
        slug: 'nanoid-test-1',
        title: 'Nanoid Test Book',
        author: 'Nanoid Tester',
        description: 'Testing nanoid generation',
        price: 15.99,
        genre: 'test',
        coverUrl: '/test.jpg',
        imageUrls: ['/test.jpg'],
        isbn: '978-9999999992', // Unique ISBN for test
        publishedYear: 2020,
        inStock: true,
      }

      // Act
      const book1 = await createBook(context, { ...bookData, slug: 'nanoid-test-1', isbn: '978-9999999993' })
      const book2 = await createBook(context, { ...bookData, slug: 'nanoid-test-2', isbn: '978-9999999994' })

      // Assert
      assert.notEqual(book1.id, book2.id, 'IDs should be unique')

      // nanoid format validation
      assert.match(book1.id, NANOID_PATTERN, 'ID should be valid nanoid')
      assert.match(book2.id, NANOID_PATTERN, 'ID should be valid nanoid')
    })

    it('stores imageUrls as JSON array', async () => {
      // Arrange
      const imageUrls = ['/image1.jpg', '/image2.jpg', '/image3.jpg']
      const newBook: Omit<Book, 'id'> = {
        slug: 'json-test-book',
        title: 'JSON Test Book',
        author: 'Test Author',
        description: 'Testing JSON storage',
        price: 19.99,
        genre: 'test',
        coverUrl: '/cover.jpg',
        imageUrls,
        isbn: '978-9999999995', // Unique ISBN for test
        publishedYear: 2020,
        inStock: true,
      }

      // Act
      const createdBook = await createBook(context, newBook)
      const retrievedBook = await getBookById(context, createdBook.id)

      // Assert
      assert.ok(retrievedBook)
      assert.deepStrictEqual(retrievedBook.imageUrls, imageUrls)
    })

    it('can be retrieved after creation', async () => {
      // Arrange
      const newBook: Omit<Book, 'id'> = {
        slug: 'retrieval-test',
        title: 'Retrieval Test Book',
        author: 'Test Author',
        description: 'Test retrieval',
        price: 12.99,
        genre: 'test',
        coverUrl: '/test.jpg',
        imageUrls: ['/test.jpg'],
        isbn: '978-9999999996', // Unique ISBN for test
        publishedYear: 2020,
        inStock: false,
      }

      // Act
      const created = await createBook(context, newBook)
      const retrieved = await getBookById(context, created.id)

      // Assert
      assert.ok(retrieved)
      assert.strictEqual(retrieved.id, created.id)
      assert.strictEqual(retrieved.slug, newBook.slug)
      assert.strictEqual(retrieved.inStock, false)
    })
  })

  describe('updateBook', () => {
    it('updates specific fields only', async () => {
      // Arrange
      const originalBook = await getAllBooks(context).then(books => books[0])
      const originalTitle = originalBook.title

      // Act
      const updated = await updateBook(context, originalBook.id, {
        price: 99.99,
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.price, 99.99, 'Price should be updated')
      assert.strictEqual(updated.title, originalTitle, 'Title should be unchanged')
    })

    it('preserves untouched fields', async () => {
      // Arrange
      const originalBook = await getAllBooks(context).then(books => books[0])

      // Act
      const updated = await updateBook(context, originalBook.id, {
        title: 'Updated Title',
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.title, 'Updated Title')
      assert.strictEqual(updated.author, originalBook.author)
      assert.strictEqual(updated.isbn, originalBook.isbn)
      assert.strictEqual(updated.price, originalBook.price)
    })

    it('handles partial updates', async () => {
      // Arrange
      const newBook = await createBook(context, {
        slug: 'partial-update-test',
        title: 'Original Title',
        author: 'Original Author',
        description: 'Original description',
        price: 10.00,
        genre: 'original',
        coverUrl: '/original.jpg',
        imageUrls: ['/original.jpg'],
        isbn: '978-9999999997', // Unique ISBN for test
        publishedYear: 2020,
        inStock: true,
      })

      // Act
      const updated = await updateBook(context, newBook.id, {
        title: 'New Title',
        price: 20.00,
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.title, 'New Title')
      assert.strictEqual(updated.price, 20.00)
      assert.strictEqual(updated.author, 'Original Author') // unchanged
      assert.strictEqual(updated.genre, 'original') // unchanged
    })

    it('returns undefined for non-existent book', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const updated = await updateBook(context, nonExistentId, {
        title: 'Should Not Work',
      })

      // Assert
      assert.strictEqual(updated, undefined)
    })

    it('updates imageUrls array correctly', async () => {
      // Arrange
      const book = await getAllBooks(context).then(books => books[0])
      const newImageUrls = ['/new1.jpg', '/new2.jpg', '/new3.jpg', '/new4.jpg']

      // Act
      const updated = await updateBook(context, book.id, {
        imageUrls: newImageUrls,
      })

      // Assert
      assert.ok(updated)
      assert.deepStrictEqual(updated.imageUrls, newImageUrls)
    })

    it('updates inStock boolean correctly', async () => {
      // Arrange
      const book = await getAllBooks(context).then(books => books[0])
      const originalInStock = book.inStock

      // Act
      const updated = await updateBook(context, book.id, {
        inStock: !originalInStock,
      })

      // Assert
      assert.ok(updated)
      assert.strictEqual(updated.inStock, !originalInStock)
    })

    it('returns existing book when no fields provided', async () => {
      // Arrange
      const book = await getAllBooks(context).then(books => books[0])

      // Act
      const result = await updateBook(context, book.id, {})

      // Assert
      assert.ok(result)
      assert.strictEqual(result.id, book.id)
      assert.strictEqual(result.title, book.title)
    })
  })

  describe('deleteBook', () => {
    it('removes book from database', async () => {
      // Arrange
      const newBook = await createBook(context, {
        slug: 'delete-test',
        title: 'To Be Deleted',
        author: 'Delete Author',
        description: 'This book will be deleted',
        price: 9.99,
        genre: 'test',
        coverUrl: '/delete.jpg',
        imageUrls: ['/delete.jpg'],
        isbn: '978-9999999998', // Unique ISBN for test
        publishedYear: 2020,
        inStock: true,
      })

      // Act
      const deleted = await deleteBook(context, newBook.id)

      // Assert
      assert.strictEqual(deleted, true, 'Delete should return true')

      // Verify book is gone
      const retrieved = await getBookById(context, newBook.id)
      assert.strictEqual(retrieved, undefined, 'Book should no longer exist')
    })

    it('returns true on success', async () => {
      // Arrange
      const book = await createBook(context, {
        slug: 'delete-success-test',
        title: 'Delete Success Test',
        author: 'Test Author',
        description: 'Test',
        price: 10.00,
        genre: 'test',
        coverUrl: '/test.jpg',
        imageUrls: ['/test.jpg'],
        isbn: '978-9999999999', // Unique ISBN for test
        publishedYear: 2020,
        inStock: true,
      })

      // Act
      const result = await deleteBook(context, book.id)

      // Assert
      assert.strictEqual(result, true)
    })

    it('returns false for non-existent book', async () => {
      // Arrange
      const nonExistentId = generateId()

      // Act
      const result = await deleteBook(context, nonExistentId)

      // Assert
      assert.strictEqual(result, false)
    })
  })

  describe('Integration Tests', () => {
    it('full CRUD workflow: create → read → update → delete', async () => {
      // Create
      const created = await createBook(context, {
        slug: 'crud-workflow-test',
        title: 'CRUD Workflow Book',
        author: 'CRUD Author',
        description: 'Testing full CRUD workflow',
        price: 25.00,
        genre: 'integration-test',
        coverUrl: '/crud.jpg',
        imageUrls: ['/crud1.jpg', '/crud2.jpg'],
        isbn: '978-9999999990', // Unique ISBN for test
        publishedYear: 2024,
        inStock: true,
      })

      assert.ok(created.id)
      assert.strictEqual(created.title, 'CRUD Workflow Book')

      // Read
      const read = await getBookById(context, created.id)
      assert.ok(read)
      assert.strictEqual(read.id, created.id)

      // Update
      const updated = await updateBook(context, created.id, {
        title: 'Updated CRUD Book',
        price: 30.00,
      })
      assert.ok(updated)
      assert.strictEqual(updated.title, 'Updated CRUD Book')
      assert.strictEqual(updated.price, 30.00)

      // Delete
      const deleted = await deleteBook(context, created.id)
      assert.strictEqual(deleted, true)

      // Verify deletion
      const afterDelete = await getBookById(context, created.id)
      assert.strictEqual(afterDelete, undefined)
    })

    it('search finds newly created book', async () => {
      // Arrange
      const uniqueTitle = `Unique Search Book ${Date.now()}`
      const created = await createBook(context, {
        slug: 'search-integration-test',
        title: uniqueTitle,
        author: 'Search Author',
        description: 'For search integration test',
        price: 15.00,
        genre: 'test',
        coverUrl: '/search.jpg',
        imageUrls: ['/search.jpg'],
        isbn: '978-9999999989', // Unique ISBN for test
        publishedYear: 2024,
        inStock: true,
      })

      // Act
      const results = await searchBooks(context, 'Unique Search Book')

      // Assert
      const found = results.find(b => b.id === created.id)
      assert.ok(found, 'Should find newly created book via search')
    })

    it('genre filtering works with newly created book', async () => {
      // Arrange
      const uniqueGenre = `test-genre-${Date.now()}`
      const created = await createBook(context, {
        slug: 'genre-test',
        title: 'Genre Test Book',
        author: 'Genre Author',
        description: 'For genre test',
        price: 20.00,
        genre: uniqueGenre,
        coverUrl: '/genre.jpg',
        imageUrls: ['/genre.jpg'],
        isbn: '978-9999999988', // Unique ISBN for test
        publishedYear: 2024,
        inStock: true,
      })

      // Act
      const results = await getBooksByGenre(context, uniqueGenre)

      // Assert
      assert.ok(results.length > 0)
      const found = results.find(b => b.id === created.id)
      assert.ok(found, 'Should find book by genre')
    })
  })
})
