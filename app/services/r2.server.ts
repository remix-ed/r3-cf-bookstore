/**
 * R2 Storage Service
 *
 * Provides a type-safe interface for interacting with Cloudflare R2 object storage.
 * Handles file uploads, downloads, and metadata management.
 *
 * Usage:
 * ```ts
 * const r2 = createR2Service(env.UPLOADS)
 * await r2.put('file-key', fileBuffer, { contentType: 'image/png' })
 * const file = await r2.get('file-key')
 * ```
 */

export interface R2Service {
  get(key: string): Promise<R2ObjectBody | null>
  put(key: string, value: ArrayBuffer | ReadableStream | Uint8Array, options?: R2PutOptions): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number }): Promise<R2Objects>
}

export interface R2PutOptions {
  contentType?: string
  contentEncoding?: string
  contentLanguage?: string
  customMetadata?: Record<string, string>
}

/**
 * Creates an R2 service instance with typed methods
 *
 * @param r2 - Cloudflare R2 bucket binding
 * @returns R2Service instance
 */
export function createR2Service(r2: R2Bucket): R2Service {
  return {
    /**
     * Get an object from R2
     *
     * @param key - The object key to retrieve
     * @returns The object body, or null if not found
     */
    async get(key: string): Promise<R2ObjectBody | null> {
      return await r2.get(key)
    },

    /**
     * Put an object into R2
     *
     * @param key - The object key
     * @param value - The object data (ArrayBuffer, ReadableStream, or Uint8Array)
     * @param options - Optional metadata and headers
     */
    async put(
      key: string,
      value: ArrayBuffer | ReadableStream | Uint8Array,
      options?: R2PutOptions
    ): Promise<void> {
      const httpMetadata: R2HTTPMetadata = {}

      if (options?.contentType) {
        httpMetadata.contentType = options.contentType
      }
      if (options?.contentEncoding) {
        httpMetadata.contentEncoding = options.contentEncoding
      }
      if (options?.contentLanguage) {
        httpMetadata.contentLanguage = options.contentLanguage
      }

      await r2.put(key, value, {
        httpMetadata,
        customMetadata: options?.customMetadata
      })
    },

    /**
     * Delete an object from R2
     *
     * @param key - The object key to delete
     */
    async delete(key: string): Promise<void> {
      await r2.delete(key)
    },

    /**
     * List objects in R2
     *
     * @param options - Optional list options (prefix, limit)
     * @returns List of objects
     */
    async list(options?: { prefix?: string; limit?: number }): Promise<R2Objects> {
      return await r2.list(options)
    }
  }
}

/**
 * Helper function to convert a File or Blob to ArrayBuffer
 *
 * @param file - File or Blob to convert
 * @returns ArrayBuffer
 */
export async function fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return await file.arrayBuffer()
}

/**
 * Helper function to get content type from filename
 *
 * @param filename - The filename to check
 * @returns Content type string
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',

    // Documents
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',

    // Archives
    'zip': 'application/zip',
    'gz': 'application/gzip',

    // Default
    '*': 'application/octet-stream'
  }

  return mimeTypes[ext || '*'] || mimeTypes['*']
}
