import { config } from './config.js'

const firstHeaderValue = (value) => value?.split(',')[0]?.trim()

export const requestOrigin = (c) => {
  if (config.publicUrl) return config.publicUrl.replace(/\/$/, '')

  const protocol = firstHeaderValue(c.req.header('x-forwarded-proto')) || 'http'
  const host =
    firstHeaderValue(c.req.header('x-forwarded-host')) ||
    firstHeaderValue(c.req.header('host')) ||
    'localhost'

  return `${protocol}://${host}`
}

export const absoluteUrl = (c, path) =>
  `${requestOrigin(c)}${path.startsWith('/') ? path : `/${path}`}`
