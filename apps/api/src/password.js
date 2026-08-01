import { hash, verify } from '@node-rs/argon2'
import { validationError } from './errors.js'

export const MIN_PASSWORD_LENGTH = 8

const hashOptions = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export const hashPassword = (password) => hash(password, hashOptions)

export const verifyPassword = (password, passwordHash) => verify(passwordHash, password)

export const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw validationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
}
