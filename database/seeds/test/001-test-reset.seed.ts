/**
 * Test Database Reset Seed
 *
 * Clears all data from test database tables.
 * Run this before other seeds to ensure a clean state.
 *
 * Uses PRAGMA foreign_keys=OFF to safely delete from all tables
 * without worrying about foreign key constraint order.
 */

export default async function resetTestDatabase(db: any) {
  await db.batch([
    // Disable foreign key checks
    db.prepare('PRAGMA foreign_keys=OFF'),

    // Clear all tables
    db.prepare('DELETE FROM orders'),
    db.prepare('DELETE FROM books'),
    db.prepare('DELETE FROM users'),
    db.prepare('DELETE FROM password_reset_tokens'),

    // Re-enable foreign key checks
    db.prepare('PRAGMA foreign_keys=ON'),
  ])

  console.log('   ✓ Database reset complete')
}
