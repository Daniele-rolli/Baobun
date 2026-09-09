import { describe, expect, it } from 'vitest'
import { parseIcsEvents } from '../src/icsImport.js'

describe('parseIcsEvents', () => {
  it('parses folded text, UTC dates, and supported recurrence rules', () => {
    const events = parseIcsEvents(
      [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:event-1',
        'DTSTART:20260105T090000Z',
        'DTEND:20260105T100000Z',
        'SUMMARY:Team sync',
        'DESCRIPTION:First line\\nSecond line',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      uid: 'event-1',
      title: 'Team sync',
      notes: 'First line\nSecond line',
      recurrence: { frequency: 'WEEKLY', interval: 1, count: 4 },
    })
    expect(events[0].start.toISOString()).toBe('2026-01-05T09:00:00.000Z')
  })
})
