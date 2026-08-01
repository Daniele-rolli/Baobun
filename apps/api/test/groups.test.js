import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'groups-test@example.com'
let cookie = ''
let groupId = ''

const req = (path, { method = 'GET', body } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'G', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
})

describe('groups', () => {
  it('creates and lists a group', async () => {
    const create = await req('/api/groups', { method: 'POST', body: { name: 'Team' } })
    expect(create.status).toBe(201)
    const { group } = await create.json()
    groupId = group.$id
    expect(group.inviteCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(group.ownerId).toBeTruthy()

    const list = await req('/api/groups')
    const { groups } = await list.json()
    expect(groups.some((g) => g.$id === groupId)).toBe(true)
  })

  it('joins via invite code', async () => {
    const otherEmail = 'other@example.com'
    await prisma.user.deleteMany({ where: { email: otherEmail } })
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Other', email: otherEmail, password: 'password123' }),
    })
    const otherCookie = reg.headers.get('set-cookie') || ''

    const list = await req('/api/groups')
    const { groups } = await list.json()
    const group = groups.find((g) => g.$id === groupId)
    expect(group).toBeTruthy()

    const join = await app.request(`/api/groups/join?inviteCode=${group.inviteCode}`, {
      headers: { cookie: otherCookie },
    })
    expect(join.status).toBe(200)
    const { group: joined } = await join.json()
    expect(joined.memberCount).toBeGreaterThanOrEqual(2)
  })
})
