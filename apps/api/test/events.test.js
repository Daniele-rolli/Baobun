import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'events-test@example.com'
let cookie = ''
let groupId = ''
let eventId = ''

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
    body: JSON.stringify({ name: 'E', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
  const create = await req('/api/groups', { method: 'POST', body: { name: 'EventsG' } })
  groupId = (await create.json()).group.$id
})

describe('events', () => {
  it('creates, lists, updates, moves and deletes an event', async () => {
    const create = await req(`/api/groups/${groupId}/events`, {
      method: 'POST',
      body: {
        title: 'Standup',
        start: '2026-08-02T09:00:00Z',
        end: '2026-08-02T09:30:00Z',
        people: ['everyone'],
      },
    })
    expect(create.status).toBe(201)
    const { event } = await create.json()
    eventId = event.$id
    expect(event.people).toEqual(['everyone'])

    const list = await req(`/api/groups/${groupId}/events`)
    expect((await list.json()).events.length).toBeGreaterThanOrEqual(1)

    const move = await req(`/api/events/${eventId}/date`, {
      method: 'PUT',
      body: { start: '2026-08-03T09:00:00Z' },
    })
    expect(move.status).toBe(200)
    expect((await move.json()).event.start).toContain('2026-08-03')

    const patch = await req(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: { title: 'Standup moved' },
    })
    expect((await patch.json()).event.title).toBe('Standup moved')

    const del = await req(`/api/events/${eventId}`, { method: 'DELETE' })
    expect(del.status).toBe(200)
  })
})
