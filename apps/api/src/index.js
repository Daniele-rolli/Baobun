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
  startReminderWorker()
})
