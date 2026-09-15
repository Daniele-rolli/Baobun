import nodemailer from 'nodemailer'
import { config } from './config.js'

const DEBUG = config.mail.debug
const { sender, host, port, secure, rejectSelfSigned, user, password } = config.mail

export const parseSender = (sender) => {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(sender)
  if (match) return { name: match[1].trim(), address: match[2].trim() }
  return { name: '', address: sender.trim() }
}

const buildTransport = () => {
  if (DEBUG) {
    return nodemailer.createTransport({
      jsonTransport: true,
      logger: false,
      debug: false,
    })
  }
  if (!host) {
    throw new Error(
      'MAIL_HOST is not set. Configure SMTP (e.g. Gmail alias) or set MAIL_DEBUG=true for preview.',
    )
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    // ponytail: bounded so a dead SMTP server fails into the caller's .catch
    // instead of hanging the request until the client gives up
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: user ? { user, pass: password } : undefined,
    tls: { rejectUnauthorized: rejectSelfSigned },
  })
}

export const sendMail = async ({ to, subject, text = '', html = '' }) => {
  const transport = buildTransport()
  const from = parseSender(sender)
  try {
    const info = await transport.sendMail({ from, to, subject, text, html })
    if (DEBUG) {
      const preview =
        (typeof info.messageId === 'string' && info.message?.raw?.length) ||
        (info.message && Buffer.isBuffer(info.message)
          ? info.message.toString()
          : JSON.stringify(info.message ?? info))
      console.log('[mail] preview:', preview)
    }
  } finally {
    transport.close()
  }
}
