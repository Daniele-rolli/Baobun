import { Client } from 'minio'
import { config } from './config.js'

const parseEndpoint = (endpoint) => {
  const url = new URL(endpoint)
  return { host: url.hostname, port: url.port ? Number(url.port) : undefined, ssl: url.protocol === 'https:' }
}

const { host, port, ssl } = parseEndpoint(config.s3.endpoint)

let client
export const getS3 = () => {
  if (!client) {
    client = new Client({
      endPoint: host,
      port,
      useSSL: ssl,
      accessKey: config.s3.accessKey,
      secretKey: config.s3.secretKey,
      region: config.s3.region,
    })
  }
  return client
}

export const BUCKETS = {
  avatars: config.s3.bucketAvatars,
  tagIcons: config.s3.bucketTagIcons,
  calendarFeeds: config.s3.bucketCalendarFeeds,
}

export const ensureBuckets = async () => {
  const s3 = getS3()
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await s3.bucketExists(bucket).catch(() => false)
    if (!exists) await s3.makeBucket(bucket, config.s3.region)
  }
  // ponytail: feeds stay private — ICS bytes are served via the API token route.
  // Existing deployments: remove the old PUBLIC_READ policy on the feeds bucket
  // and delete orphaned cal-feed-* objects at cutover.
}

export const putObject = async (bucket, key, data, contentType = 'application/octet-stream') => {
  const s3 = getS3()
  await s3.putObject(bucket, key, data, data.length ?? undefined, {
    'Content-Type': contentType,
  })
  return key
}

export const getObject = async (bucket, key) => {
  const s3 = getS3()
  const stream = await s3.getObject(bucket, key)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export const deleteObject = async (bucket, key) => {
  const s3 = getS3()
  await s3.removeObject(bucket, key)
}

export const presignGetUrl = async (bucket, key, { expiresInSeconds = 900 } = {}) => {
  const s3 = getS3()
  const signed = await s3.presignedGetObject(bucket, key, expiresInSeconds)
  return signed
}
