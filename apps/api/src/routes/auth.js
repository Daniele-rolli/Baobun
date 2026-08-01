import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword, validatePassword } from '../password.js'
import { createSession, destroySession } from '../session.js'
import { requireAuth } from '../middleware/auth.js'
import { unauthorized, conflict, validationError, AppError } from '../errors.js'
import { sendMail } from '../mail.js'
import { config } from '../config.js'
import { getObject, BUCKETS, presignGetUrl } from '../s3.js'
import { randomBytes, createHash } from 'crypto'
import { ERROR_CODES } from '@baobun/shared'

export const serializeUser = (user, avatarUrl = null) => ({
  $id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl,
  avatarFileId: user.avatarObjectKey,
})

export const avatarUrlFor = async (user) => {
  if (!user.avatarObjectKey) return null
  try {
    await getObject(BUCKETS.avatars, user.avatarObjectKey)
    return await presignGetUrl(BUCKETS.avatars, user.avatarObjectKey)
  } catch {
    return null
  }
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

const emailSetPasswordLink = async (user) => {
  const raw = randomBytes(32).toString('base64url')
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
  const url = `${config.webOrigin}/reset-password?userId=${user.id}&token=${raw}`
  await sendMail({
    to: user.email,
    subject: 'Welcome to Baobun — set your password',
    text: `Click this link to set your Baobun password: ${url}\nThis link expires in 1 hour.`,
    html: `<p>Click <a href="${url}">here</a> to set your Baobun password. This link expires in 1 hour.</p>`,
  })
}

const auth = new Hono()

auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({ name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string() })
    .safeParse(body)
  if (!parsed.success) throw validationError('Please provide name, email and password.')
  const { name, email, password } = parsed.data
  validatePassword(password)

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) throw conflict('Email already in use.')

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name,
    },
  })
  await createSession(c, user.id, {
    userAgent: c.req.header('user-agent') || '',
    ip: c.req.header('x-forwarded-for') || '',
  })
  return c.json({ user: serializeUser(user, null) }, 201)
})

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string() })
    .safeParse(body)
  if (!parsed.success) throw validationError('Please provide email and password.')

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    if (user && user.needsPasswordSet) {
      const hasPending = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gte: new Date() } },
      })
      if (!hasPending) await emailSetPasswordLink(user).catch(() => {})
      throw new AppError(
        401,
        ERROR_CODES.passwordSetRequired,
        'Check your email for a link to set your password.',
      )
    }
    throw unauthorized('Invalid email or password.')
  }

  await createSession(c, user.id, {
    userAgent: c.req.header('user-agent') || '',
    ip: c.req.header('x-forwarded-for') || '',
  })
  return c.json({ user: serializeUser(user, await avatarUrlFor(user)) })
})

auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user')
  return c.json({ user: serializeUser(user, await avatarUrlFor(user)) })
})

auth.post('/logout', async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

auth.post('/forgot', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const raw = randomBytes(32).toString('base64url')
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      })
      const url = `${config.webOrigin}/reset-password?userId=${user.id}&token=${raw}`
      await sendMail({
        to: user.email,
        subject: 'Reset your Baobun password',
        text: `Click this link to reset your password: ${url}\nThis link expires in 1 hour.`,
        html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      }).catch(() => {})
    }
  }
  return c.json({ ok: true })
})

auth.post('/reset', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({ userId: z.string().min(1), token: z.string().min(1), newPassword: z.string() })
    .safeParse(body)
  if (!parsed.success) throw validationError('Invalid reset link.')
  validatePassword(parsed.data.newPassword)

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      userId: parsed.data.userId,
      tokenHash: hashToken(parsed.data.token),
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
  })
  if (!token) throw unauthorized('Invalid or expired reset link.')

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: parsed.data.userId, id: { not: token.id } } }),
    prisma.user.update({
      where: { id: parsed.data.userId },
      data: { passwordHash: await hashPassword(parsed.data.newPassword), needsPasswordSet: false },
    }),
  ])
  return c.json({ ok: true })
})

export default auth
