const unescapeText = (value = '') =>
  value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

const parseIcsDate = (value) => {
  const clean = value.trim()
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/)
  if (!match) return null
  const [, year, month, day, hour = '00', minute = '00', second = '00', utc] = match
  const args = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ]
  const date = utc ? new Date(Date.UTC(...args)) : new Date(...args)
  return Number.isNaN(date.getTime()) ? null : date
}

const parseRule = (value) => {
  const entries = Object.fromEntries(
    value
      .split(';')
      .map((part) => part.split('='))
      .filter(([key, item]) => key && item),
  )
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(entries.FREQ)) return null
  const recurrence = {
    frequency: entries.FREQ,
    interval: Math.max(1, Number(entries.INTERVAL) || 1),
  }
  if (entries.COUNT) recurrence.count = Math.min(366, Math.max(1, Number(entries.COUNT) || 1))
  if (entries.UNTIL) {
    const until = parseIcsDate(entries.UNTIL)
    if (until) recurrence.until = until.toISOString()
  }
  return recurrence.count || recurrence.until ? recurrence : null
}

export const parseIcsEvents = (source) => {
  const lines = String(source)
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r/g, '')
    .split('\n')
  const events = []
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current?.title && current.start) {
        const end =
          current.end && current.end > current.start
            ? current.end
            : new Date(current.start.getTime() + 60 * 60 * 1000)
        events.push({ ...current, end })
      }
      current = null
      continue
    }
    if (!current) continue

    const separator = line.indexOf(':')
    if (separator < 0) continue
    const property = line.slice(0, separator).split(';')[0].toUpperCase()
    const value = line.slice(separator + 1)
    if (property === 'UID') current.uid = value.trim()
    if (property === 'SUMMARY') current.title = unescapeText(value).trim()
    if (property === 'DESCRIPTION') current.notes = unescapeText(value)
    if (property === 'DTSTART') current.start = parseIcsDate(value)
    if (property === 'DTEND') current.end = parseIcsDate(value)
    if (property === 'RRULE') current.recurrence = parseRule(value)
  }

  return events
}
