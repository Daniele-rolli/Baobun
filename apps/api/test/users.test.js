import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'users-test@example.com'
let cookie = ''

const auth = async () => {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'U', email, password: 'password123' }),
  })
  cookie = res.headers.get('set-cookie') || ''
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  await auth()
})

describe('users', () => {
  it('updates name', async () => {
    const res = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.name).toBe('Renamed')
  })

  it('changes password with current password', async () => {
    const res = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ password: 'newpassword1', currentPassword: 'password123' }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects password change without current password', async () => {
    const res = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ password: 'anotherpass1' }),
    })
    expect(res.status).toBe(401)
  })
})
