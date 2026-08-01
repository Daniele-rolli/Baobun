import { apiFetch } from '@/lib/api'

export const publish = (groupId, userId = 'all') =>
  apiFetch(`/api/calendar-feeds/${groupId}/${userId}.ics`, { method: 'PUT' })

export const getUrl = (groupId, userId = 'all') =>
  apiFetch(`/api/calendar-feeds/${groupId}/${userId}.ics/url`)
