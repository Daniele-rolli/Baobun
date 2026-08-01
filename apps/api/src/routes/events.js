import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { notFound, forbidden, validationError } from '../errors.js'

export const eventToJson = (event) => ({
  $id: event.id,
  groupId: event.groupId,
  title: event.title,
  start: event.start.toISOString(),
  end: event.end.toISOString(),
  notes: event.notes,
  people: Array.isArray(event.people) ? event.people : [],
  tagId: event.tagId,
  userId: event.userId,
  createdAt: event.createdAt.toISOString(),
})

export const eventSchema = z.object({
  title: z.string().trim().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  notes: z.string().optional().default(''),
  people: z.array(z.string()).optional().default([]),
  tagId: z.string().optional().default(''),
})

const events = new Hono()

const requireEventMember = async (c, next) => {
  const user = c.get('user')
  const event = await prisma.event.findUnique({ where: { id: c.req.param('id') } })
  if (!event) throw notFound('Event not found.')
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: event.groupId, userId: user.id },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  c.set('event', event)
  await next()
}

events.use('*', requireAuth)

events.patch('/:id', requireEventMember, async (c) => {
  const event = c.get('event')
  const body = await c.req.json().catch(() => ({}))
  const data = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.notes === 'string') data.notes = body.notes
  if (typeof body.start === 'string' && body.start) data.start = new Date(body.start)
  if (typeof body.end === 'string' && body.end) data.end = new Date(body.end)
  if (Array.isArray(body.people)) data.people = body.people
  if (typeof body.tagId === 'string') data.tagId = body.tagId
  const updated = await prisma.event.update({ where: { id: event.id }, data })
  return c.json({ event: eventToJson(updated) })
})

events.delete('/:id', requireEventMember, async (c) => {
  const event = c.get('event')
  await prisma.event.delete({ where: { id: event.id } })
  return c.json({ ok: true })
})

events.put('/:id/date', requireEventMember, async (c) => {
  const event = c.get('event')
  const body = await c.req.json().catch(() => ({}))
  const start = new Date(body.start ?? '')
  if (Number.isNaN(start.getTime())) throw validationError('A valid start date is required.')
  const duration = event.end.getTime() - event.start.getTime()
  const end = new Date(start.getTime() + (duration > 0 ? duration : 60 * 60 * 1000))
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { start, end },
  })
  return c.json({ event: eventToJson(updated) })
})

export default events
