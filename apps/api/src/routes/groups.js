import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireMember, requireOwner, requireGroupRole } from '../middleware/auth.js'
import { notFound, conflict, validationError } from '../errors.js'
import { avatarUrlFor } from './auth.js'
import { eventToJson, eventSchema } from './events.js'
import { tagToJson } from './tags.js'
import { putObject, BUCKETS } from '../storage.js'
import { expandRecurrence } from '../recurrence.js'
import { randomUUID } from 'crypto'
import { parseIcsEvents } from '../icsImport.js'

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const groupToJson = (group, memberCount = 0, role = null) => ({
  $id: group.id,
  name: group.name,
  color: group.color,
  inviteCode: group.inviteCode,
  ownerId: group.ownerUserId,
  memberCount,
  role,
})

const memberToJson = (m) => ({
  $id: m.id,
  email: m.email,
  name: m.name,
  avatarUrl: m.avatarUrl ?? null,
  addedAt: m.joinedAt,
  userId: m.userId,
  role: m.role,
})

const groups = new Hono()

groups.use('*', requireAuth)

groups.get('/', async (c) => {
  const user = c.get('user')
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: { include: { _count: { select: { members: true } } } } },
  })
  const list = memberships.map((m) =>
    groupToJson(
      m.group,
      m.group._count.members,
      m.group.ownerUserId === user.id ? 'OWNER' : m.role,
    ),
  )
  return c.json({ groups: list })
})

groups.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ name: z.string().trim().min(1) }).safeParse(body)
  if (!parsed.success) throw validationError('Group name is required.')
  const color = typeof body.color === 'string' && body.color ? body.color : '#f43f5e'

  let inviteCode = generateInviteCode()
  while (await prisma.group.findUnique({ where: { inviteCode } })) {
    inviteCode = generateInviteCode()
  }

  const group = await prisma.group.create({
    data: { name: parsed.data.name, color, ownerUserId: user.id, inviteCode },
  })
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: 'OWNER',
    },
  })
  return c.json({ group: groupToJson(group, 1, 'OWNER') }, 201)
})

groups.get('/join', async (c) => {
  const user = c.get('user')
  const code = String(c.req.query('inviteCode') || '')
    .trim()
    .toUpperCase()
  if (!code) throw validationError('Invite code is required.')
  const group = await prisma.group.findUnique({ where: { inviteCode: code } })
  if (!group) throw notFound('Invalid invite code.')

  const existing = await prisma.groupMember.findFirst({
    where: { groupId: group.id, userId: user.id },
  })
  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, email: user.email, name: user.name },
    })
  }
  const count = await prisma.groupMember.count({ where: { groupId: group.id } })
  return c.json({ group: groupToJson(group, count, existing?.role || 'MEMBER') })
})

groups.get('/:id', requireMember('id'), async (c) => {
  const group = await prisma.group.findUnique({ where: { id: c.req.param('id') } })
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true },
  })
  const memberJson = await Promise.all(
    members.map(async (m) =>
      memberToJson({ ...m, avatarUrl: m.user ? await avatarUrlFor(m.user) : null }),
    ),
  )
  const membership = c.get('membership')
  return c.json({
    group: groupToJson(
      group,
      members.length,
      group.ownerUserId === c.get('user').id ? 'OWNER' : membership.role,
    ),
    members: memberJson.map((member) => ({
      ...member,
      role: member.userId === group.ownerUserId ? 'OWNER' : member.role,
    })),
  })
})

groups.patch('/:id', requireOwner('id'), async (c) => {
  const group = c.get('group')
  const body = await c.req.json().catch(() => ({}))
  const data = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.color === 'string' && body.color) data.color = body.color
  const updated = await prisma.group.update({ where: { id: group.id }, data })
  const count = await prisma.groupMember.count({ where: { groupId: group.id } })
  return c.json({ group: groupToJson(updated, count) })
})

groups.delete('/:id', requireOwner('id'), async (c) => {
  const group = c.get('group')
  await prisma.group.delete({ where: { id: group.id } })
  return c.json({ ok: true })
})

groups.get('/:id/members', requireMember('id'), async (c) => {
  const groupId = c.req.param('id')
  const [group, members] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true },
    }),
  ])
  const memberJson = await Promise.all(
    members.map(async (m) =>
      memberToJson({ ...m, avatarUrl: m.user ? await avatarUrlFor(m.user) : null }),
    ),
  )
  return c.json({
    members: memberJson.map((member) => ({
      ...member,
      role: member.userId === group.ownerUserId ? 'OWNER' : member.role,
    })),
  })
})

groups.post('/:id/members', requireGroupRole('ADMIN', 'id'), async (c) => {
  const group = c.get('group')
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(body)
  if (!parsed.success) throw validationError('A valid email is required.')

  const email = parsed.data.email.toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  const existing = await prisma.groupMember.findFirst({ where: { groupId: group.id, email } })
  if (existing) throw conflict('That email is already a member.')

  const member = await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: user?.id ?? null,
      email,
      name: user?.name ?? email.split('@')[0],
    },
  })
  return c.json({ member: memberToJson(member) }, 201)
})

groups.patch('/:id/members/:memberId/role', requireOwner('id'), async (c) => {
  const { id: groupId, memberId } = c.req.param()
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.enum(['ADMIN', 'MEMBER', 'VIEWER']).safeParse(body.role)
  if (!parsed.success) throw validationError('Role must be admin, member, or viewer.')
  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId } })
  if (!member) throw notFound('Member not found.')
  if (member.userId === c.get('group').ownerUserId) {
    throw validationError("The owner's role cannot be changed.")
  }
  const updated = await prisma.groupMember.update({
    where: { id: member.id },
    data: { role: parsed.data },
  })
  return c.json({ member: memberToJson(updated) })
})

groups.delete('/:id/members/:memberId', requireGroupRole('ADMIN', 'id'), async (c) => {
  const { id: groupId, memberId } = c.req.param()
  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId } })
  if (!member) throw notFound('Member not found.')
  if (member.userId === c.get('membership').group.ownerUserId) {
    throw validationError('The group owner cannot be removed.')
  }
  await prisma.groupMember.delete({ where: { id: member.id } })
  return c.json({ ok: true })
})

groups.get('/:id/events', requireMember('id'), async (c) => {
  const groupId = c.req.param('id')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const where = { groupId }
  if (from) where.start = { ...(where.start || {}), gte: new Date(from) }
  if (to) where.start = { ...(where.start || {}), lte: new Date(to) }
  const items = await prisma.event.findMany({ where, orderBy: { start: 'asc' } })
  return c.json({ events: items.map(eventToJson) })
})

groups.post('/:id/events', requireGroupRole('MEMBER', 'id'), async (c) => {
  const groupId = c.req.param('id')
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) throw validationError('Event title, start and end are required.')

  const start = new Date(parsed.data.start)
  const end = new Date(parsed.data.end)
  if (end <= start) throw validationError('Event end must be after its start.')

  const occurrences = expandRecurrence({ start, end, recurrence: parsed.data.recurrence })
  const seriesId = occurrences.length > 1 ? randomUUID() : null
  const recurrence = parsed.data.recurrence ? JSON.stringify(parsed.data.recurrence) : null
  const created = await prisma.$transaction(
    occurrences.map((occurrence) =>
      prisma.event.create({
        data: {
          groupId,
          userId: user.id,
          title: parsed.data.title,
          start: occurrence.start,
          end: occurrence.end,
          notes: parsed.data.notes,
          people: parsed.data.people,
          tagId: parsed.data.tagId,
          reminderMinutes: parsed.data.reminderMinutes,
          seriesId,
          recurrence,
        },
      }),
    ),
  )
  return c.json({ event: eventToJson(created[0]), occurrenceCount: created.length, seriesId }, 201)
})

groups.post('/:id/events/import', requireGroupRole('MEMBER', 'id'), async (c) => {
  const groupId = c.req.param('id')
  const user = c.get('user')
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw validationError('Choose a non-empty .ics calendar file.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw validationError('Calendar files must be 5 MB or smaller.')
  }

  const parsedEvents = parseIcsEvents(await file.text())
  if (!parsedEvents.length) {
    throw validationError('No supported events were found in this calendar.')
  }

  let imported = 0
  let skipped = 0
  for (const parsedEvent of parsedEvents) {
    const occurrences = expandRecurrence(parsedEvent)
    const seriesId = occurrences.length > 1 ? randomUUID() : null
    for (const [index, occurrence] of occurrences.entries()) {
      const importUid = parsedEvent.uid ? `${parsedEvent.uid}#${index}` : null
      if (
        importUid &&
        (await prisma.event.findUnique({
          where: { groupId_importUid: { groupId, importUid } },
        }))
      ) {
        skipped += 1
        continue
      }
      await prisma.event.create({
        data: {
          groupId,
          userId: user.id,
          title: parsedEvent.title,
          notes: parsedEvent.notes || '',
          start: occurrence.start,
          end: occurrence.end,
          people: [],
          tagId: '',
          seriesId,
          recurrence: parsedEvent.recurrence ? JSON.stringify(parsedEvent.recurrence) : null,
          importUid,
        },
      })
      imported += 1
    }
  }
  return c.json({ imported, skipped })
})

groups.get('/:id/tags', requireMember('id'), async (c) => {
  const groupId = c.req.param('id')
  const items = await prisma.tag.findMany({ where: { groupId }, orderBy: { name: 'asc' } })
  return c.json({ tags: await Promise.all(items.map(tagToJson)) })
})

groups.post('/:id/tags', requireGroupRole('MEMBER', 'id'), async (c) => {
  const groupId = c.req.param('id')
  const form = await c.req.formData().catch(() => null)
  const name = String(form?.get('name') ?? '').trim()
  if (!name) throw validationError('Tag name is required.')
  const color = String(form?.get('color') ?? '#6B7280').trim() || '#6B7280'
  const icon = form?.get('icon') ? String(form.get('icon')) : null

  const tag = await prisma.tag.create({ data: { groupId, name, color, icon } })

  const image = form?.get('image')
  if (image instanceof File && image.size > 0) {
    const key = `tag-${tag.id}`
    await putObject(
      BUCKETS.tagIcons,
      key,
      Buffer.from(await image.arrayBuffer()),
      image.type || 'application/octet-stream',
    )
    await prisma.tag.update({ where: { id: tag.id }, data: { imageObjectKey: key } })
  }

  const fresh = await prisma.tag.findUnique({ where: { id: tag.id } })
  return c.json({ tag: await tagToJson(fresh) }, 201)
})

export default groups
