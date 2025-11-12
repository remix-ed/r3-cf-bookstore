/**
 * KV Storage Service
 *
 * Provides a type-safe interface for interacting with Cloudflare KV.
 * Handles JSON serialization/deserialization automatically.
 *
 * Usage:
 * ```ts
 * const kv = createKVService(env.SESSION_KV)
 * await kv.set('key', { data: 'value' }, { expirationTtl: 3600 })
 * const value = await kv.get<{ data: string }>('key')
 * ```
 */

export interface KVService {
  get<T = any>(key: string): Promise<T | null>
  set<T = any>(key: string, value: T, options?: { expirationTtl?: number; expiration?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>
}

/**
 * Creates a KV service instance with typed methods and JSON serialization
 *
 * @param kv - Cloudflare KV namespace binding
 * @returns KVService instance
 */
export function createKVService(kv: KVNamespace): KVService {
  return {
    /**
     * Get a value from KV with automatic JSON deserialization
     *
     * @param key - The key to retrieve
     * @returns The value, or null if not found
     */
    async get<T = any>(key: string): Promise<T | null> {
      const value = await kv.get(key, "text")
      if (value === null) {
        return null
      }

      try {
        return JSON.parse(value) as T
      } catch {
        // If parsing fails, return the raw value
        return value as unknown as T
      }
    },

    /**
     * Set a value in KV with automatic JSON serialization
     *
     * @param key - The key to set
     * @param value - The value to store (will be JSON serialized)
     * @param options - Optional expiration settings
     */
    async set<T = any>(
      key: string,
      value: T,
      options?: { expirationTtl?: number; expiration?: number }
    ): Promise<void> {
      const serialized = JSON.stringify(value)
      await kv.put(key, serialized, options)
    },

    /**
     * Delete a key from KV
     *
     * @param key - The key to delete
     */
    async delete(key: string): Promise<void> {
      await kv.delete(key)
    },

    /**
     * List keys in KV
     *
     * @param options - Optional list options (prefix, limit)
     * @returns List of keys
     */
    async list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }> {
      return await kv.list(options)
    }
  }
}
