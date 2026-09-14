import { rateLimiter } from 'hono-rate-limiter'
import { ERROR_CODES } from '@baobun/shared'

// ponytail: MemoryStore = per-process counters; switch to a Redis store when horizontally scaled
const keyGenerator = (c) => (c.req.header('x-forwarded-for') || '').split(',')[0].trim() || 'direct'

const message = {
  error: { code: ERROR_CODES.rateLimited, message: 'Too many attempts, please try again later.' },
}

// 10 req/min per IP — stops credential stuffing + invite-code brute force
// without tripping normal use (or the per-file API test suites).
export const authLimiter = rateLimiter({ windowMs: 60_000, limit: 10, keyGenerator, message })
export const joinLimiter = rateLimiter({ windowMs: 60_000, limit: 10, keyGenerator, message })
