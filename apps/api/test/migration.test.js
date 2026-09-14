import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
let server
let endpoint

const collectionNames = new Set(['users', 'groups', 'members', 'events', 'tags'])
const queryValue = (url, method) =>
  url.searchParams
    .getAll('queries[]')
    .map((query) => JSON.parse(query))
    .find((query) => query.method === method)?.values?.[0]

describe('Appwrite migration', () => {
  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost')
      response.setHeader('content-type', 'application/json')

      if (/\/collections\/[^/]+$/.test(url.pathname)) {
        response.end(JSON.stringify({ $id: url.pathname.split('/').at(-1) }))
        return
      }

      if (url.pathname === '/v1/users') {
        response.end(
          JSON.stringify({
            users: queryValue(url, 'offset') === 0
              ? [{ $id: 'user-1', email: 'user@example.com', name: 'User' }]
              : [],
          }),
        )
        return
      }

      const collection = [...collectionNames].find((name) =>
        url.pathname.endsWith(`/collections/${name}/documents`),
      )
      if (collection) {
        const documents =
          queryValue(url, 'offset') === 0
            ? [{ $id: `${collection}-1`, name: collection, start: '2026-01-01T10:00:00Z' }]
            : []
        response.end(JSON.stringify({ documents }))
        return
      }

      response.statusCode = 404
      response.end(JSON.stringify({ message: 'Not found' }))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    endpoint = `http://127.0.0.1:${server.address().port}/v1`
  })

  afterAll(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))))

  it('paginates every collection and includes events in a dry run', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['scripts/migrate-from-appwrite.js', '--dry-run'],
      {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://baobun:baobun@127.0.0.1:59999/baobun',
          APPWRITE_ENDPOINT: endpoint,
          APPWRITE_PROJECT_ID: 'project',
          APPWRITE_API_KEY: 'key',
          APPWRITE_DB_ID: 'database',
          APPWRITE_USERS_COLLECTION: 'users',
          APPWRITE_GROUPS_COLLECTION: 'groups',
          APPWRITE_MEMBERS_COLLECTION: 'members',
          APPWRITE_EVENTS_COLLECTION: 'events',
          APPWRITE_TAGS_COLLECTION: 'tags',
          APPWRITE_AVATAR_BUCKET: 'avatars',
          APPWRITE_TAG_ICONS_BUCKET: 'tag-icons',
          APPWRITE_CALENDAR_FEEDS_BUCKET: 'feeds',
        },
      },
    )

    expect(stdout).toContain('users=1 groups=1 members=1 events=1 tags=1')
  })
})
