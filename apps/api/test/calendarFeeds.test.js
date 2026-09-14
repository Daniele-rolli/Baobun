import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'feed-test@example.com'
let cookie = ''
let groupId = ''
let userId = ''

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
    body: JSON.stringify({ name: 'F', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
  const { user } = await (await req('/api/auth/me')).json()
  userId = user.id
  const create = await req('/api/groups', { method: 'POST', body: { name: 'FeedG' } })
  groupId = (await create.json()).group.id
  await req(`/api/groups/${groupId}/events`, {
    method: 'POST',
    body: {
      title: 'Feed event',
      start: '2026-08-05T10:00:00Z',
      end: '2026-08-05T11:00:00Z',
      people: ['everyone'],
    },
  })
})

describe('calendar feeds', () => {
  it('publishes and reads a feed by unguessable token', async () => {
    const put = await req(`/api/calendar-feeds/${groupId}/${userId}.ics`, { method: 'PUT' })
    expect(put.status).toBe(200)
    const { httpsUrl, webcalUrl } = await put.json()
    expect(webcalUrl).toMatch(/^webcal:\/\//)
    expect(httpsUrl).toMatch(/\/api\/calendar-feeds\/public\/[0-9a-f]{32}\.ics$/)

    const get = await app.request(new URL(httpsUrl).pathname)
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toContain('text/calendar')
    const body = await get.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('Feed event')
  })

  it('re-publishing rotates the token and kills the old URL', async () => {
    const first = await (
      await req(`/api/calendar-feeds/${groupId}/${userId}.ics`, { method: 'PUT' })
    ).json()
    const second = await (
      await req(`/api/calendar-feeds/${groupId}/${userId}.ics`, { method: 'PUT' })
    ).json()
    expect(second.httpsUrl).not.toBe(first.httpsUrl)
    expect(await (await app.request(new URL(first.httpsUrl).pathname)).status).toBe(404)
    expect(await (await app.request(new URL(second.httpsUrl).pathname)).status).toBe(200)
  })

  it('404s for unknown tokens and legacy deterministic keys', async () => {
    const get = await app.request('/api/calendar-feeds/public/00000000000000000000000000000000.ics')
    expect(get.status).toBe(404)
    const legacy = await app.request(`/api/calendar-feeds/${groupId}/${userId}.ics`)
    expect(legacy.status).toBe(404)
  })
})
