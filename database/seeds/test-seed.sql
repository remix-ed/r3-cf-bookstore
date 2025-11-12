-- Test Seed Data for Bookstore Database
-- This file contains test data with properly hashed passwords
-- Generated: 2025-01-12

-- Clear existing data (for re-seeding)
DELETE FROM password_reset_tokens;
DELETE FROM orders;
DELETE FROM books;
DELETE FROM users;

-- Seed Test Users with PBKDF2-hashed passwords
-- Admin: admin@bookstore.com / admin123
-- Customer: customer@example.com / password123
INSERT INTO users (id, email, password, name, role, created_at) VALUES
  (
    '1',
    'admin@bookstore.com',
    'bpW0X/CwyTh02qcFeDh/gA==:NEvM8WnoakBX0JekH1ZRcmLmOmXD8C0yUeuElPBQRb0=',
    'Admin User',
    'admin',
    strftime('%s', '2024-01-01')
  ),
  (
    '2',
    'customer@example.com',
    'VGZVHJUtbPq67hr0e7ikIw==:mHJE+QXuiVj/DxI6amYIIqd5Tkz1wsw4IFOJ7MoP4TE=',
    'John Doe',
    'customer',
    strftime('%s', '2024-02-15')
  );

-- Seed Test Books (using nanoid format IDs)
INSERT INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES
  (
    'book_bbq_000000000001',
    'bbq',
    'Ash & Smoke',
    'Rusty Char-Broil',
    'The perfect gift for the BBQ enthusiast in your life!',
    16.99,
    'cookbook',
    '["/images/bbq-1.png","/images/bbq-2.png","/images/bbq-3.png"]',
    '/images/bbq-1.png',
    '978-0525559474',
    2020,
    1
  ),
  (
    'book_metal_0000000001',
    'heavy-metal',
    'Heavy Metal Guitar Riffs',
    'Axe Master Krush',
    'The ultimate guide to heavy metal guitar riffs!',
    27.00,
    'music',
    '["/images/heavy-metal-1.png","/images/heavy-metal-2.png","/images/heavy-metal-3.png"]',
    '/images/heavy-metal-1.png',
    '978-0735211292',
    2018,
    1
  ),
  (
    'book_3ways_0000000001',
    'three-ways',
    'Three Ways to Change Your Life',
    'Buck McCash',
    'Learn the secrets of transforming your life!',
    19.99,
    'self-help',
    '["/images/three-ways-1.png","/images/three-ways-2.png","/images/three-ways-3.png"]',
    '/images/three-ways-1.png',
    '978-1234567890',
    2022,
    1
  );

-- Seed Test Orders
INSERT INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES
  (
    '1001',
    '2',
    '[{"bookId":"book_bbq_000000000001","title":"Ash & Smoke","price":16.99,"quantity":1}]',
    16.99,
    'pending',
    '{"street":"123 Main St","city":"Springfield","state":"IL","zip":"62701"}',
    strftime('%s', '2024-03-01 10:00:00')
  ),
  (
    '1002',
    '2',
    '[{"bookId":"book_metal_0000000001","title":"Heavy Metal Guitar Riffs","price":27.00,"quantity":2}]',
    54.00,
    'delivered',
    '{"street":"123 Main St","city":"Springfield","state":"IL","zip":"62701"}',
    strftime('%s', '2024-02-15 14:30:00')
  );
