import { createHash, randomBytes } from 'crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { notFound, validationError } from '../errors.js'

const tokens = new Hono()
tokens.use('*', requireAuth)

const tokenToJson = (token) => ({
  $id: token.id,
  name: token.name,
  prefix: token.tokenPrefix,
  createdAt: token.createdAt.toISOString(),
  lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
  expiresAt: token.expiresAt?.toISOString() ?? null,
})

tokens.get('/', async (c) => {
  const user = c.get('user')
  const items = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ tokens: items.map(tokenToJson) })
})

tokens.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      expiresAt: z.string().datetime().nullable().optional(),
    })
    .safeParse(body)
  if (!parsed.success) throw validationError('A token name and valid optional expiry are required.')

  const secret = `bbn_${randomBytes(32).toString('base64url')}`
  const tokenHash = createHash('sha256').update(secret).digest('hex')
  const token = await prisma.apiToken.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      tokenHash,
      tokenPrefix: secret.slice(0, 12),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  })
  return c.json({ token: tokenToJson(token), secret }, 201)
})

tokens.delete('/:id', async (c) => {
  const user = c.get('user')
  const token = await prisma.apiToken.findFirst({
    where: { id: c.req.param('id'), userId: user.id },
  })
  if (!token) throw notFound('API token not found.')
  await prisma.apiToken.delete({ where: { id: token.id } })
  return c.json({ ok: true })
})

export default tokens
