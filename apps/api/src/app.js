import { Hono } from 'hono'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import groupsRoutes from './routes/groups.js'
import eventsRoutes from './routes/events.js'
import tagsRoutes from './routes/tags.js'
import calendarFeedsRoutes from './routes/calendarFeeds.js'
import filesRoutes from './routes/files.js'
import tokensRoutes from './routes/tokens.js'
import publicApiRoutes from './routes/publicApi.js'
import { serveStaticApp } from './staticApp.js'

export const app = new Hono()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/auth', authRoutes)
app.route('/api/files', filesRoutes)
app.route('/api/tokens', tokensRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/groups', groupsRoutes)
app.route('/api/events', eventsRoutes)
app.route('/api/tags', tagsRoutes)
app.route('/api/calendar-feeds', calendarFeedsRoutes)
app.route('/api/v1', publicApiRoutes)
app.route('/feeds/calendar-feeds', calendarFeedsRoutes)

app.get('*', serveStaticApp)
app.notFound(notFoundHandler)
app.onError(errorHandler)
