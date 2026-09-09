import { Hono } from 'hono'
import { requireAuthOrToken } from '../middleware/auth.js'
import { notFound } from '../errors.js'
import { BUCKETS, getObjectWithMetadata } from '../s3.js'

const readableBuckets = new Set([BUCKETS.avatars, BUCKETS.tagIcons])
const files = new Hono()

files.use('*', requireAuthOrToken)

files.get('/:bucket/:key', async (c) => {
  const bucket = c.req.param('bucket')
  if (!readableBuckets.has(bucket)) throw notFound('File not found.')

  try {
    const { data, contentType } = await getObjectWithMetadata(bucket, c.req.param('key'))
    return c.body(data, 200, {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    })
  } catch {
    throw notFound('File not found.')
  }
})

export default files
