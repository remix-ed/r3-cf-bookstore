/**
 * Password hashing utilities using Web Crypto API (PBKDF2)
 *
 * This implementation uses PBKDF2 with SHA-256 for password hashing,
 * which is supported natively in Cloudflare Workers via the Web Crypto API.
 */

const ITERATIONS = 100000 // OWASP recommended minimum
const HASH_LENGTH = 32 // 256 bits
const SALT_LENGTH = 16 // 128 bits

/**
 * Hash a password using PBKDF2-SHA256
 *
 * Returns a string in the format: salt:hash (both base64 encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  // Derive key using PBKDF2
  const hash = await deriveKey(password, salt)

  // Encode salt and hash as base64
  const saltB64 = arrayBufferToBase64(salt)
  const hashB64 = arrayBufferToBase64(hash)

  // Return combined format: salt:hash
  return `${saltB64}:${hashB64}`
}

/**
 * Verify a password against a hash
 *
 * @param password - The password to verify
 * @param storedHash - The stored hash in format salt:hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Parse stored hash
    const [saltB64, hashB64] = storedHash.split(':')
    if (!saltB64 || !hashB64) return false

    // Decode salt and hash from base64
    const salt = base64ToArrayBuffer(saltB64)
    const expectedHash = base64ToArrayBuffer(hashB64)

    // Derive key with same salt
    const actualHash = await deriveKey(password, salt)

    // Constant-time comparison
    return constantTimeEqual(new Uint8Array(actualHash), new Uint8Array(expectedHash))
  } catch {
    // Invalid hash format (e.g., invalid base64) - return false
    return false
  }
}

/**
 * Derive a key using PBKDF2-SHA256
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  // Encode password as UTF-8
  const passwordBuffer = new TextEncoder().encode(password)

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
    'deriveBits',
  ])

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8, // bits
  )

  return derivedBits
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Constant-time comparison to prevent timing attacks
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }

  return result === 0
}
