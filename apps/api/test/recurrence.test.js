import { describe, expect, it } from 'vitest'
import { expandRecurrence } from '../src/recurrence.js'

describe('expandRecurrence', () => {
  it('creates a bounded weekly series while preserving duration', () => {
    const start = new Date('2026-01-05T09:00:00.000Z')
    const end = new Date('2026-01-05T10:30:00.000Z')
    const occurrences = expandRecurrence({
      start,
      end,
      recurrence: { frequency: 'WEEKLY', interval: 2, count: 3 },
    })
    expect(occurrences.map((item) => item.start.toISOString())).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
      '2026-02-02T09:00:00.000Z',
    ])
    expect(occurrences[2].end.getTime() - occurrences[2].start.getTime()).toBe(90 * 60 * 1000)
  })

  it('clamps monthly events to the last day of shorter months', () => {
    const occurrences = expandRecurrence({
      start: new Date('2026-01-31T09:00:00.000Z'),
      end: new Date('2026-01-31T10:00:00.000Z'),
      recurrence: { frequency: 'MONTHLY', interval: 1, count: 3 },
    })
    expect(occurrences.map((item) => item.start.toISOString())).toEqual([
      '2026-01-31T09:00:00.000Z',
      '2026-02-28T09:00:00.000Z',
      '2026-03-31T09:00:00.000Z',
    ])
  })
})
