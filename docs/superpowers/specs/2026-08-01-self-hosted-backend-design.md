# Baobun — Migrate from Appwrite Cloud to a Self-Hosted Backend

Date: 2026-08-01
Status: Approved

## 1. Goal

Replace Appwrite Cloud (auth, database, storage) with a self-hosted stack on a single
VPS/homelab via docker-compose, and move the app's transactional mail to a pluggable
SMTP relay (Gmail alias or any provider).

The frontend PWA keeps its current UI and behavior. Only the data layer changes.

## 2. Decisions

| Topic | Decision |
|---|---|
| Backend direction | Replace Appwrite entirely |
| Backend stack | Node + Hono + Prisma |
| Database | Postgres 16 (docker-compose) |
| Object storage | MinIO (docker-compose, S3-compatible) |
| Auth | Opaque session cookie + DB `sessions` table |
| Session | HttpOnly `baobun_sid` cookie, 30-day rolling expiry |
| Password hashing | argon2id (`@node-rs/argon2`) |
| Mail | Nodemailer SMTP transport driven by `MAIL_*` env flags |
| Repo layout | Monorepo: `apps/api`, `apps/web`, `packages/shared`, `infra/` |
| Frontend API client | Thin `fetch` wrapper (`src/lib/api.js`) + per-domain service modules |
| Cut-over | Big-bang frontend PR; run ETL script before deploy |
| Migration | One-shot ETL script reading Appwrite admin REST API into Postgres + MinIO |
| Migrated-user auth | Lazy one-time set-password link, emailed on first failed login |

## 3. Architecture

```
+----------------------------+   HTTPS   +----------------------------+
| Browser / PWA (Vue, apps/web) <------> | apps/api (Hono, Node)      |
|  src/lib/api.js (fetch)    | JSON/cookie| cookie auth, REST /api/*   |
+----------------------------+           +----------------------------+
                                                |        |         |
                      +-------------------------+        |         +-----------------+
                      v                                  v                         v
               +--------------+                 +--------------+           +----------------+
               | Postgres 16  |                 | MinIO        |           | SMTP relay     |
               | Prisma       |                 | avatars,     |           | MAIL_HOST=...  |
               | migrations   |                 | tag-icons,   |           | (Gmail alias / |
               +--------------+                 | calendar-    |           |  any provider) |
                                                | feeds        |           +----------------+
                                                +--------------+

+-------------------+
| apps/web (Vue3)   |
|  lib/appwrite.js  -> lib/api.js
|  5 Pinia stores   -> service modules
+-------------------+
```

## 4. Data model (Prisma)

snake_case in DB, camelCase in JS.

### users
- `id` uuid PK
- `email` citext unique
- `password_hash` text (argon2id)
- `name` text
- `avatar_object_key` text nullable
- `needs_password_set` boolean, default false (set for migrated users)
- `created_at` timestamptz

`avatarUrl` and `avatarFileId` from Appwrite collapse into `avatar_object_key`; URL is
derived server-side via presigned GET.

### sessions
- `id` text PK — random 32-byte base64url, the cookie value
- `user_id` uuid FK -> users.id
- `created_at` timestamptz
- `expires_at` timestamptz (30d, rolling)
- `user_agent` text nullable
- `ip` text nullable
- Index: `(user_id)`, `(expires_at)`

### password_reset_tokens
- `id` uuid PK
- `user_id` uuid FK -> users.id
- `token_hash` text — sha256 of the raw emailed token
- `expires_at` timestamptz (1h)
- `used_at` timestamptz nullable
- Index: `(user_id)`

### groups
- `id` uuid PK
- `name` text
- `owner_user_id` uuid FK -> users.id
- `invite_code` text unique (8-char uppercase)
- `created_at` timestamptz

### group_members
- `id` uuid PK
- `group_id` uuid FK -> groups.id
- `user_id` uuid FK -> users.id, nullable (pending invite for non-registered email)
- `email` citext
- `name` text
- `joined_at` timestamptz
- Unique: `(group_id, user_id)` where `user_id IS NOT NULL`; `(group_id, email)` always

### events
- `id` uuid PK
- `group_id` uuid FK -> groups.id
- `title` text
- `description` text nullable
- `start` timestamptz
- `end` timestamptz nullable
- `tag_ids` uuid[]
- `created_by` uuid FK -> users.id
- `created_at` timestamptz

### tags
- `id` uuid PK
- `group_id` uuid FK -> groups.id
- `name` text
- `color` text
- `icon` text
- `image_object_key` text nullable

## 5. Auth flow

Endpoints under `/api/auth`:

- `POST /auth/register {name, email, password}` — argon2 hash, create user, create session, set cookie, return user. Reject passwords < 8 chars. 409 on duplicate email.
- `POST /auth/login {email, password}` — verify; create session; set cookie.
  - If `user.needs_password_set` is true, verification fails; the API lazily emails a one-time set-password link (see section 8) and returns a 401 with `code: "password_set_required"`.
- `POST /auth/logout` — delete session row, clear cookie.
- `GET /auth/me` — read session cookie, join user, return.
- `POST /auth/forgot {email}` — create `password_reset_tokens` row, send email with link `${WEB_ORIGIN}/reset-password?id=<userId>&token=<raw>`. Always returns 200 (no user enumeration).
- `POST /auth/reset {id, token, newPassword}` — hash incoming token, look up valid row, set new password, mark used, delete other rows for the user. If the user was `needs_password_set`, clear that flag.

Cookie: `HttpOnly; Secure; SameSite=Lax; Path=/;` name `baobun_sid`. Secure off in dev.

Authorization: every handler touching a group/event/tag/member verifies the requesting user
is a `group_members` row for the group. Owner-only endpoints (group edit/delete, member
management) additionally check `owner_user_id`.

## 6. REST API

All JSON, cookie-authenticated except where noted. Pagination: `?limit=` + `?cursor=`,
returns `{items, nextCursor}`.

Auth: as in section 5.

Users:
- `PATCH /users/me` — name, email (requires `currentPassword`), password (requires `currentPassword`)
- `PUT /users/me/avatar` — multipart; returns `{avatarUrl}`
- `DELETE /users/me/avatar`

Groups:
- `GET /groups` — groups the user is a member of
- `POST /groups {name}` — returns group with auto-generated invite code
- `GET /groups/:id` — group + members
- `PATCH /groups/:id` — owner only
- `DELETE /groups/:id` — owner only, cascades
- `POST /groups/join {inviteCode}` — adds current user as member
- `GET /groups/:id/members`
- `POST /groups/:id/members {email}` — owner only; creates pending member row if no user exists
- `DELETE /groups/:id/members/:memberId` — owner only

Events:
- `GET /groups/:id/events?from=&to=`
- `POST /groups/:id/events`
- `PATCH /events/:id`
- `DELETE /events/:id`
- `PUT /events/:id/date {start}` — used by `moveEventDate`

Tags:
- `GET /groups/:id/tags`
- `POST /groups/:id/tags` — multipart, optional `image`
- `PATCH /tags/:id`
- `DELETE /tags/:id`

Calendar feeds:
- `GET /calendar-feeds/:groupId/:userId.ics` — **unauthenticated**, latest `.ics`; `Cache-Control: public, max-age=60`
- `PUT /calendar-feeds/:groupId/:userId.ics` — authenticated (any group member); rebuilds ICS from current events, overwrites MinIO object

Errors: status code + `{error: {code, message}}`. Codes: `unauthorized`, `forbidden`,
`not_found`, `validation_error`, `conflict`, `password_set_required`, `internal`.

## 7. Frontend client (apps/web)

- `src/lib/api.js` — one `apiFetch(path, {method, body, json, signal})`:
  - prefixes `VITE_API_URL`,
  - `credentials: 'include'`,
  - `json: true` sets `Content-Type: application/json` and stringifies,
  - `FormData` passed through (browser sets header),
  - parses JSON, throws `{code, message, status}` on non-2xx.
- `src/lib/services/{auth,users,groups,events,tags,calendarFeed}.js` — named functions
  calling `apiFetch`. Pinia stores call these.
- Stores keep their current shapes (`items`, `byId`, `fetchByGroup`, ...). Only bodies change.
- `src/composable/useSession.js` — thin wrapper around me/login/logout.
- `src/lib/liveCalendarFeed.js` — calls `PUT /calendar-feeds/...`, returns the API-minted public URL.
- `src/views/Join.vue` — switch from `databases.X` to the groups service.
- Login view: handle 401 `password_set_required` → "Check your email for a set-password link."

`vite.config.js`:
- Remove `/v1/account`, `/v1/databases`, `/v1/storage`, `/v1/functions` from `navigateFallbackDenylist`.
- Replace the `NetworkOnly` runtime URL pattern `^https://[a-zA-Z0-9.-]+/v1/.*` with the API origin.

## 8. Mail

`apps/api/src/mail.js`:
- `sendMail({to, subject, html, text})` via nodemailer.
- `MAIL_DEBUG=true` → `jsonTransport`; log preview line like
  `console.log('[mail] preview:', nodemailer.getTestMessageUrl(info))`. Does not send.
- `MAIL_DEBUG=false` + `MAIL_HOST` set → real SMTP transport built from flags.

Gmail example:
```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=<gmail-alias>
MAIL_PASSWORD=<app-password>
```

Emails sent: password reset, one-time set-password (section 8.1).

### 8.1 One-time set-password for migrated users

Migrated users have a random `password_hash` and `needs_password_set = true`.

On `POST /auth/login` with a `needs_password_set` user:
1. Verification fails; the API creates a `password_reset_tokens` row (1h expiry).
2. Emails a "welcome to Baobun — set your password" link.
3. Returns 401 `{code: "password_set_required"}`. Frontend shows a friendly message.

Idempotency: one email per user total — only trigger if the user has no unused,
unexpired token for `needs_password_set` on file; otherwise reuse it.

This avoids a batch send at cut-over (no Gmail throttling spike) and means day-one
friction is a single click per user. The `reset-password` page handles both reset and
first-time set via the same `POST /auth/reset` path.

## 9. Docker / infra

`docker-compose.yml` at repo root, four services:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: baobun
      POSTGRES_PASSWORD: baobun_dev
      POSTGRES_DB: baobun
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: baobun
      MINIO_ROOT_PASSWORD: baobun_dev
    volumes: [miniodata:/data]
    ports: ["9000:9000", "9001:9001"]

  api:
    build: ./apps/api
    env_file: ./apps/api/.env
    depends_on: [postgres, minio]
    ports: ["3001:3001"]

  mailpit:
    image: axllent/mailpit:latest
    ports: ["8025:8025", "1025:1025"]
```

`mailpit` is the local dev SMTP sink; prod removes it and sets `MAIL_HOST` to a real relay.
TLS termination (Caddy/nginx) is out of scope.

Buckets created at API startup (idempotent): `avatars` (private), `tag-icons` (private),
`calendar-feeds` (public read).

### apps/api/.env

```
DATABASE_URL=postgresql://baobun:baobun_dev@postgres:5432/baobun
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=baobun
S3_SECRET_KEY=baobun_dev
S3_BUCKET_AVATARS=avatars
S3_BUCKET_TAG_ICONS=tag-icons
S3_BUCKET_CALENDAR_FEEDS=calendar-feeds
S3_PUBLIC_ENDPOINT=http://localhost:9000

COOKIE_SECRET=<32B random>
WEB_ORIGIN=http://localhost:4173

MAIL_DEBUG=true
MAIL_SENDER="Baobun <no-reply@baobun.local>"
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_REJECT_SELF_SIGNED=false
MAIL_USER=
MAIL_PASSWORD=

PORT=3001
```

## 10. Migration (apps/api/scripts/migrate-from-appwrite.ts)

Reads Appwrite Cloud via the admin REST API (service-account API key):
`APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.

Order: users → groups → members → tags → events.

Per user:
- New UUID id, new random argon2 password hash, `needs_password_set = true`.
- Avatar file copied from Appwrite bucket → MinIO `avatars` with a new key; `avatar_object_key` saved.

Per group/member/tag/event: map foreign keys, copy tag-icon files to MinIO `tag-icons`.

Calendar feeds:
- Copy the existing `.ics` blobs to MinIO `calendar-feeds` **with the same object keys**
  produced by the new `getLiveFeedFileId` logic, so existing webcal subscriptions keep
  working after cut-over.
- Feeds are also regenerated on the next `PUT` from a member.

Idempotency: `--dry-run` flag prints count comparisons without writing; real run writes
`migration-report.json` with per-table counts.

Explicitly NOT migrated: password hashes (write-only in Appwrite), active sessions (cookie
domain), Appwrite-internal auth rate-limits.

## 11. Cut-over runbook (docs/runbooks/cutover.md)

1. Set Appwrite project read-only (Appwrite console) — stop writes.
2. Run `migrate-from-appwrite.ts --dry-run`; inspect counts.
3. Run it for real; verify `migration-report.json`.
4. Deploy new API + frontend.
5. Existing calendar-feed webcal subscriptions: preserved via same-key copies (section 10).
   If any object keys can't be reproduced, document re-subscribe.
6. Users log in → prompted for set-password link (section 8.1).

## 12. Testing

- `apps/api`: Vitest + supertest against ephemeral Postgres + MinIO. Cover register/login/
  logout, session expiry, password reset e2e (with `MAIL_DEBUG=true` capturing the token),
  lazy set-password on first login, group invite-code join, owner checks, member checks,
  calendar-feed regeneration.
- `apps/web`: Vitest store tests mocking `api.js` with msw; assert store behavior matches
  pre-migration behavior (regression insurance for the big-bang rewrite).
- Migration: round-trip — seed Appwrite (docker) + fresh Postgres + MinIO, run script, assert
  row counts and a sampled checksum per table.

## 13. Risks

- **Password hashes can't be migrated.** Appwrite does not expose them. Mitigated by lazy
  set-password link (section 8.1).
- **Session invalidation on cut-over.** Cookie domain changes; everyone logs in once.
- **Gmail throttling.** Avoided by lazy single-email-per-user send (no batch).
- **Calendar-feed URL stability.** Mitigated by same-key copies; residual risk documented.
- **Avatar privacy change.** Public bucket files become presigned URLs. No current consumer
  hotlinks them; safe.
- **PWA cache rules** in `vite.config.js` reference `/v1/*` — must be updated (section 7).
- **Email-change contract.** Preserve Appwrite's "current password required" behavior.

## 14. Out of scope

- OAuth / social login
- Real-time subscriptions
- Server-side push notifications
- DKIM/SPF for `MAIL_SENDER` domain (relay handles deliverability)
- Production TLS termination
- Multi-region / horizontal scaling

## 15. Deliverables

1. Monorepo scaffold: `apps/api` (Hono + Prisma + nodemailer + S3 SDK), `apps/web`,
   `packages/shared`, `infra/`.
2. `docker-compose.yml`, `apps/api/Dockerfile`, dev `.env`.
3. Rewritten `apps/web/src/lib/api.js`, `src/lib/services/*`, five Pinia stores, `Join.vue`,
   `liveCalendarFeed.js`, `useSession.js`, Login.vue handling for `password_set_required`.
4. `vite.config.js` cache-rule updates.
5. `apps/api/scripts/migrate-from-appwrite.ts`.
6. `docs/runbooks/cutover.md`.
7. Tests as described in section 12.
