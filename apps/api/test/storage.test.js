import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

let storagePath
let ensureStorage
let putObject
let getObject
let deleteObject
let BUCKETS
let presignGetUrl

describe('local storage', () => {
  beforeAll(async () => {
    storagePath = await mkdtemp(join(tmpdir(), 'baobun-storage-'))
    process.env.STORAGE_PATH = storagePath
    ;({ ensureStorage, putObject, getObject, deleteObject, BUCKETS, presignGetUrl } =
      await import('../src/storage.js'))
    await ensureStorage()
  })

  afterAll(() => rm(storagePath, { recursive: true, force: true }))

  it('round-trips an object', async () => {
    const key = `test-${Date.now()}.txt`
    await putObject(BUCKETS.avatars, key, Buffer.from('hello'), 'text/plain')
    const buf = await getObject(BUCKETS.avatars, key)
    expect(buf.toString()).toBe('hello')
    const url = await presignGetUrl(BUCKETS.avatars, key)
    expect(url).toContain(`/api/files/${BUCKETS.avatars}/`)
    await deleteObject(BUCKETS.avatars, key)
    await expect(getObject(BUCKETS.avatars, key)).rejects.toThrow()
  })
})
