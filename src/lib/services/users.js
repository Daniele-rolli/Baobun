import { apiFetch } from '@/lib/api'

export const updateProfile = (payload) =>
  apiFetch('/api/users/me', { method: 'PATCH', json: true, body: payload })

export const updateAvatar = (file) => {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/api/users/me/avatar', { method: 'PUT', body: form })
}

export const deleteAvatar = () => apiFetch('/api/users/me/avatar', { method: 'DELETE' })
