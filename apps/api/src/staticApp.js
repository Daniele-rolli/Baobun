import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { config } from './config.js'

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const staticRoot = config.staticDir ? resolve(config.staticDir) : null

const safeStaticPath = (relativePath) => {
  const target = resolve(staticRoot, relativePath)
  if (target !== staticRoot && !target.startsWith(`${staticRoot}${sep}`)) return null
  return target
}

const sendFile = async (c, target, requestPath) => {
  const data = await readFile(target)
  const extension = extname(target).toLowerCase()
  c.header('Content-Type', CONTENT_TYPES[extension] || 'application/octet-stream')
  c.header(
    'Cache-Control',
    requestPath.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : requestPath === '/sw.js' || requestPath === '/index.html' || requestPath === '/'
        ? 'no-cache'
        : 'public, max-age=3600',
  )
  c.header('X-Content-Type-Options', 'nosniff')
  return c.body(data)
}

export const serveStaticApp = async (c) => {
  if (!staticRoot || c.req.path.startsWith('/api/') || c.req.path.startsWith('/feeds/')) {
    return c.notFound()
  }

  let requestPath
  try {
    requestPath = decodeURIComponent(c.req.path)
  } catch {
    return c.notFound()
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
  const target = safeStaticPath(relativePath)
  if (!target) return c.notFound()

  try {
    return await sendFile(c, target, requestPath)
  } catch {
    if (extname(relativePath)) return c.notFound()
    return sendFile(c, safeStaticPath('index.html'), '/index.html').catch(() => c.notFound())
  }
}
