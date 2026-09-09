import { describe, it, expect, beforeAll } from 'vitest'
import {
  ensureBuckets,
  putObject,
  getObject,
  deleteObject,
  BUCKETS,
  presignGetUrl,
} from '../src/s3.js'

describe('s3', () => {
  beforeAll(async () => {
    await ensureBuckets()
  })

  it('round-trips an object', async () => {
    const key = `test-${Date.now()}.txt`
    await putObject(BUCKETS.avatars, key, Buffer.from('hello'), 'text/plain')
    const buf = await getObject(BUCKETS.avatars, key)
    expect(buf.toString()).toBe('hello')
    const url = await presignGetUrl(BUCKETS.avatars, key)
    expect(url).toMatch(/^http/)
    await deleteObject(BUCKETS.avatars, key)
    await expect(getObject(BUCKETS.avatars, key)).rejects.toThrow()
  })
})
