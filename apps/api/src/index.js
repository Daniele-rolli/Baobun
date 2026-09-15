import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './config.js'
import { ensureStorage } from './storage.js'
import { startReminderWorker } from './reminders.js'

await ensureStorage().catch((err) => {
  console.error('Failed to initialize storage:', err)
  process.exit(1)
})

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
  // Non-secret effective config — makes stale .env (compose doesn't recreate
  // on env change) visible at a glance. Never log passwords or API keys here.
  console.log(
    `[config] publicUrl=${config.publicUrl} mail.debug=${config.mail.debug} mail.sender=${config.mail.sender} mail.host=${config.mail.host || '(unset)'} mail.port=${config.mail.port} mail.secure=${config.mail.secure} mail.user=${config.mail.user || '(unset)'}`,
  )
  startReminderWorker()
})
