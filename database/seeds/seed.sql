-- Seed data for bookstore database
-- This file contains sample data for development and testing

-- Seed Users
-- NOTE: In production, passwords should be properly hashed with bcrypt/argon2
-- These are plain text passwords for demonstration purposes only
INSERT OR IGNORE INTO users (id, email, password, name, role, created_at) VALUES
  ('1', 'admin@bookstore.com', 'admin123', 'Admin User', 'admin', strftime('%s', '2024-01-01')),
  ('2', 'customer@example.com', 'password123', 'John Doe', 'customer', strftime('%s', '2024-02-15'));

-- Seed Books
INSERT OR IGNORE INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock) VALUES
  (
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
  ),
  (
    '002',
    'heavy-metal',
    'Heavy Metal Guitar Riffs',
    'Axe Master Krush',
    'The ultimate guide to heavy metal guitar riffs!',
    27.00,
    'music',
    '["/images/heavy-metal-1.png", "/images/heavy-metal-2.png", "/images/heavy-metal-3.png"]',
    '/images/heavy-metal-1.png',
    '978-0735211292',
    2018,
    1
  ),
  (
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
  );

-- Seed Orders
INSERT OR IGNORE INTO orders (id, user_id, items, total, status, shipping_address, created_at) VALUES
  (
    '1001',
    '2',
    '[{"bookId":"1","title":"The Midnight Library","price":16.99,"quantity":1},{"bookId":"3","title":"Project Hail Mary","price":28.99,"quantity":1}]',
    45.98,
    'delivered',
    '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}',
    strftime('%s', '2024-09-15')
  ),
  (
    '1002',
    '2',
    '[{"bookId":"2","title":"Atomic Habits","price":27.00,"quantity":2}]',
    54.00,
    'shipped',
    '{"street":"123 Main St","city":"Boston","state":"MA","zip":"02101"}',
    strftime('%s', '2024-10-01')
  );
