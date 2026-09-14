export {
  buildIcsContent,
  buildCalendarFileName,
  buildEventDetailsText,
  escapeIcs,
  toUtcIcsDate,
} from './ics.js'

export const SESSION_COOKIE = 'baobun_sid'

export const ERROR_CODES = {
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  validation: 'validation_error',
  conflict: 'conflict',
  passwordSetRequired: 'password_set_required',
  rateLimited: 'rate_limited',
  internal: 'internal',
}
