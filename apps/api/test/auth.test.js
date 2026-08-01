import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'crypto'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const testUser = { name: 'Ada', email: 'ada@example.com', password: 'supersecret1' }

const json = (path, { method = 'GET', body, cookie = '' } = {}) =>
  app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

describe('auth', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } })
  })

  it('registers, logs in, gets me, logs out', async () => {
    const reg = await json('/api/auth/register', { method: 'POST', body: testUser })
    expect(reg.status).toBe(201)
    const regCookie = reg.headers.get('set-cookie') || ''
    expect(regCookie).toContain('baobun_sid=')

    const me = await json('/api/auth/me', { cookie: regCookie })
    expect(me.status).toBe(200)
    const meBody = await me.json()
    expect(meBody.user.email).toBe(testUser.email)
    expect(meBody.user.$id).toBeTruthy()

    await json('/api/auth/logout', { method: 'POST', cookie: regCookie })

    const meAfter = await json('/api/auth/me', { cookie: regCookie })
    expect(meAfter.status).toBe(401)
  })

  it('rejects bad login', async () => {
    const bad = await json('/api/auth/login', {
      method: 'POST',
      body: { email: testUser.email, password: 'wrongpass1' },
    })
    expect(bad.status).toBe(401)
  })

  it('resets a password via forgot + reset', async () => {
    const forgot = await json('/api/auth/forgot', {
      method: 'POST',
      body: { email: testUser.email },
    })
    expect(forgot.status).toBe(200)

    const user = await prisma.user.findUnique({ where: { email: testUser.email } })
    // We only store the hash of the emailed token, so create a token we know:
    const raw = 'manual-test-token'
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 60000),
      },
    })

    const reset = await json('/api/auth/reset', {
      method: 'POST',
      body: { userId: user.id, token: raw, newPassword: 'brandnewpass1' },
    })
    expect(reset.status).toBe(200)

    const login = await json('/api/auth/login', {
      method: 'POST',
      body: { email: testUser.email, password: 'brandnewpass1' },
    })
    expect(login.status).toBe(200)
  })
})
