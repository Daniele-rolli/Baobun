import { apiFetch } from '@/lib/api'

export const list = () => apiFetch('/api/groups')
export const create = (payload) => apiFetch('/api/groups', { method: 'POST', json: true, body: payload })
export const update = (id, patch) => apiFetch(`/api/groups/${id}`, { method: 'PATCH', json: true, body: patch })
export const remove = (id) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' })
export const joinByCode = (inviteCode) => apiFetch(`/api/groups/join?inviteCode=${encodeURIComponent(inviteCode)}`)
export const listMembers = (id) => apiFetch(`/api/groups/${id}/members`)
export const addMember = (id, email) => apiFetch(`/api/groups/${id}/members`, { method: 'POST', json: true, body: { email } })
export const removeMember = (id, memberId) => apiFetch(`/api/groups/${id}/members/${memberId}`, { method: 'DELETE' })
