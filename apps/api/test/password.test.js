import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, validatePassword } from '../src/password.js'
import { AppError } from '../src/errors.js'

describe('password', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toContain('correct')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('rejects short passwords', () => {
    expect(() => validatePassword('short')).toThrow(AppError)
    expect(() => validatePassword('longenough')).not.toThrow()
  })
})
