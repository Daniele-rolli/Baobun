import { describe, it, expect } from 'vitest'
import { getLiveFeedFileId } from '@baobun/shared'

describe('getLiveFeedFileId', () => {
  it('is stable and deterministic', () => {
    expect(getLiveFeedFileId({ groupId: 'ABC123', userId: 'user_1' })).toBe(
      getLiveFeedFileId({ groupId: 'ABC123', userId: 'user_1' }),
    )
    expect(getLiveFeedFileId({ groupId: 'ABC123', userId: 'user_1' })).toMatch(
      /^cal-feed-abc123-user_1-/,
    )
  })
})
