import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, ROLE_LEVEL } from '../middleware/auth.js'
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
  seriesId: event.seriesId,
  recurrence: event.recurrence ? JSON.parse(event.recurrence) : null,
  reminderMinutes: event.reminderMinutes,
  remindedAt: event.remindedAt?.toISOString() ?? null,
})

export const eventSchema = z.object({
  title: z.string().trim().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  notes: z.string().optional().default(''),
  people: z.array(z.string()).optional().default([]),
  tagId: z.string().optional().default(''),
  reminderMinutes: z.number().int().min(0).max(10080).nullable().optional().default(null),
  recurrence: z
    .object({
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
      interval: z.number().int().min(1).max(30).optional().default(1),
      count: z.number().int().min(2).max(366).optional(),
      until: z.string().datetime().optional(),
    })
    .nullable()
    .optional()
    .default(null)
    .refine((value) => !value || value.count || value.until, {
      message: 'Recurring events require a count or end date.',
    }),
})

const events = new Hono()

const requireEventMember = async (c, next) => {
  const user = c.get('user')
  const event = await prisma.event.findUnique({ where: { id: c.req.param('id') } })
  if (!event) throw notFound('Event not found.')
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: event.groupId, userId: user.id },
    include: { group: true },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  const role = membership.group.ownerUserId === user.id ? 'OWNER' : membership.role
  c.set('eventMembership', { ...membership, role })
  c.set('event', event)
  await next()
}

const requireEventWrite = (c, event) => {
  const user = c.get('user')
  const membership = c.get('eventMembership')
  if ((ROLE_LEVEL[membership.role] ?? -1) < ROLE_LEVEL.MEMBER) {
    throw forbidden('Viewers cannot change events.')
  }
  if (membership.role === 'MEMBER' && event.userId !== user.id) {
    throw forbidden('Members can only change events they created.')
  }
}

events.use('*', requireAuth)

events.patch('/:id', requireEventMember, async (c) => {
  const event = c.get('event')
  requireEventWrite(c, event)
  const body = await c.req.json().catch(() => ({}))
  const data = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.notes === 'string') data.notes = body.notes
  if (typeof body.start === 'string' && body.start) {
    data.start = new Date(body.start)
    if (Number.isNaN(data.start.getTime())) throw validationError('Event start must be a valid date.')
    data.remindedAt = null
  }
  if (typeof body.end === 'string' && body.end) {
    data.end = new Date(body.end)
    if (Number.isNaN(data.end.getTime())) throw validationError('Event end must be a valid date.')
  }
  if (Array.isArray(body.people)) data.people = body.people
  if (typeof body.tagId === 'string') data.tagId = body.tagId
  if (
    body.reminderMinutes === null ||
    (Number.isInteger(body.reminderMinutes) &&
      body.reminderMinutes >= 0 &&
      body.reminderMinutes <= 10080)
  ) {
    data.reminderMinutes = body.reminderMinutes
    data.remindedAt = null
  }
  if ((data.end ?? event.end) <= (data.start ?? event.start)) {
    throw validationError('Event end must be after its start.')
  }
  const updated = await prisma.event.update({ where: { id: event.id }, data })
  return c.json({ event: eventToJson(updated) })
})

events.delete('/:id', requireEventMember, async (c) => {
  const event = c.get('event')
  requireEventWrite(c, event)
  await prisma.event.delete({ where: { id: event.id } })
  return c.json({ ok: true })
})

events.put('/:id/date', requireEventMember, async (c) => {
  const event = c.get('event')
  requireEventWrite(c, event)
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
