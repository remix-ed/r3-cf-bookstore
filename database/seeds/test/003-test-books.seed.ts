/**
 * Test Seed: Books
 *
 * Creates test book catalog for testing.
 */

export default async function seedTestBooks(db: any) {
  const books = [
    {
      id: '001',
      slug: 'bbq',
      title: 'Ash & Smoke',
      author: 'Rusty Char-Broil',
      description: 'The perfect gift for the BBQ enthusiast in your life!',
      price: 16.99,
      genre: 'cookbook',
      imageUrls: ['/images/bbq-1.png', '/images/bbq-2.png', '/images/bbq-3.png'],
      coverUrl: '/images/bbq-1.png',
      isbn: '978-0525559474',
      publishedYear: 2020,
      inStock: true,
    },
    {
      id: '002',
      slug: 'heavy-metal',
      title: 'Heavy Metal Guitar Riffs',
      author: 'Axe Master Krush',
      description: 'The ultimate guide to heavy metal guitar riffs!',
      price: 27.0,
      genre: 'music',
      imageUrls: ['/images/heavy-metal-1.png', '/images/heavy-metal-2.png', '/images/heavy-metal-3.png'],
      coverUrl: '/images/heavy-metal-1.png',
      isbn: '978-0735211292',
      publishedYear: 2018,
      inStock: true,
    },
    {
      id: '003',
      slug: 'three-ways',
      title: 'Three Ways to Change Your Life',
      author: 'Britney Spears',
      description: 'A practical guide to changing your life for the better.',
      price: 28.99,
      genre: 'self-help',
      imageUrls: ['/images/three-ways-1.png', '/images/three-ways-2.png', '/images/three-ways-3.png'],
      coverUrl: '/images/three-ways-1.png',
      isbn: '978-1501175565',
      publishedYear: 2019,
      inStock: true,
    },
  ]

  // Prepare statement for batch execution
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO books (id, slug, title, author, description, price, genre, image_urls, cover_url, isbn, published_year, in_stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  // Create batch with bound parameters (true D1 batch API)
  const batch = books.map((book) =>
    stmt.bind(
      book.id,
      book.slug,
      book.title,
      book.author,
      book.description,
      book.price,
      book.genre,
      JSON.stringify(book.imageUrls),
      book.coverUrl,
      book.isbn,
      book.publishedYear,
      book.inStock ? 1 : 0
    )
  )

  await db.batch(batch)
  console.log(`   ✓ Created ${batch.length} records`)
}
