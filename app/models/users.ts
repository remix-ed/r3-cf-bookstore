/**
 * User Model
 *
 * Provides functions for user management using D1 database.
 * All functions require AppContext to access D1 service.
 */

import type { AppContext } from '~/app/context.server'
import { getDB } from '~/app/middleware/d1'
import { hashPassword, verifyPassword } from '~/app/utils/password'
import { v } from '~/app/utils/validation'
import { generateId, nanoidValidator } from '~/app/utils/nanoid'

export interface User {
  id: string
  email: string
  password: string // In production, this should be hashed!
  name: string
  role: 'customer' | 'admin'
  createdAt: Date
}

/**
 * Database row type (snake_case from D1)
 */
interface UserRow {
  id: string
  email: string
  password: string
  name: string
  role: 'customer' | 'admin'
  created_at: number
}

// =============================================================================
// Validation Schemas
// =============================================================================

export const UserSchema = v.object({
  id: nanoidValidator(),
  email: v.pipe(v.string(), v.email(), v.maxLength(255)),
  password: v.pipe(v.string(), v.minLength(1)), // Hashed password
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  role: v.picklist(['customer', 'admin']),
  createdAt: v.date(),
})

export const UserRowSchema = v.object({
  id: UserSchema.entries.id,
  email: UserSchema.entries.email,
  password: UserSchema.entries.password,
  name: UserSchema.entries.name,
  role: UserSchema.entries.role,
  created_at: v.number(), // Different from UserSchema.createdAt
})

export const InsertUserSchema = v.object({
  ...v.omit(UserSchema, ['id', 'createdAt', 'password', 'role']).entries,
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)), // Plaintext password (will be hashed)
  role: v.optional(v.picklist(['customer', 'admin']), 'customer'),
})

export const UpdateUserSchema = v.partial(
  v.omit(InsertUserSchema, ['role'])
)

export const AdminUpdateUserSchema = v.partial(InsertUserSchema)

export const LoginSchema = v.object({
  ...v.pick(UserSchema, ['email']).entries,
  password: v.pipe(v.string(), v.minLength(1)),
})

export const PasswordResetTokenSchema = v.object({
  token: nanoidValidator(32),
})

export const ResetPasswordSchema = v.object({
  ...PasswordResetTokenSchema.entries,
  ...v.pick(InsertUserSchema, ['password']).entries,
})

export type InsertUserInput = v.InferOutput<typeof InsertUserSchema>
export type UpdateUserInput = v.InferOutput<typeof UpdateUserSchema>
export type AdminUpdateUserInput = v.InferOutput<typeof AdminUpdateUserSchema>
export type LoginInput = v.InferOutput<typeof LoginSchema>
export type ResetPasswordInput = v.InferOutput<typeof ResetPasswordSchema>

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert database row to User model
 */
function rowToUser(row: UserRow | null | undefined): User | undefined {
  if (!row) return undefined
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role,
    createdAt: new Date(row.created_at * 1000), // Convert unix timestamp to Date
  }
}

/**
 * Get all users
 */
export async function getAllUsers(context: AppContext): Promise<User[]> {
  const db = getDB(context)
  const result = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
  const rows = result.results as unknown as UserRow[]
  return rows.map(row => rowToUser(row)).filter((u): u is User => u !== undefined)
}

/**
 * Get user by ID
 */
export async function getUserById(context: AppContext, id: string): Promise<User | undefined> {
  const db = getDB(context)
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first() as UserRow | null
  return rowToUser(row)
}

/**
 * Get user by email
 */
export async function getUserByEmail(context: AppContext, email: string): Promise<User | undefined> {
  const db = getDB(context)
  const row = await db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').bind(email).first() as UserRow | null
  return rowToUser(row)
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(context: AppContext, email: string, password: string): Promise<User | undefined> {
  const user = await getUserByEmail(context, email)
  if (!user) {
    return undefined
  }
  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    return undefined
  }
  return user
}

/**
 * Create a new user
 */
export async function createUser(
  context: AppContext,
  email: string,
  password: string,
  name: string,
  role: 'customer' | 'admin' = 'customer',
): Promise<User> {
  const db = getDB(context)
  const hashedPassword = await hashPassword(password)
  const id = generateId()

  await db
    .prepare("INSERT INTO users (id, email, password, name, role, created_at) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))")
    .bind(id, email, hashedPassword, name, role)
    .run()

  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first() as UserRow | null
  const user = rowToUser(row)
  if (!user) {
    throw new Error('Failed to create user')
  }
  return user
}

/**
 * Update user
 */
export async function updateUser(context: AppContext, id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
  const db = getDB(context)

  // Hash password if it's being updated
  const updateData = { ...data }
  if (updateData.password) {
    updateData.password = await hashPassword(updateData.password)
  }

  const updates: string[] = []
  const values: any[] = []

  if (updateData.email !== undefined) {
    updates.push('email = ?')
    values.push(updateData.email)
  }
  if (updateData.password !== undefined) {
    updates.push('password = ?')
    values.push(updateData.password)
  }
  if (updateData.name !== undefined) {
    updates.push('name = ?')
    values.push(updateData.name)
  }
  if (updateData.role !== undefined) {
    updates.push('role = ?')
    values.push(updateData.role)
  }

  if (updates.length === 0) {
    return getUserById(context, id)
  }

  values.push(id)
  await db
    .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first() as UserRow | null
  return rowToUser(row)
}

/**
 * Delete user
 */
export async function deleteUser(context: AppContext, id: string): Promise<boolean> {
  const db = getDB(context)
  const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}

/**
 * Create password reset token
 */
export async function createPasswordResetToken(context: AppContext, email: string): Promise<string | undefined> {
  const user = await getUserByEmail(context, email)
  if (!user) return undefined

  const token = generateId(32)
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

  const db = getDB(context)
  await db
    .prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, user.id, expiresAt)
    .run()

  return token
}

/**
 * Reset password using token
 */
export async function resetPassword(context: AppContext, token: string, newPassword: string): Promise<boolean> {
  const db = getDB(context)
  const tokenData = await db
    .prepare('SELECT * FROM password_reset_tokens WHERE token = ?')
    .bind(token)
    .first() as { token: string; user_id: string; expires_at: number } | null

  if (!tokenData) return false

  const now = Math.floor(Date.now() / 1000)
  if (tokenData.expires_at < now) {
    await db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').bind(token).run()
    return false
  }

  const user = await getUserById(context, tokenData.user_id)
  if (!user) return false

  await updateUser(context, user.id, { password: newPassword })
  await db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').bind(token).run()

  return true
}
