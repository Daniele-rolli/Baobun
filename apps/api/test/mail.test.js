import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('mail', () => {
  it('parseSender splits name and address', async () => {
    const { parseSender } = await import('../src/mail.js')
    expect(parseSender('Baobun <no-reply@x.com>')).toEqual({
      name: 'Baobun',
      address: 'no-reply@x.com',
    })
    expect(parseSender('no-reply@x.com')).toEqual({ name: '', address: 'no-reply@x.com' })
  })

  it('logs a preview and does not throw in debug mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { sendMail } = await import('../src/mail.js')
    await sendMail({ to: 'a@b.co', subject: 'Hi', text: 'body' })
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[mail] preview:'), expect.anything())
    logSpy.mockRestore()
  })
})
