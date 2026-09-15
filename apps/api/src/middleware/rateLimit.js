import { rateLimiter } from 'hono-rate-limiter'
import { ERROR_CODES } from '@baobun/shared'

// ponytail: MemoryStore = per-process counters; switch to a Redis store when horizontally scaled
// Proxy chain (Cloudflare -> Nginx Proxy Manager -> app): prefer the leftmost
// authoritative client-IP header. Spoofable by direct clients, but direct clients
// share the 'direct' bucket anyway — worst case is self-throttling, not bypass
// of auth (wrong passwords still fail; this only paces guesses).
const firstIp = (v) => (v || '').split(',')[0].trim()
const keyGenerator = (c) =>
  firstIp(c.req.header('cf-connecting-ip')) ||
  firstIp(c.req.header('x-real-ip')) ||
  firstIp(c.req.header('x-forwarded-for')) ||
  'direct'

const message = {
  error: { code: ERROR_CODES.rateLimited, message: 'Too many attempts, please try again later.' },
}

// 10 req/min per IP — stops credential stuffing + invite-code brute force
// without tripping normal use (or the per-file API test suites).
export const authLimiter = rateLimiter({ windowMs: 60_000, limit: 10, keyGenerator, message })
export const joinLimiter = rateLimiter({ windowMs: 60_000, limit: 10, keyGenerator, message })
