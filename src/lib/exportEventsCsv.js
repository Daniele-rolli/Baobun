import { formatDateNumeric, formatTime } from '@/lib/dateTimePreferences'
import { data } from 'autoprefixer'

const normalizePeopleIds = (people) => {
  if (!Array.isArray(people)) return []
  return people
    .map((person) => {
      if (typeof person === 'string') return person
      if (person?.$id) return person.$id
      return ''
    })
    .filter(Boolean)
}

const csvEscape = (value) => {
  const stringValue = value == null ? '' : String(value)
  return `"${stringValue.replace(/"/g, '""')}"`
}

const sanitizeFileName = (value) =>
  String(value || 'events')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'events'

export const buildEventsCsvFileName = (label = 'events') => {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  return `${sanitizeFileName(label)}-${stamp}.csv`
}

export const downloadEventsCsv = ({
  events = [],
  tags = [],
  members = [],
  filename = buildEventsCsvFileName(),
  dateFormat = 'mdy',
  timeFormat = '12h',
}) => {
  if (!Array.isArray(events) || !events.length || typeof document === 'undefined') return false

  const tagNameById = Object.fromEntries(
    (tags || []).filter((tag) => tag?.$id).map((tag) => [tag.$id, tag.name || 'General']),
  )
  const memberNameById = {
    everyone: 'Everyone',
    ...Object.fromEntries(
      (members || [])
        .filter((member) => member?.$id)
        .map((member) => [member.$id, member.name || member.email || member.$id]),
    ),
  }

  const rows = [['Title', 'Start Date', 'End Date', 'People'].join(',')]

  for (const event of events) {
    const people = normalizePeopleIds(event?.people)
      .map((personId) => memberNameById[personId] || personId)
      .join('; ')

    rows.push(
      [
        event?.title || '',
        event?.start ? formatDateNumeric(event.start, dateFormat, true) : '',
        event?.end ? formatDateNumeric(event.end, dateFormat, true) : '',
        people,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return true
}
