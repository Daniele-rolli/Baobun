import { apiFetch } from '@/lib/api'

export const register = (payload) =>
  apiFetch('/api/auth/register', { method: 'POST', json: true, body: payload })
export const login = (payload) =>
  apiFetch('/api/auth/login', { method: 'POST', json: true, body: payload })
export const logout = () => apiFetch('/api/auth/logout', { method: 'POST' })
export const me = () => apiFetch('/api/auth/me')
export const forgot = (email) =>
  apiFetch('/api/auth/forgot', { method: 'POST', json: true, body: { email } })
export const reset = (payload) =>
  apiFetch('/api/auth/reset', { method: 'POST', json: true, body: payload })
