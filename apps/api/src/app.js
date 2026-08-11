import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import groupsRoutes from './routes/groups.js'
import eventsRoutes from './routes/events.js'
import tagsRoutes from './routes/tags.js'
import calendarFeedsRoutes from './routes/calendarFeeds.js'

export const app = new Hono()

const origins = config.webOrigin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  '*',
  cors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  }),
)

app.route('/api/auth', authRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/groups', groupsRoutes)
app.route('/api/events', eventsRoutes)
app.route('/api/tags', tagsRoutes)
app.route('/api/calendar-feeds', calendarFeedsRoutes)

app.notFound(notFoundHandler)
app.onError(errorHandler)
