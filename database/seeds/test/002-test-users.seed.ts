/**
 * Test Seed: Users
 *
 * Creates test users with properly hashed passwords for testing.
 */

import { hashPassword } from '../../../app/utils/password'

export default async function seedTestUsers(db: any) {
  // Hash passwords using the same algorithm as the app
  const adminPasswordHash = await hashPassword('admin123')
  const customerPasswordHash = await hashPassword('password123')

  // Get timestamps
  const adminCreatedAt = Math.floor(new Date('2024-01-01').getTime() / 1000)
  const customerCreatedAt = Math.floor(new Date('2024-02-15').getTime() / 1000)

  // Prepare statement for batch execution
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO users (id, email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )

  // Create batch with bound parameters (true D1 batch API)
  const batch = [
    stmt.bind('1', 'admin@bookstore.com', adminPasswordHash, 'Admin User', 'admin', adminCreatedAt),
    stmt.bind('2', 'customer@example.com', customerPasswordHash, 'John Doe', 'customer', customerCreatedAt),
  ]

  await db.batch(batch)

  console.log(`   ✓ Created ${batch.length} records`)
}
