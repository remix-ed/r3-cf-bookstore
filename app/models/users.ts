/**
 * User Model
 *
 * Provides functions for user management using D1 database.
 * All functions require AppContext to access D1 service.
 */

import type { AppContext } from '~/app/context.server'
import { nanoid } from 'nanoid'
import { getD1 } from '~/app/services/container'

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
  const d1 = getD1(context)
  const rows = await d1.users.getAll() as UserRow[]
  return rows.map(row => rowToUser(row)).filter((u): u is User => u !== undefined)
}

/**
 * Get user by ID
 */
export async function getUserById(context: AppContext, id: string): Promise<User | undefined> {
  const d1 = getD1(context)
  const row = await d1.users.getById(id) as UserRow | null
  return rowToUser(row)
}

/**
 * Get user by email
 */
export async function getUserByEmail(context: AppContext, email: string): Promise<User | undefined> {
  const d1 = getD1(context)
  const row = await d1.users.getByEmail(email) as UserRow | null
  return rowToUser(row)
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(context: AppContext, email: string, password: string): Promise<User | undefined> {
  const d1 = getD1(context)
  const row = await d1.users.authenticate(email, password) as UserRow | null
  return rowToUser(row)
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
  const d1 = getD1(context)
  const row = await d1.users.create({
    id: nanoid(),
    email,
    password, // In production, hash this!
    name,
    role
  }) as UserRow
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
  const d1 = getD1(context)
  const row = await d1.users.update(id, data) as UserRow | null
  return rowToUser(row)
}

/**
 * Delete user
 */
export async function deleteUser(context: AppContext, id: string): Promise<boolean> {
  const d1 = getD1(context)
  return await d1.users.delete(id)
}

/**
 * Create password reset token
 */
export async function createPasswordResetToken(context: AppContext, email: string): Promise<string | undefined> {
  const user = await getUserByEmail(context, email)
  if (!user) return undefined

  const token = nanoid(32)
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

  const d1 = getD1(context)
  await d1.passwordResetTokens.create(token, user.id, expiresAt)

  return token
}

/**
 * Reset password using token
 */
export async function resetPassword(context: AppContext, token: string, newPassword: string): Promise<boolean> {
  const d1 = getD1(context)
  const tokenData = await d1.passwordResetTokens.get(token)

  if (!tokenData) return false

  const now = Math.floor(Date.now() / 1000)
  if (tokenData.expires_at < now) {
    await d1.passwordResetTokens.delete(token)
    return false
  }

  const user = await getUserById(context, tokenData.user_id)
  if (!user) return false

  await updateUser(context, user.id, { password: newPassword })
  await d1.passwordResetTokens.delete(token)

  return true
}
