import { apiFetch } from '@/lib/api'

export const listByGroup = (groupId) => apiFetch(`/api/groups/${groupId}/tags`)

export const create = (groupId, { name, color, icon, image }) => {
  const form = new FormData()
  form.append('name', name)
  if (color) form.append('color', color)
  if (icon) form.append('icon', icon)
  if (image) form.append('image', image)
  return apiFetch(`/api/groups/${groupId}/tags`, { method: 'POST', body: form })
}

export const update = (id, { name, color }) => {
  const form = new FormData()
  if (name) form.append('name', name)
  if (color) form.append('color', color)
  return apiFetch(`/api/tags/${id}`, { method: 'PATCH', body: form })
}

export const remove = (id) => apiFetch(`/api/tags/${id}`, { method: 'DELETE' })
