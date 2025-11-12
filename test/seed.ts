/**
 * Test Database Seeding
 *
 * Seeds the test database with sample data for running tests.
 * This ensures tests have consistent data to work with.
 */

import { hashPassword } from '../app/utils/password'

/**
 * Seed the test database with sample data
 */
export async function seedTestDatabase(db: D1Database) {
  // Seed Users with hashed passwords
  const adminPassword = await hashPassword('admin123')
  const customerPassword = await hashPassword('password123')

  await db
    .prepare(
      'INSERT OR IGNORE INTO users (id, email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind('1', 'admin@bookstore.com', adminPassword, 'Admin User', 'admin', Math.floor(new Date('2024-01-01').getTime() / 1000))
    .run()

  await db
    .prepare(
      'INSERT OR IGNORE INTO users (id, email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind('2', 'customer@example.com', customerPassword, 'John Doe', 'customer', Math.floor(new Date('2024-02-15').getTime() / 1000))
    .run()

  // Seed Books
  await db
    .prepare(
      'INSERT OR IGNORE INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      '001',
      'bbq',
      'Ash & Smoke',
      'Rusty Char-Broil',
      'The perfect gift for the BBQ enthusiast in your life!',
      16.99,
      'cookbook',
      '["/images/bbq-1.png", "/images/bbq-2.png", "/images/bbq-3.png"]',
      '/images/bbq-1.png',
      '978-0525559474',
      2020,
      1
    )
    .run()

  await db
    .prepare(
      'INSERT OR IGNORE INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      '002',
      'heavy-metal',
      'Heavy Metal Guitar Riffs',
      'Axe Master Krush',
      'The ultimate guide to heavy metal guitar riffs!',
      27.0,
      'music',
      '["/images/heavy-metal-1.png", "/images/heavy-metal-2.png", "/images/heavy-metal-3.png"]',
      '/images/heavy-metal-1.png',
      '978-0735211292',
      2018,
      1
    )
    .run()

  await db
    .prepare(
      'INSERT OR IGNORE INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      '003',
      'three-ways',
      'Three Ways to Change Your Life',
      'Britney Spears',
      'A practical guide to changing your life for the better.',
      28.99,
      'self-help',
      '["/images/three-ways-1.png", "/images/three-ways-2.png", "/images/three-ways-3.png"]',
      '/images/three-ways-1.png',
      '978-0593135204',
      2021,
      1
    )
    .run()

  // Seed Orders
  await db
    .prepare(
      'INSERT OR IGNORE INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      '1001',
      '2',
      '[{"bookId":"001","title":"Ash & Smoke","price":16.99,"quantity":1},{"bookId":"003","title":"Three Ways to Change Your Life","price":28.99,"quantity":1}]',
      45.98,
      'delivered',
      '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}',
      Math.floor(new Date('2024-09-15').getTime() / 1000)
    )
    .run()

  await db
    .prepare(
      'INSERT OR IGNORE INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      '1002',
      '2',
      '[{"bookId":"002","title":"Heavy Metal Guitar Riffs","price":27.00,"quantity":2}]',
      54.0,
      'shipped',
      '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}',
      Math.floor(new Date('2024-10-01').getTime() / 1000)
    )
    .run()
}

/**
 * Clear all test data from the database
 */
export async function clearTestDatabase(db: D1Database) {
  await db.exec('DELETE FROM orders')
  await db.exec('DELETE FROM books')
  await db.exec('DELETE FROM users')
  await db.exec('DELETE FROM password_reset_tokens')
}
