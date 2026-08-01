import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireMember, requireOwner } from '../middleware/auth.js'
import { notFound, conflict, validationError } from '../errors.js'
import { avatarUrlFor } from './auth.js'

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const groupToJson = (group, memberCount = 0) => ({
  $id: group.id,
  name: group.name,
  color: group.color,
  inviteCode: group.inviteCode,
  ownerId: group.ownerUserId,
  memberCount,
})

const memberToJson = (m) => ({
  $id: m.id,
  email: m.email,
  name: m.name,
  avatarUrl: m.avatarUrl ?? null,
  addedAt: m.joinedAt,
  userId: m.userId,
})

const groups = new Hono()

groups.use('*', requireAuth)

groups.get('/', async (c) => {
  const user = c.get('user')
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: { include: { _count: { select: { members: true } } } } },
  })
  const list = memberships.map((m) => groupToJson(m.group, m.group._count.members))
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
    },
  })
  return c.json({ group: groupToJson(group, 1) }, 201)
})

groups.get('/join', async (c) => {
  const user = c.get('user')
  const code = String(c.req.query('inviteCode') || '').trim().toUpperCase()
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
  return c.json({ group: groupToJson(group, count) })
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
  return c.json({ group: groupToJson(group, members.length), members: memberJson })
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
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  })
  const memberJson = await Promise.all(
    members.map(async (m) =>
      memberToJson({ ...m, avatarUrl: m.user ? await avatarUrlFor(m.user) : null }),
    ),
  )
  return c.json({ members: memberJson })
})

groups.post('/:id/members', requireOwner('id'), async (c) => {
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

groups.delete('/:id/members/:memberId', requireOwner('id'), async (c) => {
  const { id: groupId, memberId } = c.req.param()
  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId } })
  if (!member) throw notFound('Member not found.')
  await prisma.groupMember.delete({ where: { id: member.id } })
  return c.json({ ok: true })
})

export default groups
