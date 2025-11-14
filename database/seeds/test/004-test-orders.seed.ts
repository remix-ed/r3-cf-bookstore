/**
 * Test Seed: Orders
 *
 * Creates test orders for testing order functionality.
 */

export default async function seedTestOrders(db: any) {
  const orders = [
    {
      id: '1001',
      userId: '2',
      items: [
        { bookId: '001', title: 'Ash & Smoke', price: 16.99, quantity: 1 },
        { bookId: '003', title: 'Three Ways to Change Your Life', price: 28.99, quantity: 1 },
      ],
      total: 45.98,
      status: 'delivered',
      shippingAddress: {
        street: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
      },
      createdAt: Math.floor(new Date('2024-09-15').getTime() / 1000),
    },
    {
      id: '1002',
      userId: '2',
      items: [{ bookId: '002', title: 'Heavy Metal Guitar Riffs', price: 27.0, quantity: 2 }],
      total: 54.0,
      status: 'shipped',
      shippingAddress: {
        street: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
      },
      createdAt: Math.floor(new Date('2024-10-01').getTime() / 1000),
    },
  ]

  // Prepare statement for batch execution
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO orders (id, user_id, items, total, status, shipping_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  // Create batch with bound parameters (true D1 batch API)
  const batch = orders.map((order) =>
    stmt.bind(
      order.id,
      order.userId,
      JSON.stringify(order.items),
      order.total,
      order.status,
      JSON.stringify(order.shippingAddress),
      order.createdAt
    )
  )

  await db.batch(batch)

  console.log(`   ✓ Created ${batch.length} records`)
}
