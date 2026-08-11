const toDate = (value) => (value instanceof Date ? new Date(value) : new Date(value))

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime())

export const startOfLocalDay = (value) => {
  const date = toDate(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export const addDays = (value, days) => {
  const date = toDate(value)
  date.setDate(date.getDate() + days)
  return date
}

export const getEventRange = (event) => {
  const start = toDate(event?.start)
  if (!isValidDate(start)) return null

  const rawEnd = toDate(event?.end)
  const end =
    isValidDate(rawEnd) && rawEnd.getTime() > start.getTime()
      ? rawEnd
      : new Date(start.getTime() + 60 * 60 * 1000)

  return { start, end }
}

export const eventOccursOnDate = (event, date) => {
  const range = getEventRange(event)
  if (!range) return false

  const dayStart = startOfLocalDay(date)
  const nextDayStart = addDays(dayStart, 1)

  return range.start < nextDayStart && range.end > dayStart
}

export const eventEndsOnOrAfterDate = (event, date) => {
  const range = getEventRange(event)
  if (!range) return false
  return range.end > startOfLocalDay(date)
}

export const getEventSegmentForDate = (event, date) => {
  const range = getEventRange(event)
  if (!range) return null

  const dayStart = startOfLocalDay(date)
  const nextDayStart = addDays(dayStart, 1)
  const start = new Date(Math.max(range.start.getTime(), dayStart.getTime()))
  const end = new Date(Math.min(range.end.getTime(), nextDayStart.getTime()))

  if (start >= end) return null

  return { start, end }
}

export const eventSpansMultipleDates = (event) => {
  const range = getEventRange(event)
  if (!range) return false

  const inclusiveEnd = new Date(range.end.getTime() - 1)
  return startOfLocalDay(range.start).getTime() !== startOfLocalDay(inclusiveEnd).getTime()
}
