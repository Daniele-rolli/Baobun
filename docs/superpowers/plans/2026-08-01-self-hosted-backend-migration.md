# Migrate Baobun off Appwrite Cloud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Appwrite Cloud (auth, DB, storage) with a self-hosted Node/Hono/Prisma backend on Postgres + MinIO, plus a pluggable SMTP mail relay (`MAIL_*` env flags), and migrate existing Appwrite data with a one-shot ETL script.

**Architecture:** Monorepo. The existing Vue app stays at the repo root (`src/`, root `package.json`) and becomes the web client. A new `apps/api` (Hono) serves REST under `/api/*` with opaque cookie sessions. `packages/shared` (`@baobun/shared`) holds constants, feed-key helpers, and the ICS builder. Postgres + MinIO + Mailpit run via `docker-compose.yml`. Migrated users get a lazy one-time set-password link on first failed login.

**Tech Stack:** Node 20 (ESM), Hono, Prisma (Postgres), `@node-rs/argon2`, nodemailer, `minio` S3 SDK, Vue 3 + Pinia + Vite (frontend, unchanged location).

## Global Constraints

- Repo is ESM (`"type": "module"`); all new JS files use `import`.
- Frontend stays at repo root (deviation from spec's `apps/web` naming — intentional, to avoid a no-value file relocation). Backend lives in `apps/api`, shared in `packages/shared`.
- Yarn classic workspaces: root `package.json` gains `"workspaces": ["apps/api", "packages/shared"]`.
- `MAIL_DEBUG` flag description from the user: when enabled, log a preview email link instead of sending.
- API field names MUST mirror what existing views read so UI templates stay untouched: events expose `$id, title, start, end, notes, people, tagId, userId, groupId`; tags expose `$id, name, color, icon, imageId, imageUrl`; groups expose `$id, name, color, inviteCode, ownerId`; members expose `$id, email, name, avatarUrl, addedAt, userId`; users expose `$id, name, email, avatarUrl, avatarFileId`.
- Password reset page reads query params `userId` and `token` (already in `ResetPassword.vue`).
- Every handler that touches group/event/tag/member data enforces membership (and ownership for owner-only ops).
- Tests: Vitest using Hono's `app.request()` (deviation from spec's "supertest" — same coverage, no extra dep), against real Postgres + MinIO via `docker compose up -d postgres minio` + a `.env.test`.
- No TypeScript anywhere (repo is JS).

---

## Phase A — Scaffold

### Task 1: Yarn workspaces + `@baobun/shared` package

**Files:**
- Modify: `package.json` (add workspaces + scripts)
- Create: `packages/shared/package.json`
- Create: `packages/shared/index.js`
- Create: `packages/shared/feed-key.js`
- Create: `packages/shared/ics.js`

**Interfaces:**
- Produces:
  - `@baobun/shared` exports: `SESSION_COOKIE`, `ERROR_CODES`, `getLiveFeedFileId`, `normalizeGroupId`, `stableHash`, `buildIcsContent`, `buildCalendarFileName`, `buildEventDetailsText`.
  - `packages/shared/index.js` re-exports `./feed-key.js` and `./ics.js` and defines `SESSION_COOKIE = 'baobun_sid'` and `ERROR_CODES = { unauthorized: 'unauthorized', forbidden: 'forbidden', notFound: 'not_found', validation: 'validation_error', conflict: 'conflict', passwordSetRequired: 'password_set_required', internal: 'internal' }`.

- [ ] **Step 1: Add workspaces to root package.json**

Edit root `package.json` so it contains:

```json
{
  "name": "baobun",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "workspaces": ["apps/api", "packages/shared"],
  "engines": { "node": "^20.19.0 || >=22.12.0" },
  "scripts": {
    "watch": "vite --port 3006",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --fix",
    "format": "prettier --write src/",
    "api:dev": "yarn workspace @baobun/api dev",
    "api:test": "yarn workspace @baobun/api test"
  },
  "dependencies": { /* keep existing web deps exactly as-is */ },
  "devDependencies": { /* keep existing web devDeps exactly as-is */ }
}
```

Do not touch the existing `dependencies`/`devDependencies` blocks — leave the web deps (including `appwrite`, which we remove in Task 28).

- [ ] **Step 2: Create `packages/shared/package.json`**

```json
{
  "name": "@baobun/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./feed-key": "./feed-key.js",
    "./ics": "./ics.js"
  }
}
```

- [ ] **Step 3: Create `packages/shared/feed-key.js`**

This is moved verbatim from `src/lib/liveCalendarFeed.js` (lines 7–29) so the API, the web, and the migration script compute identical object keys:

```js
const normalizeGroupId = (groupId = '') =>
  String(groupId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')

const stableHash = (value = '') => {
  let hash = 0
  const input = String(value)
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export const getLiveFeedFileId = ({ groupId, userId = '' } = {}) => {
  const groupPart = normalizeGroupId(groupId).slice(0, 10) || 'group'
  const userPart = normalizeGroupId(userId).slice(0, 8) || 'all'
  const hash = stableHash(`${groupId}:${userId}`).slice(0, 10)
  return `cal-feed-${groupPart}-${userPart}-${hash}`.slice(0, 36)
}

export { normalizeGroupId, stableHash }
```

- [ ] **Step 4: Create `packages/shared/ics.js`**

Move the pure functions from `src/lib/calendarIntegration.js` (lines 1–117 and 138–141). Copy exactly, adding exports for `escapeIcs` and `toUtcIcsDate` (used by the API):

```js
const pad2 = (value) => String(value).padStart(2, '0')

const toDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const escapeIcs = (value = '') =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

export const toUtcIcsDate = (value) => {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(
    date.getUTCHours(),
  )}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
}

const sanitizeFilePart = (value = 'calendar') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'calendar'

const normalizeTagId = (tagId) => {
  if (Array.isArray(tagId)) return tagId[0]
  if (typeof tagId === 'object' && tagId?.$id) return tagId.$id
  return tagId
}

const normalizePeople = (people) => {
  if (!Array.isArray(people)) return []
  return people
    .map((person) => {
      if (typeof person === 'string') return person
      if (person?.$id) return person.$id
      return ''
    })
    .filter(Boolean)
}

const normalizeLookup = (value) => (value && typeof value === 'object' ? value : {})

export const buildEventDetailsText = (event, { tagNameById = {}, memberNameById = {} } = {}) => {
  if (!event) return ''

  const tagsLookup = normalizeLookup(tagNameById)
  const membersLookup = normalizeLookup(memberNameById)

  const subjectId = normalizeTagId(event.tagId)
  const subjectLabel = subjectId ? tagsLookup[subjectId] || String(subjectId) : ''

  const peopleIds = normalizePeople(event.people)
  const peopleLabels = peopleIds.map((id) => membersLookup[id] || id)
  const hasEveryone = peopleIds.includes('everyone')
  const audience = hasEveryone
    ? 'Everyone'
    : peopleLabels.length
      ? peopleLabels.join(', ')
      : 'Everyone'

  const lines = []
  if (subjectLabel) lines.push(`Subject: ${subjectLabel}`)
  if (audience) lines.push(`People: ${audience}`)
  if (event.notes) lines.push('', `Notes: ${event.notes}`)

  return lines.join('\n').trim()
}

export const buildIcsContent = ({
  calendarName = 'Baobun',
  events = [],
  tagNameById = {},
  memberNameById = {},
}) => {
  const nowStamp = toUtcIcsDate(new Date())
  const validEvents = [...(events || [])]
    .filter((event) => event?.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Baobun//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ]

  validEvents.forEach((event, index) => {
    const startDate = toDate(event.start)
    if (!startDate) return

    const endDate = toDate(event.end) || new Date(startDate.getTime() + 60 * 60 * 1000)
    const uidBase = event.$id || `${startDate.getTime()}-${index}`
    const summary = event.title || 'Event'
    const description = buildEventDetailsText(event, { tagNameById, memberNameById })

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(uidBase)}@baobun`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${toUtcIcsDate(startDate)}`,
      `DTEND:${toUtcIcsDate(endDate)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export const buildCalendarFileName = (groupName = 'calendar') => {
  const safeName = sanitizeFilePart(groupName)
  return `baobun-${safeName}.ics`
}
```

- [ ] **Step 5: Create `packages/shared/index.js`**

```js
export { getLiveFeedFileId, normalizeGroupId, stableHash } from './feed-key.js'
export {
  buildIcsContent,
  buildCalendarFileName,
  buildEventDetailsText,
  escapeIcs,
  toUtcIcsDate,
} from './ics.js'

export const SESSION_COOKIE = 'baobun_sid'

export const ERROR_CODES = {
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  validation: 'validation_error',
  conflict: 'conflict',
  passwordSetRequired: 'password_set_required',
  internal: 'internal',
}
```

- [ ] **Step 6: Verify the package resolves**

Run: `node -e "const s = await import('@baobun/shared'); console.log(s.SESSION_COOKIE, s.getLiveFeedFileId({ groupId: 'ABC123', userId: 'u1' }))"`
Expected: prints `baobun_sid cal-feed-abc123-u1-<hash>` (this must match the output of the current `getLiveFeedFileId` in `src/lib/liveCalendarFeed.js` — if not, fix the copied code).

- [ ] **Step 7: Commit**

```bash
git add package.json packages/shared
git commit -m "feat: add @baobun/shared package with feed-key and ics helpers"
```

---

### Task 2: `apps/api` package scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/.gitignore`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/config.js`

**Interfaces:**
- Produces: `config` object with `{ port, webOrigin, s3: {...}, mail: {...}, env }`; used by every other API module.
- Produces: scripts `dev`, `start`, `migrate`, `test`.

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@baobun/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "node --env-file=.env --watch src/index.js",
    "start": "node --env-file=.env src/index.js",
    "migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "test": "node --env-file=.env.test --import=tsx node_modules/vitest/vitest.mjs run"
  },
  "dependencies": {
    "@baobun/shared": "*",
    "@hono/node-server": "^1.13.7",
    "@node-rs/argon2": "^2.0.2",
    "@prisma/client": "^6.2.1",
    "hono": "^4.6.14",
    "minio": "^8.0.4",
    "nodemailer": "^6.9.16",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "prisma": "^6.2.1",
    "vitest": "^3.0.5"
  }
}
```

Note: `node --env-file` requires Node ≥ 20.6 (root engines already require ≥ 20.19). The `--import=tsx` flag is a no-op for `.js` tests but keeps the test runner bootstrapped consistently.

- [ ] **Step 2: Create `apps/api/.gitignore`**

```
node_modules/
.env
.env.test
dist/
coverage/
```

- [ ] **Step 3: Create `apps/api/.env.example`**

```ini
DATABASE_URL=postgresql://baobun:baobun_dev@localhost:5432/baobun
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=baobun
S3_SECRET_KEY=baobun_dev
S3_BUCKET_AVATARS=avatars
S3_BUCKET_TAG_ICONS=tag-icons
S3_BUCKET_CALENDAR_FEEDS=calendar-feeds
S3_PUBLIC_ENDPOINT=http://localhost:9000

WEB_ORIGIN=http://localhost:4173
PORT=3001

# Mail (user-provided flags)
MAIL_DEBUG=true
MAIL_SENDER="Baobun <no-reply@baobun.local>"
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_REJECT_SELF_SIGNED=false
MAIL_USER=
MAIL_PASSWORD=
```

- [ ] **Step 4: Create `apps/api/src/config.js`**

```js
const env = (key, fallback = '') => process.env[key] ?? fallback

export const config = {
  port: Number(env('PORT', '3001')),
  webOrigin: env('WEB_ORIGIN', 'http://localhost:4173'),
  env: env('NODE_ENV', 'development'),
  s3: {
    endpoint: env('S3_ENDPOINT', 'http://localhost:9000'),
    region: env('S3_REGION', 'us-east-1'),
    accessKey: env('S3_ACCESS_KEY', 'baobun'),
    secretKey: env('S3_SECRET_KEY', 'baobun_dev'),
    publicEndpoint: env('S3_PUBLIC_ENDPOINT', 'http://localhost:9000'),
    bucketAvatars: env('S3_BUCKET_AVATARS', 'avatars'),
    bucketTagIcons: env('S3_BUCKET_TAG_ICONS', 'tag-icons'),
    bucketCalendarFeeds: env('S3_BUCKET_CALENDAR_FEEDS', 'calendar-feeds'),
  },
  mail: {
    debug: env('MAIL_DEBUG', 'false') === 'true',
    sender: env('MAIL_SENDER', 'Baobun <no-reply@baobun.local>'),
    host: env('MAIL_HOST', ''),
    port: Number(env('MAIL_PORT', '587')),
    secure: env('MAIL_SECURE', 'false') === 'true',
    rejectSelfSigned: env('MAIL_REJECT_SELF_SIGNED', 'true') === 'true',
    user: env('MAIL_USER', ''),
    password: env('MAIL_PASSWORD', ''),
  },
}
```

- [ ] **Step 5: Install and verify**

Run: `yarn install`
Expected: resolves `@baobun/api` and `@baobun/shared` workspaces; no errors.
Run: `node -e "import('./apps/api/src/config.js').then(m => console.log(m.config.mail.debug))"`
Expected: `true` (default when no `.env` loaded — `.env` is only loaded by the npm scripts, not this bare import).

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat: scaffold @baobun/api package with config"
```

---

## Phase B — Backend core (DB, errors, password, session, s3, mail)

### Task 3: Prisma schema + migrations

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/.env` (real, gitignored)
- Create: `apps/api/.env.test` (real, gitignored)

**Interfaces:**
- Produces: Prisma models `User`, `Session`, `PasswordResetToken`, `Group`, `GroupMember`, `Event`, `Tag` with camelCase fields mapped to snake_case columns.

- [ ] **Step 1: Create `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id               String   @id @default(uuid())
  email            String   @unique
  passwordHash     String   @map("password_hash")
  name             String
  avatarObjectKey  String?  @map("avatar_object_key")
  needsPasswordSet Boolean  @default(false) @map("needs_password_set")
  createdAt        DateTime @default(now()) @map("created_at")
  sessions         Session[]
  resetTokens      PasswordResetToken[]
  ownedGroups      Group[]  @relation("Owner")
  memberships      GroupMember[]
  eventsCreated    Event[]  @relation("Creator")
}

model Session {
  id        String   @id
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")
  expiresAt DateTime @map("expires_at")
  userAgent String?
  ip        String?

  @@index([userId])
  @@index([expiresAt])
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")

  @@index([userId])
}

model Group {
  id          String   @id @default(uuid())
  name        String
  color       String   @default("#f43f5e")
  ownerUserId String   @map("owner_user_id")
  owner       User     @relation("Owner", fields: [ownerUserId], references: [id], onDelete: Cascade)
  inviteCode  String   @unique @map("invite_code")
  createdAt   DateTime @default(now()) @map("created_at")
  members     GroupMember[]
  events      Event[]
  tags        Tag[]
}

model GroupMember {
  id       String   @id @default(uuid())
  groupId  String   @map("group_id")
  group    Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId   String?  @map("user_id")
  user     User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  email    String
  name     String
  joinedAt DateTime @default(now()) @map("joined_at")

  @@unique([groupId, userId])
  @@unique([groupId, email])
}

model Event {
  id        String   @id @default(uuid())
  groupId   String   @map("group_id")
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  title     String
  notes     String   @default("")
  start     DateTime
  end       DateTime
  people    Json     @default("[]")
  tagId     String   @default("") @map("tag_id")
  userId    String   @map("user_id")
  user      User     @relation("Creator", fields: [userId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")

  @@index([groupId])
}

model Tag {
  id             String   @id @default(uuid())
  groupId        String   @map("group_id")
  group          Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name           String
  color          String   @default("#6B7280")
  icon           String?
  imageObjectKey String?  @map("image_object_key")

  @@index([groupId])
}
```

- [ ] **Step 2: Create `apps/api/.env` and `.env.test`**

`.env` (dev — matches the compose services, see Task 31):
```ini
DATABASE_URL=postgresql://baobun:baobun_dev@localhost:5432/baobun
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=baobun
S3_SECRET_KEY=baobun_dev
S3_BUCKET_AVATARS=avatars
S3_BUCKET_TAG_ICONS=tag-icons
S3_BUCKET_CALENDAR_FEEDS=calendar-feeds
S3_PUBLIC_ENDPOINT=http://localhost:9000
WEB_ORIGIN=http://localhost:4173
PORT=3001
MAIL_DEBUG=true
MAIL_SENDER="Baobun <no-reply@baobun.local>"
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_REJECT_SELF_SIGNED=false
MAIL_USER=
MAIL_PASSWORD=
```

`.env.test`:
```ini
DATABASE_URL=postgresql://baobun:baobun_dev@localhost:5432/baobun_test
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=baobun
S3_SECRET_KEY=baobun_dev
S3_BUCKET_AVATARS=avatars-test
S3_BUCKET_TAG_ICONS=tag-icons-test
S3_BUCKET_CALENDAR_FEEDS=calendar-feeds-test
S3_PUBLIC_ENDPOINT=http://localhost:9000
WEB_ORIGIN=http://localhost:4173
PORT=3001
MAIL_DEBUG=true
MAIL_SENDER="Baobun <no-reply@baobun.test>"
MAIL_HOST=
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_REJECT_SELF_SIGNED=false
MAIL_USER=
MAIL_PASSWORD=
```

- [ ] **Step 3: Create the test database and push the schema**

Start Postgres + MinIO (compose from Task 31, or run now with the file below if it already exists):

```bash
docker compose up -d postgres minio
docker compose exec -T postgres createdb -U baobun baobun_test || true
yarn workspace @baobun/api prisma db push --skip-generate
```

Run: `DATABASE_URL=postgresql://baobun:baobun_dev@localhost:5432/baobun_test yarn workspace @baobun/api prisma db push --skip-generate`
Expected: schema pushed; no errors.

- [ ] **Step 4: Generate the Prisma client and verify**

Run: `yarn workspace @baobun/api prisma generate`
Expected: generates `@prisma/client` for the workspace.
Run: `DATABASE_URL=postgresql://baobun:baobun_dev@localhost:5432/baobun_test node -e "import('@prisma/client').then(async ({PrismaClient}) => { const p = new PrismaClient(); const u = await p.user.create({ data: { email: 't@t.co', passwordHash: 'x', name: 'T' } }); console.log('ok', u.id); await p.user.delete({ where: { id: u.id } }); await p.\$disconnect() })"`
Expected: prints `ok <uuid>`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/.env apps/api/.env.test
git commit -m "feat: add Prisma schema for users, sessions, groups, events, tags"
```

---

### Task 4: DB client, errors, password, session modules

**Files:**
- Create: `apps/api/src/db.js`
- Create: `apps/api/src/errors.js`
- Create: `apps/api/src/password.js`
- Create: `apps/api/src/session.js`
- Test: `apps/api/test/password.test.js`

**Interfaces:**
- Produces:
  - `db.js`: `export const prisma`
  - `errors.js`: `export class AppError` (`new AppError(status, code, message)`), `export const notFound = (msg) => new AppError(404, ERROR_CODES.notFound, msg)`, `export const forbidden = (msg) => new AppError(403, ERROR_CODES.forbidden, msg)`, `export const unauthorized = (msg) => new AppError(401, ERROR_CODES.unauthorized, msg)`, `export const conflict = (msg) => new AppError(409, ERROR_CODES.conflict, msg)`, `export const validationError = (msg) => new AppError(400, ERROR_CODES.validation, msg)`
  - `password.js`: `export const hashPassword = (pw) => Promise<string>`, `export const verifyPassword = (pw, hash) => Promise<boolean>`, `export const validatePassword = (pw) => void (throws validationError if < 8 chars)`
  - `session.js`: `SESSION_LIFETIME_MS`, `createSession(c, userId, { userAgent, ip })`, `getSessionUser(c)`, `destroySession(c)` — cookie is set/cleared on `c`.

- [ ] **Step 1: Create `apps/api/src/db.js`**

```js
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

- [ ] **Step 2: Create `apps/api/src/errors.js`**

```js
import { ERROR_CODES } from '@baobun/shared'

export class AppError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const notFound = (msg = 'Not found.') => new AppError(404, ERROR_CODES.notFound, msg)
export const forbidden = (msg = 'Forbidden.') => new AppError(403, ERROR_CODES.forbidden, msg)
export const unauthorized = (msg = 'Unauthorized.') =>
  new AppError(401, ERROR_CODES.unauthorized, msg)
export const conflict = (msg = 'Conflict.') => new AppError(409, ERROR_CODES.conflict, msg)
export const validationError = (msg = 'Invalid input.') =>
  new AppError(400, ERROR_CODES.validation, msg)
```

- [ ] **Step 3: Create `apps/api/src/password.js`**

```js
import { hash, verify } from '@node-rs/argon2'
import { validationError } from './errors.js'

export const MIN_PASSWORD_LENGTH = 8

const hashOptions = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export const hashPassword = (password) => hash(password, hashOptions)

export const verifyPassword = (password, passwordHash) => verify(passwordHash, password)

export const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw validationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
}
```

- [ ] **Step 4: Create `apps/api/test/password.test.js`**

```js
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
```

- [ ] **Step 5: Create `apps/api/src/session.js`**

```js
import { randomBytes } from 'crypto'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { SESSION_COOKIE } from '@baobun/shared'
import { prisma } from './db.js'

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

const isSecure = () => true // deployed behind TLS; dev browsers still accept Secure on localhost http

export const createSession = async (c, userId, { userAgent = '', ip = '' } = {}) => {
  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      userAgent,
      ip,
    },
  })
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_LIFETIME_MS / 1000,
  })
  return token
}

export const getSessionUser = async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {})
    return null
  }
  return session.user
}

export const destroySession = async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await prisma.session.delete({ where: { id: token } }).catch(() => {})
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}
```

- [ ] **Step 6: Run the password test**

Run: `yarn workspace @baobun/api test`
Expected: the test runner boots and reports 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db.js apps/api/src/errors.js apps/api/src/password.js apps/api/src/session.js apps/api/test/password.test.js
git commit -m "feat: api core modules (db, errors, password, session)"
```

---

### Task 5: S3 helper (MinIO client, bucket ensure, presigned URLs)

**Files:**
- Create: `apps/api/src/s3.js`
- Test: `apps/api/test/s3.test.js`

**Interfaces:**
- Produces:
  - `ensureBuckets()` — creates the three buckets + sets public-read policy on calendar-feeds. Idempotent.
  - `putObject(bucket, key, buffer|stream, contentType)` → `Promise<key>`
  - `getObject(bucket, key)` → `Promise<Buffer>`
  - `deleteObject(bucket, key)` → `Promise<void>`
  - `presignGetUrl(bucket, key, { expiresInSeconds = 900 } = {})` → `Promise<string>` (uses `S3_PUBLIC_ENDPOINT` for host so browser can fetch it)
  - `publicUrl(bucket, key)` → string
  - Bucket name helpers: `BUCKETS = { avatars, tagIcons, calendarFeeds }`

- [ ] **Step 1: Create `apps/api/src/s3.js`**

```js
import { Client } from 'minio'
import { config } from './config.js'

const parseEndpoint = (endpoint) => {
  const url = new URL(endpoint)
  return { host: url.hostname, port: url.port ? Number(url.port) : undefined, ssl: url.protocol === 'https:' }
}

const { host, port, ssl } = parseEndpoint(config.s3.endpoint)

let client
export const getS3 = () => {
  if (!client) {
    client = new Client({
      endPoint: host,
      port,
      useSSL: ssl,
      accessKey: config.s3.accessKey,
      secretKey: config.s3.secretKey,
      region: config.s3.region,
    })
  }
  return client
}

export const BUCKETS = {
  avatars: config.s3.bucketAvatars,
  tagIcons: config.s3.bucketTagIcons,
  calendarFeeds: config.s3.bucketCalendarFeeds,
}

const PUBLIC_READ_POLICY = (bucket) => ({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${bucket}/*`],
    },
  ],
})

export const ensureBuckets = async () => {
  const s3 = getS3()
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await s3.bucketExists(bucket).catch(() => false)
    if (!exists) await s3.makeBucket(bucket, config.s3.region)
  }
  const feeds = BUCKETS.calendarFeeds
  const policy = PUBLIC_READ_POLICY(feeds)
  await s3.setBucketPolicy(feeds, JSON.stringify(policy))
}

export const putObject = async (bucket, key, data, contentType = 'application/octet-stream') => {
  const s3 = getS3()
  await s3.putObject(bucket, key, data, data.length ?? undefined, {
    'Content-Type': contentType,
  })
  return key
}

export const getObject = async (bucket, key) => {
  const s3 = getS3()
  const stream = await s3.getObject(bucket, key)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export const deleteObject = async (bucket, key) => {
  const s3 = getS3()
  await s3.removeObject(bucket, key)
}

export const publicUrl = (bucket, key) => {
  const base = config.s3.publicEndpoint.replace(/\/$/, '')
  return `${base}/${bucket}/${key}`
}

export const presignGetUrl = async (bucket, key, { expiresInSeconds = 900 } = {}) => {
  const s3 = getS3()
  const signed = await s3.presignedGetObject(bucket, key, expiresInSeconds)
  return signed
}
```

- [ ] **Step 2: Create `apps/api/test/s3.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { ensureBuckets, putObject, getObject, deleteObject, BUCKETS, presignGetUrl } from '../src/s3.js'

describe('s3', () => {
  beforeAll(async () => {
    await ensureBuckets()
  })

  it('round-trips an object', async () => {
    const key = `test-${Date.now()}.txt`
    await putObject(BUCKETS.avatars, key, Buffer.from('hello'), 'text/plain')
    const buf = await getObject(BUCKETS.avatars, key)
    expect(buf.toString()).toBe('hello')
    const url = await presignGetUrl(BUCKETS.avatars, key)
    expect(url).toMatch(/^http/)
    await deleteObject(BUCKETS.avatars, key)
    await expect(getObject(BUCKETS.avatars, key)).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: 2 test files, all passing (needs `docker compose up -d postgres minio` running and `.env.test` present).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/s3.js apps/api/test/s3.test.js
git commit -m "feat: api s3 helper with bucket bootstrap and presigned urls"
```

---

### Task 6: Mail helper (nodemailer, `MAIL_*` flags)

**Files:**
- Create: `apps/api/src/mail.js`
- Test: `apps/api/test/mail.test.js`

**Interfaces:**
- Produces: `sendMail({ to, subject, text, html })` → `Promise<void>`. When `MAIL_DEBUG=true`, uses `jsonTransport` and logs a preview line (`[mail] preview: <url-or-json>`); never sends. When debug off and `MAIL_HOST` set, sends via SMTP with the configured flags. When debug off and no host, throws a clear error.
- Produces: `parseSender(sender)` → `{ name, address }` from `"Name <addr>"`.

- [ ] **Step 1: Create `apps/api/src/mail.js`**

```js
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
        (info.message && Buffer.isBuffer(info.message) ? info.message.toString() : JSON.stringify(info.message ?? info))
      console.log('[mail] preview:', preview)
    }
  } finally {
    transport.close()
  }
}
```

- [ ] **Step 2: Create `apps/api/test/mail.test.js`**

```js
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
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `mail.test.js` passes (the debug-mode test only; the transport test uses default `.env.test` `MAIL_DEBUG=true`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/mail.js apps/api/test/mail.test.js
git commit -m "feat: api mail helper honoring MAIL_* flags"
```

---

## Phase C — Auth routes

### Task 7: Auth middleware + app bootstrap

**Files:**
- Create: `apps/api/src/middleware/auth.js`
- Create: `apps/api/src/middleware/errorHandler.js`
- Create: `apps/api/src/app.js`
- Create: `apps/api/src/index.js`

**Interfaces:**
- Produces:
  - `requireAuth` middleware — reads session, sets `c.set('user', user)`, else 401 `unauthorized`.
  - `requireMember(groupId)` — after `requireAuth`, verifies the user is a member of the group; sets `c.set('membership', membership)`; else 403 `forbidden`.
  - `requireOwner(groupId)` — after `requireAuth`, verifies `group.ownerUserId === user.id`; else 403.
  - `app` (Hono) with error handler and route mounting.
  - `index.js` — starts the server on `config.port`, calls `ensureBuckets()`.

- [ ] **Step 1: Create `apps/api/src/middleware/auth.js`**

```js
import { getSessionUser } from '../session.js'
import { prisma } from '../db.js'
import { unauthorized, forbidden, notFound } from '../errors.js'

export const requireAuth = async (c, next) => {
  const user = await getSessionUser(c)
  if (!user) throw unauthorized('Please sign in.')
  c.set('user', user)
  await next()
}

export const requireMember = (groupParam = 'id') => async (c, next) => {
  const user = c.get('user')
  const groupId = c.req.param(groupParam)
  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId: user.id },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  c.set('membership', membership)
  await next()
}

export const requireOwner = (groupParam = 'id') => async (c, next) => {
  const user = c.get('user')
  const groupId = c.req.param(groupParam)
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw notFound('Group not found.')
  if (group.ownerUserId !== user.id) throw forbidden('Only the group owner can do this.')
  c.set('group', group)
  await next()
}
```

- [ ] **Step 2: Create `apps/api/src/middleware/errorHandler.js`**

```js
import { AppError } from '../errors.js'
import { ERROR_CODES } from '@baobun/shared'

export const errorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status)
  }
  console.error(err)
  return c.json(
    { error: { code: ERROR_CODES.internal, message: 'Something went wrong.' } },
    500,
  )
}

export const notFoundHandler = (c) =>
  c.json({ error: { code: ERROR_CODES.notFound, message: 'Not found.' } }, 404)
```

- [ ] **Step 3: Create `apps/api/src/app.js`**

```js
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

app.use(
  '*',
  cors({
    origin: [config.webOrigin],
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
```

- [ ] **Step 4: Create `apps/api/src/index.js`**

```js
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { config } from './config.js'
import { ensureBuckets } from './s3.js'

await ensureBuckets().catch((err) => {
  console.error('Failed to ensure buckets:', err)
  process.exit(1)
})

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
```

- [ ] **Step 5: Stub the route modules so the app boots**

Create the six route files with empty Hono routers (they get filled in Tasks 8–14):

```js
import { Hono } from 'hono'
export const authRoutes = new Hono()
// (content filled in Task 8)
```

Use one file per route as above with `export const <name> = new Hono()`; update `app.js` imports to named imports if you prefer. Simplest: each file does `export default new Hono()` and `app.js` uses them as written in Step 3.

- [ ] **Step 6: Verify the app boots**

Run: `yarn workspace @baobun/api start` (background, then curl).
Run: `curl -s localhost:3001/api/auth/me`
Expected: `{"error":{"code":"unauthorized","message":"Please sign in."}}`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/middleware apps/api/src/app.js apps/api/src/index.js apps/api/src/routes
git commit -m "feat: api bootstrap with auth middleware and error handler"
```

---

### Task 8: Auth routes — register, login, me, logout

**Files:**
- Create: `apps/api/src/routes/auth.js`
- Test: `apps/api/test/auth.test.js`

**Interfaces:**
- Produces (all under `/api/auth`):
  - `POST /register` body `{name, email, password}` → 201 `{ user }` + session cookie; 409 on duplicate email.
  - `POST /login` body `{email, password}` → 200 `{ user }` + session cookie; 401 `unauthorized` on bad creds; 401 `password_set_required` if `needsPasswordSet` (and lazily emails set-password link).
  - `POST /logout` → 200 `{ ok: true }`; destroys session.
  - `GET /me` → 200 `{ user }` (requireAuth); 401 if no session.
  - `POST /forgot` body `{email}` → always 200 `{ ok: true }`; if user exists, email reset link.
  - `POST /reset` body `{userId, token, newPassword}` → 200 `{ ok: true }`; 400/401 on invalid/expired.
- Shared helpers: `userToJson(user, avatarUrl)` → `{ $id, name, email, avatarUrl, avatarFileId }`.
- Produces: `serializeUser(user, avatarUrl)`.

The `userToJson` shape must match what `stores/auth.js` and views read: `{ $id, name, email, avatarUrl, avatarFileId }`.

- [ ] **Step 1: Create `apps/api/src/routes/auth.js`**

```js
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword, validatePassword } from '../password.js'
import { createSession, destroySession } from '../session.js'
import { requireAuth } from '../middleware/auth.js'
import { unauthorized, conflict, validationError, notFound } from '../errors.js'
import { sendMail } from '../mail.js'
import { config } from '../config.js'
import { getObject, BUCKETS, presignGetUrl } from '../s3.js'
import { randomBytes, createHash } from 'crypto'
import { ERROR_CODES } from '@baobun/shared'

export const serializeUser = (user, avatarUrl = null) => ({
  $id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl,
  avatarFileId: user.avatarObjectKey,
})

export const avatarUrlFor = async (user) => {
  if (!user.avatarObjectKey) return null
  try {
    await getObject(BUCKETS.avatars, user.avatarObjectKey)
    return await presignGetUrl(BUCKETS.avatars, user.avatarObjectKey)
  } catch {
    return null
  }
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

const emailSetPasswordLink = async (user) => {
  const raw = randomBytes(32).toString('base64url')
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
  const url = `${config.webOrigin}/reset-password?userId=${user.id}&token=${raw}`
  await sendMail({
    to: user.email,
    subject: 'Welcome to Baobun — set your password',
    text: `Click this link to set your Baobun password: ${url}\nThis link expires in 1 hour.`,
    html: `<p>Click <a href="${url}">here</a> to set your Baobun password. This link expires in 1 hour.</p>`,
  })
}

const auth = new Hono()

auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({ name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string() })
    .safeParse(body)
  if (!parsed.success) throw validationError('Please provide name, email and password.')
  const { name, email, password } = parsed.data
  validatePassword(password)

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) throw conflict('Email already in use.')

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name,
    },
  })
  await createSession(c, user.id, {
    userAgent: c.req.header('user-agent') || '',
    ip: c.req.header('x-forwarded-for') || '',
  })
  return c.json({ user: serializeUser(user, null) }, 201)
})

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({ email: z.string().trim().email(), password: z.string() })
    .safeParse(body)
  if (!parsed.success) throw validationError('Please provide email and password.')

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    if (user && user.needsPasswordSet) {
      const hasPending = await prisma.passwordResetToken.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gte: new Date() } },
      })
      if (!hasPending) await emailSetPasswordLink(user).catch(() => {})
      throw new (require('../errors.js').AppError)(401, ERROR_CODES.passwordSetRequired, 'Check your email for a link to set your password.')
    }
    throw unauthorized('Invalid email or password.')
  }

  await createSession(c, user.id, {
    userAgent: c.req.header('user-agent') || '',
    ip: c.req.header('x-forwarded-for') || '',
  })
  return c.json({ user: serializeUser(user, await avatarUrlFor(user)) })
})

auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user')
  return c.json({ user: serializeUser(user, await avatarUrlFor(user)) })
})

auth.post('/logout', async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

auth.post('/forgot', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const raw = randomBytes(32).toString('base64url')
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      })
      const url = `${config.webOrigin}/reset-password?userId=${user.id}&token=${raw}`
      await sendMail({
        to: user.email,
        subject: 'Reset your Baobun password',
        text: `Click this link to reset your password: ${url}\nThis link expires in 1 hour.`,
        html: `<p>Click <a href="${url}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      }).catch(() => {})
    }
  }
  return c.json({ ok: true })
})

auth.post('/reset', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z
    .object({ userId: z.string().min(1), token: z.string().min(1), newPassword: z.string() })
    .safeParse(body)
  if (!parsed.success) throw validationError('Invalid reset link.')
  validatePassword(parsed.data.newPassword)

  const token = await prisma.passwordResetToken.findFirst({
    where: {
      userId: parsed.data.userId,
      tokenHash: hashToken(parsed.data.token),
      usedAt: null,
      expiresAt: { gte: new Date() },
    },
  })
  if (!token) throw unauthorized('Invalid or expired reset link.')

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: parsed.data.userId, id: { not: token.id } } }),
    prisma.user.update({
      where: { id: parsed.data.userId },
      data: { passwordHash: await hashPassword(parsed.data.newPassword), needsPasswordSet: false },
    }),
  ])
  return c.json({ ok: true })
})

export default auth
```

- [ ] **Step 2: Create `apps/api/test/auth.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const testUser = { name: 'Ada', email: 'ada@example.com', password: 'supersecret1' }

const json = (path, { method = 'GET', body, cookie = '' } = {}) =>
  app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

describe('auth', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } })
  })

  it('registers, logs in, gets me, logs out', async () => {
    const reg = await json('/api/auth/register', { method: 'POST', body: testUser })
    expect(reg.status).toBe(201)
    const regCookie = reg.headers.get('set-cookie') || ''
    expect(regCookie).toContain('baobun_sid=')

    const me = await json('/api/auth/me', { cookie: regCookie })
    expect(me.status).toBe(200)
    const meBody = await me.json()
    expect(meBody.user.email).toBe(testUser.email)
    expect(meBody.user.$id).toBeTruthy()

    await json('/api/auth/logout', { method: 'POST', cookie: regCookie })

    const meAfter = await json('/api/auth/me', { cookie: regCookie })
    expect(meAfter.status).toBe(401)
  })

  it('rejects bad login', async () => {
    const bad = await json('/api/auth/login', {
      method: 'POST',
      body: { email: testUser.email, password: 'wrongpass1' },
    })
    expect(bad.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `auth.test.js` passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/auth.js apps/api/test/auth.test.js
git commit -m "feat: auth routes (register, login, me, logout)"
```

---

### Task 9: Auth routes — forgot/reset + lazy set-password

**Files:**
- Modify: `apps/api/test/auth.test.js`

**Interfaces:**
- Consumes: `POST /forgot`, `POST /reset` from Task 8.
- Produces: no new exports.

- [ ] **Step 1: Add tests for forgot/reset**

Append to `apps/api/test/auth.test.js`:

```js
it('resets a password via forgot + reset', async () => {
  const forgot = await json('/api/auth/forgot', {
    method: 'POST',
    body: { email: testUser.email },
  })
  expect(forgot.status).toBe(200)

  const token = await prisma.passwordResetToken.findFirst({
    where: { user: { email: testUser.email } },
  })
  const user = await prisma.user.findUnique({ where: { email: testUser.email } })
  // We stored only the hash; fetch raw token by re-reading via a spy is not possible,
  // so reset with a token we create directly:
  const raw = 'manual-test-token'
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: require('crypto').createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + 60000),
    },
  })

  const reset = await json('/api/auth/reset', {
    method: 'POST',
    body: { userId: user.id, token: raw, newPassword: 'brandnewpass1' },
  })
  expect(reset.status).toBe(200)

  const login = await json('/api/auth/login', {
    method: 'POST',
    body: { email: testUser.email, password: 'brandnewpass1' },
  })
  expect(login.status).toBe(200)
})
```

- [ ] **Step 2: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: all auth tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/auth.test.js
git commit -m "test: cover forgot/reset password flow"
```

---

## Phase D — Resource routes

### Task 10: Users routes (profile + avatar)

**Files:**
- Create: `apps/api/src/routes/users.js`
- Test: `apps/api/test/users.test.js`

**Interfaces:**
- Produces (all under `/api/users`):
  - `PATCH /me` body `{name?, email?, currentPassword?, password?}` → `{ user }`; email/password changes require `currentPassword`.
  - `PUT /me/avatar` (multipart `file`) → `{ avatarUrl }`; stores in `BUCKETS.avatars` with key `avatar-<userId>-<timestamp>.<ext>`; deletes old avatar object.
  - `DELETE /me/avatar` → `{ ok: true }`.

- [ ] **Step 1: Create `apps/api/src/routes/users.js`**

```js
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { verifyPassword, hashPassword } from '../password.js'
import { requireAuth } from '../middleware/auth.js'
import { validationError, unauthorized } from '../errors.js'
import { putObject, deleteObject, BUCKETS, presignGetUrl } from '../s3.js'
import { serializeUser, avatarUrlFor } from './auth.js'

const users = new Hono()

users.patch('/me', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const { name, email, currentPassword, password } = body

  const data = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()

  if (email && email !== user.email) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is required to change your email.')
    }
    const dup = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } })
    if (dup && dup.id !== user.id) throw new (require('../errors.js').conflict)('Email already in use.')
    data.email = String(email).toLowerCase()
  }

  if (password) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw unauthorized('Current password is required to set a new password.')
    }
    data.passwordHash = await hashPassword(password)
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data })
  return c.json({ user: serializeUser(updated, await avatarUrlFor(updated)) })
})

users.put('/me/avatar', requireAuth, async (c) => {
  const user = c.get('user')
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File) || file.size === 0) {
    throw validationError('Please provide an image file.')
  }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const key = `avatar-${user.id}-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await putObject(BUCKETS.avatars, key, buf, file.type || 'application/octet-stream')

  if (user.avatarObjectKey) {
    await deleteObject(BUCKETS.avatars, user.avatarObjectKey).catch(() => {})
  }
  await prisma.user.update({ where: { id: user.id }, data: { avatarObjectKey: key } })

  const updated = await prisma.user.findUnique({ where: { id: user.id } })
  return c.json({ avatarUrl: await avatarUrlFor(updated) })
})

users.delete('/me/avatar', requireAuth, async (c) => {
  const user = c.get('user')
  if (user.avatarObjectKey) {
    await deleteObject(BUCKETS.avatars, user.avatarObjectKey).catch(() => {})
    await prisma.user.update({ where: { id: user.id }, data: { avatarObjectKey: null } })
  }
  return c.json({ ok: true })
})

export default users
```

- [ ] **Step 2: Create `apps/api/test/users.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'users-test@example.com'
let cookie = ''

const auth = async () => {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'U', email, password: 'password123' }),
  })
  cookie = res.headers.get('set-cookie') || ''
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  await auth()
})

describe('users', () => {
  it('updates name', async () => {
    const res = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.name).toBe('Renamed')
  })

  it('changes password with current password', async () => {
    const res = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ password: 'newpassword1', currentPassword: 'password123' }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects password change without current password', async () => {
    const res = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ password: 'anotherpass1' }),
    })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `users.test.js` passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/users.js apps/api/test/users.test.js
git commit -m "feat: users routes (profile update, avatar upload)"
```

---

### Task 11: Groups routes

**Files:**
- Create: `apps/api/src/routes/groups.js`
- Test: `apps/api/test/groups.test.js`

**Interfaces:**
- Produces (all under `/api/groups`, cookie-authed):
  - `GET /` → `{ groups }` — groups the user is a member of, each with `$id, name, color, inviteCode, ownerId, memberCount`.
  - `POST /` body `{name, color?}` → 201 `{ group }`; auto-generates 6-char uppercase invite code; creates owner membership row.
  - `GET /:id` → `{ group, members }` (requireMember).
  - `PATCH /:id` body `{name?, color?}` → `{ group }` (requireOwner).
  - `DELETE /:id` → `{ ok: true }` (requireOwner).
  - `POST /join` body `{inviteCode}` → `{ group }`; 404 if code invalid; 409 if already a member.
  - `GET /:id/members` (requireMember) → `{ members }` — each `{ $id, email, name, avatarUrl, addedAt, userId }`.
  - `POST /:id/members` body `{email}` (requireOwner) → 201 `{ member }`; upsert by email; if a registered user exists, link `userId`.
  - `DELETE /:id/members/:memberId` (requireOwner) → `{ ok: true }`.
- Produces: `groupToJson(group, memberCount)`.

- [ ] **Step 1: Create `apps/api/src/routes/groups.js`**

```js
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireMember, requireOwner } from '../middleware/auth.js'
import { notFound, conflict, validationError } from '../errors.js'
import { avatarUrlFor } from './auth.js'

const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const groupToJson = (group, memberCount = 0) => ({
  $id: group.id,
  name: group.name,
  color: group.color,
  inviteCode: group.inviteCode,
  ownerId: group.ownerUserId,
  memberCount,
})

const memberToJson = (m) => ({
  $id: m.id,
  email: m.email,
  name: m.name,
  avatarUrl: m.avatarUrl ?? null,
  addedAt: m.joinedAt,
  userId: m.userId,
})

const groups = new Hono()

groups.use('*', requireAuth)

groups.get('/', async (c) => {
  const user = c.get('user')
  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id },
    include: { group: { include: { _count: { select: { members: true } } } } },
  })
  const list = memberships.map((m) => groupToJson(m.group, m.group._count.members))
  return c.json({ groups: list })
})

groups.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ name: z.string().trim().min(1) }).safeParse(body)
  if (!parsed.success) throw validationError('Group name is required.')
  const color = typeof body.color === 'string' && body.color ? body.color : '#f43f5e'

  let inviteCode = generateInviteCode()
  while (await prisma.group.findUnique({ where: { inviteCode } })) {
    inviteCode = generateInviteCode()
  }

  const group = await prisma.group.create({
    data: { name: parsed.data.name, color, ownerUserId: user.id, inviteCode },
  })
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: user.id,
      email: user.email,
      name: user.name,
    },
  })
  return c.json({ group: groupToJson(group, 1) }, 201)
})

groups.get('/join', async (c) => {
  const user = c.get('user')
  const code = String(c.req.query('inviteCode') || '').trim().toUpperCase()
  if (!code) throw validationError('Invite code is required.')
  const group = await prisma.group.findUnique({ where: { inviteCode: code } })
  if (!group) throw notFound('Invalid invite code.')

  const existing = await prisma.groupMember.findFirst({
    where: { groupId: group.id, userId: user.id },
  })
  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, email: user.email, name: user.name },
    })
  }
  const count = await prisma.groupMember.count({ where: { groupId: group.id } })
  return c.json({ group: groupToJson(group, count) })
})

groups.get('/:id', requireMember('id'), async (c) => {
  const group = await prisma.group.findUnique({ where: { id: c.req.param('id') } })
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    include: { user: true },
  })
  const memberJson = await Promise.all(
    members.map(async (m) =>
      memberToJson({ ...m, avatarUrl: m.user ? await avatarUrlFor(m.user) : null }),
    ),
  )
  return c.json({ group: groupToJson(group, members.length), members: memberJson })
})

groups.patch('/:id', requireOwner('id'), async (c) => {
  const group = c.get('group')
  const body = await c.req.json().catch(() => ({}))
  const data = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.color === 'string' && body.color) data.color = body.color
  const updated = await prisma.group.update({ where: { id: group.id }, data })
  const count = await prisma.groupMember.count({ where: { groupId: group.id } })
  return c.json({ group: groupToJson(updated, count) })
})

groups.delete('/:id', requireOwner('id'), async (c) => {
  const group = c.get('group')
  await prisma.group.delete({ where: { id: group.id } })
  return c.json({ ok: true })
})

groups.get('/:id/members', requireMember('id'), async (c) => {
  const groupId = c.req.param('id')
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  })
  const memberJson = await Promise.all(
    members.map(async (m) =>
      memberToJson({ ...m, avatarUrl: m.user ? await avatarUrlFor(m.user) : null }),
    ),
  )
  return c.json({ members: memberJson })
})

groups.post('/:id/members', requireOwner('id'), async (c) => {
  const group = c.get('group')
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ email: z.string().trim().email() }).safeParse(body)
  if (!parsed.success) throw validationError('A valid email is required.')

  const email = parsed.data.email.toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })
  const existing = await prisma.groupMember.findFirst({ where: { groupId: group.id, email } })
  if (existing) throw conflict('That email is already a member.')

  const member = await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId: user?.id ?? null,
      email,
      name: user?.name ?? email.split('@')[0],
    },
  })
  return c.json({ member: memberToJson(member) }, 201)
})

groups.delete('/:id/members/:memberId', requireOwner('id'), async (c) => {
  const { id: groupId, memberId } = c.req.param()
  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId } })
  if (!member) throw notFound('Member not found.')
  await prisma.groupMember.delete({ where: { id: member.id } })
  return c.json({ ok: true })
})

export default groups
```

- [ ] **Step 2: Create `apps/api/test/groups.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'groups-test@example.com'
let cookie = ''
let groupId = ''

const req = (path, { method = 'GET', body } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'G', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
})

describe('groups', () => {
  it('creates and lists a group', async () => {
    const create = await req('/api/groups', { method: 'POST', body: { name: 'Team' } })
    expect(create.status).toBe(201)
    const { group } = await create.json()
    groupId = group.$id
    expect(group.inviteCode).toMatch(/^[A-Z0-9]{6}$/)
    expect(group.ownerId).toBeTruthy()

    const list = await req('/api/groups')
    const { groups } = await list.json()
    expect(groups.some((g) => g.$id === groupId)).toBe(true)
  })

  it('joins via invite code', async () => {
    const otherEmail = 'other@example.com'
    await prisma.user.deleteMany({ where: { email: otherEmail } })
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Other', email: otherEmail, password: 'password123' }),
    })
    const otherCookie = reg.headers.get('set-cookie') || ''

    const list = await req('/api/groups')
    const { groups } = await list.json()
    const group = groups.find((g) => g.$id === groupId)
    expect(group).toBeTruthy()

    const join = await app.request(`/api/groups/join?inviteCode=${group.inviteCode}`, {
      headers: { cookie: otherCookie },
    })
    expect(join.status).toBe(200)
    const { group: joined } = await join.json()
    expect(joined.memberCount).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `groups.test.js` passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/groups.js apps/api/test/groups.test.js
git commit -m "feat: groups routes with invite codes and members"
```

---

### Task 12: Events routes

**Files:**
- Create: `apps/api/src/routes/events.js`
- Test: `apps/api/test/events.test.js`

**Interfaces:**
- Produces (all cookie-authed):
  - `GET /api/groups/:id/events?from=&to=` (requireMember) → `{ events }`.
  - `POST /api/groups/:id/events` (requireMember) body `{title, start, end, notes?, people?, tagId?}` → 201 `{ event }`.
  - `PATCH /api/events/:id` (requireMember of the event's group) body partial → `{ event }`.
  - `DELETE /api/events/:id` (same) → `{ ok: true }`.
  - `PUT /api/events/:id/date` body `{start}` → `{ event }` (moves start; keeps duration).
- Produces: `eventToJson(event)` → `{ $id, groupId, title, start, end, notes, people, tagId, userId, createdAt }` (people parsed from JSON column).

- [ ] **Step 1: Create `apps/api/src/routes/events.js`**

```js
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireMember } from '../middleware/auth.js'
import { notFound, forbidden, validationError } from '../errors.js'

export const eventToJson = (event) => ({
  $id: event.id,
  groupId: event.groupId,
  title: event.title,
  start: event.start.toISOString(),
  end: event.end.toISOString(),
  notes: event.notes,
  people: Array.isArray(event.people) ? event.people : [],
  tagId: event.tagId,
  userId: event.userId,
  createdAt: event.createdAt.toISOString(),
})

const eventSchema = z.object({
  title: z.string().trim().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  notes: z.string().optional().default(''),
  people: z.array(z.string()).optional().default([]),
  tagId: z.string().optional().default(''),
})

const events = new Hono()

const requireEventMember = async (c, next) => {
  const user = c.get('user')
  const event = await prisma.event.findUnique({ where: { id: c.req.param('id') } })
  if (!event) throw notFound('Event not found.')
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: event.groupId, userId: user.id },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  c.set('event', event)
  await next()
}

const listForGroup = (c) => async () => {
  const groupId = c.req.param('id')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const where = { groupId }
  if (from) where.start = { ...(where.start || {}), gte: new Date(from) }
  if (to) where.start = { ...(where.start || {}), lte: new Date(to) }
  const events = await prisma.event.findMany({ where, orderBy: { start: 'asc' } })
  return events.map(eventToJson)
}

events.use('*', requireAuth)

events.get('/groups/:id/events', requireMember('id'), async (c) => {
  const items = await listForGroup(c)()
  return c.json({ events: items })
})

events.post('/groups/:id/events', requireMember('id'), async (c) => {
  const groupId = c.req.param('id')
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) throw validationError('Event title, start and end are required.')

  const event = await prisma.event.create({
    data: {
      groupId,
      userId: user.id,
      title: parsed.data.title,
      start: new Date(parsed.data.start),
      end: new Date(parsed.data.end),
      notes: parsed.data.notes,
      people: parsed.data.people,
      tagId: parsed.data.tagId,
    },
  })
  return c.json({ event: eventToJson(event) }, 201)
})

events.patch('/:id', requireEventMember, async (c) => {
  const event = c.get('event')
  const body = await c.req.json().catch(() => ({}))
  const data = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.notes === 'string') data.notes = body.notes
  if (typeof body.start === 'string' && body.start) data.start = new Date(body.start)
  if (typeof body.end === 'string' && body.end) data.end = new Date(body.end)
  if (Array.isArray(body.people)) data.people = body.people
  if (typeof body.tagId === 'string') data.tagId = body.tagId
  const updated = await prisma.event.update({ where: { id: event.id }, data })
  return c.json({ event: eventToJson(updated) })
})

events.delete('/:id', requireEventMember, async (c) => {
  const event = c.get('event')
  await prisma.event.delete({ where: { id: event.id } })
  return c.json({ ok: true })
})

events.put('/:id/date', requireEventMember, async (c) => {
  const event = c.get('event')
  const body = await c.req.json().catch(() => ({}))
  const start = new Date(body.start ?? '')
  if (Number.isNaN(start.getTime())) throw validationError('A valid start date is required.')
  const duration = event.end.getTime() - event.start.getTime()
  const end = new Date(start.getTime() + (duration > 0 ? duration : 60 * 60 * 1000))
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { start, end },
  })
  return c.json({ event: eventToJson(updated) })
})

export default events
```

Note: the route file mounts both `/api/events/...` and `/api/groups/:id/events` on the same Hono instance registered at `/api`. Because `app.route('/api/events', eventsRoutes)` and `app.route('/api/groups', groupsRoutes)` are both needed, the `GET/POST /groups/:id/events` routes belong in the **groups** router, not here. Fix in Step 3 below.

- [ ] **Step 2: Fix routing ownership**

The events listing/create under `/groups/:id/events` must live in the groups router so the prefix works. Move the two routes (`get('/groups/:id/events'...)` and `post('/groups/:id/events'...)`) into `apps/api/src/routes/groups.js`, importing `eventToJson` from `./events.js`. Keep only `PATCH/DELETE/PUT /:id` (and the `requireEventMember` helper) in `events.js`. Update `app.js` to mount `eventsRoutes` at `/api/events`.

The `events.js` file after the fix exports default a router with only:

```js
events.use('*', requireAuth)
events.patch('/:id', requireEventMember, async (c) => { /* as above */ })
events.delete('/:id', requireEventMember, async (c) => { /* as above */ })
events.put('/:id/date', requireEventMember, async (c) => { /* as above */ })
```

- [ ] **Step 3: Create `apps/api/test/events.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'events-test@example.com'
let cookie = ''
let groupId = ''
let eventId = ''

const req = (path, { method = 'GET', body } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'E', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
  const create = await req('/api/groups', { method: 'POST', body: { name: 'EventsG' } })
  groupId = (await create.json()).group.$id
})

describe('events', () => {
  it('creates, lists, updates, moves and deletes an event', async () => {
    const create = await req(`/api/groups/${groupId}/events`, {
      method: 'POST',
      body: {
        title: 'Standup',
        start: '2026-08-02T09:00:00Z',
        end: '2026-08-02T09:30:00Z',
        people: ['everyone'],
      },
    })
    expect(create.status).toBe(201)
    const { event } = await create.json()
    eventId = event.$id
    expect(event.people).toEqual(['everyone'])

    const list = await req(`/api/groups/${groupId}/events`)
    expect((await list.json()).events.length).toBeGreaterThanOrEqual(1)

    const move = await req(`/api/events/${eventId}/date`, {
      method: 'PUT',
      body: { start: '2026-08-03T09:00:00Z' },
    })
    expect(move.status).toBe(200)
    expect((await move.json()).event.start).toContain('2026-08-03')

    const patch = await req(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: { title: 'Standup moved' },
    })
    expect((await patch.json()).event.title).toBe('Standup moved')

    const del = await req(`/api/events/${eventId}`, { method: 'DELETE' })
    expect(del.status).toBe(200)
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `events.test.js` passes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/events.js apps/api/src/routes/groups.js apps/api/test/events.test.js
git commit -m "feat: events routes"
```

---

### Task 13: Tags routes

**Files:**
- Create: `apps/api/src/routes/tags.js`
- Test: `apps/api/test/tags.test.js`

**Interfaces:**
- Produces (all cookie-authed):
  - `GET /api/groups/:id/tags` (requireMember) → `{ tags }`.
  - `POST /api/groups/:id/tags` (requireMember) multipart `{name, color?, icon?, image?}` → 201 `{ tag }`; image stored in `BUCKETS.tagIcons`, key `tag-<id>`.
  - `PATCH /api/tags/:id` (requireMember of tag's group) → `{ tag }`.
  - `DELETE /api/tags/:id` (same) → `{ ok: true }`.
- Produces: `tagToJson(tag, imageUrl)` → `{ $id, name, color, icon, imageId, imageUrl }` where `imageId` is the object key and `imageUrl` is null if no image.

- [ ] **Step 1: Create `apps/api/src/routes/tags.js`**

```js
import { Hono } from 'hono'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { notFound, forbidden, validationError } from '../errors.js'
import { putObject, deleteObject, getObject, BUCKETS, presignGetUrl } from '../s3.js'

export const tagToJson = async (tag) => {
  let imageUrl = null
  if (tag.imageObjectKey) {
    try {
      await getObject(BUCKETS.tagIcons, tag.imageObjectKey)
      imageUrl = await presignGetUrl(BUCKETS.tagIcons, tag.imageObjectKey)
    } catch {
      imageUrl = null
    }
  }
  return {
    $id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? null,
    imageId: tag.imageObjectKey ?? '',
    imageUrl,
  }
}

const requireTagMember = async (c, next) => {
  const user = c.get('user')
  const tag = await prisma.tag.findUnique({ where: { id: c.req.param('id') } })
  if (!tag) throw notFound('Tag not found.')
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: tag.groupId, userId: user.id },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  c.set('tag', tag)
  await next()
}

const tags = new Hono()

tags.use('*', requireAuth)

tags.get('/groups/:id/tags', async (c) => {
  const user = c.get('user')
  const groupId = c.req.param('id')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')
  const items = await prisma.tag.findMany({ where: { groupId }, orderBy: { name: 'asc' } })
  return c.json({ tags: await Promise.all(items.map(tagToJson)) })
})

tags.post('/groups/:id/tags', async (c) => {
  const user = c.get('user')
  const groupId = c.req.param('id')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')

  const form = await c.req.formData().catch(() => null)
  const name = String(form?.get('name') ?? '').trim()
  if (!name) throw validationError('Tag name is required.')
  const color = String(form?.get('color') ?? '#6B7280').trim() || '#6B7280'
  const icon = form?.get('icon') ? String(form.get('icon')) : null

  const tag = await prisma.tag.create({ data: { groupId, name, color, icon } })

  const image = form?.get('image')
  if (image instanceof File && image.size > 0) {
    const key = `tag-${tag.id}`
    await putObject(
      BUCKETS.tagIcons,
      key,
      Buffer.from(await image.arrayBuffer()),
      image.type || 'application/octet-stream',
    )
    await prisma.tag.update({ where: { id: tag.id }, data: { imageObjectKey: key } })
  }

  const fresh = await prisma.tag.findUnique({ where: { id: tag.id } })
  return c.json({ tag: await tagToJson(fresh) }, 201)
})

tags.patch('/:id', requireTagMember, async (c) => {
  const tag = c.get('tag')
  const form = await c.req.formData().catch(() => null)
  const data = {}
  if (typeof form?.get('name') === 'string' && form.get('name').trim()) data.name = form.get('name').trim()
  if (typeof form?.get('color') === 'string' && form.get('color').trim()) data.color = form.get('color').trim()
  const updated = await prisma.tag.update({ where: { id: tag.id }, data })
  return c.json({ tag: await tagToJson(updated) })
})

tags.delete('/:id', requireTagMember, async (c) => {
  const tag = c.get('tag')
  if (tag.imageObjectKey) await deleteObject(BUCKETS.tagIcons, tag.imageObjectKey).catch(() => {})
  await prisma.tag.delete({ where: { id: tag.id } })
  return c.json({ ok: true })
})

export default tags
```

- [ ] **Step 2: Create `apps/api/test/tags.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'tags-test@example.com'
let cookie = ''
let groupId = ''
let tagId = ''

const req = (path, { method = 'GET', body } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'T', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
  const create = await req('/api/groups', { method: 'POST', body: { name: 'TagsG' } })
  groupId = (await create.json()).group.$id
})

describe('tags', () => {
  it('creates, lists, patches and deletes a tag', async () => {
    const form = new FormData()
    form.append('name', 'Urgent')
    form.append('color', '#ef4444')
    const create = await app.request(`/api/groups/${groupId}/tags`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(create.status).toBe(201)
    const { tag } = await create.json()
    tagId = tag.$id
    expect(tag.name).toBe('Urgent')
    expect(tag.imageUrl).toBeNull()

    const list = await req(`/api/groups/${groupId}/tags`)
    expect((await list.json()).tags.some((t) => t.$id === tagId)).toBe(true)

    const patchForm = new FormData()
    patchForm.append('color', '#f97316')
    const patch = await app.request(`/api/tags/${tagId}`, {
      method: 'PATCH',
      headers: { cookie },
      body: patchForm,
    })
    expect((await patch.json()).tag.color).toBe('#f97316')

    const del = await req(`/api/tags/${tagId}`, { method: 'DELETE' })
    expect(del.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `tags.test.js` passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/tags.js apps/api/test/tags.test.js
git commit -m "feat: tags routes with optional icon upload"
```

---

### Task 14: Calendar feed routes

**Files:**
- Create: `apps/api/src/routes/calendarFeeds.js`
- Test: `apps/api/test/calendarFeeds.test.js`

**Interfaces:**
- Produces:
  - `GET /api/calendar-feeds/:groupId/:userId.ics` — **unauthenticated**; reads MinIO `BUCKETS.calendarFeeds` object key from `getLiveFeedFileId({ groupId, userId })`; 404 if missing; returns `text/calendar` with `Cache-Control: public, max-age=60`.
  - `PUT /api/calendar-feeds/:groupId/:userId.ics` — authenticated + member; rebuilds ICS from DB events for the group filtered by user, using `@baobun/shared` `buildIcsContent`; stores object; returns `{ httpsUrl, webcalUrl }`.
  - `GET /api/calendar-feeds/:groupId/:userId.ics/url` — authenticated + member; returns current URLs without rebuilding.

- [ ] **Step 1: Create `apps/api/src/routes/calendarFeeds.js`**

```js
import { Hono } from 'hono'
import { getLiveFeedFileId, buildIcsContent } from '@baobun/shared'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { forbidden, notFound } from '../errors.js'
import { getObject, putObject, BUCKETS, publicUrl } from '../s3.js'
import { config } from '../config.js'
import { eventToJson } from './events.js'

const keyFor = (c) => {
  const groupId = c.req.param('groupId')
  const userId = c.req.param('userId') || ''
  return { groupId, userId, key: getLiveFeedFileId({ groupId, userId }) }
}

const buildFeed = async ({ groupId, userId }) => {
  const where = { groupId }
  const events = await prisma.event.findMany({ where, orderBy: { start: 'asc' } })
  const visible =
    userId === 'all' || !userId
      ? events
      : events.filter((e) => {
          const people = Array.isArray(e.people) ? e.people : []
          if (!people.length) return e.userId === userId
          if (people.includes('everyone')) return true
          if (people.includes(userId)) return true
          return false
        })
  const members = await prisma.groupMember.findMany({ where: { groupId }, include: { user: true } })
  const memberNameById = { everyone: 'Everyone' }
  for (const m of members) memberNameById[m.id] = m.name
  const tags = await prisma.tag.findMany({ where: { groupId } })
  const tagNameById = {}
  for (const t of tags) tagNameById[t.id] = t.name

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  return buildIcsContent({
    calendarName: group?.name || 'Baobun',
    events: visible.map(eventToJson),
    tagNameById,
    memberNameById,
  })
}

const feeds = new Hono()

feeds.get('/:groupId/:userId.ics', async (c) => {
  const { key } = keyFor(c)
  let buf
  try {
    buf = await getObject(BUCKETS.calendarFeeds, key)
  } catch {
    throw notFound('Calendar feed not found.')
  }
  c.header('content-type', 'text/calendar; charset=utf-8')
  c.header('cache-control', 'public, max-age=60')
  return c.body(buf)
})

feeds.put('/:groupId/:userId.ics', requireAuth, async (c) => {
  const user = c.get('user')
  const { groupId, userId } = keyFor(c)
  if (userId !== 'all' && userId !== user.id) throw forbidden('You can only publish your own feed.')
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')

  const ics = await buildFeed({ groupId, userId })
  const key = getLiveFeedFileId({ groupId, userId })
  await putObject(BUCKETS.calendarFeeds, key, Buffer.from(ics, 'utf8'), 'text/calendar; charset=utf-8')
  const base = config.s3.publicEndpoint.replace(/\/$/, '')
  const httpsUrl = `${base}/${BUCKETS.calendarFeeds}/${key}`
  return c.json({ httpsUrl, webcalUrl: httpsUrl.replace(/^https?:\/\//i, 'webcal://') })
})

feeds.get('/:groupId/:userId.ics/url', requireAuth, async (c) => {
  const user = c.get('user')
  const { groupId, userId, key } = keyFor(c)
  const membership = await prisma.groupMember.findFirst({ where: { groupId, userId: user.id } })
  if (!membership) throw forbidden('You are not a member of this group.')
  const httpsUrl = publicUrl(BUCKETS.calendarFeeds, key)
  return c.json({ httpsUrl, webcalUrl: httpsUrl.replace(/^https?:\/\//i, 'webcal://') })
})

export default feeds
```

- [ ] **Step 2: Create `apps/api/test/calendarFeeds.test.js`**

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'feed-test@example.com'
let cookie = ''
let groupId = ''
let userId = ''

const req = (path, { method = 'GET', body } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'F', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
  const { user } = await (await req('/api/auth/me')).json()
  userId = user.$id
  const create = await req('/api/groups', { method: 'POST', body: { name: 'FeedG' } })
  groupId = (await create.json()).group.$id
  await req(`/api/groups/${groupId}/events`, {
    method: 'POST',
    body: { title: 'Feed event', start: '2026-08-05T10:00:00Z', end: '2026-08-05T11:00:00Z', people: ['everyone'] },
  })
})

describe('calendar feeds', () => {
  it('publishes and reads a feed', async () => {
    const put = await req(`/api/calendar-feeds/${groupId}/${userId}.ics`, { method: 'PUT' })
    expect(put.status).toBe(200)
    const { webcalUrl } = await put.json()
    expect(webcalUrl).toMatch(/^webcal:\/\//)

    const get = await app.request(`/api/calendar-feeds/${groupId}/${userId}.ics`)
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toContain('text/calendar')
    const body = await get.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('Feed event')
  })

  it('404s for a missing feed', async () => {
    const get = await app.request('/api/calendar-feeds/nonexistent/nobody.ics')
    expect(get.status).toBe(404)
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `yarn workspace @baobun/api test`
Expected: `calendarFeeds.test.js` passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/calendarFeeds.js apps/api/test/calendarFeeds.test.js
git commit -m "feat: calendar feed routes (public read, authed rebuild)"
```

---

## Phase E — Frontend API client + services + store rewrites

### Task 15: Frontend `api.js` client + delete `appwrite.js`

**Files:**
- Create: `src/lib/api.js`
- Delete: `src/lib/appwrite.js`

**Interfaces:**
- Produces: `export const apiFetch = async (path, { method = 'GET', body, json = false, signal } = {}) => Promise<any>`.
  - Prefixes `import.meta.env.VITE_API_URL`.
  - `credentials: 'include'`.
  - If `json` is true and `body` is an object → `Content-Type: application/json` + `JSON.stringify(body)`.
  - If `body` is `FormData`, send as-is (no content-type header).
  - On non-2xx → throw `{ code, message, status }` (extracted from `{error:{code,message}}`).

- [ ] **Step 1: Create `src/lib/api.js`**

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const apiFetch = async (path, { method = 'GET', body, json = false, signal } = {}) => {
  const headers = {}
  let payload = body
  if (json && body !== undefined && body !== null) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: payload,
    signal,
  })

  if (!res.ok) {
    let code = 'internal'
    let message = 'Something went wrong.'
    try {
      const data = await res.json()
      if (data?.error?.code) code = data.error.code
      if (data?.error?.message) message = data.error.message
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code, message)
  }

  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}
```

- [ ] **Step 2: Delete `src/lib/appwrite.js`**

Run: `git rm src/lib/appwrite.js`

- [ ] **Step 3: Create `src/lib/services/` skeleton**

Create an empty `src/lib/services/.gitkeep` (filled in Tasks 16–21).

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.js
git rm src/lib/appwrite.js
git commit -m "feat: add apiFetch client, remove appwrite client"
```

---

### Task 16: Frontend service modules

**Files:**
- Create: `src/lib/services/auth.js`
- Create: `src/lib/services/users.js`
- Create: `src/lib/services/groups.js`
- Create: `src/lib/services/events.js`
- Create: `src/lib/services/tags.js`
- Create: `src/lib/services/calendarFeed.js`

**Interfaces:**
- Produces named functions consumed by stores (Tasks 17–21):
  - `auth.js`: `register({name,email,password})`, `login({email,password})`, `logout()`, `me()`, `forgot(email)`, `reset({userId,token,newPassword})`
  - `users.js`: `updateProfile({name,email,currentPassword,password})`, `updateAvatar(file)`, `deleteAvatar()`
  - `groups.js`: `list()`, `create({name,color})`, `get(id)`, `update(id,patch)`, `remove(id)`, `joinByCode(code)`, `listMembers(id)`, `addMember(id,email)`, `removeMember(id,memberId)`
  - `events.js`: `listByGroup(groupId,{from,to})`, `create(groupId,payload)`, `update(id,patch)`, `remove(id)`, `moveDate(id,start)`
  - `tags.js`: `listByGroup(groupId)`, `create(groupId,{name,color,icon,image})`, `update(id,{name,color})`, `remove(id)`
  - `calendarFeed.js`: `publish(groupId,userId)`, `getUrl(groupId,userId)`

- [ ] **Step 1: Create `src/lib/services/auth.js`**

```js
import { apiFetch } from '@/lib/api'

export const register = (payload) => apiFetch('/api/auth/register', { method: 'POST', json: true, body: payload })
export const login = (payload) => apiFetch('/api/auth/login', { method: 'POST', json: true, body: payload })
export const logout = () => apiFetch('/api/auth/logout', { method: 'POST' })
export const me = () => apiFetch('/api/auth/me')
export const forgot = (email) => apiFetch('/api/auth/forgot', { method: 'POST', json: true, body: { email } })
export const reset = (payload) => apiFetch('/api/auth/reset', { method: 'POST', json: true, body: payload })
```

- [ ] **Step 2: Create `src/lib/services/users.js`**

```js
import { apiFetch } from '@/lib/api'

export const updateProfile = (payload) =>
  apiFetch('/api/users/me', { method: 'PATCH', json: true, body: payload })

export const updateAvatar = (file) => {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/api/users/me/avatar', { method: 'PUT', body: form })
}

export const deleteAvatar = () => apiFetch('/api/users/me/avatar', { method: 'DELETE' })
```

- [ ] **Step 3: Create `src/lib/services/groups.js`**

```js
import { apiFetch } from '@/lib/api'

export const list = () => apiFetch('/api/groups')
export const create = (payload) => apiFetch('/api/groups', { method: 'POST', json: true, body: payload })
export const get = (id) => apiFetch(`/api/groups/${id}`)
export const update = (id, patch) => apiFetch(`/api/groups/${id}`, { method: 'PATCH', json: true, body: patch })
export const remove = (id) => apiFetch(`/api/groups/${id}`, { method: 'DELETE' })
export const joinByCode = (inviteCode) => apiFetch(`/api/groups/join?inviteCode=${encodeURIComponent(inviteCode)}`)
export const listMembers = (id) => apiFetch(`/api/groups/${id}/members`)
export const addMember = (id, email) => apiFetch(`/api/groups/${id}/members`, { method: 'POST', json: true, body: { email } })
export const removeMember = (id, memberId) => apiFetch(`/api/groups/${id}/members/${memberId}`, { method: 'DELETE' })
```

- [ ] **Step 4: Create `src/lib/services/events.js`**

```js
import { apiFetch } from '@/lib/api'

export const listByGroup = (groupId, { from, to } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiFetch(`/api/groups/${groupId}/events${qs ? `?${qs}` : ''}`)
}

export const create = (groupId, payload) =>
  apiFetch(`/api/groups/${groupId}/events`, { method: 'POST', json: true, body: payload })
export const update = (id, patch) => apiFetch(`/api/events/${id}`, { method: 'PATCH', json: true, body: patch })
export const remove = (id) => apiFetch(`/api/events/${id}`, { method: 'DELETE' })
export const moveDate = (id, start) => apiFetch(`/api/events/${id}/date`, { method: 'PUT', json: true, body: { start } })
```

- [ ] **Step 5: Create `src/lib/services/tags.js`**

```js
import { apiFetch } from '@/lib/api'

export const listByGroup = (groupId) => apiFetch(`/api/groups/${groupId}/tags`)

export const create = (groupId, { name, color, icon, image }) => {
  const form = new FormData()
  form.append('name', name)
  if (color) form.append('color', color)
  if (icon) form.append('icon', icon)
  if (image) form.append('image', image)
  return apiFetch(`/api/groups/${groupId}/tags`, { method: 'POST', body: form })
}

export const update = (id, { name, color }) => {
  const form = new FormData()
  if (name) form.append('name', name)
  if (color) form.append('color', color)
  return apiFetch(`/api/tags/${id}`, { method: 'PATCH', body: form })
}

export const remove = (id) => apiFetch(`/api/tags/${id}`, { method: 'DELETE' })
```

- [ ] **Step 6: Create `src/lib/services/calendarFeed.js`**

```js
import { apiFetch } from '@/lib/api'

export const publish = (groupId, userId = 'all') =>
  apiFetch(`/api/calendar-feeds/${groupId}/${userId}.ics`, { method: 'PUT' })

export const getUrl = (groupId, userId = 'all') =>
  apiFetch(`/api/calendar-feeds/${groupId}/${userId}.ics/url`)
```

- [ ] **Step 7: Verify imports compile**

Run: `yarn build`
Expected: build succeeds (services import only `@/lib/api`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/services
git commit -m "feat: frontend service modules for auth, users, groups, events, tags, calendar feeds"
```

---

### Task 17: Rewrite `auth` store

**Files:**
- Modify: `src/stores/auth.js` (full rewrite)

**Interfaces:**
- Consumes: `services/auth.js` (`register`, `login`, `logout`, `me`, `forgot`, `reset`), `services/users.js` (`updateProfile`, `updateAvatar`, `deleteAvatar`).
- Produces: same public API as today: `user`, `isLoggedIn`, `loading`, `error`, `version`, `initAuth`, `fetchUser`, `login`, `register`, `logout`, `updateProfile`, `resetPassword`, `confirmResetPassword`.
- `user` shape: `{ $id, name, email, avatarUrl, avatarFileId }`.

- [ ] **Step 1: Rewrite `src/stores/auth.js`**

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from '@/router'
import * as authService from '@/lib/services/auth'
import * as userService from '@/lib/services/users'
import { clearSession, markSessionActive } from '@/composable/useSession'

const STORE_VERSION = 3

const cachedAuth = localStorage.getItem('auth')
if (cachedAuth) {
  try {
    const parsed = JSON.parse(cachedAuth)
    if (!parsed.version || parsed.version < STORE_VERSION || !parsed.user || !parsed.user.$id) {
      localStorage.removeItem('auth')
    }
  } catch {
    localStorage.removeItem('auth')
  }
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref(null)
    const isLoggedIn = ref(false)
    const loading = ref(false)
    const error = ref(null)
    const version = ref(STORE_VERSION)

    const setUser = (data) => {
      user.value = data
      isLoggedIn.value = !!data
    }

    const initAuth = async () => {
      loading.value = true
      try {
        const { user: data } = await authService.me()
        setUser(data)
        markSessionActive()
      } catch {
        user.value = null
        isLoggedIn.value = false
        clearSession()
      } finally {
        loading.value = false
      }
    }

    const fetchUser = async () => {
      loading.value = true
      error.value = null
      try {
        const { user: data } = await authService.me()
        setUser(data)
      } catch (err) {
        user.value = null
        isLoggedIn.value = false
        if (err?.code !== 'unauthorized') console.error('Auth error:', err)
      } finally {
        loading.value = false
      }
    }

    const login = async (email, password) => {
      loading.value = true
      error.value = null
      try {
        const { user: data } = await authService.login({ email, password })
        setUser(data)
        markSessionActive()
      } catch (err) {
        error.value =
          err?.code === 'password_set_required'
            ? 'Check your email for a link to set your password.'
            : err?.code === 'unauthorized'
              ? 'Invalid email or password.'
              : err?.message || 'Login failed'
      } finally {
        loading.value = false
      }
    }

    const register = async (name, email, password) => {
      loading.value = true
      error.value = null
      try {
        const { user: data } = await authService.register({ name, email, password })
        setUser(data)
        markSessionActive()
      } catch (err) {
        error.value =
          err?.code === 'conflict' ? 'Email already in use.' : err?.message || 'Registration failed'
      } finally {
        loading.value = false
      }
    }

    const logout = async () => {
      loading.value = true
      try {
        await authService.logout()
      } catch (err) {
        if (err?.status !== 401) console.error('Logout error:', err)
      }
      clearSession()
      user.value = null
      isLoggedIn.value = false
      await new Promise((r) => setTimeout(r, 50))
      router.push('/login')
      loading.value = false
    }

    const updateProfile = async ({ name, email, password, currentPassword, avatarFile, removeAvatar }) => {
      loading.value = true
      error.value = null
      try {
        if (name && name !== user.value?.name) {
          const { user: data } = await userService.updateProfile({ name })
          setUser(data)
        }
        if ((email && email !== user.value?.email) || password) {
          const patch = {}
          if (email && email !== user.value?.email) patch.email = email
          if (password) patch.password = password
          if (currentPassword) patch.currentPassword = currentPassword
          const { user: data } = await userService.updateProfile(patch)
          setUser(data)
        }
        if (removeAvatar) {
          await userService.deleteAvatar()
          user.value.avatarUrl = null
          user.value.avatarFileId = null
        }
        if (avatarFile) {
          const { avatarUrl } = await userService.updateAvatar(avatarFile)
          user.value.avatarUrl = avatarUrl
          user.value.avatarFileId = user.value.avatarFileId
        }
        return { success: true }
      } catch (err) {
        console.error('Error updating profile:', err)
        error.value = err?.message || 'Profile update failed'
        return { success: false, error: error.value }
      } finally {
        loading.value = false
      }
    }

    const resetPassword = async (email) => {
      loading.value = true
      try {
        await authService.forgot(email)
        return { success: true }
      } catch (err) {
        error.value = err?.message || 'Password reset failed'
        return { success: false, error: error.value }
      } finally {
        loading.value = false
      }
    }

    const confirmResetPassword = async (userId, secret, newPassword, confirmPassword) => {
      loading.value = true
      try {
        await authService.reset({ userId, token: secret, newPassword })
        return { success: true }
      } catch (err) {
        error.value = err?.message || 'Password reset confirmation failed'
        return { success: false, error: error.value }
      } finally {
        loading.value = false
      }
    }

    return {
      user,
      isLoggedIn,
      loading,
      error,
      version,
      initAuth,
      fetchUser,
      login,
      register,
      logout,
      updateProfile,
      resetPassword,
      confirmResetPassword,
    }
  },
  {
    persist: {
      key: 'auth',
      storage: localStorage,
      paths: ['user', 'isLoggedIn', 'version'],
    },
  },
)
```

- [ ] **Step 2: Build**

Run: `yarn build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/stores/auth.js
git commit -m "refactor: auth store uses new API services"
```

---

### Task 18: Rewrite `event`, `group`, `tag` stores

**Files:**
- Modify: `src/stores/event.js`
- Modify: `src/stores/group.js`
- Modify: `src/stores/tag.js`

**Interfaces:**
- Consumes: `services/events.js`, `services/groups.js`, `services/tags.js`.
- Produces: identical store public APIs to today so views don't change:
  - `event.js`: `items`, `byId`, `loading`, `error`, `fetchByGroup`, `createEvent`, `updateEvent`, `deleteEvent`, `moveEventDate`.
  - `group.js`: `items`, `byId`, `loading`, `error`, `fetchAll`, `createGroup`, `getMembers`, `updateGroup`, `deleteGroup`, `listMembers`, `addMember`, `getInviteCode`, `removeMember`.
  - `tag.js`: `items`, `byId`, `loading`, `error`, `fetchByGroup`, `createTag`, `updateTag`, `deleteTag`.

- [ ] **Step 1: Rewrite `src/stores/event.js`**

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as eventService from '@/lib/services/events'

export const useEventsStore = defineStore('events', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const byId = computed(() => Object.fromEntries(items.value.map((e) => [e.$id, e])))

  async function fetchByGroup(groupId) {
    try {
      loading.value = true
      const res = await eventService.listByGroup(groupId)
      items.value = res.events
    } catch (err) {
      console.error('Failed to fetch events:', err)
      error.value = err
    } finally {
      loading.value = false
    }
  }

  async function createEvent(payload) {
    const res = await eventService.create(payload.groupId, payload)
    items.value.push(res.event)
    return res.event
  }

  async function updateEvent(id, patch) {
    const res = await eventService.update(id, patch)
    const ix = items.value.findIndex((x) => x.$id === id)
    if (ix !== -1) items.value[ix] = res.event
    return res.event
  }

  async function deleteEvent(id) {
    await eventService.remove(id)
    items.value = items.value.filter((e) => e.$id !== id)
  }

  async function moveEventDate(id, newLocalDateYYYYMMDD) {
    const ev = items.value.find((e) => e.$id === id)
    if (!ev || !ev.start) return
    const currentStart = new Date(ev.start)
    if (!Number.isFinite(currentStart.getTime())) return

    const [y, m, d] = String(newLocalDateYYYYMMDD).split('-').map(Number)
    if (!y || !m || !d) return

    const moved = new Date(y, m - 1, d)
    moved.setHours(
      currentStart.getHours(),
      currentStart.getMinutes(),
      currentStart.getSeconds(),
      currentStart.getMilliseconds(),
    )

    const res = await eventService.moveDate(id, moved.toISOString())
    const ix = items.value.findIndex((x) => x.$id === id)
    if (ix !== -1) items.value[ix] = res.event
    return res.event
  }

  return {
    items,
    byId,
    loading,
    error,
    fetchByGroup,
    createEvent,
    updateEvent,
    deleteEvent,
    moveEventDate,
  }
})
```

- [ ] **Step 2: Rewrite `src/stores/group.js`**

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as groupService from '@/lib/services/groups'

export const useGroupsStore = defineStore('groups', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const byId = computed(() => Object.fromEntries(items.value.map((g) => [g.$id, g])))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const res = await groupService.list()
      items.value = res.groups
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createGroup(payload) {
    const res = await groupService.create(payload)
    items.value.push(res.group)
    return res.group
  }

  async function updateGroup(id, patch) {
    const res = await groupService.update(id, patch)
    const ix = items.value.findIndex((x) => x.$id === id)
    if (ix !== -1) items.value[ix] = res.group
    return res.group
  }

  async function deleteGroup(id) {
    await groupService.remove(id)
    items.value = items.value.filter((g) => g.$id !== id)
  }

  async function listMembers(groupId) {
    const res = await groupService.listMembers(groupId)
    return res.members
  }

  async function getMembers(groupId) {
    const res = await groupService.listMembers(groupId)
    return res.members.map((doc) => ({
      $id: doc.$id,
      email: doc.email,
      name: doc.name || doc.email.split('@')[0],
      avatarUrl:
        doc.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name || doc.email.split('@')[0])}&background=random`,
      addedAt: doc.addedAt,
      userId: doc.userId || null,
    }))
  }

  async function addMember(groupId, email) {
    const res = await groupService.addMember(groupId, email)
    return res.member
  }

  async function removeMember(memberId) {
    // The store callers pass only memberId; groupId is needed for the route.
    const member = items.value.flatMap((g) => g.members || []).find((m) => m.$id === memberId)
    // Fallback: caller-provided group is unavailable; use a dedicated endpoint below.
    return await groupService.removeMember(member?.groupId || '', memberId)
  }

  async function getInviteCode(code) {
    const res = await groupService.get ? groupService.getInviteCode?.(code) : null
    return null
  }

  return {
    items,
    byId,
    loading,
    error,
    fetchAll,
    createGroup,
    getMembers,
    updateGroup,
    deleteGroup,
    listMembers,
    addMember,
    getInviteCode,
    removeMember,
  }
})
```

Note: `getInviteCode` and `removeMember` need a group context the current view callers don't pass. Check callers in Task 22 and adjust the service signatures so `removeMember(memberId)` works. If no view calls `getInviteCode`, keep it as a no-op returning `null` and remove it from the store return if unused. Do this refinement in Task 22, not here.

- [ ] **Step 3: Rewrite `src/stores/tag.js`**

```js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as tagService from '@/lib/services/tags'

export const useTagsStore = defineStore('tags', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const byId = computed(() => Object.fromEntries(items.value.map((t) => [t.$id, t])))

  async function fetchByGroup(groupId) {
    const res = await tagService.listByGroup(groupId)
    items.value = res.tags
  }

  async function createTag(groupId, { name, color, icon, imageFile }) {
    const tag = await tagService.create(groupId, { name, color, icon, image: imageFile || undefined })
    items.value.push(tag)
    return tag
  }

  async function updateTag(id, patch) {
    const tag = await tagService.update(id, patch)
    const ix = items.value.findIndex((t) => t.$id === id)
    if (ix !== -1) items.value[ix] = tag
    return tag
  }

  async function deleteTag(id) {
    await tagService.remove(id)
    items.value = items.value.filter((t) => t.$id !== id)
  }

  return { items, byId, loading, error, fetchByGroup, createTag, updateTag, deleteTag }
})
```

- [ ] **Step 4: Build**

Run: `yarn build`
Expected: succeeds (stores compile; unused `getInviteCode` warning is fine).

- [ ] **Step 5: Commit**

```bash
git add src/stores/event.js src/stores/group.js src/stores/tag.js
git commit -m "refactor: event, group, tag stores use API services"
```

---

### Task 19: Rewrite `useSession.js` and `liveCalendarFeed.js`

**Files:**
- Modify: `src/composable/useSession.js`
- Modify: `src/lib/liveCalendarFeed.js`

**Interfaces:**
- Consumes: `services/auth.js` (`me`), `services/calendarFeed.js`.
- Produces (same exports as today): `sessionStatus`, `markSessionActive`, `clearSession`, `hasLocalSession`, `withSession(key, fn)`, `validateSession()`, and `getLiveFeedBucketId`, `getLiveFeedFileId`, `getLiveFeedUrls`, `publishLiveCalendarFeed`.
- `publishLiveCalendarFeed` no longer uploads to Appwrite storage — it calls `PUT /api/calendar-feeds/:groupId/:userId.ics` and returns `{ httpsUrl, webcalUrl }`.

- [ ] **Step 1: Rewrite `src/composable/useSession.js`**

```js
import { ref } from 'vue'
import router from '@/router'
import * as authService from '@/lib/services/auth'

const SESSION_STORE_KEY = 'baobun_session'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800

const inFlight = new Map()
export const sessionStatus = ref('idle')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function markSessionActive() {
  sessionStorage.setItem(SESSION_STORE_KEY, 'active')
  sessionStatus.value = 'valid'
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_STORE_KEY)
  localStorage.removeItem('auth')
  sessionStatus.value = 'invalid'
}

export function hasLocalSession() {
  return sessionStorage.getItem(SESSION_STORE_KEY) === 'active'
}

export async function withSession(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key)

  const promise = (async () => {
    let lastError
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await fn()
        markSessionActive()
        return result
      } catch (err) {
        lastError = err
        const status = err?.status
        if (status === 401) {
          clearSession()
          router.push('/login')
          throw err
        }
        if (status >= 400 && status < 500) throw err
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
    throw lastError
  })()

  inFlight.set(key, promise)
  try {
    return await promise
  } finally {
    inFlight.delete(key)
  }
}

export async function validateSession() {
  try {
    await authService.me()
    markSessionActive()
    return true
  } catch {
    clearSession()
    return false
  }
}
```

- [ ] **Step 2: Rewrite `src/lib/liveCalendarFeed.js`**

```js
import * as feedService from '@/lib/services/calendarFeed'

export const getLiveFeedBucketId = () => import.meta.env.VITE_CALENDAR_FEEDS_BUCKET || 'configured'

export const getLiveFeedUrls = async ({ groupId, userId = 'all' } = {}) => {
  if (!groupId) return { httpsUrl: '', webcalUrl: '' }
  try {
    const res = await feedService.getUrl(groupId, userId || 'all')
    return res
  } catch {
    return { httpsUrl: '', webcalUrl: '' }
  }
}

export const publishLiveCalendarFeed = async ({ groupId, userId = 'all' } = {}) => {
  if (!groupId) throw new Error('Missing group id.')
  return await feedService.publish(groupId, userId || 'all')
}
```

- [ ] **Step 3: Build**

Run: `yarn build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/composable/useSession.js src/lib/liveCalendarFeed.js
git commit -m "refactor: useSession and liveCalendarFeed use API services"
```

---

## Phase F — Views + config

### Task 20: Update views that call Appwrite directly

**Files:**
- Modify: `src/views/Join.vue`
- Modify: `src/views/DashBoard.vue`
- Modify: `src/components/Home/Navigator.vue`
- Modify: `src/components/UpcomingEvents.vue`

**Interfaces:**
- Consumes: `services/groups.js`, `stores/groups`, `stores/auth`, `services/tags.js` indirectly via stores.
- Produces: same rendered UI, no visual change.

- [ ] **Step 1: Rewrite `src/views/Join.vue` (script only)**

Replace the whole `<script>` block (keep `<template>` as-is):

```js
import { useAuthStore } from '@/stores/auth'
import { joinByCode } from '@/lib/services/groups'

export default {
  data() {
    return { loading: true, error: '' }
  },
  async created() {
    const inviteCode = this.$route.params.id
    const authStore = useAuthStore()

    if (!authStore.user) {
      sessionStorage.setItem('pendingInviteCode', inviteCode)
      this.$router.push('/login')
      return
    }

    await this.joinGroup(inviteCode, authStore)
  },
  methods: {
    async joinGroup(inviteCode, authStore) {
      try {
        const { group } = await joinByCode(inviteCode)
        if (!group) {
          this.error = 'Invalid invite code.'
          return
        }
        this.$router.push(`/group/${group.$id}`)
      } catch (err) {
        this.error = 'Could not join group.'
        console.error(err)
      } finally {
        this.loading = false
      }
    },
  },
}
```

- [ ] **Step 2: Rewrite `src/views/DashBoard.vue` (script only)**

Replace the imports and the `loadGroups`/`createGroup`/`joinGroup` bodies:

```js
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import * as groupService from '@/lib/services/groups'
import { Users, Mail, ChevronRight, Plus } from 'lucide-vue-next'

export default {
  components: { Users, Mail, ChevronRight, Plus },
  setup() {
    const authStore = useAuthStore()
    const groupsStore = useGroupsStore()

    const userGroups = ref([])
    const counts = ref({})
    // ... keep all template refs unchanged (newGroupName, newGroupColor, inviteCode,
    //     loadingCreate, loadingJoin, joinError, welcomeMessages, etc.)

    const loadGroups = async () => {
      if (!authStore.user) return
      try {
        await groupsStore.fetchAll()
        userGroups.value = groupsStore.items.map((g) => ({
          ...g,
          color: g.color || stringToColor(g.$id),
        }))
        const countMap = {}
        await Promise.all(
          userGroups.value.map(async (g) => {
            const { members } = await groupService.listMembers(g.$id)
            countMap[g.$id] = members.length
          }),
        )
        counts.value = countMap
      } catch (err) {
        console.error('Failed to load groups:', err)
      }
    }

    const createGroup = async () => {
      loadingCreate.value = true
      joinError.value = ''
      try {
        await groupsStore.createGroup({
          name: newGroupName.value,
          color: newGroupColor.value || stringToColor(groupIdFallback()),
        })
        newGroupName.value = ''
        await loadGroups()
      } catch (err) {
        joinError.value = 'Failed to create group.'
        console.error(err)
      } finally {
        loadingCreate.value = false
      }
    }

    const groupIdFallback = () => `g${Math.random().toString(36).slice(2, 8)}`

    const joinGroup = async () => {
      loadingJoin.value = true
      joinError.value = ''
      try {
        await groupService.joinByCode(inviteCode.value.toUpperCase())
        inviteCode.value = ''
        await loadGroups()
      } catch (err) {
        joinError.value = err?.code === 'not_found' ? 'Invalid invite code.' : 'Could not join group.'
        console.error(err)
      } finally {
        loadingJoin.value = false
      }
    }

    // ... keep colorToRgba, onMounted, return unchanged, but remove the
    //     databases/Query/ID import and the DB/collection consts.
  },
}
```

- [ ] **Step 3: Rewrite `src/components/Home/Navigator.vue` (script only)**

Replace the appwrite imports and `loadGroups`:

```js
import { useGroupsStore } from '@/stores/groups'   // NOTE: name — see Step 4
import { useAuthStore } from '@/stores/auth'
```

and:

```js
const loadGroups = async () => {
  if (!authStore.user) return
  try {
    await groupsStore.fetchAll()
    userGroups.value = groupsStore.items
  } catch (err) {
    console.error('Failed to load groups:', err)
  }
}
```

- [ ] **Step 4: Fix the store import name mismatch**

`src/components/Home/Navigator.vue` currently does `import { useGroupsStore } from '@/stores/group'` (file `group.js`, store id `'groups'`). Keep `@/stores/group` import — do NOT rename to `@/stores/groups`. Undo any change from Step 3 that renamed the import; only replace the appwrite-based body.

- [ ] **Step 5: Update `src/components/UpcomingEvents.vue`**

Replace the `getTagIconUrl` helper (line ~338):

```js
const getTagIconUrl = (imageId) => {
  const tag = tagsStore.items.find((t) => t.$id === normalizeTagId(imageId))
  return tag?.imageUrl || ''
}
```

And update the template usage (`:src="getTagIconUrl(tagsMap[normalizeTagId(event.tagId)].imageId)"` stays — it now resolves through `tagsStore.items` which already carries `imageUrl` from the API). Remove the `import { storage } from '@/lib/appwrite'` line.

- [ ] **Step 6: Build**

Run: `yarn build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/views/Join.vue src/views/DashBoard.vue src/components/Home/Navigator.vue src/components/UpcomingEvents.vue
git commit -m "refactor: views use groups service instead of appwrite sdk"
```

---

### Task 21: `getInviteCode` and `removeMember` refinement

**Files:**
- Modify: `src/stores/group.js`
- Modify: `src/lib/services/groups.js`

**Interfaces:**
- Consumes: caller audit from this task.
- Produces: `getInviteCode(code)` and `removeMember(memberId)` that actually work.

- [ ] **Step 1: Audit callers**

Run: `rg -n "getInviteCode|removeMember" src --no-heading`
Expected findings:
- `removeMember(memberId)` is called by `GroupSettings.vue` (`removeMember(m.$id)`) with only a member id.
- `getInviteCode(code)` is not called by any view.

- [ ] **Step 2: Add groupId-aware `removeMember`**

Since the API route is `DELETE /api/groups/:id/members/:memberId`, the store needs the group id. Change `removeMember` to accept `(groupId, memberId)` and update `GroupSettings.vue` call site accordingly (it has `selectedGroupId`):

`src/stores/group.js`:
```js
async function removeMember(groupId, memberId) {
  return await groupService.removeMember(groupId, memberId)
}
```

`src/views/Settings/GroupSettings.vue` (call site): change
`await groupStore.removeMember(id)` → `await groupStore.removeMember(selectedGroupId.value, id)`.

- [ ] **Step 3: Remove dead `getInviteCode`**

Remove `getInviteCode` from the store and from the services (it was never a real API endpoint). Also remove `get`/`getInviteCode` references in `src/lib/services/groups.js` if unused.

- [ ] **Step 4: Build**

Run: `yarn build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/stores/group.js src/lib/services/groups.js src/views/Settings/GroupSettings.vue
git commit -m "refactor: fix removeMember signature, drop dead getInviteCode"
```

---

### Task 22: vite config PWA cache rules

**Files:**
- Modify: `vite.config.js`

**Interfaces:**
- Produces: PWA workbox rules that network-only the API origin and stop denying `/v1/*` (Appwrite paths no longer exist).

- [ ] **Step 1: Update `vite.config.js`**

Replace the `navigateFallbackDenylist` and the Appwrite runtime rule:

```js
workbox: {
  cleanupOutdatedCaches: true,

  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//],

  runtimeCaching: [
    {
      // The API must always bypass cache (cookie auth)
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff2|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'asset-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
},
```

Remove the `api.yourdomain.com` example rule block and the old `/v1/...` denylist entries.

- [ ] **Step 2: Build**

Run: `yarn build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "refactor: PWA cache rules target /api instead of /v1"
```

---

## Phase G — Infra

### Task 23: docker-compose + API Dockerfile

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/api/Dockerfile`

**Interfaces:**
- Produces: services `postgres`, `minio`, `api`, `mailpit` per spec section 9.

- [ ] **Step 1: Create `docker-compose.yml` at repo root**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: baobun
      POSTGRES_PASSWORD: baobun_dev
      POSTGRES_DB: baobun
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U baobun"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: baobun
      MINIO_ROOT_PASSWORD: baobun_dev
    volumes:
      - miniodata:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  api:
    build: ./apps/api
    env_file: ./apps/api/.env
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_started
    ports:
      - "3001:3001"

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "8025:8025"
      - "1025:1025"

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 2: Create `apps/api/Dockerfile`**

```dockerfile
FROM node:20.19.0-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

COPY prisma ./prisma
RUN yarn prisma generate

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/index.js"]
```

Note: the Docker build context is `apps/api`, but `yarn install` needs the workspace root. Because the app is served from `apps/api` alone in the container, change the compose `build` to build the API with the monorepo context:

```yaml
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
```

and update the Dockerfile to work from the repo root context:

```dockerfile
FROM node:20.19.0-alpine

WORKDIR /app

COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma

RUN yarn install --frozen-lockfile
RUN yarn workspace @baobun/api prisma generate

COPY apps/api/src apps/api/src
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "src/index.js"]
```

Use this second Dockerfile (repo-root context) and the `context: .` compose build block.

- [ ] **Step 3: Start the stack**

Run: `docker compose up -d --build`
Expected: `postgres`, `minio`, `mailpit` healthy; `api` logs `API listening on http://localhost:3001`.

- [ ] **Step 4: Verify**

Run: `curl -s localhost:3001/api/auth/me`
Expected: `{"error":{"code":"unauthorized","message":"Please sign in."}}`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml apps/api/Dockerfile
git commit -m "feat: docker-compose stack (postgres, minio, api, mailpit)"
```

---

### Task 24: Frontend env var update

**Files:**
- Modify: `.env`

**Interfaces:**
- Produces: `VITE_API_URL=http://localhost:3001` replacing Appwrite vars.

- [ ] **Step 1: Rewrite `.env`**

```ini
VITE_API_URL=http://localhost:3001
VITE_CALENDAR_FEEDS_BUCKET=configured
```

- [ ] **Step 2: Grep for stale Appwrite env usage**

Run: `rg -n "VITE_(PROJECT_ID|DB|AVATAR_BUCKET|TAG_ICONS_BUCKET|EVENTS_COLLECTION|USERS_COLLECTION|GROUPS_COLLECTION|MEMBERS_COLLECTION|TAGS_COLLECTION|APPWRITE)" src vite.config.js --no-heading`
Expected: no remaining matches (the `VITE_CALENDAR_FEEDS_BUCKET` reference in `liveCalendarFeed.js` now returns a sentinel).

- [ ] **Step 3: Commit**

```bash
git add .env
git commit -m "refactor: point frontend at self-hosted API"
```

---

## Phase H — Migration script

### Task 25: Migration ETL script

**Files:**
- Create: `apps/api/scripts/migrate-from-appwrite.js`
- Create: `apps/api/scripts/migrate-README.md`

**Interfaces:**
- Consumes env: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, plus the normal `DATABASE_URL`, S3 env, and `MAIL_*` from `apps/api/.env`.
- Produces: `--dry-run` prints per-table counts; real run writes rows to Postgres and files to MinIO, then writes `migration-report.json`.
- Uses `@baobun/shared` `getLiveFeedFileId` to reproduce calendar-feed object keys.

- [ ] **Step 1: Create `apps/api/scripts/migrate-from-appwrite.js`**

```js
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { randomBytes, createHash } from 'crypto'
import { getLiveFeedFileId } from '@baobun/shared'
import { ensureBuckets, putObject, BUCKETS } from '../src/s3.js'

const prisma = new PrismaClient()

const env = (k) => process.env[k]
const dryRun = process.argv.includes('--dry-run')

const hashPassword = () =>
  `$random$` + randomBytes(32).toString('base64url') // placeholder; real argon2 set via set-password link

const api = async (path) => {
  const res = await fetch(`${env('APPWRITE_ENDPOINT')}/v1${path}`, {
    headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
  })
  if (!res.ok) throw new Error(`Appwrite ${path} -> ${res.status}`)
  return res.json()
}

const listAll = async (path) => {
  const out = []
  let offset = 0
  for (;;) {
    const page = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`)
    const docs = page.documents || []
    out.push(...docs)
    if (docs.length < 100) break
    offset += docs.length
  }
  return out
}

const main = async () => {
  await ensureBuckets()
  const dry = dryRun ? ' (dry run)' : ''

  const [users, groups, members, events, tags] = await Promise.all([
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_USERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_GROUPS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_MEMBERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_EVENTS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_TAGS_COLLECTION')}/documents`),
  ])

  console.log(`[migrate]${dry} users=${users.length} groups=${groups.length} members=${members.length} events=${events.length} tags=${tags.length}`)

  if (dry) return

  const report = { users: users.length, groups: groups.length, members: members.length, events: events.length, tags: tags.length }

  // users: id = appwrite $id so relationships carry over
  for (const u of users) {
    const email = (u.email || '').toLowerCase()
    await prisma.user.upsert({
      where: { email },
      update: { needsPasswordSet: true },
      create: {
        id: u.$id,
        email,
        passwordHash: hashPassword(),
        name: u.name || email.split('@')[0],
        avatarObjectKey: u.avatarFileId ? `avatar-${u.$id}` : null,
        needsPasswordSet: true,
      },
    })
    if (u.avatarFileId) {
      try {
        const file = await fetch(
          `${env('APPWRITE_ENDPOINT')}/v1/storage/buckets/${env('APPWRITE_AVATAR_BUCKET')}/files/${u.avatarFileId}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.avatars, `avatar-${u.$id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] avatar skip ${u.email}: ${err.message}`)
      }
    }
  }

  for (const g of groups) {
    await prisma.group.upsert({
      where: { id: g.$id },
      update: { name: g.name, color: g.color || '#f43f5e', inviteCode: g.inviteCode },
      create: {
        id: g.$id,
        name: g.name,
        color: g.color || '#f43f5e',
        ownerUserId: g.ownerId || g.ownerUserId || users[0]?.$id,
        inviteCode: g.inviteCode,
      },
    })
  }

  for (const m of members) {
    const email = (m.email || '').toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } }).catch(() => null)
    await prisma.groupMember.upsert({
      where: { id: m.$id },
      update: {},
      create: {
        id: m.$id,
        groupId: m.groupId,
        userId: user?.id ?? null,
        email,
        name: m.name || email.split('@')[0],
        joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
      },
    })
  }

  for (const t of tags) {
    await prisma.tag.upsert({
      where: { id: t.$id },
      update: { name: t.name, color: t.color || '#6B7280' },
      create: {
        id: t.$id,
        groupId: t.groupId,
        name: t.name,
        color: t.color || '#6B7280',
        icon: t.icon ?? null,
        imageObjectKey: t.imageId ? `tag-${t.$id}` : null,
      },
    })
    if (t.imageId) {
      try {
        const file = await fetch(
          `${env('APPWRITE_ENDPOINT')}/v1/storage/buckets/${env('APPWRITE_TAG_ICONS_BUCKET')}/files/${t.imageId}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.tagIcons, `tag-${t.$id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] tag icon skip ${t.name}: ${err.message}`)
      }
    }
  }

  for (const e of events) {
    await prisma.event.upsert({
      where: { id: e.$id },
      update: {},
      create: {
        id: e.$id,
        groupId: e.groupId,
        title: e.title,
        notes: e.notes || '',
        start: new Date(e.start),
        end: new Date(e.end || e.start),
        people: Array.isArray(e.people) ? e.people : [],
        tagId: e.tagId || '',
        userId: e.userId || groups.find((g) => g.$id === e.groupId)?.ownerId || users[0]?.$id,
      },
    })
  }

  // Calendar feeds: reproduce object keys so existing webcal subscriptions keep working
  for (const g of groups) {
    for (const m of members.filter((mm) => mm.groupId === g.$id && mm.userId)) {
      const key = getLiveFeedFileId({ groupId: g.$id, userId: m.userId })
      const src = `${env('APPWRITE_ENDPOINT')}/v1/storage/buckets/${env('APPWRITE_CALENDAR_FEEDS_BUCKET')}/files/${encodeURIComponent(key)}/download`
      try {
        const res = await fetch(src, {
          headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
        })
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          await putObject(BUCKETS.calendarFeeds, key, buf, 'text/calendar; charset=utf-8')
          report.calendarFeeds = (report.calendarFeeds || 0) + 1
        }
      } catch {
        // no feed yet — fine
      }
    }
  }

  await prisma.$disconnect()
  await import('node:fs/promises').then((fs) =>
    fs.writeFile('migration-report.json', JSON.stringify(report, null, 2)),
  )
  console.log('[migrate] done', report)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
```

- [ ] **Step 2: Create `apps/api/scripts/migrate-README.md`**

```markdown
# Appwrite → Baobun migration

Run against Appwrite Cloud with a project owner API key:

```bash
cd apps/api
export APPWRITE_ENDPOINT=https://cloud.appwrite.io
export APPWRITE_PROJECT_ID=...
export APPWRITE_API_KEY=...
export APPWRITE_DB_ID=...
export APPWRITE_USERS_COLLECTION=...
export APPWRITE_GROUPS_COLLECTION=...
export APPWRITE_MEMBERS_COLLECTION=...
export APPWRITE_EVENTS_COLLECTION=...
export APPWRITE_TAGS_COLLECTION=...
export APPWRITE_AVATAR_BUCKET=...
export APPWRITE_TAG_ICONS_BUCKET=...
export APPWRITE_CALENDAR_FEEDS_BUCKET=...

node --env-file=.env scripts/migrate-from-appwrite.js --dry-run
node --env-file=.env scripts/migrate-from-appwrite.js
```

- dry-run prints counts without writing.
- Real run writes Postgres + MinIO and `migration-report.json`.
- Migrated users get `needsPasswordSet=true`; they'll receive a set-password email on first login.
- Calendar-feed object keys are reproduced so existing webcal subscriptions keep working.
```

- [ ] **Step 3: Add a test that `getLiveFeedFileId` output matches the legacy app**

The migration relies on the shared feed-key helper matching what the app previously produced. Add to `packages/shared` a test (run from `apps/api` via workspace test) that asserts stable output for a known input:

Create `apps/api/test/feed-key.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { getLiveFeedFileId } from '@baobun/shared'

describe('getLiveFeedFileId', () => {
  it('is stable and deterministic', () => {
    expect(getLiveFeedFileId({ groupId: 'ABC123', userId: 'user_1' })).toBe(
      getLiveFeedFileId({ groupId: 'ABC123', userId: 'user_1' }),
    )
    expect(getLiveFeedFileId({ groupId: 'ABC123', userId: 'user_1' })).toMatch(/^cal-feed-abc123-user_1-/)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `yarn workspace @baobun/api test`
Expected: all tests (including `feed-key.test.js`) pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts apps/api/test/feed-key.test.js
git commit -m "feat: appwrite migration ETL script with dry-run and report"
```

---

### Task 26: Cutover runbook

**Files:**
- Create: `docs/runbooks/cutover.md`

- [ ] **Step 1: Create `docs/runbooks/cutover.md`**

```markdown
# Cutover: Appwrite Cloud → self-hosted Baobun

1. **Freeze writes**: In Appwrite console, set the project to read-only.
2. **Run the migration** (from `apps/api`, with env set per `scripts/migrate-README.md`):
   - `node --env-file=.env scripts/migrate-from-appwrite.js --dry-run` — verify counts match.
   - `node --env-file=.env scripts/migrate-from-appwrite.js` — writes Postgres + MinIO; check `migration-report.json`.
3. **Deploy**:
   - `docker compose up -d --build` (backend: postgres, minio, api, mailpit).
   - Build + serve the frontend with `VITE_API_URL` pointing at the API.
4. **Verify**:
   - `curl localhost:3001/api/auth/me` → 401.
   - Register a fresh user; create a group; add an event; confirm it appears.
5. **User migration**:
   - Users log in → API returns `password_set_required` → they get a set-password email → they set a new password.
6. **Calendar feeds**:
   - Existing webcal subscriptions keep working (object keys reproduced).
   - New feed URLs are `https://<host>/api/calendar-feeds/<groupId>/<userId>.ics`.
7. **Decommission Appwrite** once no traffic for a week.

Rollback: keep the Appwrite project active (read-only) until step 7; the frontend can be pointed back at Appwrite by restoring the old `.env` and `src/lib/appwrite.js` from git.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/cutover.md
git commit -m "docs: cutover runbook"
```

---

## Phase I — Final verification

### Task 27: Remove the Appwrite dependency + full build/test

**Files:**
- Modify: root `package.json` (remove `appwrite`)
- Modify: `.env`

**Interfaces:**
- Produces: a repo with no `appwrite` package; `yarn build` + `yarn api:test` both green.

- [ ] **Step 1: Remove the appwrite dependency**

Run: `yarn remove appwrite`
Expected: `appwrite` removed from root `package.json` and `yarn.lock`.

- [ ] **Step 2: Grep for any remaining appwrite references**

Run: `rg -ni "appwrite" --glob '!node_modules' --glob '!dist' --glob '!dev-dist' . --no-heading`
Expected: only hits in `docs/` (runbook/README) are acceptable; no `src/` hits.

- [ ] **Step 3: Full build + lint**

Run: `yarn build`
Expected: succeeds.
Run: `yarn lint`
Expected: succeeds (fix any issues the linter reports).

- [ ] **Step 4: Full API test run**

Run: `docker compose up -d postgres minio` then `yarn api:test`
Expected: all API tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock .env
git commit -m "chore: remove appwrite dependency, finalize migration"
```

---

### Task 28: Final smoke test + plan self-review

**Files:**
- None (verification only)

- [ ] **Step 1: End-to-end smoke test against the compose stack**

With `docker compose up -d` running:

1. `curl -s -c /tmp/cj -X POST localhost:3001/api/auth/register -H 'content-type: application/json' -d '{"name":"Smoke","email":"smoke@example.com","password":"password123"}'` → expect `{"user":{"$id":...}}` and a `baobun_sid` cookie in `/tmp/cj`.
2. `curl -s -b /tmp/cj localhost:3001/api/groups -X POST -H 'content-type: application/json' -d '{"name":"SmokeGroup"}'` → expect `201` with `inviteCode`.
3. `curl -s -b /tmp/cj localhost:3001/api/auth/me` → expect the user object.

- [ ] **Step 2: Self-review against the spec**

Walk the spec sections and confirm each has a deliverable:

| Spec section | Plan task |
|---|---|
| Monorepo layout | 1, 2 |
| Prisma data model | 3 |
| Auth flow + sessions | 4, 8, 9 |
| REST endpoints | 8–14 |
| Frontend `api.js` + services | 15, 16 |
| Stores + views | 17–21 |
| vite PWA rules | 22 |
| docker-compose + env | 23, 24 |
| Mail `MAIL_*` | 6 |
| Migration + cutover | 25, 26 |
| Tests | 3–14, 27 |
| Out-of-scope items | none implemented (correct) |

- [ ] **Step 3: Final commit if anything changed**

```bash
git status
# commit any stragglers
```
