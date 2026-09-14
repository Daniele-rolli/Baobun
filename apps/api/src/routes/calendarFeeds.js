import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { buildIcsContent } from '@baobun/shared'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { forbidden, notFound } from '../errors.js'
import { getObject, putObject, deleteObject, BUCKETS } from '../storage.js'
import { absoluteUrl } from '../publicUrl.js'
import { eventToJson } from './events.js'

const newToken = () => randomBytes(16).toString('hex')
const keyForToken = (token) => `feed-${token}.ics`

const feedUrls = (c, token) => {
  const httpsUrl = absoluteUrl(c, `/api/calendar-feeds/public/${token}.ics`)
  return { httpsUrl, webcalUrl: httpsUrl.replace(/^https?:\/\//i, 'webcal://') }
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

// Public: served by unguessable token. Old deterministic cal-feed-* keys 404 here.
feeds.get('/public/:token', async (c) => {
  const raw = c.req.param('token') || ''
  if (!raw.endsWith('.ics')) throw notFound('Calendar feed not found.')
  const feed = await prisma.calendarFeed.findUnique({ where: { token: raw.slice(0, -4) } })
  if (!feed) throw notFound('Calendar feed not found.')
  let buf
  try {
    buf = await getObject(BUCKETS.calendarFeeds, feed.objectKey)
  } catch {
    throw notFound('Calendar feed not found.')
  }
  c.header('content-type', 'text/calendar; charset=utf-8')
  c.header('cache-control', 'public, max-age=60')
  return c.body(buf)
})

feeds.put('/:groupId/:userId', requireAuth, async (c) => {
  const user = c.get('user')
  const groupId = c.req.param('groupId')
  const raw = c.req.param('userId') || ''
  if (!raw.endsWith('.ics')) throw notFound('Calendar feed not found.')
  const userId = raw.slice(0, -4)
  if (userId !== 'all' && userId !== user.id) throw forbidden('You can only publish your own feed.')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')

  const ics = await buildFeed({ groupId, userId })
  const token = newToken()
  const objectKey = keyForToken(token)
  await putObject(
    BUCKETS.calendarFeeds,
    objectKey,
    Buffer.from(ics, 'utf8'),
    'text/calendar; charset=utf-8',
  )

  // ponytail: rotate token on every publish; stale token + object die together
  const prev = await prisma.calendarFeed.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  await prisma.calendarFeed.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, token, objectKey },
    update: { token, objectKey, updatedAt: new Date() },
  })
  if (prev) await deleteObject(BUCKETS.calendarFeeds, prev.objectKey).catch(() => {})

  return c.json(feedUrls(c, token))
})

feeds.get('/:groupId/:userId/url', requireAuth, async (c) => {
  const user = c.get('user')
  const groupId = c.req.param('groupId')
  const raw = c.req.param('userId') || ''
  if (!raw.endsWith('.ics')) throw notFound('Calendar feed not found.')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')
  const feed = await prisma.calendarFeed.findUnique({
    where: { groupId_userId: { groupId, userId: raw.slice(0, -4) } },
  })
  if (!feed) throw notFound('Calendar feed not found.')
  return c.json(feedUrls(c, feed.token))
})

export default feeds
