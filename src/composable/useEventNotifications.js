import { formatDateShort, formatTime } from '@/lib/dateTimePreferences'

const MAX_TIMEOUT_MS = 2_147_483_647
const scheduledTimers = new Map()

function formatLeadTimeLabel(leadMinutes) {
  const minutes = Number(leadMinutes)
  if (minutes === 0) return 'Same day'
  if (minutes === 1440) return '1 day before'
  if (minutes === 2880) return '2 days before'
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60)
    return `${hours} hour${hours !== 1 ? 's' : ''} before`
  }
  return `${minutes} min before`
}

function storageKey(eventId, eventStart, leadMinutes) {
  return `baobun:notify:${eventId}:${eventStart}:${leadMinutes}`
}

function hasBeenNotified(key) {
  return localStorage.getItem(key) === '1'
}

function markNotified(key) {
  localStorage.setItem(key, '1')
}

function clearAllScheduled() {
  for (const timeoutId of scheduledTimers.values()) {
    clearTimeout(timeoutId)
  }
  scheduledTimers.clear()
}

function notifyEvent({ event, groupId, leadMinutes, dateFormat, timeFormat }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  const datePart = formatDateShort(event.start, dateFormat, true)
  const timePart = formatTime(event.start, timeFormat, true)
  const title = event.title || 'Upcoming event'
  const body = `${formatLeadTimeLabel(leadMinutes)} • ${datePart} ${timePart}`.trim()

  const n = new Notification(title, {
    body,
    tag: `event-${event.id}`,
    renotify: false,
    data: { url: groupId ? `/group/${groupId}` : '/' },
  })

  n.onclick = () => {
    window.focus()
    const target = n.data?.url || '/'
    window.location.assign(target)
  }
}

export function scheduleEventNotifications({
  events,
  groupId,
  leadMinutes = 15,
  enabled = false,
  permission = 'default',
  dateFormat = 'mdy',
  timeFormat = '12h',
}) {
  clearAllScheduled()

  if (!enabled || permission !== 'granted') return

  const now = Date.now()
  for (const event of events || []) {
    if (!event?.id || !event?.start) continue

    const eventStart = new Date(event.start).getTime()
    if (!Number.isFinite(eventStart)) continue

    const remindAt = eventStart - leadMinutes * 60 * 1000
    const delay = remindAt - now
    if (delay <= 0 || delay > MAX_TIMEOUT_MS) continue

    const key = storageKey(event.id, event.start, leadMinutes)
    if (hasBeenNotified(key)) continue

    const timeoutId = setTimeout(() => {
      notifyEvent({ event, groupId, leadMinutes, dateFormat, timeFormat })
      markNotified(key)
      scheduledTimers.delete(key)
    }, delay)

    scheduledTimers.set(key, timeoutId)
  }
}

export function clearScheduledEventNotifications() {
  clearAllScheduled()
}
