import { prisma } from './db.js'
import { sendMail } from './mail.js'
import { config } from './config.js'

const LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000
const POLL_INTERVAL_MS = 60 * 1000

const recipientEmails = (event) => {
  const people = Array.isArray(event.people) ? event.people : []
  if (people.includes('everyone')) return event.group.members.map((member) => member.email)
  if (people.length) {
    const selected = new Set(people)
    return event.group.members
      .filter((member) => selected.has(member.id))
      .map((member) => member.email)
  }
  return [event.user.email]
}

export const sendDueReminders = async (now = new Date()) => {
  const candidates = await prisma.event.findMany({
    where: {
      reminderMinutes: { not: null },
      remindedAt: null,
      start: {
        gt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        lte: new Date(now.getTime() + LOOKAHEAD_MS),
      },
    },
    include: {
      user: true,
      group: { include: { members: true } },
    },
  })

  let sent = 0
  for (const event of candidates) {
    const dueAt = new Date(event.start.getTime() - event.reminderMinutes * 60 * 1000)
    if (dueAt > now) continue

    const claimed = await prisma.event.updateMany({
      where: { id: event.id, remindedAt: null },
      data: { remindedAt: now },
    })
    if (claimed.count !== 1) continue

    const emails = [...new Set(recipientEmails(event).filter(Boolean))]
    const eventUrl = config.publicUrl
      ? `${config.publicUrl.replace(/\/$/, '')}/group/${event.groupId}`
      : ''
    const when = event.start.toLocaleString()
    const results = await Promise.allSettled(
      emails.map((to) =>
        sendMail({
          to,
          subject: `Reminder: ${event.title}`,
          text: `${event.title} starts ${when}.${event.notes ? `\n\n${event.notes}` : ''}${
            eventUrl ? `\n\nOpen Baobun: ${eventUrl}` : ''
          }`,
        }),
      ),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[reminders] send failed:', result.reason)
      }
    }
    sent += 1
  }
  return sent
}

export const startReminderWorker = () => {
  let running = false
  const run = async () => {
    // A slow poll (e.g. slow SMTP) must not overlap the next 60s tick.
    if (running) return
    running = true
    try {
      await sendDueReminders()
    } catch (error) {
      console.error('[reminders] worker failed:', error)
    } finally {
      running = false
    }
  }
  run()
  const timer = setInterval(run, POLL_INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}
