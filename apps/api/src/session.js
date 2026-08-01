import { randomBytes } from 'crypto'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { SESSION_COOKIE } from '@baobun/shared'
import { prisma } from './db.js'

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

const isSecure = () => true // deployed behind TLS; dev browsers still accept Secure on localhost http

export const createSession = async (c, userId, { userAgent = '', ip = '' } = {}) => {
  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      userAgent,
      ip,
    },
  })
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_LIFETIME_MS / 1000,
  })
  return token
}

export const getSessionUser = async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {})
    return null
  }
  return session.user
}

export const destroySession = async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await prisma.session.delete({ where: { id: token } }).catch(() => {})
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}
