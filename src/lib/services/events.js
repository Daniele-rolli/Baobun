import { apiFetch } from '@/lib/api'

export const listByGroup = (groupId, { from, to } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiFetch(`/api/groups/${groupId}/events${qs ? `?${qs}` : ''}`)
}

export const create = (groupId, payload) =>
  apiFetch(`/api/groups/${groupId}/events`, { method: 'POST', json: true, body: payload })
export const update = (id, patch) =>
  apiFetch(`/api/events/${id}`, { method: 'PATCH', json: true, body: patch })
export const remove = (id) => apiFetch(`/api/events/${id}`, { method: 'DELETE' })
export const moveDate = (id, start) =>
  apiFetch(`/api/events/${id}/date`, { method: 'PUT', json: true, body: { start } })

export const importCalendar = (groupId, file) => {
  const body = new FormData()
  body.append('file', file)
  return apiFetch(`/api/groups/${groupId}/events/import`, { method: 'POST', body })
}
