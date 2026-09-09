import { Hono } from 'hono'
import { prisma } from '../db.js'
import { unauthorized, validationError } from '../errors.js'
import { getApiTokenUser } from '../middleware/auth.js'
import { eventToJson } from './events.js'
import { tagToJson } from './tags.js'

const publicApi = new Hono()

publicApi.use('*', async (c, next) => {
  const user = await getApiTokenUser(c)
  if (!user) {
    throw unauthorized('The API token is invalid or expired.')
  }
  c.set('user', user)
  await next()
})

publicApi.get('/groups', async (c) => {
  const user = c.get('user')
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: { include: { _count: { select: { members: true, events: true } } } } },
  })
  return c.json({
    groups: memberships.map(({ group, role }) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      role: group.ownerUserId === user.id ? 'OWNER' : role,
      memberCount: group._count.members,
      eventCount: group._count.events,
    })),
  })
})

publicApi.get('/groups/:id/events', async (c) => {
  const user = c.get('user')
  const groupId = c.req.param('id')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw unauthorized('The group is not available to this token.')

  const from = c.req.query('from')
  const to = c.req.query('to')
  const start = {}
  if (from) {
    const value = new Date(from)
    if (Number.isNaN(value.getTime())) throw validationError('The from value must be a valid date.')
    start.gte = value
  }
  if (to) {
    const value = new Date(to)
    if (Number.isNaN(value.getTime())) throw validationError('The to value must be a valid date.')
    start.lte = value
  }

  const [events, tags] = await Promise.all([
    prisma.event.findMany({
      where: { groupId, ...(Object.keys(start).length ? { start } : {}) },
      orderBy: { start: 'asc' },
    }),
    prisma.tag.findMany({ where: { groupId }, orderBy: { name: 'asc' } }),
  ])
  return c.json({
    events: events.map(eventToJson),
    tags: await Promise.all(tags.map(tagToJson)),
  })
})

export default publicApi
