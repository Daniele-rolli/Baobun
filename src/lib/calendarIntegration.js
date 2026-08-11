const pad2 = (value) => String(value).padStart(2, '0')

const toDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const escapeIcs = (value = '') =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

const toUtcIcsDate = (value) => {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(
    date.getUTCHours(),
  )}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
}

const sanitizeFilePart = (value = 'calendar') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'calendar'

const normalizeTagId = (tagId) => {
  if (Array.isArray(tagId)) return tagId[0]
  if (typeof tagId === 'object' && tagId?.$id) return tagId.$id
  return tagId
}

const normalizePeople = (people) => {
  if (!Array.isArray(people)) return []
  return people
    .map((person) => {
      if (typeof person === 'string') return person
      if (person?.$id) return person.$id
      return ''
    })
    .filter(Boolean)
}

const normalizeLookup = (value) => (value && typeof value === 'object' ? value : {})

export const buildEventDetailsText = (event, { tagNameById = {}, memberNameById = {} } = {}) => {
  if (!event) return ''

  const tagsLookup = normalizeLookup(tagNameById)
  const membersLookup = normalizeLookup(memberNameById)

  const subjectId = normalizeTagId(event.tagId)
  const subjectLabel = subjectId ? tagsLookup[subjectId] || String(subjectId) : ''

  const peopleIds = normalizePeople(event.people)
  const peopleLabels = peopleIds.map((id) => membersLookup[id] || id)
  const hasEveryone = peopleIds.includes('everyone')
  const audience = hasEveryone
    ? 'Everyone'
    : peopleLabels.length
      ? peopleLabels.join(', ')
      : 'Everyone'

  const lines = []
  if (subjectLabel) lines.push(`Subject: ${subjectLabel}`)
  if (audience) lines.push(`People: ${audience}`)
  if (event.notes) lines.push('', `Notes: ${event.notes}`)

  return lines.join('\n').trim()
}

export const buildIcsContent = ({
  calendarName = 'Baobun',
  events = [],
  tagNameById = {},
  memberNameById = {},
}) => {
  const nowStamp = toUtcIcsDate(new Date())
  const validEvents = [...(events || [])]
    .filter((event) => event?.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Baobun//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ]

  validEvents.forEach((event, index) => {
    const startDate = toDate(event.start)
    if (!startDate) return

    const endDate = toDate(event.end) || new Date(startDate.getTime() + 60 * 60 * 1000)
    const uidBase = event.$id || `${startDate.getTime()}-${index}`
    const summary = event.title || 'Event'
    const description = buildEventDetailsText(event, { tagNameById, memberNameById })

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(uidBase)}@baobun`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${toUtcIcsDate(startDate)}`,
      `DTEND:${toUtcIcsDate(endDate)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export const downloadIcsFile = ({
  fileName = 'baobun-calendar.ics',
  calendarName,
  events,
  tagNameById = {},
  memberNameById = {},
}) => {
  const payload = buildIcsContent({ calendarName, events, tagNameById, memberNameById })
  const blob = new Blob([payload], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

export const buildCalendarFileName = (groupName = 'calendar') => {
  const safeName = sanitizeFilePart(groupName)
  return `baobun-${safeName}.ics`
}

export const buildGoogleCalendarUrl = (event, { tagNameById = {}, memberNameById = {} } = {}) => {
  if (!event?.start) return ''
  const startDate = toDate(event.start)
  if (!startDate) return ''

  const endDate = toDate(event.end) || new Date(startDate.getTime() + 60 * 60 * 1000)
  const details = buildEventDetailsText(event, { tagNameById, memberNameById })
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Event',
    details,
    dates: `${toUtcIcsDate(startDate)}/${toUtcIcsDate(endDate)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
