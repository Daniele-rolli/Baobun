import { getSessionUser } from '../session.js'
import { prisma } from '../db.js'
import { unauthorized, forbidden, notFound } from '../errors.js'
import { createHash } from 'crypto'

export const ROLE_LEVEL = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 }

export const requireAuth = async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) throw unauthorized('Please sign in.')
  c.set('user', user)
  await next()
}

export const getApiTokenUser = async (c) => {
  const authorization = c.req.header('authorization') || ''
  const secret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!secret) return null
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: createHash('sha256').update(secret).digest('hex') },
    include: { user: true },
  })
  if (!token || (token.expiresAt && token.expiresAt <= new Date())) return null
  await prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  })
  return token.user
}

export const requireAuthOrToken = async (c, next) => {
  const user = (await getSessionUser(c)) || (await getApiTokenUser(c))
  if (!user) throw unauthorized('Please sign in or provide a valid API token.')
  c.set('user', user)
  await next()
}

export const requireMember =
  (groupParam = 'id') =>
  async (c, next) => {
    const user = c.get('user')
    const groupId = c.req.param(groupParam)
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: user.id },
    })
    if (!membership) throw forbidden('You are not a member of this group.')
    c.set('membership', membership)
    await next()
  }

export const requireOwner =
  (groupParam = 'id') =>
  async (c, next) => {
    const user = c.get('user')
    const groupId = c.req.param(groupParam)
    const group = await prisma.group.findUnique({ where: { id: groupId } })
    if (!group) throw notFound('Group not found.')
    if (group.ownerUserId !== user.id) throw forbidden('Only the group owner can do this.')
    c.set('group', group)
    await next()
  }

export const requireGroupRole =
  (minimumRole, groupParam = 'id') =>
  async (c, next) => {
    const user = c.get('user')
    const groupId = c.req.param(groupParam)
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: user.id },
      include: { group: true },
    })
    if (!membership) throw forbidden('You are not a member of this group.')
    const effectiveRole = membership.group.ownerUserId === user.id ? 'OWNER' : membership.role
    if ((ROLE_LEVEL[effectiveRole] ?? -1) < ROLE_LEVEL[minimumRole]) {
      throw forbidden(`This action requires the ${minimumRole.toLowerCase()} role.`)
    }
    c.set('membership', { ...membership, role: effectiveRole })
    await next()
  }
