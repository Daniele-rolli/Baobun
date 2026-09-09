import { AppError } from '../errors.js'
import { ERROR_CODES } from '@baobun/shared'

export const errorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status)
  }
  console.error(err)
  return c.json({ error: { code: ERROR_CODES.internal, message: 'Something went wrong.' } }, 500)
}

export const notFoundHandler = (c) =>
  c.json({ error: { code: ERROR_CODES.notFound, message: 'Not found.' } }, 404)
