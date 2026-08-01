import { ERROR_CODES } from '@baobun/shared'

export class AppError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const notFound = (msg = 'Not found.') => new AppError(404, ERROR_CODES.notFound, msg)
export const forbidden = (msg = 'Forbidden.') => new AppError(403, ERROR_CODES.forbidden, msg)
export const unauthorized = (msg = 'Unauthorized.') =>
  new AppError(401, ERROR_CODES.unauthorized, msg)
export const conflict = (msg = 'Conflict.') => new AppError(409, ERROR_CODES.conflict, msg)
export const validationError = (msg = 'Invalid input.') =>
  new AppError(400, ERROR_CODES.validation, msg)
