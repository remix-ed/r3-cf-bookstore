/**
 * Upload Handler for R2 Storage
 *
 * Handles file uploads to Cloudflare R2 bucket.
 * Files are stored with unique keys and can be accessed via /uploads/:key route.
 */

import type { FileUpload } from '@remix-run/fetch-router/form-data-middleware'
import { generateId } from '~/app/utils/nanoid'
import { createR2Service, getContentType } from '~/app/services/r2.server'

/**
 * Creates an upload handler for the specified R2 bucket
 *
 * @param r2Bucket - Cloudflare R2 bucket binding
 * @returns Upload handler function
 */
export function createUploadHandler(r2Bucket: R2Bucket) {
  const r2 = createR2Service(r2Bucket)

  /**
   * Upload handler for file uploads. Stores files in R2 and returns
   * a public URL path that can be used to access the file.
   *
   * @param file - File upload object
   * @returns Public URL path for the uploaded file
   */
  return async function uploadHandler(file: FileUpload): Promise<string> {
    // Generate unique key for this file
    const ext = file.name.split('.').pop() || 'bin'
    const uniqueId = generateId(12)
    const key = `${file.fieldName}/${Date.now()}-${uniqueId}.${ext}`

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Store file in R2 with appropriate content type
    await r2.put(key, arrayBuffer, {
      contentType: file.type || getContentType(file.name),
      customMetadata: {
        originalName: file.name,
        fieldName: file.fieldName,
        uploadedAt: new Date().toISOString()
      }
    })

    // Return public URL path
    return `/uploads/${key}`
  }
}

/**
 * Get file from R2 by key
 *
 * @param r2Bucket - Cloudflare R2 bucket binding
 * @param key - File key
 * @returns R2 object or null
 */
export async function getUploadedFile(r2Bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  const r2 = createR2Service(r2Bucket)
  return await r2.get(key)
}

/**
 * Delete file from R2 by key
 *
 * @param r2Bucket - Cloudflare R2 bucket binding
 * @param key - File key
 */
export async function deleteUploadedFile(r2Bucket: R2Bucket, key: string): Promise<void> {
  const r2 = createR2Service(r2Bucket)
  await r2.delete(key)
}
