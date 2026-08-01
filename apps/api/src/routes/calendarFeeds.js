import { Hono } from 'hono'
import { getLiveFeedFileId, buildIcsContent } from '@baobun/shared'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { forbidden, notFound } from '../errors.js'
import { getObject, putObject, BUCKETS, publicUrl } from '../s3.js'
import { config } from '../config.js'
import { eventToJson } from './events.js'

const keyFor = (c) => {
  const groupId = c.req.param('groupId')
  const raw = c.req.param('userId') || ''
  if (!raw.endsWith('.ics')) throw notFound('Calendar feed not found.')
  const userId = raw.slice(0, -4)
  return { groupId, userId, key: getLiveFeedFileId({ groupId, userId }) }
}

const buildFeed = async ({ groupId, userId }) => {
  const where = { groupId }
  const events = await prisma.event.findMany({ where, orderBy: { start: 'asc' } })
  const visible =
    userId === 'all' || !userId
      ? events
      : events.filter((e) => {
          const people = Array.isArray(e.people) ? e.people : []
          if (!people.length) return e.userId === userId
          if (people.includes('everyone')) return true
          if (people.includes(userId)) return true
          return false
        })
  const members = await prisma.groupMember.findMany({ where: { groupId }, include: { user: true } })
  const memberNameById = { everyone: 'Everyone' }
  for (const m of members) memberNameById[m.id] = m.name
  const tags = await prisma.tag.findMany({ where: { groupId } })
  const tagNameById = {}
  for (const t of tags) tagNameById[t.id] = t.name

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  return buildIcsContent({
    calendarName: group?.name || 'Baobun',
    events: visible.map(eventToJson),
    tagNameById,
    memberNameById,
  })
}

const feeds = new Hono()

feeds.get('/:groupId/:userId', async (c) => {
  const { key } = keyFor(c)
  let buf
  try {
    buf = await getObject(BUCKETS.calendarFeeds, key)
  } catch {
    throw notFound('Calendar feed not found.')
  }
  c.header('content-type', 'text/calendar; charset=utf-8')
  c.header('cache-control', 'public, max-age=60')
  return c.body(buf)
})

feeds.put('/:groupId/:userId', requireAuth, async (c) => {
  const user = c.get('user')
  const { groupId, userId } = keyFor(c)
  if (userId !== 'all' && userId !== user.id) throw forbidden('You can only publish your own feed.')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')

  const ics = await buildFeed({ groupId, userId })
  const key = getLiveFeedFileId({ groupId, userId })
  await putObject(BUCKETS.calendarFeeds, key, Buffer.from(ics, 'utf8'), 'text/calendar; charset=utf-8')
  const base = config.s3.publicEndpoint.replace(/\/$/, '')
  const httpsUrl = `${base}/${BUCKETS.calendarFeeds}/${key}`
  return c.json({ httpsUrl, webcalUrl: httpsUrl.replace(/^https?:\/\//i, 'webcal://') })
})

feeds.get('/:groupId/:userId/url', requireAuth, async (c) => {
  const user = c.get('user')
  const { groupId, userId, key } = keyFor(c)
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')
  const httpsUrl = publicUrl(BUCKETS.calendarFeeds, key)
  return c.json({ httpsUrl, webcalUrl: httpsUrl.replace(/^https?:\/\//i, 'webcal://') })
})

export default feeds
