import { getSessionUser } from '../session.js'
import { prisma } from '../db.js'
import { unauthorized, forbidden, notFound } from '../errors.js'

export const requireAuth = async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) throw unauthorized('Please sign in.')
  c.set('user', user)
  await next()
}

export const requireMember = (groupParam = 'id') => async (c, next) => {
  const user = c.get('user')
  const groupId = c.req.param(groupParam)
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId: user.id },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  c.set('membership', membership)
  await next()
}

export const requireOwner = (groupParam = 'id') => async (c, next) => {
  const user = c.get('user')
  const groupId = c.req.param(groupParam)
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw notFound('Group not found.')
  if (group.ownerUserId !== user.id) throw forbidden('Only the group owner can do this.')
  c.set('group', group)
  await next()
}
