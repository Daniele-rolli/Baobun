import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './config.js'
import { ensureBuckets } from './s3.js'
import { startReminderWorker } from './reminders.js'

await ensureBuckets().catch((err) => {
  console.error('Failed to ensure buckets:', err)
  process.exit(1)
})

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
  startReminderWorker()
})
