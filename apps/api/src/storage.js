import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

export const BUCKETS = {
  avatars: 'avatars',
  tagIcons: 'tag-icons',
  calendarFeeds: 'calendar-feeds',
}

const root = resolve(config.storagePath)
const bucketNames = new Set(Object.values(BUCKETS))

const objectPath = (bucket, key) => {
  if (!bucketNames.has(bucket)) throw new Error('Unknown storage bucket.')
  const bucketRoot = resolve(root, bucket)
  const target = resolve(bucketRoot, key)
  if (target !== bucketRoot && !target.startsWith(`${bucketRoot}${sep}`)) {
    throw new Error('Invalid storage key.')
  }
  return target
}

const metadataPath = (target) => `${target}.metadata.json`

export const ensureStorage = async () => {
  await Promise.all([...bucketNames].map((bucket) => mkdir(resolve(root, bucket), { recursive: true })))
}

export const putObject = async (bucket, key, data, contentType = 'application/octet-stream') => {
  const target = objectPath(bucket, key)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${randomUUID()}.tmp`
  await writeFile(temporary, data)
  await rename(temporary, target)
  await writeFile(metadataPath(target), JSON.stringify({ contentType }))
  return key
}

export const getObject = async (bucket, key) => readFile(objectPath(bucket, key))

export const getObjectWithMetadata = async (bucket, key) => {
  const target = objectPath(bucket, key)
  const [data, metadata] = await Promise.all([
    readFile(target),
    readFile(metadataPath(target), 'utf8')
      .then(JSON.parse)
      .catch(() => ({})),
  ])
  return { data, contentType: metadata.contentType || 'application/octet-stream' }
}

export const deleteObject = async (bucket, key) => {
  const target = objectPath(bucket, key)
  await Promise.all([
    rm(target, { force: true }),
    rm(metadataPath(target), { force: true }),
  ])
}

export const publicUrl = (bucket, key) => {
  const base = config.publicUrl.replace(/\/$/, '')
  return `${base}/api/files/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`
}

export const presignGetUrl = async (bucket, key) => publicUrl(bucket, key)
