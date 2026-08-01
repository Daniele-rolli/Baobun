const normalizeGroupId = (groupId = '') =>
  String(groupId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')

const stableHash = (value = '') => {
  let hash = 0
  const input = String(value)
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export const getLiveFeedFileId = ({ groupId, userId = '' } = {}) => {
  const groupPart = normalizeGroupId(groupId).slice(0, 10) || 'group'
  const userPart = normalizeGroupId(userId).slice(0, 8) || 'all'
  const hash = stableHash(`${groupId}:${userId}`).slice(0, 10)
  return `cal-feed-${groupPart}-${userPart}-${hash}`.slice(0, 36)
}

export { normalizeGroupId, stableHash }
