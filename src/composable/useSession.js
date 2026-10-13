import { ref } from 'vue'
import * as authService from '@/lib/services/auth'

const SESSION_STORE_KEY = 'baobun_session'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800

const inFlight = new Map()
export const sessionStatus = ref('idle')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function markSessionActive() {
  sessionStorage.setItem(SESSION_STORE_KEY, 'active')
  sessionStatus.value = 'valid'
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_STORE_KEY)
  localStorage.removeItem('auth')
  sessionStatus.value = 'invalid'
}

export function hasLocalSession() {
  return sessionStorage.getItem(SESSION_STORE_KEY) === 'active'
}

export async function withSession(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key)

  const promise = (async () => {
    let lastError
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await fn()
        markSessionActive()
        return result
      } catch (err) {
        lastError = err
        const status = err?.status
        if (status === 401) {
          clearSession()
          const { default: router } = await import('@/router')
          router.push('/login')
          throw err
        }
        if (status >= 400 && status < 500) throw err
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
    throw lastError
  })()

  inFlight.set(key, promise)
  try {
    return await promise
  } finally {
    inFlight.delete(key)
  }
}

export async function validateSession() {
  try {
    await authService.me()
    markSessionActive()
    return true
  } catch {
    clearSession()
    return false
  }
}
