export const WEEKDAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad2 = (n) => String(n).padStart(2, '0')

const toDate = (value) => (value instanceof Date ? new Date(value) : new Date(value))

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime())

export const rotateWeekdayLabels = (weekStartsOn = 0) => {
  const normalized = ((Number(weekStartsOn) % 7) + 7) % 7
  return [...WEEKDAY_LABELS_SHORT.slice(normalized), ...WEEKDAY_LABELS_SHORT.slice(0, normalized)]
}

export const formatDateShort = (value, dateFormat = 'mdy', includeYear = false) => {
  const date = toDate(value)
  if (!isValidDate(date)) return ''

  const day = date.getDate()
  const month = date.getMonth() + 1
  const monthShort = date.toLocaleDateString('en-US', { month: 'short' })
  const year = date.getFullYear()

  if (dateFormat === 'dmy') {
    return includeYear ? `${day} ${monthShort} ${year}` : `${day} ${monthShort}`
  }

  if (dateFormat === 'ymd') {
    return includeYear ? `${year}-${pad2(month)}-${pad2(day)}` : `${pad2(month)}-${pad2(day)}`
  }

  return includeYear ? `${monthShort} ${day}, ${year}` : `${monthShort} ${day}`
}

export const formatDateNumeric = (value, dateFormat = 'mdy', includeYear = true) => {
  const date = toDate(value)
  if (!isValidDate(date)) return ''

  const day = pad2(date.getDate())
  const month = pad2(date.getMonth() + 1)
  const year = date.getFullYear()

  if (dateFormat === 'dmy') {
    return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`
  }

  if (dateFormat === 'ymd') {
    return includeYear ? `${year}-${month}-${day}` : `${month}-${day}`
  }

  return includeYear ? `${month}/${day}/${year}` : `${month}/${day}`
}

export const formatMonthYear = (value, dateFormat = 'mdy') => {
  const date = toDate(value)
  if (!isValidDate(date)) return ''

  if (dateFormat === 'ymd') {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export const formatTime = (value, timeFormat = '12h', includeMinutes = true) => {
  const date = toDate(value)
  if (!isValidDate(date)) return ''

  const opts = includeMinutes
    ? { hour: 'numeric', minute: '2-digit', hour12: timeFormat !== '24h' }
    : { hour: 'numeric', hour12: timeFormat !== '24h' }

  return date.toLocaleTimeString([], opts)
}

export const formatHourLabel = (hour, timeFormat = '12h') => {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return formatTime(d, timeFormat, timeFormat === '24h')
}
