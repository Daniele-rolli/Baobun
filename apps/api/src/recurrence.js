const MAX_OCCURRENCES = 366
const MAX_HORIZON_MS = 2 * 365 * 24 * 60 * 60 * 1000

const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

const addMonthsClamped = (date, months) => {
  const next = new Date(date)
  const day = next.getUTCDate()
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)
  next.setUTCDate(Math.min(day, daysInMonth(next.getUTCFullYear(), next.getUTCMonth())))
  return next
}

const nextDate = (date, frequency, interval) => {
  if (frequency === 'MONTHLY') return addMonthsClamped(date, interval)
  const days = frequency === 'WEEKLY' ? interval * 7 : interval
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export const expandRecurrence = ({ start, end, recurrence }) => {
  if (!recurrence) return [{ start, end }]

  const duration = end.getTime() - start.getTime()
  const interval = recurrence.interval || 1
  const count = recurrence.count || MAX_OCCURRENCES
  const until = recurrence.until ? new Date(recurrence.until) : null
  const horizon = new Date(start.getTime() + MAX_HORIZON_MS)
  const occurrences = []
  let occurrenceStart = new Date(start)

  while (occurrences.length < Math.min(count, MAX_OCCURRENCES)) {
    if (occurrenceStart > horizon || (until && occurrenceStart > until)) break
    occurrences.push({
      start: occurrenceStart,
      end: new Date(occurrenceStart.getTime() + duration),
    })
    occurrenceStart =
      recurrence.frequency === 'MONTHLY'
        ? addMonthsClamped(start, occurrences.length * interval)
        : nextDate(occurrenceStart, recurrence.frequency, interval)
  }

  return occurrences
}
