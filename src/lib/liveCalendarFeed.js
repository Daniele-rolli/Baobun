import * as feedService from '@/lib/services/calendarFeed'

export const getLiveFeedUrls = async ({ groupId, userId = 'all' } = {}) => {
  if (!groupId) return { httpsUrl: '', webcalUrl: '' }
  try {
    const res = await feedService.getUrl(groupId, userId || 'all')
    return res
  } catch {
    return { httpsUrl: '', webcalUrl: '' }
  }
}

export const publishLiveCalendarFeed = async ({ groupId, userId = 'all' } = {}) => {
  if (!groupId) throw new Error('Missing group id.')
  return await feedService.publish(groupId, userId || 'all')
}
