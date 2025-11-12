import * as assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'

import { createTestRouter } from '../../test/helpers.ts'

describe('R2 Upload Handler', () => {
  let router: any

  before(async () => {
    router = await createTestRouter()
  })

  describe('R2 Storage Integration', () => {
    it('stores uploaded files with proper metadata', async () => {
      // Directly test R2 put/get
      const testKey = 'test/metadata-check.jpg'
      const testContent = 'test content with metadata'

      await router.env.UPLOADS_BUCKET.put(testKey, testContent, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
      })

      // Retrieve and verify
      const retrieved = await router.env.UPLOADS_BUCKET.get(testKey)

      assert.ok(retrieved, 'Should retrieve stored file')
      assert.equal(retrieved.key, testKey, 'Should have correct key')
      assert.equal(retrieved.httpMetadata?.contentType, 'image/jpeg', 'Should preserve content type')
      assert.equal(await retrieved.text(), testContent, 'Should preserve content')
    })

    it('handles file deletion from R2', async () => {
      const testKey = 'test/to-delete.jpg'

      // Store file
      await router.env.UPLOADS_BUCKET.put(testKey, 'content to delete', {
        httpMetadata: { contentType: 'image/jpeg' },
      })

      // Verify it exists
      let file = await router.env.UPLOADS_BUCKET.get(testKey)
      assert.ok(file, 'File should exist before deletion')

      // Delete file
      await router.env.UPLOADS_BUCKET.delete(testKey)

      // Verify deletion
      file = await router.env.UPLOADS_BUCKET.get(testKey)
      assert.equal(file, null, 'File should not exist after deletion')
    })
  })
})
