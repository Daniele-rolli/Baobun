import { Hono } from 'hono'
import { prisma } from '../db.js'
import { verifyPassword, hashPassword } from '../password.js'
import { requireAuth } from '../middleware/auth.js'
import { validationError, unauthorized, conflict } from '../errors.js'
import { putObject, deleteObject, BUCKETS } from '../storage.js'
import { serializeUser, avatarUrlFor } from './auth.js'

const users = new Hono()

users.patch('/me', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const { name, email, currentPassword, password } = body

  const data = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()

  if (email && email !== user.email) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is required to change your email.')
    }
    const dup = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })
    if (dup && dup.id !== user.id) throw conflict('Email already in use.')
    data.email = String(email).toLowerCase()
  }

  if (password) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is required to set a new password.')
    }
    data.passwordHash = await hashPassword(password)
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data })
  return c.json({ user: serializeUser(updated, await avatarUrlFor(updated)) })
})

users.put('/me/avatar', requireAuth, async (c) => {
  const user = c.get('user')
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File) || file.size === 0) {
    throw validationError('Please provide an image file.')
  }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const key = `avatar-${user.id}-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await putObject(BUCKETS.avatars, key, buf, file.type || 'application/octet-stream')

  if (user.avatarObjectKey) {
    await deleteObject(BUCKETS.avatars, user.avatarObjectKey).catch(() => {})
  }
  await prisma.user.update({ where: { id: user.id }, data: { avatarObjectKey: key } })

  const updated = await prisma.user.findUnique({ where: { id: user.id } })
  return c.json({ avatarUrl: await avatarUrlFor(updated) })
})

users.delete('/me/avatar', requireAuth, async (c) => {
  const user = c.get('user')
  if (user.avatarObjectKey) {
    await deleteObject(BUCKETS.avatars, user.avatarObjectKey).catch(() => {})
    await prisma.user.update({ where: { id: user.id }, data: { avatarObjectKey: null } })
  }
  return c.json({ ok: true })
})

export default users
